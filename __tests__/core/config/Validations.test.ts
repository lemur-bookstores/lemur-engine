import { BaseValidator } from "../../../src/core/config/validation/BaseValidator";
import { ValidationChain } from "../../../src/core/config/validation/ValidationChain";
import { ValidatorFactory } from "../../../src/core/config/validation/ValidatorFactory";
import { KernelConfig } from "../../../src/core/config/types";
import { ValidationContext } from "../../../src/core/config/validation/types";
import { defaultKernelConfig } from "../../../src/core/config/types";
import {
  DEFAULT_BULKHEAD_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_PLUGIN_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from "../../../src/core/config/defaults";

// Mock validator para testing
class MockValidator extends BaseValidator {
  protected validatorName = "mock-validator";
  private shouldFail: boolean;

  constructor(shouldFail = false) {
    super();
    this.shouldFail = shouldFail;
  }

  protected doValidate(context: ValidationContext): void {
    if (this.shouldFail) {
      this.addError(context, {
        code: "MOCK_ERROR",
        message: "Mock validation failed",
        path: ["test"],
      });
    }
  }
}

describe("BaseValidator", () => {
  let validator: MockValidator;
  let config: KernelConfig;

  beforeEach(() => {
    validator = new MockValidator();
    config = { ...defaultKernelConfig };
  });

  describe("validate", () => {
    it("should return valid result when validation passes", () => {
      const result = validator.validate(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid result when validation fails", () => {
      const failingValidator = new MockValidator(true);
      const result = failingValidator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("MOCK_ERROR");
    });

    it("should chain validators correctly", () => {
      const validator1 = new MockValidator(true);
      const validator2 = new MockValidator(true);

      validator1.setNextValidator(validator2);
      const result = validator1.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("setNextValidator", () => {
    it("should set next validator in chain", () => {
      const nextValidator = new MockValidator();
      const returned = validator.setNextValidator(nextValidator);

      expect(returned).toBe(nextValidator);
    });
  });

  describe("getValidatorName", () => {
    it("should return validator name", () => {
      expect(validator.getValidatorName()).toBe("mock-validator");
    });
  });

  describe("addError", () => {
    it("should add error to context", () => {
      const context: ValidationContext = {
        config,
        path: [],
        errors: [],
      };

      validator["addError"](context, {
        code: "TEST_ERROR",
        message: "Test error message",
      });

      expect(context.errors).toHaveLength(1);
      expect(context.errors[0].code).toBe("TEST_ERROR");
      expect(context.errors[0].message).toBe("Test error message");
    });

    it("should use default values for missing error properties", () => {
      const context: ValidationContext = {
        config,
        path: [],
        errors: [],
      };

      validator["addError"](context, {});

      expect(context.errors[0].code).toBe("VALIDATION_ERROR");
      expect(context.errors[0].message).toBe("Validation failed");
    });
  });

  describe("validateField", () => {
    it("should validate existing field successfully", () => {
      const context: ValidationContext = {
        config: { ...config, environment: "test" as any },
        path: [],
        errors: [],
      };

      validator["validateField"](
        context,
        ["environment"],
        (value: string) => value === "test",
        { code: "INVALID_ENV", message: "Invalid environment" },
      );

      expect(context.errors).toHaveLength(0);
    });

    it("should add error for invalid field value", () => {
      const context: ValidationContext = {
        config: { ...config, environment: "invalid" as any },
        path: [],
        errors: [],
      };

      validator["validateField"](
        context,
        ["environment"],
        (value: string) => value === "test",
        { code: "INVALID_ENV", message: "Invalid environment" },
      );

      expect(context.errors).toHaveLength(1);
      expect(context.errors[0].code).toBe("INVALID_ENV");
    });

    it("should add error for missing field", () => {
      const context: ValidationContext = {
        config: {
          environment: "development",
          version: "",
          retry: DEFAULT_RETRY_CONFIG,
          plugins: [],
          bulkhead: DEFAULT_BULKHEAD_CONFIG,
          circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
          errorHandler: {
            console: {
              enabled: false,
            },
            file: {
              enabled: false,
              path: "",
            },
          },
          pluginConfig: DEFAULT_PLUGIN_CONFIG,
          logging: {},
        },
        path: [],
        errors: [],
      };

      validator["validateField"](context, ["nonexistent"], () => true, {
        code: "FIELD_ERROR",
        message: "Field error",
      });

      expect(context.errors).toHaveLength(1);
      expect(context.errors[0].code).toBe("FIELD_NOT_FOUND");
    });
  });
});

describe("ValidationChain", () => {
  let chain: ValidationChain;
  let config: KernelConfig;

  beforeEach(() => {
    chain = new ValidationChain();
    config = { ...defaultKernelConfig };
  });

  describe("addValidator", () => {
    it("should add validator to empty chain", () => {
      const validator = new MockValidator();
      const result = chain.addValidator(validator);

      expect(result).toBe(chain);
    });

    it("should add multiple validators to chain", () => {
      const validator1 = new MockValidator();
      const validator2 = new MockValidator();

      chain.addValidator(validator1).addValidator(validator2);

      const result = chain.validate(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe("validate", () => {
    it("should return valid result for empty chain", () => {
      const result = chain.validate(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate using chain of validators", () => {
      const validator1 = new MockValidator(false);
      const validator2 = new MockValidator(true);

      chain.addValidator(validator1).addValidator(validator2);
      const result = chain.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("should reset chain to empty state", () => {
      const validator = new MockValidator();
      chain.addValidator(validator);

      chain.reset();
      const result = chain.validate(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("getValidators", () => {
    it("should return empty array for empty chain", () => {
      const validators = chain.getValidators();
      expect(validators).toHaveLength(0);
    });

    it("should return validator names", () => {
      const validator = new MockValidator();
      chain.addValidator(validator);

      const validators = chain.getValidators();
      expect(validators).toContain("mock-validator");
    });
  });
});

describe("ValidatorFactory", () => {
  describe("createValidator", () => {
    it("should create retry validator", () => {
      const validator = ValidatorFactory.createValidator("retry");
      expect(validator).toBeDefined();
      expect(validator?.getValidatorName()).toBe("retry-config-validator");
    });

    it("should create bulkhead validator", () => {
      const validator = ValidatorFactory.createValidator("bulkhead");
      expect(validator).toBeDefined();
      expect(validator?.getValidatorName()).toBe("bulkhead-config-validator");
    });

    it("should create circuit breaker validator", () => {
      const validator = ValidatorFactory.createValidator("circuitBreaker");
      expect(validator).toBeDefined();
      expect(validator?.getValidatorName()).toBe("circuit-breaker-validator");
    });

    it("should create plugin validator", () => {
      const validator = ValidatorFactory.createValidator("plugin");
      expect(validator).toBeDefined();
      expect(validator?.getValidatorName()).toBe("plugin-config-validator");
    });

    it("should return null for unknown validator type", () => {
      const validator = ValidatorFactory.createValidator("unknown");
      expect(validator).toBeNull();
    });
  });

  describe("createDefaultChain", () => {
    it("should create chain with all default validators", () => {
      const chain = ValidatorFactory.createDefaultChain();
      expect(chain).toBeInstanceOf(ValidationChain);

      const result = chain.validate(defaultKernelConfig);
      expect(result.isValid).toBe(true);
    });
  });

  describe("createCustomChain", () => {
    it("should create chain with specified validators", () => {
      const chain = ValidatorFactory.createCustomChain(["retry", "bulkhead"]);
      expect(chain).toBeInstanceOf(ValidationChain);
    });

    it("should skip unknown validator types", () => {
      const chain = ValidatorFactory.createCustomChain([
        "retry",
        "unknown",
        "bulkhead",
      ]);
      expect(chain).toBeInstanceOf(ValidationChain);
    });
  });

  describe("registerValidator", () => {
    it("should register custom validator", () => {
      class CustomValidator extends BaseValidator {
        protected validatorName = "custom-validator";
        protected doValidate(): void {}
      }

      ValidatorFactory.registerValidator("custom", CustomValidator);
      const validator = ValidatorFactory.createValidator("custom");

      expect(validator).toBeInstanceOf(CustomValidator);
      expect(validator?.getValidatorName()).toBe("custom-validator");
    });
  });
});
