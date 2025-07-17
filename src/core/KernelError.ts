// Formato estandarizado de error para todo el kernel
export class KernelError extends Error {
    public readonly code?: string;
    public readonly details?: Record<string, any>;
    public readonly sourceModule?: string;
    public readonly isCritical: boolean;
    public readonly timestamp: Date;

    constructor(
        message: string,
        options?: { code?: string; details?: Record<string, any>; sourceModule?: string; isCritical?: boolean; innerError?: Error }
    ) {
        super(message);
        this.name = this.constructor.name; // Nombre de la clase del error
        this.code = options?.code;
        this.details = options?.details;
        this.sourceModule = options?.sourceModule;
        this.isCritical = options?.isCritical ?? false;
        this.timestamp = new Date();

        // Preserve stack trace for debugging
        if (options?.innerError && options.innerError.stack) {
            this.stack = `${this.stack}\nCaused by: ${options.innerError.stack}`;
        } else if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// Evento estándar de error para el Message Bus
export interface ErrorOccurredEvent {
    eventType: 'ErrorOccurred';
    error: KernelError;
}
