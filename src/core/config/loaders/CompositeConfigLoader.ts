import { IConfigLoader } from "../interfaces/IConfigLoader";
import { KernelConfig } from "../types";
import { BaseConfigLoader } from "../base/BaseConfigLoader";

interface LoaderEntry {
  loader: IConfigLoader;
  priority: number;
}

export class CompositeConfigLoader
  extends BaseConfigLoader
  implements IConfigLoader
{
  private loaders: LoaderEntry[] = [];
  private configCache: KernelConfig | null = null;

  public addLoader(loader: IConfigLoader, priority: number = 0): void {
    this.loaders.push({ loader, priority });
    this.loaders.sort((a, b) => b.priority - a.priority);

    loader.subscribe({
      onConfigChange: async () => {
        await this.reloadAndNotify();
      },
    });
  }

  public removeLoader(loader: IConfigLoader): void {
    const index = this.loaders.findIndex((entry) => entry.loader === loader);
    if (index !== -1) {
      this.loaders.splice(index, 1);
    }
  }

  public async loadConfig(): Promise<KernelConfig> {
    try {
      const configs = await Promise.all(
        this.loaders.map((entry) => entry.loader.loadConfig()),
      );

      let mergedConfig = {} as KernelConfig;
      for (const config of configs) {
        mergedConfig = this.mergeConfigs(mergedConfig, config);
      }

      this.validateConfig(mergedConfig);

      const oldConfig = this.configCache;
      this.configCache = mergedConfig;

      if (oldConfig) {
        await this.notifyConfigChange(oldConfig, mergedConfig);
      }

      return mergedConfig;
    } catch (error: any) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private async reloadAndNotify(): Promise<void> {
    const oldConfig = this.configCache;
    if (oldConfig) {
      const newConfig = await this.loadConfig();
      await this.notifyConfigChange(oldConfig, newConfig);
    }
  }

  public getLoaders(): LoaderEntry[] {
    return [...this.loaders];
  }

  public getCachedConfig(): KernelConfig | null {
    return this.configCache;
  }
}
