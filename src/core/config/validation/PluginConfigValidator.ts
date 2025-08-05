import { BaseValidator } from "./BaseValidator";
import { ValidationContext } from "./types";

export class PluginConfigValidator extends BaseValidator {
  protected validatorName = "plugin-config-validator";

  protected doValidate(context: ValidationContext): void {
    this.validateField(
      context,
      ["plugins"],
      (value: any[]) => Array.isArray(value),
      {
        code: "INVALID_PLUGINS_ARRAY",
        message: "plugins must be an array",
      },
      true, // plugins es opcional
    );

    const pluginsConfig = context.config.plugins;
    if (pluginsConfig && Array.isArray(pluginsConfig)) {
      pluginsConfig.forEach((_plugin, index) => {
        this.validatePluginConfig(context, index);
      });
    }

    this.validateField(
      context,
      ["pluginConfig"],
      (value: any) => typeof value === "object" && value !== null,
      {
        code: "INVALID_PLUGIN_CONFIG_OBJECT",
        message: "pluginConfig must be an object",
      },
      true, // pluginConfig es opcional
    );

    if (context.config.pluginConfig) {
      this.validatePluginConfigObject(context);
    }
  }

  private validatePluginConfigObject(context: ValidationContext): void {
    // Validate metadata
    this.validateField(
      context,
      ["pluginConfig", "metadata"],
      (value: any) => typeof value === "object" && value !== null,
      {
        code: "INVALID_PLUGIN_METADATA",
        message: "Plugin metadata must be an object",
      },
      true, // metadata es opcional
    );

    if (context.config.pluginConfig.metadata) {
      const metadataPath = ["pluginConfig", "metadata"];
      this.validateField(
        context,
        [...metadataPath, "name"],
        (value: string) => typeof value === "string",
        {
          code: "INVALID_PLUGIN_METADATA_NAME",
          message: "Plugin metadata name must be a string",
        },
        true, // name es opcional
      );

      this.validateField(
        context,
        [...metadataPath, "version"],
        (value: string) => typeof value === "string",
        {
          code: "INVALID_PLUGIN_METADATA_VERSION",
          message: "Plugin metadata version must be a string",
        },
        true, // version es opcional
      );

      this.validateField(
        context,
        [...metadataPath, "enabled"],
        (value: boolean) => typeof value === "boolean",
        {
          code: "INVALID_PLUGIN_METADATA_ENABLED",
          message: "Plugin metadata enabled must be a boolean",
        },
        true, // enabled es opcional
      );
    }

    // Validate autoload
    this.validateField(
      context,
      ["pluginConfig", "autoload"],
      (value: any) => typeof value === "object" && value !== null,
      {
        code: "INVALID_PLUGIN_AUTOLOAD",
        message: "Plugin autoload must be an object",
      },
      true, // autoload es opcional
    );

    if (context.config.pluginConfig.autoload) {
      const autoloadPath = ["pluginConfig", "autoload"];
      this.validateField(
        context,
        [...autoloadPath, "enabled"],
        (value: boolean) => typeof value === "boolean",
        {
          code: "INVALID_PLUGIN_AUTOLOAD_ENABLED",
          message: "Plugin autoload enabled must be a boolean",
        },
        true, // enabled es opcional
      );

      this.validateField(
        context,
        [...autoloadPath, "directories"],
        (value: string[]) => Array.isArray(value),
        {
          code: "INVALID_PLUGIN_AUTOLOAD_DIRECTORIES",
          message: "Plugin autoload directories must be an array",
        },
        true, // directories es opcional
      );
    }
  }

  private validatePluginConfig(
    context: ValidationContext,
    index: number,
  ): void {
    const basePath = ["plugins", index.toString()];

    this.validateField(
      context,
      [...basePath, "name"],
      (value: string) => typeof value === "string" && value.length > 0,
      {
        code: "INVALID_PLUGIN_NAME",
        message: "Plugin name must be a non-empty string",
      },
      true, // name es opcional
    );

    this.validateField(
      context,
      [...basePath, "version"],
      (value: string) =>
        typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value),
      {
        code: "INVALID_PLUGIN_VERSION",
        message: "Plugin version must be a valid semver string",
      },
      true, // version es opcional
    );

    this.validateField(
      context,
      [...basePath, "enabled"],
      (value: boolean) => typeof value === "boolean",
      {
        code: "INVALID_PLUGIN_ENABLED",
        message: "Plugin enabled must be a boolean value",
      },
      true, // enabled es opcional
    );

    this.validateField(
      context,
      [...basePath, "dependencies"],
      (value: string[]) =>
        Array.isArray(value) && value.every((dep) => typeof dep === "string"),
      {
        code: "INVALID_PLUGIN_DEPENDENCIES",
        message: "Plugin dependencies must be an array of strings",
      },
      true, // dependencies es opcional
    );

    this.validateField(
      context,
      [...basePath, "config"],
      (value: object) => typeof value === "object" && value !== null,
      {
        code: "INVALID_PLUGIN_CONFIG",
        message: "Plugin config must be an object",
      },
      true, // config es opcional
    );
  }
}
