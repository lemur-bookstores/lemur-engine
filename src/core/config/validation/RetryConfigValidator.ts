import { BaseValidator } from './BaseValidator';
import { ValidationContext } from './types';

export class RetryConfigValidator extends BaseValidator {
    protected validatorName = 'RetryConfigValidator';

    protected doValidate(context: ValidationContext): void {
        const retryConfig = context.config.retry;

        if (!retryConfig) {
            return; // La configuración de retry es opcional
        }

        this.validateField(
            context,
            ['retry', 'maxAttempts'],
            (value: number) => typeof value === 'number' && value > 0,
            {
                code: 'INVALID_MAX_ATTEMPTS',
                message: 'maxAttempts must be a positive number'
            }
        );

        this.validateField(
            context,
            ['retry', 'delay'],
            (value: number) => typeof value === 'number' && value >= 0,
            {
                code: 'INVALID_DELAY',
                message: 'delay must be a non-negative number'
            }
        );

        this.validateField(
            context,
            ['retry', 'backoffFactor'],
            (value: number) => typeof value === 'number' && value >= 1,
            {
                code: 'INVALID_BACKOFF_FACTOR',
                message: 'backoffFactor must be greater than or equal to 1'
            }
        );

        if (retryConfig.retryableErrors) {
            this.validateField(
                context,
                ['retry', 'retryableErrors'],
                (value: string[]) => Array.isArray(value) && value.every(e => typeof e === 'string'),
                {
                    code: 'INVALID_RETRYABLE_ERRORS',
                    message: 'retryableErrors must be an array of strings'
                }
            );
        }
    }
}
