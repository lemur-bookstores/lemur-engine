import { Plugin } from "./PluginInterfaces";
import fs from "fs/promises";
import path from "path";
import { findUp } from "../../utils";

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  permissions?: string[];
  entry: string;
  config?: string;
}

export class PluginLoader {
  private pluginsDir: string;
  private loadedPlugins: Map<string, Plugin>;

  constructor(pluginsDir: string) {
    this.pluginsDir = pluginsDir;
    this.loadedPlugins = new Map();
  }

  /**
   * Carga automáticamente todos los plugins del directorio
   */
  async loadPlugins(): Promise<Map<string, Plugin>> {
    try {
      // Leer el directorio de plugins
      const entries = await fs.readdir(this.pluginsDir, {
        withFileTypes: true,
      });
      const pluginDirs = entries.filter((entry) => entry.isDirectory());

      // Cargar cada plugin en paralelo
      const loadPromises = pluginDirs.map((dir) =>
        this.loadSinglePlugin(dir.name),
      );
      const loadedPlugins = await Promise.all(loadPromises);

      // Filtrar plugins válidos y agregarlos al mapa
      loadedPlugins.forEach((plugin: Plugin | null) => {
        if (plugin) {
          this.loadedPlugins.set(plugin.metadata.name, plugin);
        }
      });

      return this.loadedPlugins;
    } catch (error: any) {
      console.error("Error loading plugins:", error);
      throw error;
    }
  }

  /**
   * Carga un plugin individual
   */
  private async loadSinglePlugin(pluginDir: string): Promise<Plugin | null> {
    try {
      const pluginPath = path.join(this.pluginsDir, pluginDir);

      // Buscar plugin.json usando findUp desde el directorio del plugin
      const metadataPath = await findUp("plugin.json", pluginPath);

      if (!metadataPath) {
        console.warn(
          `No plugin.json found for plugin in directory: ${pluginDir}`,
        );
        return null;
      }

      // Cargar y validar metadata
      const metadata = await this.loadMetadata(metadataPath);
      if (!this.validateMetadata(metadata)) {
        console.error(`Invalid metadata for plugin: ${pluginDir}`);
        return null;
      }

      // Cargar el módulo del plugin (buscar desde el directorio donde se encontró plugin.json)
      const pluginBaseDir = path.dirname(metadataPath);
      const entryPath = path.join(pluginBaseDir, metadata.entry);
      const pluginModule = require(entryPath);

      // Verificar que el módulo exporta una clase de plugin válida
      if (!this.validatePluginModule(pluginModule)) {
        console.error(`Invalid plugin module in: ${pluginDir}`);
        return null;
      }

      // Instanciar el plugin
      const plugin = new pluginModule.default();
      plugin.metadata = metadata;

      return plugin;
    } catch (error: any) {
      console.error(`Error loading plugin from ${pluginDir}:`, error);
      return null;
    }
  }

  /**
   * Carga y parsea el archivo de metadata
   */
  private async loadMetadata(metadataPath: string): Promise<PluginMetadata> {
    const content = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(content);
  }

  /**
   * Valida la metadata del plugin
   */
  private validateMetadata(metadata: PluginMetadata): boolean {
    const requiredFields = ["name", "version", "entry"];
    return requiredFields.every(
      (field) => metadata[field as keyof PluginMetadata],
    );
  }

  /**
   * Valida que el módulo del plugin sea válido
   */
  private validatePluginModule(module: any): boolean {
    return (
      module &&
      typeof module.default === "function" &&
      module.default.prototype.initialize &&
      module.default.prototype.shutdown
    );
  }
}
