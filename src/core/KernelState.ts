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

    constructor(handlers: Map<KernelState, IKernelState>) {
        this.stateHandlers = handlers;
        // Establecer el estado inicial como INITIALIZING
        const initializingHandler = handlers.get(KernelState.INITIALIZING);
        if (!initializingHandler) {
            throw new Error('No handler registered for INITIALIZING state');
        }
        this.currentState = initializingHandler;
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
