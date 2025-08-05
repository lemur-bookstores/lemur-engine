import { BaseValidator } from "./BaseValidator";
import { ValidationContext } from "./types";

export class RetryConfigValidator extends BaseValidator {
  protected validatorName = "retry-config-validator";

  protected doValidate(context: ValidationContext): void {
    this.validateField(
      context,
      ["retry"],
      (value: any) => typeof value === "object" || value === undefined,
      {
        code: "INVALID_RETRY_CONFIG",
        message: "retry configuration must be an object",
      },
      true, // retry es opcional
    );

    this.validateField(
      context,
      ["retry", "maxAttempts"],
      (value: number) => typeof value === "number" && value > 0,
      {
        code: "INVALID_MAX_ATTEMPTS",
        message: "maxAttempts must be a positive number",
      },
      true,
    );

    this.validateField(
      context,
      ["retry", "delay"],
      (value: number) => typeof value === "number" && value >= 0,
      {
        code: "INVALID_DELAY",
        message: "delay must be a non-negative number",
      },
      true,
    );

    this.validateField(
      context,
      ["retry", "backoffFactor"],
      (value: number) => typeof value === "number" && value >= 1,
      {
        code: "INVALID_BACKOFF_FACTOR",
        message: "backoffFactor must be greater than or equal to 1",
      },
      true,
    );

    this.validateField(
      context,
      ["retry", "retryableErrors"],
      (value: string[]) =>
        Array.isArray(value) && value.every((e) => typeof e === "string"),
      {
        code: "INVALID_RETRYABLE_ERRORS",
        message: "retryableErrors must be an array of strings",
      },
      true,
    );
  }
}
