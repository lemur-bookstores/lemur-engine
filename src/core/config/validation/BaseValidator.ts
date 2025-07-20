import { KernelConfig } from '../types';
import { ConfigValidator, ValidationResult, ValidationError, ValidationContext } from './types';

export abstract class BaseValidator implements ConfigValidator {
    protected nextValidator: ConfigValidator | null = null;
    protected abstract validatorName: string;

    public setNextValidator(validator: ConfigValidator): ConfigValidator {
        this.nextValidator = validator;
        return validator;
    }

    public validate(config: KernelConfig): ValidationResult {
        const context: ValidationContext = {
            config,
            path: [],
            errors: []
        };

        this.doValidate(context);

        if (this.nextValidator) {
            const nextResult = this.nextValidator.validate(config);
            context.errors.push(...nextResult.errors);
        }

        return {
            isValid: context.errors.length === 0,
            errors: context.errors
        };
    }

    protected abstract doValidate(context: ValidationContext): void;

    public getValidatorName(): string {
        return this.validatorName;
    }

    protected addError(context: ValidationContext, error: Partial<ValidationError>): void {
        context.errors.push({
            code: error.code || 'VALIDATION_ERROR',
            message: error.message || 'Validation failed',
            path: [...context.path, ...(error.path || [])],
            value: error.value,
            details: error.details
        });
    }

    protected validateField<T>(
        context: ValidationContext,
        fieldPath: string[],
        validator: (value: T) => boolean,
        error: Partial<ValidationError>
    ): void {
        let current: any = context.config;
        for (const field of fieldPath) {
            if (current === undefined || current === null) {
                this.addError(context, {
                    code: 'FIELD_NOT_FOUND',
                    message: `Field ${fieldPath.join('.')} not found`,
                    path: fieldPath
                });
                return;
            }
            current = current[field];
        }

        context.path.push(...fieldPath);
        if (!validator(current)) {
            this.addError(context, {
                ...error,
                value: current
            });
        }
        context.path = context.path.slice(0, -fieldPath.length);
    }
}
