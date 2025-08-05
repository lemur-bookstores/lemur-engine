import { ErrorHandler } from "../core/ErrorHandlerService";
import { KernelError } from "../core/KernelError";
import {
  LogEntry,
  LogStorage,
  MetricEntry,
  MetricsStorage,
} from "../core/interfaces/storage";

export class ConsoleErrorHandler implements ErrorHandler {
  canHandle(_error: KernelError): boolean {
    return true; // Maneja todos los errores
  }

  async handleError(error: KernelError): Promise<void> {
    console.error("Kernel Error:", {
      message: error.message,
      code: error.code,
      sourceModule: error.sourceModule,
      timestamp: error.timestamp,
      details: error.details,
      stack: error.stack,
    });
  }
}

export class LogErrorHandler implements ErrorHandler {
  constructor(private storage: LogStorage) {}

  canHandle(_error: KernelError): boolean {
    return true;
  }

  async handleError(error: KernelError): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: error.timestamp,
      type: "error",
      message: error.message,
      code: error.code,
      sourceModule: error.sourceModule,
      details: error.details,
      stack: error.stack,
    };

    await this.storage.save(logEntry);
  }
}

export class MetricsErrorHandler implements ErrorHandler {
  private errorCounts: Map<string, number> = new Map();

  constructor(private storage: MetricsStorage) {}

  canHandle(_error: KernelError): boolean {
    return true;
  }

  async handleError(error: KernelError): Promise<void> {
    const errorType = error.code || "unknown";
    const currentCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, currentCount + 1);

    const metric: MetricEntry = {
      timestamp: new Date(),
      type: "error_count",
      value: currentCount + 1,
      tags: {
        error_type: errorType,
        source_module: error.sourceModule || "unknown",
        is_critical: error.isCritical.toString(),
      },
      metadata: {
        details: error.details,
        moduleStats: this.getModuleStats(),
      },
    };

    await this.storage.publish(metric);
  }

  private getModuleStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.errorCounts.forEach((count, type) => {
      stats[type] = count;
    });
    return stats;
  }
}
