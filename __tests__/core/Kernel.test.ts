import { Kernel } from '../../src/core/Kernel';
import { EventBus } from '../../src/core/EventBus';
import { PluginRegistry } from '../../src/core/PluginManager';
import { ServiceContainer } from '../../src/core/ServiceContainer';
import { ConfigManager } from '../../src/core/ConfigManager';
import { KernelState } from '../../src/core/KernelState';
import { Plugin, PluginStatus, PluginMetadata } from '../../src/core/plugins/PluginInterfaces';
import { defaultKernelConfig } from '../../src/core/config/types';

// Mock de plugin para testing
class MockPlugin implements Plugin {
    metadata: PluginMetadata = {
        name: 'test-plugin',
        version: '1.0.0',
        dependencies: [],
        description: 'Test plugin for unit testing'
    };
    
    private _status: PluginStatus = PluginStatus.INACTIVE;

    async initialize(_kernel: Kernel): Promise<void> {
        this._status = PluginStatus.ACTIVE;
    }

    async shutdown(): Promise<void> {
        this._status = PluginStatus.INACTIVE;
    }

    status(): PluginStatus {
        return this._status;
    }

    hooks = {
        onBeforeInitialize: jest.fn(),
        onAfterInitialize: jest.fn(),
        onBeforeShutdown: jest.fn(),
        onAfterShutdown: jest.fn(),
        onError: jest.fn(),
        onStatusChange: jest.fn()
    };
}

describe('Kernel', () => {
    let kernel: Kernel;
    let mockPlugin: MockPlugin;

    beforeEach(() => {
        kernel = new Kernel();
        mockPlugin = new MockPlugin();
    });

    afterEach(async () => {
        const currentState = kernel.getState();
        if (currentState === KernelState.RUNNING || currentState === KernelState.MAINTENANCE) {
            await kernel.shutdown();
        }
    });

    describe('Constructor', () => {
        it('should create kernel with default config', () => {
            const kernel = new Kernel();
            expect(kernel).toBeInstanceOf(Kernel);
            expect(kernel.getConfig()).toEqual(defaultKernelConfig);
        });

        it('should create kernel with custom config', () => {
            const customConfig = {
                ...defaultKernelConfig,
                environment: 'development' as const
            };
            const kernel = new Kernel(customConfig);
            expect(kernel.getConfig().environment).toBe('development');
        });

        it('should initialize all core components', () => {
            expect(kernel.getEventBus()).toBeInstanceOf(EventBus);
            expect(kernel.getPluginRegistry()).toBeInstanceOf(PluginRegistry);
            expect(kernel.getServiceContainer()).toBeInstanceOf(ServiceContainer);
            expect(kernel.getConfigManager()).toBeInstanceOf(ConfigManager);
        });
    });

    describe('Static create method', () => {
        it('should create kernel with external config', async () => {
            const kernel = await Kernel.create();
            expect(kernel).toBeInstanceOf(Kernel);
        });
    });

    describe('Plugin Management', () => {
        it('should register plugin', () => {
            kernel.registerPlugin(mockPlugin);
            const plugins = kernel.getPlugins();
            expect(plugins.has('test-plugin')).toBe(true);
            expect(plugins.get('test-plugin')).toBe(mockPlugin);
        });

        it('should initialize plugins in correct order', async () => {
            kernel.registerPlugin(mockPlugin);
            
            await kernel.initialize();
            
            expect(mockPlugin.hooks.onBeforeInitialize).toHaveBeenCalled();
            expect(mockPlugin.hooks.onAfterInitialize).toHaveBeenCalled();
            expect(mockPlugin.status()).toBe(PluginStatus.ACTIVE);
        });

        it('should shutdown plugins in reverse order', async () => {
            kernel.registerPlugin(mockPlugin);
            await kernel.initialize();
            
            await kernel.shutdown();
            
            expect(mockPlugin.hooks.onBeforeShutdown).toHaveBeenCalled();
            expect(mockPlugin.hooks.onAfterShutdown).toHaveBeenCalled();
            expect(mockPlugin.status()).toBe(PluginStatus.INACTIVE);
        });

        it('should handle plugin initialization errors', async () => {
            const errorPlugin = new MockPlugin();
            errorPlugin.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));
            kernel.registerPlugin(errorPlugin);

            await expect(kernel.initialize()).rejects.toThrow('Init failed');
        });
    });

    describe('Initialization', () => {
        it('should initialize successfully', async () => {
            await kernel.initialize();
            expect(kernel.getState()).toBe(KernelState.RUNNING);
        });

        it('should throw error if already initialized', async () => {
            await kernel.initialize();
            await expect(kernel.initialize()).rejects.toThrow('Kernel already initialized');
        });

        it('should publish initialization events', async () => {
            const eventSpy = jest.spyOn(kernel.getEventBus(), 'publish');
            
            await kernel.initialize();
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'kernel.initialized'
                })
            );
        });
    });

    describe('Shutdown', () => {
        it('should shutdown gracefully', async () => {
            await kernel.initialize();
            await kernel.shutdown();
            expect(kernel.getState()).toBe(KernelState.SHUTTING_DOWN);
        });

        it('should handle shutdown when not initialized', async () => {
            await expect(kernel.shutdown()).resolves.not.toThrow();
        });

        it('should publish shutdown events', async () => {
            await kernel.initialize();
            const eventSpy = jest.spyOn(kernel.getEventBus(), 'publish');
            
            await kernel.shutdown();
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'kernel.shutdown'
                })
            );
        });
    });

    describe('Event Management', () => {
        it('should publish events', async () => {
            const eventSpy = jest.spyOn(kernel.getEventBus(), 'publish');
            
            await kernel.publishEvent({
                type: 'test.event',
                payload: { test: true },
                source: 'test'
            });
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'test.event',
                    payload: { test: true },
                    source: 'test'
                })
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle errors through error handler', async () => {
            const error = new Error('Test error');
            const errorHandlerSpy = jest.spyOn(kernel['errorHandler'], 'handleError');
            
            await kernel.handleError(error);
            
            expect(errorHandlerSpy).toHaveBeenCalledWith(error);
        });
    });

    describe('State Management', () => {
        it('should enter maintenance mode when running', async () => {
            await kernel.initialize();
            // Esperar a que el kernel esté completamente en estado RUNNING
            expect(kernel.getState()).toBe(KernelState.RUNNING);
            
            await kernel.enterMaintenance();
            
            expect(kernel.getState()).toBe(KernelState.MAINTENANCE);
        });

        it('should exit maintenance mode when in maintenance', async () => {
            await kernel.initialize();
            expect(kernel.getState()).toBe(KernelState.RUNNING);
            
            await kernel.enterMaintenance();
            expect(kernel.getState()).toBe(KernelState.MAINTENANCE);
            
            await kernel.exitMaintenance();
            
            expect(kernel.getState()).toBe(KernelState.RUNNING);
        });

        it('should return current state', () => {
            const state = kernel.getState();
            expect(Object.values(KernelState)).toContain(state);
        });
    });

    describe('Configuration Management', () => {
        it('should update configuration', async () => {
            const newConfig = { environment: 'production' as const };
            
            await kernel.updateConfig(newConfig);
            
            expect(kernel.getConfig().environment).toBe('production');
        });

        it('should publish config update events', async () => {
            const eventSpy = jest.spyOn(kernel.getEventBus(), 'publish');
            
            await kernel.updateConfig({ environment: 'production' as const });
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'kernel.config.updated'
                })
            );
        });
    });

    describe('Service Access', () => {
        it('should provide access to core services', () => {
            expect(kernel.getEventBus()).toBeDefined();
            expect(kernel.getPluginRegistry()).toBeDefined();
            expect(kernel.getServiceContainer()).toBeDefined();
            expect(kernel.getConfigManager()).toBeDefined();
            expect(kernel.getMediator()).toBeDefined();
            expect(kernel.getConfigurationManager()).toBeDefined();
            expect(kernel.getStateManager()).toBeDefined();
            expect(kernel.getRetryHandler()).toBeDefined();
            expect(kernel.getBulkhead()).toBeDefined();
        });
    });

    describe('Resilience Patterns', () => {
        it('should have retry handler configured', () => {
            const retryHandler = kernel.getRetryHandler();
            expect(retryHandler).toBeDefined();
        });

        it('should have bulkhead configured', () => {
            const bulkhead = kernel.getBulkhead();
            expect(bulkhead).toBeDefined();
        });
    });
});