import { KernelConfig } from "../types";
import { ConfigValidator, ValidationResult } from "./types";

export class ValidationChain {
  private head: ConfigValidator | null = null;
  private tail: ConfigValidator | null = null;

  public addValidator(validator: ConfigValidator): ValidationChain {
    if (!this.head) {
      this.head = validator;
      this.tail = validator;
    } else {
      this.tail!.setNextValidator(validator);
      this.tail = validator;
    }

    return this;
  }

  public validate(config: KernelConfig): ValidationResult {
    if (!this.head) {
      return {
        isValid: true,
        errors: [],
      };
    }

    return this.head.validate(config);
  }

  public reset(): void {
    this.head = null;
    this.tail = null;
  }

  public getValidators(): string[] {
    const validators: string[] = [];
    let current = this.head;

    while (current) {
      validators.push(current.getValidatorName());
      current = current.getNextValidator();
    }

    return validators;
  }
}
