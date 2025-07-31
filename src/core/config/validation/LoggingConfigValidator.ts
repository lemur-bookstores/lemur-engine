import { BaseValidator } from './BaseValidator';
import { ValidationContext } from './types';

export class LoggingConfigValidator extends BaseValidator {
    protected validatorName = 'logging-config-validator';

    protected doValidate(context: ValidationContext): void {
        this.validateField(
            context,
            ['logging'],
            (value: any) => typeof value === 'object' || value === undefined,
            {
                code: 'INVALID_LOGGING_CONFIG',
                message: 'logging configuration must be an object'
            },
            true
        );

        this.validateField(
            context,
            ['logging', 'level'],
            (value: string | undefined) => value === undefined || typeof value === 'string',
            {
                code: 'INVALID_LOGGING_LEVEL',
                message: 'logging.level must be a string'
            },
            true
        );

        this.validateField(
            context,
            ['logging', 'format'],
            (value: string | undefined) => value === undefined || typeof value === 'string',
            {
                code: 'INVALID_LOGGING_FORMAT',
                message: 'logging.format must be a string'
            },
            true
        );

        this.validateField(
            context,
            ['logging', 'timestamp'],
            (value: boolean | undefined) => typeof value === 'boolean' || value === undefined,
            {
                code: 'INVALID_LOGGING_TIMESTAMP',
                message: 'logging.timestamp must be a boolean'
            },
            true
        );
    }
}