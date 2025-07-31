import { RetryConfigValidator } from './RetryConfigValidator';
import { BulkheadConfigValidator } from './BulkheadConfigValidator';
import { CircuitBreakerValidator } from './CircuitBreakerValidator';
import { PluginConfigValidator } from './PluginConfigValidator';
import { ErrorHandlerValidator } from './ErrorHandlerValidator';
import { LoggingConfigValidator } from './LoggingConfigValidator';
import { ValidationChain } from './ValidationChain';
import { ConfigValidator } from './types';

export class ValidatorFactory {
    private static validators = new Map<string, new () => ConfigValidator>();

    static {
        ValidatorFactory.validators.set('retry', RetryConfigValidator);
        ValidatorFactory.validators.set('bulkhead', BulkheadConfigValidator);
        ValidatorFactory.validators.set('circuitBreaker', CircuitBreakerValidator);
        ValidatorFactory.validators.set('plugin', PluginConfigValidator);
        ValidatorFactory.validators.set('errorHandler', ErrorHandlerValidator);
        ValidatorFactory.validators.set('logging', LoggingConfigValidator);
    }

    public static createValidator(type: string): ConfigValidator | null {
        const ValidatorClass = ValidatorFactory.validators.get(type);
        return ValidatorClass ? new ValidatorClass() : null;
    }

    public static createDefaultChain(): ValidationChain {
        const chain = new ValidationChain();

        ValidatorFactory.validators.forEach((_, type) => {
            const validator = ValidatorFactory.createValidator(type);
            if (validator) {
                chain.addValidator(validator);
            }
        });

        return chain;
    }

    public static createCustomChain(validatorTypes: string[]): ValidationChain {
        const chain = new ValidationChain();

        validatorTypes.forEach(type => {
            const validator = ValidatorFactory.createValidator(type);
            if (validator) {
                chain.addValidator(validator);
            }
        });

        return chain;
    }

    public static registerValidator(
        type: string,
        validatorClass: new () => ConfigValidator
    ): void {
        ValidatorFactory.validators.set(type, validatorClass);
    }
}
