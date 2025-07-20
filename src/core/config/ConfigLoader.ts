import { defaultKernelConfig, KernelConfig } from './types';

// 3. Loader de configuración
export class ConfigLoader {
    private static readonly CONFIG_PATHS = [
        './config/kernel.json',
        './config/kernel.js',
        './config/kernel.ts',
        './kernel.config.json',
        './kernel.config.js',
        './kernel.config.ts'
    ];

    static async loadConfig(configPath?: string): Promise<KernelConfig> {
        let config = { ...defaultKernelConfig };

        // 1. Cargar configuración desde archivo
        if (configPath) {
            config = await this.loadFromFile(configPath, config);
        } else {
            // Buscar archivos de configuración en orden de prioridad
            for (const path of this.CONFIG_PATHS) {
                try {
                    config = await this.loadFromFile(path, config);
                    break;
                } catch (error) {
                    // Continuar buscando si el archivo no existe
                    continue;
                }
            }
        }

        // 2. Sobrescribir con variables de entorno
        config = this.loadFromEnvironment(config);

        // 3. Validar configuración
        this.validateConfig(config);

        return config;
    }

    private static async loadFromFile(filePath: string, baseConfig: KernelConfig): Promise<KernelConfig> {
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

    private static loadFromEnvironment(config: KernelConfig): KernelConfig {
        const envConfig: Partial<KernelConfig> = {};

        // Mapear variables de entorno
        const envMappings = {
            'KERNEL_ENV': 'environment',
            'KERNEL_RETRY_MAX_ATTEMPTS': 'retry.maxAttempts',
            'KERNEL_RETRY_INITIAL_DELAY': 'retry.initialDelay',
            'KERNEL_RETRY_MAX_DELAY': 'retry.maxDelay',
            'KERNEL_RETRY_TIMEOUT': 'retry.timeout',
            'KERNEL_BULKHEAD_MAX_CONCURRENT': 'bulkhead.maxConcurrent',
            'KERNEL_BULKHEAD_MAX_QUEUED': 'bulkhead.maxQueued',
            'KERNEL_BULKHEAD_TIMEOUT': 'bulkhead.timeout',
            'KERNEL_CIRCUIT_BREAKER_ENABLED': 'circuitBreaker.enabled',
            'KERNEL_CIRCUIT_BREAKER_FAILURE_THRESHOLD': 'circuitBreaker.failureThreshold',
            'KERNEL_CIRCUIT_BREAKER_RESET_TIMEOUT': 'circuitBreaker.resetTimeout',
            'KERNEL_LOG_LEVEL': 'logging.level',
            'KERNEL_LOG_FORMAT': 'logging.format',
            'KERNEL_PLUGIN_AUTOLOAD_ENABLED': 'plugin.autoload.enabled',
            'KERNEL_PLUGIN_AUTOLOAD_DIRECTORIES': 'plugin.autoload.directories',
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

    private static parseEnvValue(value: string): any {
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

    private static setNestedProperty(obj: any, path: string, value: any): void {
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

    static mergeConfigs(base: KernelConfig, override: Partial<KernelConfig>): KernelConfig {
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

    static validateConfig(config: KernelConfig): void {
        // Validaciones básicas
        if (config.retry.maxAttempts < 1) {
            throw new Error('retry.maxAttempts must be at least 1');
        }

        if (config.retry.initialDelay < 0) {
            throw new Error('retry.initialDelay must be non-negative');
        }

        if (config.bulkhead.maxConcurrent < 1) {
            throw new Error('bulkhead.maxConcurrent must be at least 1');
        }

        if (config.bulkhead.maxQueued < 0) {
            throw new Error('bulkhead.maxQueued must be non-negative');
        }

        if (config.circuitBreaker.failureThreshold < 1) {
            throw new Error('circuitBreaker.failureThreshold must be at least 1');
        }

        if (!['development', 'staging', 'production'].includes(config.environment)) {
            throw new Error('environment must be one of: development, staging, production');
        }

        // Validar directorios de plugins
        if (config.plugin.autoload.enabled && config.plugin.autoload.directories.length === 0) {
            throw new Error('plugin.autoload.directories cannot be empty when autoload is enabled');
        }
    }
}