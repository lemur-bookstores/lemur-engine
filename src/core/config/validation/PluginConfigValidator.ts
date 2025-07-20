import { BaseValidator } from './BaseValidator';
import { ValidationContext } from './types';

export class PluginConfigValidator extends BaseValidator {
    protected validatorName = 'PluginConfigValidator';

    protected doValidate(context: ValidationContext): void {
        const pluginsConfig = context.config.plugins;

        if (!pluginsConfig) {
            return; // La configuración de plugins es opcional
        }

        this.validateField(
            context,
            ['plugins'],
            (value: any[]) => Array.isArray(value),
            {
                code: 'INVALID_PLUGINS_CONFIG',
                message: 'plugins configuration must be an array'
            }
        );

        pluginsConfig.forEach((_plugin, index) => {
            this.validatePluginConfig(context, index);
        });
    }

    private validatePluginConfig(context: ValidationContext, index: number): void {
        const basePath = ['plugins', index.toString()];

        this.validateField(
            context,
            [...basePath, 'name'],
            (value: string) => typeof value === 'string' && value.length > 0,
            {
                code: 'INVALID_PLUGIN_NAME',
                message: 'Plugin name must be a non-empty string'
            }
        );

        this.validateField(
            context,
            [...basePath, 'version'],
            (value: string) => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value),
            {
                code: 'INVALID_PLUGIN_VERSION',
                message: 'Plugin version must be a valid semver string'
            }
        );

        this.validateField(
            context,
            [...basePath, 'enabled'],
            (value: boolean) => typeof value === 'boolean',
            {
                code: 'INVALID_PLUGIN_ENABLED',
                message: 'Plugin enabled must be a boolean'
            }
        );

        const plugin = context.config.plugins[index];

        if (plugin.dependencies) {
            this.validateField(
                context,
                [...basePath, 'dependencies'],
                (value: string[]) => Array.isArray(value) && value.every(dep => typeof dep === 'string'),
                {
                    code: 'INVALID_PLUGIN_DEPENDENCIES',
                    message: 'Plugin dependencies must be an array of strings'
                }
            );
        }

        if (plugin.config) {
            this.validateField(
                context,
                [...basePath, 'config'],
                (value: object) => typeof value === 'object' && value !== null,
                {
                    code: 'INVALID_PLUGIN_CONFIG',
                    message: 'Plugin config must be an object'
                }
            );
        }
    }
}
