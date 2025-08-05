import { EventBus } from "./EventBus";
import { KernelError } from "./KernelError";

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
    const kernelError =
      error instanceof KernelError
        ? error
        : new KernelError(
            error.message,
            "UNKNOWN_ERROR", // code
            undefined, // details
            "unknown", // sourceModule
            false, // isCritical
            error, // innerError
          );

    // Emit error event
    await this.eventBus.publish({
      id: crypto.randomUUID(),
      type: "kernel.error",
      payload: {
        eventType: "ErrorOccurred",
        error: kernelError,
      },
      timestamp: new Date(),
      source: "ErrorHandlerService",
    });

    // Find the first handler that can handle the error
    let handlerFound = false;
    for (const handler of this.handlers) {
      try {
        if (handler.canHandle(kernelError)) {
          try {
            await handler.handleError(kernelError);
            handlerFound = true;
            break; // Stop at first successful handler
          } catch (handlerError) {
            console.error("Error handler failed:", handlerError);
            // Continue to next handler if this one fails
          }
        }
      } catch (canHandleError) {
        console.error("canHandle method failed:", canHandleError);
        // Continue to next handler if canHandle fails
      }
    }

    if (!handlerFound) {
      console.warn("No error handlers found for error:", kernelError);
    }

    // If error is critical, we might want to take additional actions
    if (kernelError.isCritical) {
      await this.handleCriticalError(kernelError);
    }
  }

  private async handleCriticalError(error: KernelError): Promise<void> {
    await this.eventBus.publish({
      id: crypto.randomUUID(),
      type: "kernel.critical_error",
      payload: {
        eventType: "CriticalErrorOccurred",
        error,
      },
      timestamp: new Date(),
      source: "ErrorHandlerService",
    });
  }
}
