import { KernelConfig } from "../types";

export interface ValidationError {
  code: string;
  message: string;
  path?: string[];
  value?: any;
  details?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ConfigValidator {
  validate(config: KernelConfig): ValidationResult;
  getValidatorName(): string;
  setNextValidator(validator: ConfigValidator): ConfigValidator;
  getNextValidator(): ConfigValidator | null;
}

export interface ValidationContext {
  config: KernelConfig;
  path: string[];
  errors: ValidationError[];
}
