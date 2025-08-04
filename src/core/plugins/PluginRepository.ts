import { Plugin } from "./PluginInterfaces";
import fs from "fs/promises";
import path from "path";

export class PluginRepository {
  private storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = storageDir;
  }

  /**
   * Guarda la configuración y estado de un plugin
   */
  async savePluginState(plugin: Plugin): Promise<void> {
    const state = {
      metadata: plugin.metadata,
      status: plugin.status(),
      config: await this.getPluginConfig(plugin),
    };

    const filePath = this.getPluginStatePath(plugin.metadata.name);
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
  }

  /**
   * Restaura el estado de un plugin
   */
  async loadPluginState(pluginName: string): Promise<any> {
    const filePath = this.getPluginStatePath(pluginName);
    try {
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Backup de todos los plugins
   */
  async backupPlugins(plugins: Map<string, Plugin>): Promise<void> {
    const backupDir = path.join(
      this.storageDir,
      "backups",
      new Date().toISOString(),
    );
    await fs.mkdir(backupDir, { recursive: true });

    for (const [name, plugin] of plugins) {
      const state = {
        metadata: plugin.metadata,
        status: plugin.status(),
        config: await this.getPluginConfig(plugin),
      };

      const backupPath = path.join(backupDir, `${name}.json`);
      await fs.writeFile(backupPath, JSON.stringify(state, null, 2));
    }
  }

  /**
   * Restaura plugins desde un backup
   */
  async restoreFromBackup(backupDir: string): Promise<Map<string, any>> {
    const restored = new Map<string, any>();
    const files = await fs.readdir(backupDir);

    for (const file of files) {
      if (file.endsWith(".json")) {
        const data = await fs.readFile(path.join(backupDir, file), "utf-8");
        const pluginName = path.basename(file, ".json");
        restored.set(pluginName, JSON.parse(data));
      }
    }

    return restored;
  }

  private getPluginStatePath(pluginName: string): string {
    return path.join(this.storageDir, "states", `${pluginName}.json`);
  }

  private async getPluginConfig(plugin: Plugin): Promise<any> {
    const configPath = path.join(
      this.storageDir,
      "config",
      `${plugin.metadata.name}.json`,
    );

    try {
      // Intentar cargar la configuración específica del plugin
      const configExists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);

      if (configExists) {
        const configData = await fs.readFile(configPath, "utf-8");
        const config = JSON.parse(configData);

        // Mezclar con la configuración por defecto
        return {
          ...this.getDefaultConfig(),
          ...config,
          metadata: {
            lastLoaded: new Date().toISOString(),
            version: plugin.metadata.version,
          },
        };
      }

      // Si no existe configuración, crear una por defecto
      const defaultConfig = {
        ...this.getDefaultConfig(),
        metadata: {
          created: new Date().toISOString(),
          version: plugin.metadata.version,
        },
      };

      // Guardar la configuración por defecto
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

      return defaultConfig;
    } catch (error: any) {
      console.error(
        `Error loading config for plugin ${plugin.metadata.name}:`,
        error,
      );
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): any {
    return {
      enabled: true,
      logging: {
        level: "info",
        enabled: true,
      },
      performance: {
        maxMemoryMB: 512,
        maxConcurrentOperations: 10,
      },
      security: {
        allowedOperations: [],
        restrictedFeatures: [],
      },
      storage: {
        persistData: true,
        maxStorageMB: 100,
      },
      lifecycle: {
        startupTimeoutMs: 5000,
        shutdownTimeoutMs: 5000,
        healthCheckIntervalMs: 30000,
      },
    };
  }
}
