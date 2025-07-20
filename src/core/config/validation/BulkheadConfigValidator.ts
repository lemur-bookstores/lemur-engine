import { BaseValidator } from './BaseValidator';
import { ValidationContext } from './types';

export class BulkheadConfigValidator extends BaseValidator {
    protected validatorName = 'BulkheadConfigValidator';

    protected doValidate(context: ValidationContext): void {
        const bulkheadConfig = context.config.bulkhead;

        if (!bulkheadConfig) {
            return; // La configuración de bulkhead es opcional
        }

        this.validateField(
            context,
            ['bulkhead', 'maxConcurrent'],
            (value: number) => typeof value === 'number' && value > 0,
            {
                code: 'INVALID_MAX_CONCURRENT',
                message: 'maxConcurrent must be a positive number'
            }
        );

        this.validateField(
            context,
            ['bulkhead', 'maxQueueSize'],
            (value: number) => typeof value === 'number' && value >= 0,
            {
                code: 'INVALID_MAX_QUEUE_SIZE',
                message: 'maxQueueSize must be a non-negative number'
            }
        );

        this.validateField(
            context,
            ['bulkhead', 'queueTimeout'],
            (value: number) => typeof value === 'number' && value >= 0,
            {
                code: 'INVALID_QUEUE_TIMEOUT',
                message: 'queueTimeout must be a non-negative number'
            }
        );
    }
}
