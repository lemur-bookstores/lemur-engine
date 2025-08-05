import { BaseValidator } from "./BaseValidator";
import { ValidationContext } from "./types";

export class BulkheadConfigValidator extends BaseValidator {
  protected validatorName = "bulkhead-config-validator";

  protected doValidate(context: ValidationContext): void {
    this.validateField(
      context,
      ["bulkhead"],
      (value: any) => typeof value === "object" || value === undefined,
      {
        code: "INVALID_BULKHEAD_CONFIG",
        message: "bulkhead configuration must be an object",
      },
      true, // bulkhead es opcional
    );

    this.validateField(
      context,
      ["bulkhead", "maxConcurrent"],
      (value: number) => typeof value === "number" && value > 0,
      {
        code: "INVALID_MAX_CONCURRENT",
        message: "maxConcurrent must be a positive number",
      },
      true,
    );

    this.validateField(
      context,
      ["bulkhead", "maxQueueSize"],
      (value: number) => typeof value === "number" && value >= 0,
      {
        code: "INVALID_MAX_QUEUE_SIZE",
        message: "maxQueueSize must be a non-negative number",
      },
      true,
    );

    this.validateField(
      context,
      ["bulkhead", "queueTimeout"],
      (value: number) => typeof value === "number" && value >= 0,
      {
        code: "INVALID_QUEUE_TIMEOUT",
        message: "queueTimeout must be a non-negative number",
      },
      true,
    );
  }
}
