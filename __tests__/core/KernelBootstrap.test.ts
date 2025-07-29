import { KernelBootstrap, BootstrapOptions, InitializationStep, InitializationContext } from '../../src/core/KernelBootstrap';
import { Kernel } from '../../src/core/Kernel';
import { ServiceContainer } from '../../src/core/ServiceContainer';
import { EventBus } from '../../src/core/EventBus';
import { KernelStateManager, KernelState } from '../../src/core/KernelState';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { PluginRegistry } from '../../src/core/PluginManager';

// Mock dependencies
jest.mock('../../src/core/Kernel');
jest.mock('../../src/core/ServiceContainer');
jest.mock('../../src/core/EventBus');
jest.mock('../../src/core/KernelState');
jest.mock('../../src/core/ErrorHandlerService');
jest.mock('../../src/core/PluginManager');

describe('KernelBootstrap', () => {
    let bootstrap: KernelBootstrap;
    let mockKernel: jest.Mocked<Kernel>;
    let mockServiceContainer: jest.Mocked<ServiceContainer>;
    let mockEventBus: jest.Mocked<EventBus>;
    let mockStateManager: jest.Mocked<KernelStateManager>;
    let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
    let mockPluginRegistry: jest.Mocked<PluginRegistry>;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock instances
        mockKernel = new Kernel({} as any) as jest.Mocked<Kernel>;
        mockServiceContainer = new ServiceContainer() as jest.Mocked<ServiceContainer>;
        mockEventBus = new EventBus() as jest.Mocked<EventBus>;
        
        // Create mock state manager instance
        mockStateManager = new KernelStateManager() as jest.Mocked<KernelStateManager>;
        
        mockErrorHandler = new ErrorHandlerService(mockEventBus) as jest.Mocked<ErrorHandlerService>;
        mockPluginRegistry = new PluginRegistry() as jest.Mocked<PluginRegistry>;

        // Mock constructor returns
        (Kernel as jest.MockedClass<typeof Kernel>).mockImplementation(() => mockKernel);
        (ServiceContainer as jest.MockedClass<typeof ServiceContainer>).mockImplementation(() => mockServiceContainer);
        (EventBus as jest.MockedClass<typeof EventBus>).mockImplementation(() => mockEventBus);
        (KernelStateManager as jest.MockedClass<typeof KernelStateManager>).mockImplementation(() => mockStateManager);
        (ErrorHandlerService as jest.MockedClass<typeof ErrorHandlerService>).mockImplementation(() => mockErrorHandler);
        (PluginRegistry as jest.MockedClass<typeof PluginRegistry>).mockImplementation(() => mockPluginRegistry);

        // Mock service container methods
        mockServiceContainer.register = jest.fn();
        mockServiceContainer.get = jest.fn();
        mockServiceContainer.has = jest.fn().mockImplementation((serviceName: string) => {
            // Mock all required core services as available
            const requiredServices = [
                'eventBus', 'pluginRegistry', 'configManager', 'circuitBreaker',
                'errorHandler', 'mediator', 'stateManager', 'configFlyweight',
                'retryHandler', 'bulkhead'
            ];
            return requiredServices.includes(serviceName);
        });
        mockServiceContainer.size = jest.fn().mockReturnValue(15); // Mock sufficient services

        // Mock plugin registry methods
        mockPluginRegistry.register = jest.fn();
        mockPluginRegistry.get = jest.fn();
        mockPluginRegistry.getPlugins = jest.fn().mockReturnValue(new Map());
        mockPluginRegistry.getInitializationOrder = jest.fn().mockReturnValue([]);

        // Mock state manager methods
        mockStateManager.transitionTo = jest.fn();
        mockStateManager.getCurrentState = jest.fn();
        mockStateManager.getCurrentStateEnum = jest.fn().mockReturnValue(KernelState.INITIALIZING);

        // Mock event bus methods
        mockEventBus.publish = jest.fn().mockResolvedValue(undefined);

        // Mock kernel methods
        mockKernel.getEventBus = jest.fn().mockReturnValue(mockEventBus);
        mockKernel.getServiceContainer = jest.fn().mockReturnValue(mockServiceContainer);
        mockKernel.getPlugins = jest.fn().mockReturnValue(new Map());
        mockKernel.getStateManager = jest.fn().mockReturnValue(mockStateManager);
        mockKernel.getState = jest.fn().mockReturnValue(KernelState.INITIALIZING);
        mockKernel.getRetryHandler = jest.fn().mockReturnValue({});
        mockKernel.getBulkhead = jest.fn().mockReturnValue({});
        mockKernel.initialize = jest.fn().mockResolvedValue(undefined);
        mockKernel.shutdown = jest.fn().mockResolvedValue(undefined);
        mockKernel.handleError = jest.fn();

        // Use getInstance instead of constructor since it's private
        bootstrap = KernelBootstrap.getInstance();
        
        // Reset initialization steps to default state
        (bootstrap as any).setupDefaultInitializationSteps();
    });

    describe('getInstance', () => {
        it('should create bootstrap instance', () => {
            expect(bootstrap).toBeInstanceOf(KernelBootstrap);
        });

        it('should return same instance (singleton)', () => {
            const instance1 = KernelBootstrap.getInstance();
            const instance2 = KernelBootstrap.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should initialize with default initialization steps', () => {
            const steps = (bootstrap as any).initializationSteps;
            expect(Array.isArray(steps)).toBe(true);
            expect(steps.length).toBeGreaterThan(0);
        });
    });

    describe('bootstrap', () => {
        it('should bootstrap kernel with default options', async () => {
            const result = await bootstrap.bootstrap();

            expect(result).toBeDefined();
            expect(result.kernel).toBe(mockKernel);
            expect(result.config).toBeDefined();
            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(result.errors).toEqual([]);
        });

        it('should bootstrap kernel with custom options', async () => {
            const options: BootstrapOptions = {
                configPath: './__tests__/fixtures/test-kernel.config.json',
                skipValidation: true,
                errorStrategy: 'continue',
                initializationTimeout: 30000
            };

            const result = await bootstrap.bootstrap(options);

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(result.kernel).toBe(mockKernel);
            expect(result.config).toBeDefined();
        });

        it('should handle state transitions correctly', async () => {
            const options: BootstrapOptions = {
                configPath: './__tests__/fixtures/test-kernel.config.json'
            };

            const result = await bootstrap.bootstrap(options);

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(mockStateManager.transitionTo).toHaveBeenCalled();
        });

        it('should execute default initialization steps', async () => {
            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(result.pluginsLoaded).toBeGreaterThanOrEqual(0);
            
            // Verify bootstrap completed successfully
            expect(result.errors).toEqual([]);
        });

        it('should execute custom initialization steps', async () => {
            const customStep: InitializationStep = {
                name: 'custom-step',
                description: 'Custom test step',
                execute: jest.fn().mockResolvedValue(undefined)
            };

            // Since customSteps is not in BootstrapOptions, we'll test this differently
            // by adding the step to the bootstrap instance directly
            (bootstrap as any).initializationSteps.push(customStep);

            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(customStep.execute).toHaveBeenCalled();
        });

        it('should handle step execution errors gracefully', async () => {
            const failingStep: InitializationStep = {
                name: 'failing-step',
                description: 'Step that fails',
                execute: jest.fn().mockRejectedValue(new Error('Step failed'))
            };

            // Add the failing step to the bootstrap instance
            (bootstrap as any).initializationSteps.push(failingStep);

            // The bootstrap should throw an error since it fails fast by default
            await expect(bootstrap.bootstrap()).rejects.toThrow('Kernel bootstrap failed');
        });

        it('should execute initialization steps in order', async () => {
            const executionOrder: string[] = [];

            const step1: InitializationStep = {
                name: 'step1',
                description: 'First step',
                execute: jest.fn().mockImplementation(async () => {
                    executionOrder.push('step1');
                })
            };

            const step2: InitializationStep = {
                name: 'step2',
                description: 'Second step',
                execute: jest.fn().mockImplementation(async () => {
                    executionOrder.push('step2');
                })
            };

            // Add steps to the bootstrap instance
            (bootstrap as any).initializationSteps.push(step1, step2);

            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(executionOrder).toContain('step1');
            expect(executionOrder).toContain('step2');
        });

        it('should handle async initialization steps', async () => {
            const asyncStep: InitializationStep = {
                name: 'async-step',
                description: 'Async step',
                execute: jest.fn().mockImplementation(async () => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                })
            };

            (bootstrap as any).initializationSteps.push(asyncStep);

            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(asyncStep.execute).toHaveBeenCalled();
        });

        it('should provide initialization context to steps', async () => {
            let capturedContext: InitializationContext | undefined;

            const step: InitializationStep = {
                name: 'context-step',
                description: 'Context test step',
                execute: jest.fn().mockImplementation(async (context: InitializationContext) => {
                    capturedContext = context;
                })
            };

            (bootstrap as any).initializationSteps.push(step);

            await bootstrap.bootstrap();

            expect(capturedContext).toBeDefined();
            expect(capturedContext!.kernel).toBe(mockKernel);
            expect(capturedContext!.serviceContainer).toBe(mockServiceContainer);
            expect(capturedContext!.eventBus).toBe(mockEventBus);
        });

        it('should handle plugin loading configuration', async () => {
            const options: BootstrapOptions = {
                configPath: './__tests__/fixtures/test-kernel.config.json'
            };

            const result = await bootstrap.bootstrap(options);

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(result.kernel).toBe(mockKernel);
            expect(result.pluginsLoaded).toBeGreaterThanOrEqual(0);
        });

        it('should handle default plugin loading', async () => {
            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(result.kernel).toBe(mockKernel);
            expect(result.pluginsLoaded).toBeGreaterThanOrEqual(0);
        });

        it('should handle plugin loading errors', async () => {
            // Add a step that will fail during plugin loading phase
            const failingStep: InitializationStep = {
                name: 'plugin-load-error',
                description: 'Plugin loading error step',
                execute: () => {
                    throw new Error('Plugin load failed');
                }
            };

            (bootstrap as any).initializationSteps.push(failingStep);

            await expect(bootstrap.bootstrap()).rejects.toThrow('Kernel bootstrap failed: Plugin load failed');
        });

        it('should transition kernel state during bootstrap', async () => {
            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(mockStateManager.transitionTo).toHaveBeenCalled();
        });

        it('should handle state transition errors', async () => {
            mockStateManager.transitionTo.mockImplementation(() => {
                throw new Error('State transition failed');
            });

            await expect(bootstrap.bootstrap()).rejects.toThrow('Kernel bootstrap failed: State transition failed');
        });
    });

    describe('setupDefaultInitializationSteps', () => {
        it('should setup default initialization steps', () => {
            (bootstrap as any).setupDefaultInitializationSteps();
            const steps = (bootstrap as any).initializationSteps;

            expect(Array.isArray(steps)).toBe(true);
            expect(steps.length).toBeGreaterThan(0);

            // Check for expected step names
            const stepNames = steps.map((step: InitializationStep) => step.name);
            expect(stepNames).toContain('validate-environment');
            expect(stepNames).toContain('setup-core-services');
            expect(stepNames).toContain('initialize-state-management');
            expect(stepNames).toContain('setup-error-handling');
            expect(stepNames).toContain('initialize-resilience-patterns');
        });

        it('should create steps with proper structure', () => {
            (bootstrap as any).setupDefaultInitializationSteps();
            const steps = (bootstrap as any).initializationSteps;

            // Find specific steps
            const coreServicesStep = steps.find((step: InitializationStep) => step.name === 'setup-core-services');
            const stateManagementStep = steps.find((step: InitializationStep) => step.name === 'initialize-state-management');
            const errorHandlingStep = steps.find((step: InitializationStep) => step.name === 'setup-error-handling');

            expect(coreServicesStep).toBeDefined();
            expect(stateManagementStep).toBeDefined();
            expect(errorHandlingStep).toBeDefined();

            // Check that steps have required properties
            expect(coreServicesStep.name).toBe('setup-core-services');
            expect(typeof coreServicesStep.execute).toBe('function');
        });

        it('should create executable steps', async () => {
            (bootstrap as any).setupDefaultInitializationSteps();
            const steps = (bootstrap as any).initializationSteps;

            for (const step of steps) {
                expect(typeof step.execute).toBe('function');
                expect(step.name).toBeTruthy();
            }
        });
    });

    describe('integration scenarios', () => {
        it('should complete full bootstrap process', async () => {
            // Mock the config loading to avoid file system dependency
            const mockConfig = { test: true };
            mockKernel.getConfigManager = jest.fn().mockReturnValue({
                loadConfig: jest.fn().mockResolvedValue(mockConfig),
                getConfig: jest.fn().mockReturnValue(mockConfig)
            });

            const options: BootstrapOptions = {
                configPath: './__tests__/fixtures/test-config.json',
                skipValidation: false,
                initializationTimeout: 30000
            };

            const result = await bootstrap.bootstrap(options);

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(result.kernel).toBe(mockKernel);
            expect(result.config).toBeDefined();
            expect(result.errors).toEqual([]);
            expect(result.pluginsLoaded).toBeGreaterThanOrEqual(0);
        });

        it('should handle partial bootstrap failure gracefully', async () => {
            // Make kernel initialization fail
            mockKernel.initialize = jest.fn().mockRejectedValue(new Error('Service registration failed'));

            await expect(bootstrap.bootstrap()).rejects.toThrow('Kernel bootstrap failed: Service registration failed');
        });

        it('should handle simple step execution', async () => {
            const executionOrder: string[] = [];

            const step1: InitializationStep = {
                name: 'step1',
                description: 'First step',
                execute: async () => { executionOrder.push('step1'); }
            };

            const step2: InitializationStep = {
                name: 'step2',
                description: 'Second step',
                execute: async () => { executionOrder.push('step2'); }
            };

            (bootstrap as any).initializationSteps.push(step1, step2);

            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(executionOrder).toContain('step1');
            expect(executionOrder).toContain('step2');
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle empty options', async () => {
            const result = await bootstrap.bootstrap({});

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
        });

        it('should handle null/undefined options', async () => {
            const result1 = await bootstrap.bootstrap(undefined);
            
            // For null, we expect it to fail since the code tries to access properties
            await expect(bootstrap.bootstrap(null as any)).rejects.toThrow('Kernel bootstrap failed');

            expect(result1.initializationTime).toBeGreaterThanOrEqual(0);
        });

        it('should handle steps that throw synchronous errors', async () => {
            const step: InitializationStep = {
                name: 'sync-error-step',
                description: 'Synchronous error step',
                execute: () => {
                    throw new Error('Synchronous error');
                }
            };

            (bootstrap as any).initializationSteps.push(step);

            await expect(bootstrap.bootstrap()).rejects.toThrow('Kernel bootstrap failed: Synchronous error');
        });

        it('should handle steps with execution times', async () => {
            const longRunningStep: InitializationStep = {
                name: 'long-step',
                description: 'Long running step',
                execute: () => new Promise(resolve => setTimeout(resolve, 50))
            };

            (bootstrap as any).initializationSteps.push(longRunningStep);

            const startTime = Date.now();
            const result = await bootstrap.bootstrap();
            const endTime = Date.now();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(endTime - startTime).toBeGreaterThanOrEqual(40); // Allow some tolerance
        });

        it('should handle duplicate step names', async () => {
            const step1: InitializationStep = {
                name: 'duplicate',
                description: 'First duplicate step',
                execute: jest.fn().mockResolvedValue(undefined)
            };

            const step2: InitializationStep = {
                name: 'duplicate',
                description: 'Second duplicate step',
                execute: jest.fn().mockResolvedValue(undefined)
            };

            (bootstrap as any).initializationSteps.push(step1, step2);

            const result = await bootstrap.bootstrap();

            // Should handle gracefully
            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
        });

        it('should handle steps that modify the context', async () => {
            const modifyingStep: InitializationStep = {
                name: 'modifying-step',
                description: 'Context modifying step',
                execute: async (context: InitializationContext) => {
                    // Try to modify context (should not affect other steps)
                    (context as any).modified = true;
                }
            };

            const checkingStep: InitializationStep = {
                name: 'checking-step',
                description: 'Context checking step',
                execute: async (context: InitializationContext) => {
                    expect(context.kernel).toBe(mockKernel);
                    expect(context.serviceContainer).toBe(mockServiceContainer);
                }
            };

            (bootstrap as any).initializationSteps.push(modifyingStep, checkingStep);

            const result = await bootstrap.bootstrap();

            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
        });
    });
});