import { ConfigLoader } from '../../../src/core/config/ConfigLoader';
import { KernelConfig } from '../../../src/core/config/types';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');
jest.mock('path');

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
                format: 'json'
            },
            pluginConfig: {
                metadata: {
                    name: '-plugin',
                    version: '1.0.0',
                    enabled: false
                },
                autoload: {
                    enabled: true,
                    directories: []
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
            (path.resolve as jest.Mock).mockReturnValue('/test/config.json');

            const config = await configLoader.loadConfig('config.json');
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

            const config = await configLoader.loadConfig('config.json');
            expect(config.environment).toBe('production');
            expect(config.retry.maxAttempts).toBe(5);
            expect(config.retry.initialDelay).toBeDefined();
        });

        it('should load from environment variables', async () => {
            process.env.KERNEL_ENV = 'staging';
            process.env.KERNEL_RETRY_MAX_ATTEMPTS = '10';

            const config = await configLoader.loadConfig();
            expect(config.environment).toBe('staging');
            expect(config.retry.maxAttempts).toBe(10);
        });
    });

    describe('Observer Pattern', () => {
        it('should notify subscribers when config changes', async () => {
            configLoader.subscribe(mockListener);

            const mockReadFile = fs.readFile as jest.Mock;
            mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));
            (path.extname as jest.Mock).mockReturnValue('.json');

            await configLoader.loadConfig('config.json');

            expect(mockListener.onConfigChange).toHaveBeenCalled();
        });

        it('should not notify unsubscribed listeners', async () => {
            configLoader.subscribe(mockListener);
            configLoader.unsubscribe(mockListener);

            const mockReadFile = fs.readFile as jest.Mock;
            mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));
            (path.extname as jest.Mock).mockReturnValue('.json');

            await configLoader.loadConfig('config.json');

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
            const invalidConfig = {
                ...mockConfig,
                plugin: { autoload: { enabled: true, directories: [] } }
            };
            expect(() => configLoader.validateConfig(invalidConfig))
                .toThrow('plugin.autoload.directories cannot be empty when autoload is enabled');
        });
    });
});
