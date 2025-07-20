import { BaseConfigLoader } from '../../../src/core/config/base/BaseConfigLoader';
import { KernelConfig } from '../../../src/core/config/types';
import { ConfigChangeListener } from '../../../src/core/config/interfaces/ConfigChangeListener';

// Clase concreta para testing
class TestConfigLoader extends BaseConfigLoader {
    public async loadConfig(): Promise<KernelConfig> {
        const config: KernelConfig = {
            environment: 'development',
            version: '',
            plugins: [],
            retry: {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                timeout: 5000,
                delay: 0,
                backoffFactor: 0
            },
            bulkhead: {
                maxConcurrent: 10,
                maxQueued: 20,
                timeout: 3000,
                maxQueueSize: 0,
                queueTimeout: 0
            },
            circuitBreaker: {
                enabled: true,
                failureThreshold: 5,
                resetTimeout: 30000,

                halfOpenSuccessThreshold: 0
            },
            logging: {
                level: 'info',
                format: 'json',
                destination: 'console'
            },
            pluginConfig: {
                metadata: {
                    name: '',
                    version: '1.0.0',
                    enabled: false
                },
                autoload: {
                    enabled: false,
                    directories: []
                }
            },
            errorHandler: {
                console: {
                    enabled: true
                    // level es opcional
                },
                file: {
                    enabled: true,
                    path: './logs/error.log'
                    // maxSize y maxFiles son opcionales
                }
                // metrics es opcional
            },

        };
        return config;
    }

    // Método para testing
    public testNotifyConfigChange(oldConfig: KernelConfig, newConfig: KernelConfig): void {
        this.notifyConfigChange(oldConfig, newConfig);
    }

    // Método para testing
    public testMergeConfigs(base: KernelConfig, override: Partial<KernelConfig>): KernelConfig {
        return this.mergeConfigs(base, override);
    }
}

describe('BaseConfigLoader', () => {
    let configLoader: TestConfigLoader;
    let mockListener1: ConfigChangeListener;
    let mockListener2: ConfigChangeListener;

    beforeEach(() => {
        configLoader = new TestConfigLoader();
        mockListener1 = {
            onConfigChange: jest.fn()
        };
        mockListener2 = {
            onConfigChange: jest.fn()
        };
    });

    describe('Observer Pattern', () => {
        it('should subscribe and notify listeners', async () => {
            configLoader.subscribe(mockListener1);
            configLoader.subscribe(mockListener2);

            const oldConfig = await configLoader.loadConfig();
            const newConfig = {
                ...oldConfig,
                environment: 'production' as const
            };

            configLoader.testNotifyConfigChange(oldConfig, newConfig);

            expect(mockListener1.onConfigChange).toHaveBeenCalledWith(oldConfig, newConfig);
            expect(mockListener2.onConfigChange).toHaveBeenCalledWith(oldConfig, newConfig);
        });

        it('should not notify unsubscribed listeners', async () => {
            configLoader.subscribe(mockListener1);
            configLoader.subscribe(mockListener2);
            configLoader.unsubscribe(mockListener2);

            const oldConfig = await configLoader.loadConfig();
            const newConfig = {
                ...oldConfig,
                environment: 'production' as const
            };

            configLoader.testNotifyConfigChange(oldConfig, newConfig);

            expect(mockListener1.onConfigChange).toHaveBeenCalled();
            expect(mockListener2.onConfigChange).not.toHaveBeenCalled();
        });

        it('should handle errors in listeners gracefully', async () => {
            const errorListener: ConfigChangeListener = {
                onConfigChange: () => {
                    throw new Error('Listener error');
                }
            };

            configLoader.subscribe(errorListener);
            configLoader.subscribe(mockListener1);

            const oldConfig = await configLoader.loadConfig();
            const newConfig = {
                ...oldConfig,
                environment: 'production' as const
            };

            // No debería lanzar error
            expect(() => {
                configLoader.testNotifyConfigChange(oldConfig, newConfig);
            }).not.toThrow();

            // El segundo listener debería ser llamado incluso si el primero falla
            expect(mockListener1.onConfigChange).toHaveBeenCalled();
        });
    });

    describe('Config Merging', () => {
        it('should merge configs correctly', async () => {
            const baseConfig = await configLoader.loadConfig();
            const base: KernelConfig = {
                ...baseConfig,
                environment: 'development',
                retry: {
                    ...baseConfig.retry,
                    maxAttempts: 3,
                    initialDelay: 100
                }
            };

            const override: Partial<KernelConfig> = {
                environment: 'production',
                retry: {
                    ...baseConfig.retry,
                    maxAttempts: 5
                }
            };

            const result = configLoader.testMergeConfigs(base, override);

            expect(result.environment).toBe('production');
            expect(result.retry.maxAttempts).toBe(5);
            expect(result.retry.initialDelay).toBe(100);
        });

        it('should handle undefined values in override', () => {
            const base = {
                environment: 'development',
                retry: { maxAttempts: 3 }
            };

            const override = {
                retry: undefined
            };

            const result = configLoader.testMergeConfigs(base as KernelConfig, override);

            expect(result).toEqual({
                environment: 'development',
                retry: { maxAttempts: 3 }
            });
        });
    });

    describe('Optional Properties', () => {
        it('should work with minimal valid config', async () => {
            const minimalConfig: KernelConfig = {
                environment: 'development',
                version: '',
                plugins: [],
                retry: {
                    maxAttempts: 3,
                    initialDelay: 100,
                    maxDelay: 1000,
                    timeout: 5000,
                    delay: 0,
                    backoffFactor: 0
                },
                bulkhead: {
                    maxConcurrent: 10,
                    maxQueued: 20,
                    timeout: 3000,
                    maxQueueSize: 0,
                    queueTimeout: 0
                },
                circuitBreaker: {
                    enabled: true,
                    failureThreshold: 5,
                    resetTimeout: 30000,
                    halfOpenSuccessThreshold: 0
                },
                logging: {},
                pluginConfig: {
                    metadata: {
                        name: '',
                        version: '1.0.0',
                        enabled: false
                    },
                    autoload: {
                        enabled: false,
                        directories: []
                    }
                },
                errorHandler: {
                    console: {
                        enabled: true
                    },
                    file: {
                        enabled: true,
                        path: './logs/error.log'
                    }
                }
            };

            // No debería lanzar error
            expect(() => {
                configLoader.validateConfig(minimalConfig);
            }).not.toThrow();
        });
    });

    describe('Base Validation', () => {
        it('should throw error for null config', () => {
            expect(() => {
                configLoader.validateConfig(null as any);
            }).toThrow('Configuration cannot be null or undefined');
        });

        it('should throw error for undefined config', () => {
            expect(() => {
                configLoader.validateConfig(undefined as any);
            }).toThrow('Configuration cannot be null or undefined');
        });
    });
});
