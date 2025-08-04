import { BaseValidator } from "./BaseValidator";
import { ValidationContext } from "./types";

export class CircuitBreakerValidator extends BaseValidator {
  protected validatorName = "circuit-breaker-validator";

  protected doValidate(context: ValidationContext): void {
    this.validateField(
      context,
      ["circuitBreaker"],
      (value: any) => typeof value === "object" || value === undefined,
      {
        code: "INVALID_CIRCUIT_BREAKER_CONFIG",
        message: "circuitBreaker configuration must be an object",
      },
      true, // circuitBreaker es opcional
    );

    this.validateField(
      context,
      ["circuitBreaker", "enabled"],
      (value: boolean) => typeof value === "boolean",
      {
        code: "INVALID_ENABLED_FLAG",
        message: "enabled must be a boolean value",
      },
      true,
    );

    this.validateField(
      context,
      ["circuitBreaker", "failureThreshold"],
      (value: number) =>
        typeof value === "number" && Number.isInteger(value) && value > 0,
      {
        code: "INVALID_FAILURE_THRESHOLD",
        message:
          "failureThreshold must be a positive integer representing the number of consecutive failures before opening the circuit",
      },
      true,
    );

    this.validateField(
      context,
      ["circuitBreaker", "resetTimeout"],
      (value: number) => typeof value === "number" && value > 0,
      {
        code: "INVALID_RESET_TIMEOUT",
        message: "resetTimeout must be a positive number",
      },
      true,
    );

    this.validateField(
      context,
      ["circuitBreaker", "halfOpenSuccessThreshold"],
      (value: number) => typeof value === "number" && value > 0,
      {
        code: "INVALID_HALF_OPEN_SUCCESS_THRESHOLD",
        message: "halfOpenSuccessThreshold must be a positive number",
      },
      true,
    );

    this.validateField(
      context,
      ["circuitBreaker", "failureCondition"],
      (value: Function | undefined) =>
        value === undefined || typeof value === "function",
      {
        code: "INVALID_FAILURE_CONDITION",
        message: "failureCondition must be a function when provided",
      },
      true,
    );
  }
}
