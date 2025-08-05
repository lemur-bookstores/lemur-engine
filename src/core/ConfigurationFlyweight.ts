/**
 * Interface para configuraciones compartidas
 */
export interface ConfigurationData {
  readonly key: string;
  readonly value: any;
  readonly metadata: Record<string, any>;
}

/**
 * Flyweight factory para configuraciones
 */
export class ConfigurationFlyweightFactory {
  private static configurations: Map<string, ConfigurationData> = new Map();

  static getConfiguration(key: string, defaultValue?: any): ConfigurationData {
    if (!this.configurations.has(key)) {
      this.configurations.set(key, {
        key,
        value: defaultValue,
        metadata: {},
      });
    }
    return this.configurations.get(key)!;
  }

  static setConfiguration(
    key: string,
    value: any,
    metadata: Record<string, any> = {},
  ): void {
    this.configurations.set(key, { key, value, metadata });
  }

  static hasConfiguration(key: string): boolean {
    return this.configurations.has(key);
  }

  static deleteConfiguration(key: string): boolean {
    return this.configurations.delete(key);
  }

  static clearConfigurations(): void {
    this.configurations.clear();
  }

  static getConfigurationCount(): number {
    return this.configurations.size;
  }
}

/**
 * Cliente que usa las configuraciones compartidas
 */
export class ConfigurationManager {
  private localOverrides: Map<string, any> = new Map();

  getValue(key: string, defaultValue?: any): any {
    // Primero revisar overrides locales
    if (this.localOverrides.has(key)) {
      return this.localOverrides.get(key);
    }

    // Obtener configuración compartida
    const config = ConfigurationFlyweightFactory.getConfiguration(
      key,
      defaultValue,
    );
    return config.value;
  }

  setValue(key: string, value: any, shared: boolean = false): void {
    if (shared) {
      ConfigurationFlyweightFactory.setConfiguration(key, value);
    } else {
      this.localOverrides.set(key, value);
    }
  }

  clearLocalOverrides(): void {
    this.localOverrides.clear();
  }

  hasLocalOverride(key: string): boolean {
    return this.localOverrides.has(key);
  }
}
