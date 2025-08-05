import { IConfigLoader } from "../interfaces/IConfigLoader";
import { KernelConfig } from "../types";
import { BaseConfigLoader } from "../base/BaseConfigLoader";

interface EnvConfigOptions {
  prefix?: string;
  separator?: string;
  transformKeys?: (key: string) => string;
}

export class EnvConfigLoader extends BaseConfigLoader implements IConfigLoader {
  private options: EnvConfigOptions;
  private configCache: KernelConfig | null = null;

  constructor(options: EnvConfigOptions = {}) {
    super();
    this.options = {
      prefix: "LEMUR_",
      separator: "_",
      transformKeys: (key: string) => key.toLowerCase(),
      ...options,
    };
  }

  public async loadConfig(): Promise<KernelConfig> {
    try {
      const config = this.parseEnvironmentVariables();
      this.validateConfig(config);

      const oldConfig = this.configCache;
      this.configCache = config;

      if (oldConfig) {
        await this.notifyConfigChange(oldConfig, config);
      }

      return config;
    } catch (error: any) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private parseEnvironmentVariables(): KernelConfig {
    const config: any = {};
    const { prefix, separator, transformKeys } = this.options;

    for (const [key, value] of Object.entries(process.env)) {
      if (!prefix || key.startsWith(prefix)) {
        const configKey = key.replace(prefix!, "");
        if (configKey) {
          const parts = configKey.split(separator!);
          let current = config;

          for (let i = 0; i < parts.length; i++) {
            const part = transformKeys!(parts[i]);
            if (i === parts.length - 1) {
              current[part] = this.parseValue(value!);
            } else {
              current[part] = current[part] || {};
              current = current[part];
            }
          }
        }
      }
    }

    return config as KernelConfig;
  }

  private parseValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // If it's not valid JSON, return as string
      return value;
    }
  }

  public getCachedConfig(): KernelConfig | null {
    return this.configCache;
  }
}
