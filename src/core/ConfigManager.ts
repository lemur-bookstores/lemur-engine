import { ConfigProvider } from '../types';

export class ConfigManager {
    private providers: ConfigProvider[] = [];
    private watchers: Map<string, ((value: any) => void)[]> = new Map();

    addProvider(provider: ConfigProvider): void {
        this.providers.push(provider);
    }

    get<T>(key: string): T | undefined {
        // Check providers in order of priority
        for (const provider of this.providers) {
            const value = provider.get<T>(key);
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }

    set(key: string, value: any): void {
        this.providers[0]?.set(key, value);
        this.notifyWatchers(key, value);
    }

    watch(key: string, callback: (value: any) => void): void {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, []);
        }
        this.watchers.get(key)!.push(callback);
    }

    private notifyWatchers(key: string, value: any): void {
        const callbacks = this.watchers.get(key) || [];
        callbacks.forEach(callback => callback(value));
    }
}
