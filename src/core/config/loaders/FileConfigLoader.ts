import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { IConfigLoader } from '../interfaces/IConfigLoader';
import { KernelConfig } from '../types';
import { BaseConfigLoader } from '../base/BaseConfigLoader';

export class FileConfigLoader extends BaseConfigLoader implements IConfigLoader {
    private configPath: string;
    private configCache: KernelConfig | null = null;
    private watchEnabled: boolean = false;
    private watcher: fs.FSWatcher | null = null;

    constructor(configPath: string, watchEnabled: boolean = false) {
        super();
        this.configPath = path.resolve(configPath);
        this.watchEnabled = watchEnabled;
        if (watchEnabled) {
            this.startWatching();
        }
    }

    private startWatching(): void {
        if (!this.watchEnabled || this.watcher) return;

        try {
            this.watcher = fs.watch(this.configPath, async (_eventType, _filename) => {
                try {
                    const newConfig = await this.loadConfig();
                    const oldConfig = this.configCache;
                    this.configCache = newConfig;

                    if (oldConfig) {
                        await this.notifyConfigChange(oldConfig, newConfig);
                    }
                } catch (error) {
                    console.error('Error in file watcher:', error);
                }
            });

            process.on('exit', () => {
                this.stopWatching();
            });
        } catch (error) {
            console.error('Error starting config file watcher:', error);
        }
    }

    private stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    public async loadConfig(configPath?: string): Promise<KernelConfig> {
        const targetPath = configPath || this.configPath;

        try {
            const fileContent = await fsPromises.readFile(targetPath, 'utf-8');
            const config = JSON.parse(fileContent) as KernelConfig;

            this.validateConfig(config);

            const oldConfig = this.configCache;
            this.configCache = config;

            if (oldConfig) {
                await this.notifyConfigChange(oldConfig, config);
            }

            return config;
        } catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    public async reloadConfig(): Promise<KernelConfig> {
        return this.loadConfig();
    }

    public getConfigPath(): string {
        return this.configPath;
    }

    public isWatchEnabled(): boolean {
        return this.watchEnabled;
    }

    public getCachedConfig(): KernelConfig | null {
        return this.configCache;
    }

    public dispose(): void {
        this.stopWatching();
    }
}
