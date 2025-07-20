import { BaseValidator } from './BaseValidator';
import { ValidationContext } from './types';

export class CircuitBreakerValidator extends BaseValidator {
    protected validatorName = 'CircuitBreakerValidator';

    protected doValidate(context: ValidationContext): void {
        const circuitConfig = context.config.circuitBreaker;

        if (!circuitConfig) {
            return; // La configuración de circuit breaker es opcional
        }

        this.validateField(
            context,
            ['circuitBreaker', 'failureThreshold'],
            (value: number) => typeof value === 'number' && value > 0 && value <= 1,
            {
                code: 'INVALID_FAILURE_THRESHOLD',
                message: 'failureThreshold must be a number between 0 and 1'
            }
        );

        this.validateField(
            context,
            ['circuitBreaker', 'resetTimeout'],
            (value: number) => typeof value === 'number' && value > 0,
            {
                code: 'INVALID_RESET_TIMEOUT',
                message: 'resetTimeout must be a positive number'
            }
        );

        this.validateField(
            context,
            ['circuitBreaker', 'halfOpenSuccessThreshold'],
            (value: number) => typeof value === 'number' && value > 0,
            {
                code: 'INVALID_HALF_OPEN_SUCCESS_THRESHOLD',
                message: 'halfOpenSuccessThreshold must be a positive number'
            }
        );

        if (circuitConfig.failureCondition) {
            this.validateField(
                context,
                ['circuitBreaker', 'failureCondition'],
                (value: Function) => typeof value === 'function',
                {
                    code: 'INVALID_FAILURE_CONDITION',
                    message: 'failureCondition must be a function'
                }
            );
        }
    }
}
