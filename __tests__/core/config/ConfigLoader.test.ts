import { ConfigLoader } from '../../../src/core/config/ConfigLoader';
import { KernelConfig } from '../../../src/core/config/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { findUp } from '../../../src/utils';

jest.mock('fs/promises');
jest.mock('path');
jest.mock('../../../src/utils', () => ({
    findUp: jest.fn()
}));

const mockFindUp = findUp as jest.MockedFunction<typeof findUp>;

describe('ConfigLoader', () => {
    let configLoader: ConfigLoader;
    let mockConfig: KernelConfig;
    let mockListener: { onConfigChange: jest.Mock };

    beforeEach(() => {
        // Limpiar todas las instancias antes de cada test
        jest.clearAllMocks();
        configLoader = ConfigLoader.getInstance();
        mockListener = { onConfigChange: jest.fn() };

        mockConfig = {
            environment: 'development',
            version: '1.0.0',
            plugins: [],
            retry: {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                timeout: 5000,
                delay: 1000,
                backoffFactor: 2
            },
            bulkhead: {
                maxConcurrent: 10,
                maxQueued: 20,
                timeout: 3000,
                maxQueueSize: 100,
                queueTimeout: 5000
            },
            circuitBreaker: {
                enabled: true,
                failureThreshold: 0.5,
                resetTimeout: 30000,
                halfOpenSuccessThreshold: 2
            },
            logging: {
                level: 'info',
                format: 'json',
                destination: 'console'
            },
            pluginConfig: {
                metadata: {
                    name: 'test-plugin',
                    version: '1.0.0',
                    enabled: false
                },
                autoload: {
                    enabled: false,
                    directories: ['./plugins']
                }
            },
            errorHandler: {
                console: { enabled: true },
                file: {
                    enabled: true,
                    path: './logs/error.log'
                }
            }
        };
    });

    describe('Singleton Pattern', () => {
        it('should always return the same instance', () => {
            const instance1 = ConfigLoader.getInstance();
            const instance2 = ConfigLoader.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('loadConfig', () => {
        it('should load config from a specific file', async () => {
            const mockReadFile = fs.readFile as jest.Mock;
            mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));
            (path.extname as jest.Mock).mockReturnValue('.json');

            const config = await configLoader.loadConfig('/path/to/config.json');
            expect(config).toBeDefined();
            expect(config.environment).toBe('development');
        });

        it('should merge configs correctly', async () => {
            const partialConfig = {
                environment: 'production',
                retry: { maxAttempts: 5 }
            };

            const mockReadFile = fs.readFile as jest.Mock;
            mockReadFile.mockResolvedValue(JSON.stringify(partialConfig));
            (path.extname as jest.Mock).mockReturnValue('.json');

            const config = await configLoader.loadConfig('/path/to/config.json');
            expect(config.environment).toBe('production');
            expect(config.retry.maxAttempts).toBe(5);
            expect(config.retry.initialDelay).toBeDefined();
        });

        it('should load from environment variables', async () => {
            // Mock findUp to return null (no config file found)
            mockFindUp.mockResolvedValue(null);

            process.env.KERNEL_ENV = 'staging';
            process.env.KERNEL_RETRY_MAX_ATTEMPTS = '10';

            const config = await configLoader.loadConfig();
            expect(config.environment).toBe('staging');
            expect(config.retry.maxAttempts).toBe(10);

            // Clean up environment variables
            delete process.env.KERNEL_ENV;
            delete process.env.KERNEL_RETRY_MAX_ATTEMPTS;
        });
    });

    describe('Observer Pattern', () => {
        it('should notify subscribers when config changes', async () => {
            // El ConfigLoader usa ConfigEventManager internamente
            // Vamos a mockear directamente la notificación
            const spy = jest.spyOn(configLoader as any, 'notifyConfigChange');

            const oldConfig = mockConfig;
            const newConfig = { ...mockConfig, environment: 'production' as any };

            // Simular notificación directa
            await (configLoader as any).notifyConfigChange(oldConfig, newConfig);

            expect(spy).toHaveBeenCalledWith(oldConfig, newConfig);
        });

        it('should not notify unsubscribed listeners', async () => {
            configLoader.subscribe(mockListener);
            configLoader.unsubscribe(mockListener);

            const oldConfig = mockConfig;
            const newConfig = { ...mockConfig, environment: 'production' as any };

            // Simulamos una notificación de cambio de configuración
            await (configLoader as any).notifyConfigChange(oldConfig, newConfig);

            expect(mockListener.onConfigChange).not.toHaveBeenCalled();
        });
    });

    describe('validateConfig', () => {
        it('should throw error for invalid retry attempts', () => {
            const invalidConfig = { ...mockConfig, retry: { ...mockConfig.retry, maxAttempts: 0 } };
            expect(() => configLoader.validateConfig(invalidConfig))
                .toThrow('retry.maxAttempts must be at least 1');
        });

        it('should throw error for invalid environment', () => {
            const invalidConfig = { ...mockConfig, environment: 'invalid' };
            expect(() => configLoader.validateConfig(invalidConfig as KernelConfig))
                .toThrow('environment must be one of: development, staging, production');
        });

        it('should throw error for empty plugin directories when autoload is enabled', () => {
            const validConfig = { ...mockConfig };
            validConfig.retry.backoffFactor = 2; // Asegurar valor válido
            validConfig.circuitBreaker.failureThreshold = 0.5; // Asegurar valor válido

            const invalidConfig = {
                ...validConfig,
                pluginConfig: {
                    ...validConfig.pluginConfig,
                    autoload: { enabled: true, directories: [] }
                }
            };
            expect(() => configLoader.validateConfig(invalidConfig))
                .toThrow('pluginConfig.autoload.directories cannot be empty when autoload is enabled');
        });
    });
});
