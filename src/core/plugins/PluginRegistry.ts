import { EventEmitter } from "events";
import { Kernel } from "../Kernel";
import { Plugin } from "./PluginInterfaces";

export enum PluginStatus {
  UNINITIALIZED = "UNINITIALIZED",
  INITIALIZING = "INITIALIZING",
  ACTIVE = "ACTIVE",
  SHUTTING_DOWN = "SHUTTING_DOWN",
  INACTIVE = "INACTIVE",
  ERROR = "ERROR",
}

export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();
  private status: Map<string, PluginStatus> = new Map();
  private kernel: Kernel;

  constructor(kernel: Kernel) {
    super();
    this.kernel = kernel;
  }

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.metadata.name)) {
      throw new Error(`Plugin ${plugin.metadata.name} is already registered`);
    }

    this.plugins.set(plugin.metadata.name, plugin);
    this.status.set(plugin.metadata.name, PluginStatus.UNINITIALIZED);

    if (plugin.metadata.dependencies) {
      this.dependencies.set(
        plugin.metadata.name,
        new Set(plugin.metadata.dependencies),
      );
    }

    this.emit("plugin:registered", plugin);
  }

  async initializePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    // Verificar el estado actual
    if (this.status.get(pluginName) === PluginStatus.ACTIVE) {
      return;
    }

    // Verificar dependencias
    if (this.dependencies.has(pluginName)) {
      const deps = this.dependencies.get(pluginName)!;
      for (const dep of deps) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Dependency ${dep} not found for plugin ${pluginName}`,
          );
        }
        if (this.status.get(dep) !== PluginStatus.ACTIVE) {
          await this.initializePlugin(dep);
        }
      }
    }

    try {
      this.status.set(pluginName, PluginStatus.INITIALIZING);
      this.emit("plugin:initializing", plugin);

      await plugin.initialize(this.kernel);

      this.status.set(pluginName, PluginStatus.ACTIVE);
      this.emit("plugin:initialized", plugin);
    } catch (error: any) {
      this.status.set(pluginName, PluginStatus.ERROR);
      this.emit("plugin:error", { plugin, error });
      throw error;
    }
  }

  async shutdownPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    // Verificar plugins dependientes
    for (const [name, deps] of this.dependencies.entries()) {
      if (
        deps.has(pluginName) &&
        this.status.get(name) === PluginStatus.ACTIVE
      ) {
        await this.shutdownPlugin(name);
      }
    }

    try {
      this.status.set(pluginName, PluginStatus.SHUTTING_DOWN);
      this.emit("plugin:shuttingDown", plugin);

      await plugin.shutdown();

      this.status.set(pluginName, PluginStatus.INACTIVE);
      this.emit("plugin:shutdown", plugin);
    } catch (error: any) {
      this.status.set(pluginName, PluginStatus.ERROR);
      this.emit("plugin:error", { plugin, error });
      throw error;
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getPluginStatus(name: string): PluginStatus | undefined {
    return this.status.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getDependencies(pluginName: string): string[] {
    const deps = this.dependencies.get(pluginName);
    return deps ? Array.from(deps) : [];
  }

  getDependents(pluginName: string): string[] {
    const dependents: string[] = [];
    for (const [name, deps] of this.dependencies.entries()) {
      if (deps.has(pluginName)) {
        dependents.push(name);
      }
    }
    return dependents;
  }
}
