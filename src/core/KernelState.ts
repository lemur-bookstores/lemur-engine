/**
 * Estados posibles del kernel
 */
export enum KernelState {
    INITIALIZING = 'INITIALIZING',
    RUNNING = 'RUNNING',
    SHUTTING_DOWN = 'SHUTTING_DOWN',
    ERROR = 'ERROR',
    MAINTENANCE = 'MAINTENANCE'
}

/**
 * Interface para estados específicos del kernel
 */
export interface IKernelState {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    handleError(error: Error): Promise<void>;
    enterMaintenance(): Promise<void>;
    exitMaintenance(): Promise<void>;
}

/**
 * Contexto que mantiene y gestiona el estado actual
 */
export class KernelStateManager {
    private currentState: IKernelState;
    private currentStateEnum: KernelState = KernelState.INITIALIZING;
    private stateHandlers: Map<KernelState | string, IKernelState>;
    private stateHistory: { state: KernelState; timestamp: Date }[] = [];

    constructor() {
        this.stateHandlers = new Map<KernelState | string, IKernelState>();
        this.currentStateEnum = KernelState.INITIALIZING;
        this.currentState = {
            initialize: async () => {},
            shutdown: async () => {},
            handleError: async () => {},
            enterMaintenance: async () => {},
            exitMaintenance: async () => {}
        };
        this.stateHistory.push({
            state: KernelState.INITIALIZING,
            timestamp: new Date()
        });
    }

    async transitionTo(newState: KernelState): Promise<void> {
        const handler = this.stateHandlers.get(newState);
        if (!handler) {
            throw new Error(`No handler registered for state: ${newState}`);
        }

        // Registrar el cambio de estado
        this.stateHistory.push({
            state: newState,
            timestamp: new Date()
        });

        // Actualizar el estado
        this.currentStateEnum = newState;
        this.currentState = handler;
    }

    registerState(stateKey: string | KernelState, handler: IKernelState): void {
        this.stateHandlers.set(stateKey, handler);
        // Si se registra el estado INITIALIZING, actualizamos el estado actual
        if (stateKey === KernelState.INITIALIZING) {
            this.currentState = handler;
        }
    }

    getCurrentState(): IKernelState {
        return this.currentState;
    }

    getCurrentStateEnum(): KernelState {
        return this.currentStateEnum;
    }

    getStateHistory(): { state: KernelState; timestamp: Date }[] {
        return [...this.stateHistory];
    }

    isInState(state: KernelState): boolean {
        return this.currentStateEnum === state;
    }
}

/**
 * Implementación base para estados del kernel
 */
export abstract class BaseKernelState implements IKernelState {
    constructor(protected manager: KernelStateManager) { }

    abstract initialize(): Promise<void>;
    abstract shutdown(): Promise<void>;
    abstract handleError(error: Error): Promise<void>;
    abstract enterMaintenance(): Promise<void>;
    abstract exitMaintenance(): Promise<void>;
}

/**
 * Estado: Kernel inicializando
 */
export class InitializingState extends BaseKernelState {
    async initialize(): Promise<void> {
        await this.manager.transitionTo(KernelState.RUNNING);
    }

    async shutdown(): Promise<void> {
        throw new Error('Cannot shutdown: Kernel is still initializing');
    }

    async handleError(_error: Error): Promise<void> {
        await this.manager.transitionTo(KernelState.ERROR);
    }

    async enterMaintenance(): Promise<void> {
        throw new Error('Cannot enter maintenance: Kernel is still initializing');
    }

    async exitMaintenance(): Promise<void> {
        throw new Error('Cannot exit maintenance: Kernel is still initializing');
    }
}

/**
 * Estado: Kernel en ejecución
 */
export class RunningState extends BaseKernelState {
    async initialize(): Promise<void> {
        throw new Error('Cannot initialize: Kernel is already running');
    }

    async shutdown(): Promise<void> {
        await this.manager.transitionTo(KernelState.SHUTTING_DOWN);
    }

    async handleError(error: Error): Promise<void> {
        if (error.message.includes('critical')) {
            await this.manager.transitionTo(KernelState.ERROR);
        }
        // Los errores no críticos se manejan sin cambio de estado
    }

    async enterMaintenance(): Promise<void> {
        await this.manager.transitionTo(KernelState.MAINTENANCE);
    }

    async exitMaintenance(): Promise<void> {
        throw new Error('Cannot exit maintenance: Kernel is in running state');
    }
}

/**
 * Estado: Kernel en mantenimiento
 */
export class MaintenanceState extends BaseKernelState {
    async initialize(): Promise<void> {
        throw new Error('Cannot initialize: Kernel is in maintenance mode');
    }

    async shutdown(): Promise<void> {
        await this.manager.transitionTo(KernelState.SHUTTING_DOWN);
    }

    async handleError(error: Error): Promise<void> {
        // En mantenimiento, los errores no causan cambios de estado
        console.warn('Error during maintenance:', error);
    }

    async enterMaintenance(): Promise<void> {
        throw new Error('Already in maintenance mode');
    }

    async exitMaintenance(): Promise<void> {
        await this.manager.transitionTo(KernelState.RUNNING);
    }
}

/**
 * Estado: Kernel cerrándose
 */
export class ShuttingDownState extends BaseKernelState {
    async initialize(): Promise<void> {
        throw new Error('Cannot initialize: Kernel is shutting down');
    }

    async shutdown(): Promise<void> {
        // Ya estamos en proceso de cierre, no hacer nada
        console.log('Kernel is already shutting down');
    }

    async handleError(error: Error): Promise<void> {
        // Durante el cierre, los errores se registran pero no cambian el estado
        console.error('Error during shutdown:', error);
    }

    async enterMaintenance(): Promise<void> {
        throw new Error('Cannot enter maintenance: Kernel is shutting down');
    }

    async exitMaintenance(): Promise<void> {
        throw new Error('Cannot exit maintenance: Kernel is shutting down');
    }
}

/**
 * Estado: Kernel en error
 */
export class ErrorState extends BaseKernelState {
    async initialize(): Promise<void> {
        throw new Error('Cannot initialize: Kernel is in error state');
    }

    async shutdown(): Promise<void> {
        await this.manager.transitionTo(KernelState.SHUTTING_DOWN);
    }

    async handleError(error: Error): Promise<void> {
        // Ya estamos en estado de error, solo registrar el nuevo error
        console.error('Additional error while in error state:', error);
    }

    async enterMaintenance(): Promise<void> {
        // Desde error, podemos intentar ir a mantenimiento para recuperación
        await this.manager.transitionTo(KernelState.MAINTENANCE);
    }

    async exitMaintenance(): Promise<void> {
        throw new Error('Cannot exit maintenance: Kernel is in error state');
    }
}
