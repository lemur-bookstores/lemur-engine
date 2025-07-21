import { defaultKernelConfig, KernelConfig } from './types';
import { BaseConfigLoader } from './base/BaseConfigLoader';
import { findUp } from '../../utils';
import path from 'path';

// Implementación concreta del ConfigLoader
export class ConfigLoader extends BaseConfigLoader {
    private static instance: ConfigLoader;

    // Patrón Singleton para mantener compatibilidad con código existente
    public static getInstance(): ConfigLoader {
        if (!ConfigLoader.instance) {
            ConfigLoader.instance = new ConfigLoader();
        }
        return ConfigLoader.instance;
    }

    // Constructor privado para Singleton
    private constructor() {
        super();
    }

    // Método estático para mantener compatibilidad con código existente
    public static async loadConfig(configPath?: string): Promise<KernelConfig> {
        return ConfigLoader.getInstance().loadConfig(configPath);
    }

    // Implementación del método abstracto
    public async loadConfig(configPath?: string): Promise<KernelConfig> {
        let config = { ...defaultKernelConfig };

        // 1. Cargar configuración desde archivo
        if (configPath) {
            config = await this.loadFromFile(configPath, config);
        } else {
            // Buscar kernel.config.json usando findUp desde el directorio src
            const srcDir = path.resolve(__dirname, '../../..'); // Subir desde src/core/config hasta la raíz del proyecto
            const configFile = await findUp('kernel.config.json', srcDir);

            if (configFile) {
                try {
                    config = await this.loadFromFile(configFile, config);
                } catch (error) {
                    console.warn(`Failed to load config from ${configFile}:`, error);
                }
            } else {
                console.warn('kernel.config.json not found, using default configuration');
            }
        }

        // 2. Sobrescribir con variables de entorno
        config = this.loadFromEnvironment(config);

        // 3. Validar configuración
        this.validateConfig(config);

        return config;
    }

    private async loadFromFile(filePath: string, baseConfig: KernelConfig): Promise<KernelConfig> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            const ext = path.extname(filePath);
            const content = await fs.readFile(filePath, 'utf-8');

            let fileConfig: Partial<KernelConfig>;

            switch (ext) {
                case '.json':
                    fileConfig = JSON.parse(content);
                    break;
                case '.js':
                case '.ts':
                    // Para archivos JS/TS, usar import dinámico
                    const module = await import(path.resolve(filePath));
                    fileConfig = module.default || module;
                    break;
                default:
                    throw new Error(`Unsupported config file extension: ${ext}`);
            }

            return this.mergeConfigs(baseConfig, fileConfig);
        } catch (error) {
            throw new Error(`Failed to load config from ${filePath}: ${error}`);
        }
    }

    private loadFromEnvironment(config: KernelConfig): KernelConfig {
        const envConfig: Partial<KernelConfig> = {};

        // Mapear variables de entorno
        const envMappings = {
            'KERNEL_ENV': 'environment',
            'KERNEL_VERSION': 'version',

            // Retry config
            'KERNEL_RETRY_MAX_ATTEMPTS': 'retry.maxAttempts',
            'KERNEL_RETRY_DELAY': 'retry.delay',
            'KERNEL_RETRY_BACKOFF_FACTOR': 'retry.backoffFactor',
            'KERNEL_RETRY_RETRYABLE_ERRORS': 'retry.retryableErrors',

            // Bulkhead config
            'KERNEL_BULKHEAD_MAX_CONCURRENT': 'bulkhead.maxConcurrent',
            'KERNEL_BULKHEAD_MAX_QUEUE_SIZE': 'bulkhead.maxQueueSize',
            'KERNEL_BULKHEAD_QUEUE_TIMEOUT': 'bulkhead.queueTimeout',

            // Circuit breaker config
            'KERNEL_CIRCUIT_BREAKER_ENABLED': 'circuitBreaker.enabled',
            'KERNEL_CIRCUIT_BREAKER_FAILURE_THRESHOLD': 'circuitBreaker.failureThreshold',
            'KERNEL_CIRCUIT_BREAKER_RESET_TIMEOUT': 'circuitBreaker.resetTimeout',
            'KERNEL_CIRCUIT_BREAKER_HALF_OPEN_SUCCESS': 'circuitBreaker.halfOpenSuccessThreshold',

            // Logging config
            'KERNEL_LOG_LEVEL': 'logging.level',
            'KERNEL_LOG_FORMAT': 'logging.format',

            // Plugin config
            'KERNEL_PLUGIN_CONFIG_NAME': 'pluginConfig.metadata.name',
            'KERNEL_PLUGIN_CONFIG_VERSION': 'pluginConfig.metadata.version',
            'KERNEL_PLUGIN_CONFIG_ENABLED': 'pluginConfig.metadata.enabled',
            'KERNEL_PLUGIN_CONFIG_AUTOLOAD_ENABLED': 'pluginConfig.autoload.enabled',
            'KERNEL_PLUGIN_CONFIG_AUTOLOAD_DIRECTORIES': 'pluginConfig.autoload.directories',

            // Error handler config
            'KERNEL_ERROR_HANDLER_CONSOLE_ENABLED': 'errorHandler.console.enabled',
            'KERNEL_ERROR_HANDLER_FILE_ENABLED': 'errorHandler.file.enabled',
            'KERNEL_ERROR_HANDLER_FILE_PATH': 'errorHandler.file.path'
        };

        Object.entries(envMappings).forEach(([envVar, configPath]) => {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                this.setNestedProperty(envConfig, configPath, this.parseEnvValue(envValue));
            }
        });

        return this.mergeConfigs(config, envConfig);
    }

    private parseEnvValue(value: string): any {
        // Intentar parsear como JSON
        if (value.startsWith('[') || value.startsWith('{')) {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }

        // Parsear booleanos
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;

        // Parsear números
        const num = Number(value);
        if (!isNaN(num)) return num;

        return value;
    }

    private setNestedProperty(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    protected mergeConfigs(base: KernelConfig, override: Partial<KernelConfig>): KernelConfig {
        const result = { ...base };

        Object.entries(override).forEach(([key, value]) => {
            if (value !== undefined) {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Merge recursivo para objetos
                    result[key as keyof KernelConfig] = {
                        ...result[key as keyof KernelConfig] as any,
                        ...value
                    } as any;
                } else {
                    result[key as keyof KernelConfig] = value as any;
                }
            }
        });

        return result;
    }

    public validateConfig(config: KernelConfig): void {
        // Llamar a la validación de la clase base
        super.validateConfig(config);

        // Validar environment
        if (!['development', 'staging', 'production'].includes(config.environment)) {
            throw new Error('environment must be one of: development, staging, production');
        }

        // Validar version
        if (!config.version) {
            throw new Error('version must be specified');
        }

        // Validaciones de retry (si está configurado)
        if (config.retry) {
            if (config.retry.maxAttempts < 1) {
                throw new Error('retry.maxAttempts must be at least 1');
            }
            if (config.retry.delay < 0) {
                throw new Error('retry.delay must be non-negative');
            }
            if (config.retry.backoffFactor < 1) {
                throw new Error('retry.backoffFactor must be at least 1');
            }
        }

        // Validaciones de bulkhead (si está configurado)
        if (config.bulkhead) {
            if (config.bulkhead.maxConcurrent < 1) {
                throw new Error('bulkhead.maxConcurrent must be at least 1');
            }
            if (config.bulkhead.maxQueueSize < 0) {
                throw new Error('bulkhead.maxQueueSize must be non-negative');
            }
            if (config.bulkhead.queueTimeout < 0) {
                throw new Error('bulkhead.queueTimeout must be non-negative');
            }
        }

        // Validaciones de circuit breaker (si está configurado)
        if (config.circuitBreaker) {
            if (config.circuitBreaker.failureThreshold < 0) {
                throw new Error('circuitBreaker.failureThreshold must be between 0 and 1');
            }
            if (config.circuitBreaker.resetTimeout < 0) {
                throw new Error('circuitBreaker.resetTimeout must be non-negative');
            }
            if (config.circuitBreaker.halfOpenSuccessThreshold < 1) {
                throw new Error('circuitBreaker.halfOpenSuccessThreshold must be at least 1');
            }
        }

        // Validar configuración de plugins
        if (config.pluginConfig?.autoload?.enabled) {
            if (!config.pluginConfig.autoload.directories || config.pluginConfig.autoload.directories.length === 0) {
                throw new Error('pluginConfig.autoload.directories cannot be empty when autoload is enabled');
            }
        }
    }
}