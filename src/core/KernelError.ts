// Formato estandarizado de error para todo el kernel
export class KernelError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly sourceModule?: string;
  public readonly isCritical: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    details?: any,
    sourceModule?: string,
    isCritical: boolean = false,
    innerError?: Error,
  ) {
    super(message);
    this.name = "KernelError";
    this.code = code;
    this.details = details;
    this.sourceModule = sourceModule;
    this.isCritical = isCritical;
    this.timestamp = new Date();

    // Preserve stack trace for debugging
    if (innerError && innerError.stack) {
      this.stack = `${this.stack}\nCaused by: ${innerError.stack}`;
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Método para serialización JSON personalizada
  toJSON() {
    // Función para manejar referencias circulares
    const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (_key: string, value: any) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular Reference]";
          }
          seen.add(value);
        }
        return value;
      };
    };

    try {
      return {
        name: this.name,
        message: this.message,
        code: this.code,
        details: this.details
          ? JSON.parse(JSON.stringify(this.details, getCircularReplacer()))
          : this.details,
        sourceModule: this.sourceModule,
        isCritical: this.isCritical,
        timestamp: this.timestamp.toISOString(),
        stack: this.stack,
      };
    } catch (error: any) {
      // Fallback para casos donde la serialización falla
      return {
        name: this.name,
        message: this.message,
        code: this.code,
        details: "[Serialization Error]",
        sourceModule: this.sourceModule,
        isCritical: this.isCritical,
        timestamp: this.timestamp.toISOString(),
        stack: this.stack,
      };
    }
  }

  toString(): string {
    const baseString = super.toString();
    if (this.code) {
      return `${baseString} [${this.code}]`;
    }
    return baseString;
  }
}

// Evento estándar de error para el Message Bus
export interface ErrorOccurredEvent {
  eventType: "ErrorOccurred";
  error: KernelError;
}
