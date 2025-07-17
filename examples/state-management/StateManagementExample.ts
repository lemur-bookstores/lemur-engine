/**
 * Ejemplo de uso del sistema de estados del kernel con manejo de errores
 */

import { Kernel } from '../../src/core/Kernel';
import { KernelError } from '../../src/core/KernelError';
import { KernelState } from '../../src/core/KernelState';
import { DebugState, BackupState } from './CustomStatesExample';

async function stateManagementExample() {
    const kernel = new Kernel();

    try {
        // 1. Inicializar el kernel (comienza en estado INITIALIZING)
        await kernel.initialize();
        console.log('Estado inicial:', kernel.getState()); // RUNNING después de inicializar

        // 2. Operaciones normales en estado RUNNING
        await kernel.publishEvent({
            type: 'example.operation',
            payload: { action: 'test' },
            source: 'StateExample'
        });

        // 3. Entrar en modo mantenimiento
        console.log('Entrando en modo mantenimiento...');
        await kernel.enterMaintenance();
        console.log('Estado actual:', kernel.getState()); // MAINTENANCE

        // 4. Realizar operaciones de mantenimiento
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Mantenimiento completado');

        // 5. Salir del modo mantenimiento
        await kernel.exitMaintenance();
        console.log('Estado actual:', kernel.getState()); // RUNNING

        // 6. Manejo de errores en diferentes estados
        try {
            throw new Error('Error de prueba');
        } catch (error) {
            await kernel.handleError(new KernelError('Error durante operación normal', {
                code: 'TEST_ERROR',
                details: { originalError: error },
                sourceModule: 'StateExample',
                isCritical: false
            }));
        }

        // 7. Registrar y usar estados personalizados
        const debugState = new DebugState(kernel.getStateManager());
        const backupState = new BackupState(kernel.getStateManager());

        // Registrar estados personalizados
        kernel.getStateManager().registerState('DEBUG', debugState);
        kernel.getStateManager().registerState('BACKUP', backupState);

        // Usar estado de debug
        console.log('Entrando en modo debug...');
        await kernel.getStateManager().transitionTo('DEBUG');
        const currentDebugState = kernel.getCurrentStateHandler() as DebugState;
        await currentDebugState.collectMetrics();
        await currentDebugState.enableVerboseLogging();

        // Volver a estado normal
        await kernel.getStateManager().transitionTo(KernelState.RUNNING);

        // 8. Realizar backup
        console.log('Iniciando backup...');
        await kernel.getStateManager().transitionTo('BACKUP');
        const currentBackupState = kernel.getCurrentStateHandler() as BackupState;
        await currentBackupState.startBackup();

        // 9. Apagar el kernel
        await kernel.shutdown();
        console.log('Estado final:', kernel.getState()); // SHUTTING_DOWN

    } catch (error) {
        console.error('Error en el ejemplo:', error);
        throw error;
    }
}

// Ejecutar el ejemplo
stateManagementExample().catch(console.error);
