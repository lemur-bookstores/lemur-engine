import { BaseValidator } from './BaseValidator';
import { ValidationContext } from './types';

export class ErrorHandlerValidator extends BaseValidator {
    protected validatorName = 'error-handler-validator';

    protected doValidate(context: ValidationContext): void {
        this.validateField(
            context,
            ['errorHandler'],
            (value: any) => typeof value === 'object' || value === undefined,
            {
                code: 'INVALID_ERROR_HANDLER_CONFIG',
                message: 'errorHandler configuration must be an object'
            },
            true
        );

        this.validateField(
            context,
            ['errorHandler', 'console', 'enabled'],
            (value: boolean | undefined) => typeof value === 'boolean' || value === undefined,
            {
                code: 'INVALID_CONSOLE_ENABLED',
                message: 'console.enabled must be a boolean'
            },
            true
        );

        this.validateField(
            context,
            ['errorHandler', 'console', 'level'],
            (value: string | undefined) => value === undefined || typeof value === 'string',
            {
                code: 'INVALID_CONSOLE_LEVEL',
                message: 'console.level must be a string'
            },
            true
        );

        this.validateField(
            context,
            ['errorHandler', 'file', 'enabled'],
            (value: boolean | undefined) => typeof value === 'boolean' || value === undefined,
            {
                code: 'INVALID_FILE_ENABLED',
                message: 'file.enabled must be a boolean'
            },
            true
        );

        this.validateField(
            context,
            ['errorHandler', 'file', 'path'],
            (value: string | undefined) => value === undefined || typeof value === 'string',
            {
                code: 'INVALID_FILE_PATH',
                message: 'file.path must be a string'
            },
            true
        );

        this.validateField(
            context,
            ['errorHandler', 'file', 'maxSize'],
            (value: string | undefined) => value === undefined || typeof value === 'string',
            {
                code: 'INVALID_FILE_MAX_SIZE',
                message: 'file.maxSize must be a string'
            },
            true
        );

        this.validateField(
            context,
            ['errorHandler', 'file', 'maxFiles'],
            (value: number | undefined) => value === undefined || typeof value === 'number',
            {
                code: 'INVALID_FILE_MAX_FILES',
                message: 'file.maxFiles must be a number'
            },
            true
        );
    }
}