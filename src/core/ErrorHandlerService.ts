import { EventBus } from './EventBus';
import { KernelError } from './KernelError';

export interface ErrorHandler {
    handleError(error: KernelError): Promise<void>;
    canHandle(error: KernelError): boolean;
}

export class ErrorHandlerService {
    private handlers: ErrorHandler[] = [];
    private readonly eventBus: EventBus;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
    }

    registerHandler(handler: ErrorHandler): void {
        this.handlers.push(handler);
    }

    async handleError(error: Error): Promise<void> {
        // Convert to KernelError if it's not already one
        const kernelError = error instanceof KernelError
            ? error
            : new KernelError(error.message, {
                innerError: error,
                sourceModule: 'unknown'
            });

        // Emit error event
        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'kernel.error',
            payload: {
                eventType: 'ErrorOccurred',
                error: kernelError
            },
            timestamp: new Date(),
            source: 'ErrorHandlerService'
        });

        // Find and execute appropriate handlers
        const appropriateHandlers = this.handlers.filter(h => h.canHandle(kernelError));

        if (appropriateHandlers.length === 0) {
            console.warn('No error handlers found for error:', kernelError);
            return;
        }

        // Execute all appropriate handlers in parallel
        await Promise.all(
            appropriateHandlers.map(handler =>
                handler.handleError(kernelError).catch(handlerError => {
                    console.error('Error handler failed:', handlerError);
                })
            )
        );

        // If error is critical, we might want to take additional actions
        if (kernelError.isCritical) {
            await this.handleCriticalError(kernelError);
        }
    }

    private async handleCriticalError(error: KernelError): Promise<void> {
        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'kernel.critical_error',
            payload: {
                eventType: 'CriticalErrorOccurred',
                error
            },
            timestamp: new Date(),
            source: 'ErrorHandlerService'
        });
    }
}
