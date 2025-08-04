import { KernelConfig } from "../types";
import { IConfigLoader } from "../interfaces/IConfigLoader";
import {
  ConfigEventManager,
  ConfigChangeEventType,
} from "../events/ConfigEventManager";
import { Logger } from "../../../utils/Logger";
import { ConfigChangeListener } from "../events/ConfigChangeListener";

export class ConfigLoaderMediator {
  private static instance: ConfigLoaderMediator;
  private loaders: Map<string, IConfigLoader> = new Map();
  private logger: Logger;
  private eventManager: ConfigEventManager;

  private constructor() {
    this.logger = new Logger("ConfigLoaderMediator");
    this.eventManager = ConfigEventManager.getInstance();
    this.setupEventHandlers();
  }

  public static getInstance(): ConfigLoaderMediator {
    if (!ConfigLoaderMediator.instance) {
      ConfigLoaderMediator.instance = new ConfigLoaderMediator();
    }
    return ConfigLoaderMediator.instance;
  }

  private setupEventHandlers(): void {
    this.eventManager.subscribe(ConfigChangeEventType.CONFIG_LOADED, {
      onConfigChange: (oldConfig, newConfig) => {
        this.logger.info("Configuration loaded", {
          changes: this.getConfigChanges(oldConfig, newConfig),
        });
      },
    });

    this.eventManager.subscribe(ConfigChangeEventType.CONFIG_ERROR, {
      onConfigChange: (_oldConfig, _newConfig) => {
        // Para eventos de error, usamos el handler general
        this.logger.error("Configuration error occurred");
      },
    });
  }

  public registerLoader(id: string, loader: IConfigLoader): void {
    this.loaders.set(id, loader);
    this.logger.debug(`Registered config loader: ${id}`);
  }

  public unregisterLoader(id: string): void {
    if (this.loaders.delete(id)) {
      this.logger.debug(`Unregistered config loader: ${id}`);
    }
  }

  public getLoader(id: string): IConfigLoader | undefined {
    return this.loaders.get(id);
  }

  public getAllLoaders(): Map<string, IConfigLoader> {
    return new Map(this.loaders);
  }

  public async loadConfig(
    loaderId: string,
    configPath?: string,
  ): Promise<KernelConfig> {
    const loader = this.loaders.get(loaderId);
    if (!loader) {
      throw new Error(`Config loader not found: ${loaderId}`);
    }

    this.logger.debug(`Loading config using loader: ${loaderId}`);
    try {
      const config = await loader.loadConfig(configPath);
      this.logger.info(`Successfully loaded config using ${loaderId}`);
      return config;
    } catch (error: any) {
      this.logger.error(`Error loading config with ${loaderId}`, { error });
      throw error;
    }
  }

  public registerPluginValidator(_plugin: any): void {
    // TODO: Implementar registro de validadores personalizados
    this.logger.debug("Plugin validator registration not implemented yet");
  }

  public addConfigExtension(_extension: any): void {
    // TODO: Implementar sistema de extensiones de configuración
    this.logger.debug("Config extension system not implemented yet");
  }

  public registerEventHook(
    eventType: ConfigChangeEventType,
    hook: ConfigChangeListener,
  ): void {
    this.eventManager.subscribe(eventType, hook);
    this.logger.debug(`Registered event hook for: ${eventType}`);
  }

  private getConfigChanges(
    oldConfig?: KernelConfig,
    newConfig?: KernelConfig,
  ): string[] {
    if (!oldConfig || !newConfig) return [];

    const changes: string[] = [];
    this.compareObjects(oldConfig, newConfig, "", changes);
    return changes;
  }

  private compareObjects(
    obj1: any,
    obj2: any,
    path: string,
    changes: string[],
  ): void {
    for (const key in obj1) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in obj2)) {
        changes.push(`Removed: ${currentPath}`);
        continue;
      }

      if (typeof obj1[key] === "object" && obj1[key] !== null) {
        this.compareObjects(obj1[key], obj2[key], currentPath, changes);
      } else if (obj1[key] !== obj2[key]) {
        changes.push(`Changed: ${currentPath}`);
      }
    }

    for (const key in obj2) {
      if (!(key in obj1)) {
        const currentPath = path ? `${path}.${key}` : key;
        changes.push(`Added: ${currentPath}`);
      }
    }
  }
}
