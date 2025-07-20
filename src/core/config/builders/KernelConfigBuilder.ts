import {
    KernelConfig,
    RetryConfig,
    BulkheadConfig,
    CircuitBreakerConfig,
    LoggingConfig,
    PluginConfig,
    PluginMetadata,
    ConsoleHandlerConfig,
    FileHandlerConfig
} from '../types';
import { DEFAULT_BULKHEAD_CONFIG, DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_RETRY_CONFIG } from '../defaults';

export class KernelConfigBuilder {
    private config: Partial<KernelConfig> = {
        environment: 'development',
        version: '1.0.0',
        retry: DEFAULT_RETRY_CONFIG,
        bulkhead: DEFAULT_BULKHEAD_CONFIG,
        circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
        logging: {},
        plugins: [],
        pluginConfig: {
            metadata: {
                name: 'default',
                version: '1.0.0',
                enabled: true
            },
            autoload: {
                enabled: true,
                directories: []
            }
        },
        errorHandler: {
            console: {
                enabled: true
            },
            file: {
                enabled: false,
                path: './logs/error.log'
            }
        }
    };

    // Environment
    public setEnvironment(env: 'development' | 'staging' | 'production'): this {
        this.config.environment = env;
        return this;
    }

    // Retry Configuration
    public configureRetry(config: Partial<Omit<RetryConfig, 'maxAttempts' | 'initialDelay' | 'maxDelay' | 'timeout'>> & Pick<RetryConfig, 'maxAttempts' | 'initialDelay' | 'maxDelay' | 'timeout'>): this {
        const currentConfig = this.config.retry as RetryConfig;
        this.config.retry = { ...currentConfig, ...config };
        return this;
    }

    // Bulkhead Configuration
    public configureBulkhead(config: Partial<Omit<BulkheadConfig, 'maxConcurrent' | 'maxQueued' | 'timeout'>> & Pick<BulkheadConfig, 'maxConcurrent' | 'maxQueued' | 'timeout'>): this {
        const currentConfig = this.config.bulkhead as BulkheadConfig;
        this.config.bulkhead = { ...currentConfig, ...config };
        return this;
    }

    // Circuit Breaker Configuration
    public configureCircuitBreaker(config: Partial<Omit<CircuitBreakerConfig, 'enabled' | 'failureThreshold' | 'resetTimeout'>> & Pick<CircuitBreakerConfig, 'enabled' | 'failureThreshold' | 'resetTimeout'>): this {
        const currentConfig = this.config.circuitBreaker as CircuitBreakerConfig;
        this.config.circuitBreaker = { ...currentConfig, ...config };
        return this;
    }

    // Logging Configuration
    public configureLogging(config: Partial<LoggingConfig>): this {
        this.config.logging = { ...this.config.logging, ...config };
        return this;
    }

    // Plugin Configuration
    public configurePluginSystem(config: Partial<PluginConfig>): this {
        this.config.pluginConfig = {
            ...this.config.pluginConfig as PluginConfig,
            ...config as PluginConfig
        };
        return this;
    }

    public addPlugin(plugin: PluginMetadata): this {
        if (!this.config.plugins) {
            this.config.plugins = [];
        }
        this.config.plugins.push(plugin);
        return this;
    }

    public setPlugins(plugins: PluginMetadata[]): this {
        this.config.plugins = [...plugins];
        return this;
    }

    // Error Handler Configuration
    public configureErrorHandler(
        console: Partial<Omit<ConsoleHandlerConfig, 'enabled'>> & Pick<ConsoleHandlerConfig, 'enabled'>,
        file?: Partial<Omit<FileHandlerConfig, 'enabled' | 'path'>> & Pick<FileHandlerConfig, 'enabled' | 'path'>
    ): this {
        const currentHandler = this.config.errorHandler!;

        currentHandler.console = {
            ...currentHandler.console,
            ...console
        } as ConsoleHandlerConfig;

        if (file) {
            currentHandler.file = {
                ...currentHandler.file,
                ...file
            } as FileHandlerConfig;
        }

        return this;
    }

    // Helper methods for common configurations
    public enableDebugMode(): this {
        return this
            .setEnvironment('development')
            .configureLogging({
                level: 'debug',
                format: 'json',
                destination: 'console'
            })
            .configureErrorHandler(
                { enabled: true, level: 'debug' },
                { enabled: true, path: './logs/debug.log' }
            );
    }

    public enableProductionMode(): this {
        return this
            .setEnvironment('production')
            .configureLogging({
                level: 'info',
                format: 'json',
                destination: 'file'
            })
            .configureErrorHandler(
                { enabled: true, level: 'error' },
                {
                    enabled: true,
                    path: './logs/error.log',
                    maxSize: '100mb',
                    maxFiles: 10
                }
            )
            .configureCircuitBreaker({
                enabled: true,
                failureThreshold: 10,
                resetTimeout: 30000,
                halfOpenSuccessThreshold: 5,
                monitoringPeriod: 5000
            });
    }

    public build(): KernelConfig {
        // Validar las propiedades requeridas
        if (!this.config.environment) {
            throw new Error('Environment must be specified');
        }
        if (!this.config.version) {
            throw new Error('Version must be specified');
        }

        // Asegurarse de que los arrays estén inicializados
        if (!this.config.plugins) {
            this.config.plugins = [];
        }

        // Asegurarse de que la configuración del plugin tenga los valores requeridos
        if (this.config.pluginConfig) {
            if (!this.config.pluginConfig.metadata) {
                this.config.pluginConfig.metadata = {
                    name: 'default',
                    version: '1.0.0',
                    enabled: true
                };
            }
            if (!this.config.pluginConfig.autoload) {
                this.config.pluginConfig.autoload = {
                    enabled: true,
                    directories: []
                };
            }
        }

        return this.config as KernelConfig;
    }

    // Factory method for common configurations
    public static development(): KernelConfigBuilder {
        return new KernelConfigBuilder().enableDebugMode();
    }

    public static production(): KernelConfigBuilder {
        return new KernelConfigBuilder().enableProductionMode();
    }

    public static staging(): KernelConfigBuilder {
        return new KernelConfigBuilder()
            .setEnvironment('staging')
            .configureLogging({
                level: 'info',
                format: 'json',
                destination: 'both'
            });
    }
}
