import { BaseKernelState, KernelState, IKernelState } from '../../src/core/KernelState';
import { KernelError } from '../../src/core/KernelError';

/**
 * Estado personalizado: Modo Debug
 * Ejemplo de cómo crear estados adicionales para el kernel
 */
export class DebugState extends BaseKernelState {
    private debugStartTime: Date;
    private collectedData: any[] = [];

    constructor(manager: any) {
        super(manager);
        this.debugStartTime = new Date();
    }

    async initialize(): Promise<void> {
        throw new Error('Cannot initialize while in debug mode');
    }

    async shutdown(): Promise<void> {
        // Guardar datos de debug antes de apagar
        await this.saveDebugData();
        await this.manager.transitionTo(KernelState.SHUTTING_DOWN);
    }

    async handleError(error: Error): Promise<void> {
        // En modo debug, recolectamos más información sobre los errores
        this.collectedData.push({
            timestamp: new Date(),
            type: 'error',
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context: this.getCurrentDebugContext()
        });
    }

    async enterMaintenance(): Promise<void> {
        throw new Error('Cannot enter maintenance while in debug mode');
    }

    async exitMaintenance(): Promise<void> {
        throw new Error('Cannot exit maintenance while in debug mode');
    }

    // Métodos específicos del estado de debug
    async collectMetrics(): Promise<void> {
        this.collectedData.push({
            timestamp: new Date(),
            type: 'metrics',
            data: await this.gatherSystemMetrics()
        });
    }

    async enableVerboseLogging(): Promise<void> {
        // Implementación de logging detallado
    }

    private getCurrentDebugContext(): object {
        return {
            sessionDuration: Date.now() - this.debugStartTime.getTime(),
            collectedDataPoints: this.collectedData.length,
            // Agregar más contexto relevante
        };
    }

    private async gatherSystemMetrics(): Promise<object> {
        return {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            // Agregar más métricas
        };
    }

    private async saveDebugData(): Promise<void> {
        // Implementar guardado de datos de debug
        console.log('Debug session data:', this.collectedData);
    }
}

/**
 * Estado personalizado: Modo Backup
 * Otro ejemplo de estado personalizado
 */
export class BackupState extends BaseKernelState {
    private backupInProgress: boolean = false;

    async initialize(): Promise<void> {
        throw new Error('Cannot initialize while backup is in progress');
    }

    async shutdown(): Promise<void> {
        if (this.backupInProgress) {
            throw new Error('Cannot shutdown while backup is in progress');
        }
        await this.manager.transitionTo(KernelState.SHUTTING_DOWN);
    }

    async handleError(error: Error): Promise<void> {
        if (this.backupInProgress) {
            // Manejar errores durante el backup
            throw new KernelError('Backup failed', {
                code: 'BACKUP_ERROR',
                details: { originalError: error },
                sourceModule: 'BackupState',
                isCritical: true
            });
        }
    }

    async enterMaintenance(): Promise<void> {
        throw new Error('Cannot enter maintenance while backup is in progress');
    }

    async exitMaintenance(): Promise<void> {
        throw new Error('Cannot exit maintenance while backup is in progress');
    }

    // Métodos específicos del estado de backup
    async startBackup(): Promise<void> {
        this.backupInProgress = true;
        try {
            await this.performBackup();
            await this.manager.transitionTo(KernelState.RUNNING);
        } catch (error) {
            this.backupInProgress = false;
            throw error;
        }
    }

    private async performBackup(): Promise<void> {
        // Implementar lógica de backup
    }
}

/**
 * Ejemplo de uso:
 * 
 * // 1. Registrar estados personalizados
 * const stateHandlers = new Map();
 * const stateManager = new KernelStateManager(stateHandlers);
 * 
 * stateHandlers.set(KernelState.INITIALIZING, new InitializingState(stateManager));
 * stateHandlers.set(KernelState.RUNNING, new RunningState(stateManager));
 * stateHandlers.set(KernelState.MAINTENANCE, new MaintenanceState(stateManager));
 * stateHandlers.set('DEBUG', new DebugState(stateManager));
 * stateHandlers.set('BACKUP', new BackupState(stateManager));
 * 
 * // 2. Usar los estados
 * // Entrar en modo debug
 * await kernel.getStateManager().transitionTo('DEBUG');
 * const debugState = kernel.getCurrentStateHandler() as DebugState;
 * await debugState.collectMetrics();
 * await debugState.enableVerboseLogging();
 * 
 * // Realizar backup
 * await kernel.getStateManager().transitionTo('BACKUP');
 * const backupState = kernel.getCurrentStateHandler() as BackupState;
 * await backupState.startBackup();
 */

/**
 * // 1. Crear estados personalizados
const debugState = new DebugState(kernel.getStateManager());
const backupState = new BackupState(kernel.getStateManager());

// 2. Registrar los estados
kernel.getStateManager().registerState('DEBUG', debugState);
kernel.getStateManager().registerState('BACKUP', backupState);

// 3. Usar los estados
await kernel.getStateManager().transitionTo('DEBUG');
const debugHandler = kernel.getCurrentStateHandler() as DebugState;
await debugHandler.collectMetrics();

// 4. Realizar backup
await kernel.getStateManager().transitionTo('BACKUP');
const backupHandler = kernel.getCurrentStateHandler() as BackupState;
await backupHandler.startBackup();
 */