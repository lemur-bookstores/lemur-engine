import { 
    KernelState, 
    KernelStateManager, 
    IKernelState, 
    InitializingState, 
    RunningState, 
    MaintenanceState,
    BaseKernelState
} from '../../src/core/KernelState';

// Mock implementation for testing
class MockKernelState extends BaseKernelState {
    public initializeCalled = false;
    public shutdownCalled = false;
    public handleErrorCalled = false;
    public enterMaintenanceCalled = false;
    public exitMaintenanceCalled = false;
    public lastError: Error | null = null;

    constructor(manager?: KernelStateManager) {
        super(manager || {} as KernelStateManager);
    }

    async initialize(): Promise<void> {
        this.initializeCalled = true;
    }

    async shutdown(): Promise<void> {
        this.shutdownCalled = true;
    }

    async handleError(error: Error): Promise<void> {
        this.handleErrorCalled = true;
        this.lastError = error;
    }

    async enterMaintenance(): Promise<void> {
        this.enterMaintenanceCalled = true;
    }

    async exitMaintenance(): Promise<void> {
        this.exitMaintenanceCalled = true;
    }
}

describe('KernelState', () => {
    describe('KernelState enum', () => {
        it('should have all required states', () => {
            expect(KernelState.INITIALIZING).toBe('INITIALIZING');
            expect(KernelState.RUNNING).toBe('RUNNING');
            expect(KernelState.SHUTTING_DOWN).toBe('SHUTTING_DOWN');
            expect(KernelState.ERROR).toBe('ERROR');
            expect(KernelState.MAINTENANCE).toBe('MAINTENANCE');
        });
    });

    describe('KernelStateManager', () => {
        let stateManager: KernelStateManager;
        let mockInitializingState: MockKernelState;
        let mockRunningState: MockKernelState;
        let mockMaintenanceState: MockKernelState;
        let mockErrorState: MockKernelState;
        let mockShuttingDownState: MockKernelState;
        let handlers: Map<KernelState, IKernelState>;

        beforeEach(() => {
            mockInitializingState = new MockKernelState();
            mockRunningState = new MockKernelState();
            mockMaintenanceState = new MockKernelState();
            mockErrorState = new MockKernelState();
            mockShuttingDownState = new MockKernelState();

            handlers = new Map([
                [KernelState.INITIALIZING, mockInitializingState],
                [KernelState.RUNNING, mockRunningState],
                [KernelState.MAINTENANCE, mockMaintenanceState],
                [KernelState.ERROR, mockErrorState],
                [KernelState.SHUTTING_DOWN, mockShuttingDownState]
            ]);

            stateManager = new KernelStateManager(handlers);
        });

        describe('constructor', () => {
            it('should initialize with INITIALIZING state', () => {
                expect(stateManager.getCurrentStateEnum()).toBe(KernelState.INITIALIZING);
                expect(stateManager.getCurrentState()).toBe(mockInitializingState);
            });

            it('should throw error if INITIALIZING handler is missing', () => {
                const incompleteHandlers = new Map([
                    [KernelState.RUNNING, mockRunningState]
                ]);

                expect(() => {
                    new KernelStateManager(incompleteHandlers);
                }).toThrow('No handler registered for INITIALIZING state');
            });

            it('should initialize state history with empty array', () => {
                expect(stateManager.getStateHistory()).toEqual([]);
            });
        });

        describe('transitionTo', () => {
            it('should transition to a registered state', async () => {
                await stateManager.transitionTo(KernelState.RUNNING);

                expect(stateManager.getCurrentStateEnum()).toBe(KernelState.RUNNING);
                expect(stateManager.getCurrentState()).toBe(mockRunningState);
            });

            it('should throw error for unregistered state', async () => {
                const incompleteManager = new KernelStateManager(new Map([
                    [KernelState.INITIALIZING, mockInitializingState]
                ]));

                await expect(incompleteManager.transitionTo(KernelState.RUNNING))
                    .rejects.toThrow('No handler registered for state: RUNNING');
            });

            it('should record state transitions in history', async () => {
                const beforeTransition = Date.now();
                
                await stateManager.transitionTo(KernelState.RUNNING);
                await stateManager.transitionTo(KernelState.MAINTENANCE);

                const history = stateManager.getStateHistory();
                expect(history).toHaveLength(2);
                
                expect(history[0].state).toBe(KernelState.RUNNING);
                expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTransition);
                
                expect(history[1].state).toBe(KernelState.MAINTENANCE);
                expect(history[1].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTransition);
            });

            it('should handle multiple transitions correctly', async () => {
                await stateManager.transitionTo(KernelState.RUNNING);
                await stateManager.transitionTo(KernelState.MAINTENANCE);
                await stateManager.transitionTo(KernelState.ERROR);

                expect(stateManager.getCurrentStateEnum()).toBe(KernelState.ERROR);
                expect(stateManager.getCurrentState()).toBe(mockErrorState);
                expect(stateManager.getStateHistory()).toHaveLength(3);
            });
        });

        describe('registerState', () => {
            it('should register new state handler', () => {
                const customState = new MockKernelState();
                stateManager.registerState('CUSTOM_STATE', customState);

                expect(() => {
                    stateManager.registerState('CUSTOM_STATE', customState);
                }).not.toThrow();
            });

            it('should allow overwriting existing state handler', () => {
                const newRunningState = new MockKernelState();
                stateManager.registerState(KernelState.RUNNING, newRunningState);

                expect(() => {
                    stateManager.registerState(KernelState.RUNNING, newRunningState);
                }).not.toThrow();
            });
        });

        describe('getCurrentState', () => {
            it('should return current state handler', () => {
                expect(stateManager.getCurrentState()).toBe(mockInitializingState);
            });

            it('should return updated state after transition', async () => {
                await stateManager.transitionTo(KernelState.RUNNING);
                expect(stateManager.getCurrentState()).toBe(mockRunningState);
            });
        });

        describe('getCurrentStateEnum', () => {
            it('should return current state enum', () => {
                expect(stateManager.getCurrentStateEnum()).toBe(KernelState.INITIALIZING);
            });

            it('should return updated state enum after transition', async () => {
                await stateManager.transitionTo(KernelState.RUNNING);
                expect(stateManager.getCurrentStateEnum()).toBe(KernelState.RUNNING);
            });
        });

        describe('getStateHistory', () => {
            it('should return copy of state history', async () => {
                await stateManager.transitionTo(KernelState.RUNNING);
                
                const history1 = stateManager.getStateHistory();
                const history2 = stateManager.getStateHistory();
                
                expect(history1).not.toBe(history2); // Different instances
                expect(history1).toEqual(history2); // Same content
            });

            it('should preserve chronological order', async () => {
                await stateManager.transitionTo(KernelState.RUNNING);
                await new Promise(resolve => setTimeout(resolve, 1)); // Ensure different timestamps
                await stateManager.transitionTo(KernelState.MAINTENANCE);
                
                const history = stateManager.getStateHistory();
                expect(history[0].timestamp.getTime()).toBeLessThan(history[1].timestamp.getTime());
            });
        });

        describe('isInState', () => {
            it('should return true for current state', () => {
                expect(stateManager.isInState(KernelState.INITIALIZING)).toBe(true);
                expect(stateManager.isInState(KernelState.RUNNING)).toBe(false);
            });

            it('should return updated value after state transition', async () => {
                await stateManager.transitionTo(KernelState.RUNNING);
                
                expect(stateManager.isInState(KernelState.INITIALIZING)).toBe(false);
                expect(stateManager.isInState(KernelState.RUNNING)).toBe(true);
            });
        });
    });

    describe('BaseKernelState', () => {
        class TestKernelState extends BaseKernelState {
            async initialize(): Promise<void> {}
            async shutdown(): Promise<void> {}
            async handleError(_error: Error): Promise<void> {}
            async enterMaintenance(): Promise<void> {}
            async exitMaintenance(): Promise<void> {}
        }

        it('should store manager reference', () => {
            const mockManager = {} as KernelStateManager;
            const state = new TestKernelState(mockManager);
            
            expect((state as any).manager).toBe(mockManager);
        });
    });

    describe('InitializingState', () => {
        let stateManager: KernelStateManager;
        let initializingState: InitializingState;

        beforeEach(() => {
            // Create mock states first
            const mockRunning = new MockKernelState();
            const mockError = new MockKernelState();
            
            const handlers = new Map<KernelState, IKernelState>();
            
            // Create a temporary initializing state for manager creation
            const tempInitializing = new MockKernelState();
            handlers.set(KernelState.INITIALIZING, tempInitializing);
            
            stateManager = new KernelStateManager(handlers);
            initializingState = new InitializingState(stateManager);
            
            // Now set the proper handlers
            handlers.set(KernelState.INITIALIZING, initializingState);
            handlers.set(KernelState.RUNNING, mockRunning);
            handlers.set(KernelState.ERROR, mockError);
        });

        describe('initialize', () => {
            it('should transition to RUNNING state', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                
                await initializingState.initialize();
                
                expect(stateManager.transitionTo).toHaveBeenCalledWith(KernelState.RUNNING);
            });
        });

        describe('shutdown', () => {
            it('should throw error when trying to shutdown during initialization', async () => {
                await expect(initializingState.shutdown())
                    .rejects.toThrow('Cannot shutdown: Kernel is still initializing');
            });
        });

        describe('handleError', () => {
            it('should transition to ERROR state', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                const error = new Error('Test error');
                
                await initializingState.handleError(error);
                
                expect(stateManager.transitionTo).toHaveBeenCalledWith(KernelState.ERROR);
            });
        });

        describe('enterMaintenance', () => {
            it('should throw error when trying to enter maintenance during initialization', async () => {
                await expect(initializingState.enterMaintenance())
                    .rejects.toThrow('Cannot enter maintenance: Kernel is still initializing');
            });
        });

        describe('exitMaintenance', () => {
            it('should throw error when trying to exit maintenance during initialization', async () => {
                await expect(initializingState.exitMaintenance())
                    .rejects.toThrow('Cannot exit maintenance: Kernel is still initializing');
            });
        });
    });

    describe('RunningState', () => {
        let stateManager: KernelStateManager;
        let runningState: RunningState;

        beforeEach(() => {
            // Create mock states first
            const mockInitializing = new MockKernelState();
            const mockShuttingDown = new MockKernelState();
            const mockError = new MockKernelState();
            const mockMaintenance = new MockKernelState();
            
            const handlers = new Map<KernelState, IKernelState>([
                [KernelState.INITIALIZING, mockInitializing]
            ]);
            
            stateManager = new KernelStateManager(handlers);
            runningState = new RunningState(stateManager);
            
            // Now add the rest of the handlers
            handlers.set(KernelState.RUNNING, runningState);
            handlers.set(KernelState.SHUTTING_DOWN, mockShuttingDown);
            handlers.set(KernelState.ERROR, mockError);
            handlers.set(KernelState.MAINTENANCE, mockMaintenance);
        });

        describe('initialize', () => {
            it('should throw error when trying to initialize while running', async () => {
                await expect(runningState.initialize())
                    .rejects.toThrow('Cannot initialize: Kernel is already running');
            });
        });

        describe('shutdown', () => {
            it('should transition to SHUTTING_DOWN state', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                
                await runningState.shutdown();
                
                expect(stateManager.transitionTo).toHaveBeenCalledWith(KernelState.SHUTTING_DOWN);
            });
        });

        describe('handleError', () => {
            it('should transition to ERROR state for critical errors', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                const criticalError = new Error('critical system failure');
                
                await runningState.handleError(criticalError);
                
                expect(stateManager.transitionTo).toHaveBeenCalledWith(KernelState.ERROR);
            });

            it('should not transition state for non-critical errors', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                const nonCriticalError = new Error('minor issue');
                
                await runningState.handleError(nonCriticalError);
                
                expect(stateManager.transitionTo).not.toHaveBeenCalled();
            });
        });

        describe('enterMaintenance', () => {
            it('should transition to MAINTENANCE state', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                
                await runningState.enterMaintenance();
                
                expect(stateManager.transitionTo).toHaveBeenCalledWith(KernelState.MAINTENANCE);
            });
        });

        describe('exitMaintenance', () => {
            it('should throw error when trying to exit maintenance while running', async () => {
                await expect(runningState.exitMaintenance())
                    .rejects.toThrow('Cannot exit maintenance: Kernel is in running state');
            });
        });
    });

    describe('MaintenanceState', () => {
        let stateManager: KernelStateManager;
        let maintenanceState: MaintenanceState;

        beforeEach(() => {
            // Create mock states first
            const mockInitializing = new MockKernelState();
            const mockRunning = new MockKernelState();
            const mockShuttingDown = new MockKernelState();
            
            const handlers = new Map<KernelState, IKernelState>([
                [KernelState.INITIALIZING, mockInitializing]
            ]);
            
            stateManager = new KernelStateManager(handlers);
            maintenanceState = new MaintenanceState(stateManager);
            
            // Now add the rest of the handlers
            handlers.set(KernelState.RUNNING, mockRunning);
            handlers.set(KernelState.SHUTTING_DOWN, mockShuttingDown);
            handlers.set(KernelState.MAINTENANCE, maintenanceState);
            
            // Mock console.warn to avoid noise in tests
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        describe('initialize', () => {
            it('should throw error when trying to initialize during maintenance', async () => {
                await expect(maintenanceState.initialize())
                    .rejects.toThrow('Cannot initialize: Kernel is in maintenance mode');
            });
        });

        describe('shutdown', () => {
            it('should transition to SHUTTING_DOWN state', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                
                await maintenanceState.shutdown();
                
                expect(stateManager.transitionTo).toHaveBeenCalledWith(KernelState.SHUTTING_DOWN);
            });
        });

        describe('handleError', () => {
            it('should log warning without changing state', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                const error = new Error('maintenance error');
                
                await maintenanceState.handleError(error);
                
                expect(console.warn).toHaveBeenCalledWith('Error during maintenance:', error);
                expect(stateManager.transitionTo).not.toHaveBeenCalled();
            });
        });

        describe('enterMaintenance', () => {
            it('should throw error when already in maintenance', async () => {
                await expect(maintenanceState.enterMaintenance())
                    .rejects.toThrow('Already in maintenance mode');
            });
        });

        describe('exitMaintenance', () => {
            it('should transition to RUNNING state', async () => {
                jest.spyOn(stateManager, 'transitionTo');
                
                await maintenanceState.exitMaintenance();
                
                expect(stateManager.transitionTo).toHaveBeenCalledWith(KernelState.RUNNING);
            });
        });
    });

    describe('Integration tests', () => {
        let stateManager: KernelStateManager;

        beforeEach(() => {
            // Create a temporary initializing state for manager creation
            const tempInitializing = new MockKernelState();
            
            const handlers = new Map<KernelState, IKernelState>([
                [KernelState.INITIALIZING, tempInitializing]
            ]);
            
            stateManager = new KernelStateManager(handlers);
            
            // Create proper handlers with the manager
            const initializingState = new InitializingState(stateManager);
            const runningState = new RunningState(stateManager);
            const maintenanceState = new MaintenanceState(stateManager);
            const errorState = new MockKernelState(stateManager);
            const shuttingDownState = new MockKernelState(stateManager);
            
            // Update handlers
            handlers.set(KernelState.INITIALIZING, initializingState);
            handlers.set(KernelState.RUNNING, runningState);
            handlers.set(KernelState.MAINTENANCE, maintenanceState);
            handlers.set(KernelState.ERROR, errorState);
            handlers.set(KernelState.SHUTTING_DOWN, shuttingDownState);
        });

        it('should handle complete initialization flow', async () => {
            expect(stateManager.getCurrentStateEnum()).toBe(KernelState.INITIALIZING);
            
            await stateManager.getCurrentState().initialize();
            expect(stateManager.getCurrentStateEnum()).toBe(KernelState.RUNNING);
        });

        it('should handle maintenance mode flow', async () => {
            // Initialize to running
            await stateManager.getCurrentState().initialize();
            
            // Enter maintenance
            await stateManager.getCurrentState().enterMaintenance();
            expect(stateManager.getCurrentStateEnum()).toBe(KernelState.MAINTENANCE);
            
            // Exit maintenance
            await stateManager.getCurrentState().exitMaintenance();
            expect(stateManager.getCurrentStateEnum()).toBe(KernelState.RUNNING);
        });

        it('should handle shutdown flow', async () => {
            // Initialize to running
            await stateManager.getCurrentState().initialize();
            
            // Shutdown
            await stateManager.getCurrentState().shutdown();
            expect(stateManager.getCurrentStateEnum()).toBe(KernelState.SHUTTING_DOWN);
        });

        it('should maintain state history throughout transitions', async () => {
            await stateManager.getCurrentState().initialize();
            await stateManager.getCurrentState().enterMaintenance();
            await stateManager.getCurrentState().exitMaintenance();
            await stateManager.getCurrentState().shutdown();
            
            const history = stateManager.getStateHistory();
            expect(history).toHaveLength(4);
            expect(history.map(h => h.state)).toEqual([
                KernelState.RUNNING,
                KernelState.MAINTENANCE,
                KernelState.RUNNING,
                KernelState.SHUTTING_DOWN
            ]);
        });
    });
});