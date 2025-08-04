/**
 * Opciones para la configuración del retry
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  exponentialBase?: number;
  timeout?: number;
  retryableErrors?: Array<string | RegExp>;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoffFactor: number;
  retryableErrors?: Array<string | RegExp>;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
  backoffStrategy?: "exponential" | "linear" | "fixed";
}

/**
 * Implementación del Retry Pattern con backoff exponencial
 */
export class RetryHandler {
  constructor(private options: RetryOptions) {
    this.options.exponentialBase = options.exponentialBase || 2;
    this.options.timeout = options.timeout || 30000;
  }

  /**
   * Ejecuta una operación con reintentos
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Si maxAttempts es 0, fallar inmediatamente
    if (this.options.maxAttempts <= 0) {
      throw new Error(
        `Operation failed after 0 attempts. Last error: undefined`,
      );
    }

    let attempt = 1;
    let lastError: any = new Error("No error"); // Inicializar lastError
    const startTime = Date.now();

    while (attempt <= this.options.maxAttempts) {
      try {
        // Verificar timeout global
        if (Date.now() - startTime > this.options.timeout!) {
          throw new Error("Operation timed out");
        }

        return await operation();
      } catch (error: any) {
        lastError = error;

        // Verificar si el error es retriable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Si es el último intento, no esperar
        if (attempt === this.options.maxAttempts) {
          break;
        }

        // Calcular delay con backoff exponencial
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
        attempt++;
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `Operation failed after ${attempt} attempts. Last error: ${errorMessage}`,
    );
  }

  /**
   * Calcula el delay para el siguiente reintento usando backoff exponencial
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.options.initialDelay *
      Math.pow(this.options.exponentialBase!, attempt - 1);

    // Añadir jitter para evitar thundering herd
    const jitter = Math.random() * 100;

    return Math.min(exponentialDelay + jitter, this.options.maxDelay);
  }

  /**
   * Verifica si un error es retriable según la configuración
   */
  private isRetryableError(error: any): boolean {
    // Si no es un objeto Error, no es retriable
    if (!(error instanceof Error)) {
      return false;
    }

    if (
      !this.options.retryableErrors ||
      this.options.retryableErrors.length === 0
    ) {
      return true;
    }

    return this.options.retryableErrors.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(error.message);
      }
      return error.message.includes(pattern);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
