/**
 * Opciones para la configuración del bulkhead
 */
export interface BulkheadOptions {
    maxConcurrent: number;
    maxQueued: number;
    timeout?: number;
}

/**
 * Error específico para cuando se excede la capacidad del bulkhead
 */
export class BulkheadRejectedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BulkheadRejectedError';
    }
}

/**
 * Implementación del Bulkhead Pattern para aislamiento de recursos
 */
export class Bulkhead {
    private executing: Set<Promise<any>> = new Set();
    private queue: Array<{
        operation: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeoutId?: NodeJS.Timeout;
    }> = [];

    constructor(private options: BulkheadOptions) {
        this.options.timeout = options.timeout || 30000;
    }

    /**
     * Ejecuta una operación dentro del bulkhead
     */
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        // Si hay espacio para ejecutar inmediatamente
        if (this.executing.size < this.options.maxConcurrent) {
            return this.executeOperation(operation);
        }

        // Si hay espacio en la cola
        if (this.queue.length < this.options.maxQueued) {
            return this.queueOperation(operation);
        }

        throw new BulkheadRejectedError('Bulkhead capacity exceeded');
    }

    /**
     * Ejecuta una operación inmediatamente
     */
    private async executeOperation<T>(operation: () => Promise<T>): Promise<T> {
        const operationPromise = operation();
        this.executing.add(operationPromise);

        try {
            // Aplicar timeout si está configurado
            const result = await Promise.race([
                operationPromise,
                this.createTimeout()
            ]);

            this.executing.delete(operationPromise);
            this.processQueue();

            return result;
        } catch (error) {
            this.executing.delete(operationPromise);
            this.processQueue();
            throw error;
        }
    }

    /**
     * Encola una operación para ejecutar cuando haya capacidad
     */
    private queueOperation<T>(operation: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeoutId = this.options.timeout
                ? setTimeout(() => {
                    const index = this.queue.findIndex(q => q.timeoutId === timeoutId);
                    if (index !== -1) {
                        this.queue.splice(index, 1);
                        reject(new Error('Operation timed out while queued'));
                    }
                }, this.options.timeout)
                : undefined;

            this.queue.push({ operation, resolve, reject, timeoutId });
        });
    }

    /**
     * Procesa la cola de operaciones pendientes
     */
    private processQueue(): void {
        if (this.queue.length === 0 || this.executing.size >= this.options.maxConcurrent) {
            return;
        }

        const next = this.queue.shift()!;
        if (next.timeoutId) {
            clearTimeout(next.timeoutId);
        }

        this.executeOperation(next.operation)
            .then(next.resolve)
            .catch(next.reject);
    }

    /**
     * Crea una promesa de timeout
     */
    private createTimeout(): Promise<never> {
        return new Promise((_, reject) => {
            if (this.options.timeout) {
                setTimeout(() => {
                    reject(new Error('Operation timed out'));
                }, this.options.timeout);
            }
        });
    }

    /**
     * Obtiene estadísticas actuales del bulkhead
     */
    getStats() {
        return {
            executing: this.executing.size,
            queued: this.queue.length,
            maxConcurrent: this.options.maxConcurrent,
            maxQueued: this.options.maxQueued
        };
    }
}
