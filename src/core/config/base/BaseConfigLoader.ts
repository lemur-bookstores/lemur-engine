import { KernelConfig } from '../types';
import { ConfigEventManager, ConfigChangeEventType } from '../events/ConfigEventManager';
import { ConfigChangeListener } from '../interfaces/ConfigChangeListener';
import { IConfigLoader } from '../interfaces/IConfigLoader';

export abstract class BaseConfigLoader implements IConfigLoader {
    protected listeners: ConfigChangeListener[] = [];

    /**
     * Método abstracto para cargar la configuración
     * Debe ser implementado por las clases hijas
     */
    abstract loadConfig(configPath?: string): Promise<KernelConfig>;

    /**
     * Valida la configuración base
     * Puede ser extendido por las clases hijas
     */
    validateConfig(config: KernelConfig): void {
        if (!config) {
            throw new Error('Configuration cannot be null or undefined');
        }
    }

    /**
     * Suscribe un listener para cambios en la configuración
     */
    subscribe(listener: ConfigChangeListener): void {
        if (!this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
    }

    /**
     * Desuscribe un listener
     */
    unsubscribe(listener: ConfigChangeListener): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Notifica a todos los listeners sobre un cambio en la configuración
     */
    protected async notifyConfigChange(oldConfig: KernelConfig, newConfig: KernelConfig): Promise<void> {
        const eventManager = ConfigEventManager.getInstance();

        await eventManager.notify({
            type: ConfigChangeEventType.CONFIG_UPDATED,
            oldConfig,
            newConfig,
            timestamp: new Date()
        });

        try {
            await eventManager.notify({
                type: ConfigChangeEventType.CONFIG_VALIDATED,
                oldConfig,
                newConfig,
                timestamp: new Date()
            });
        } catch (error) {
            await eventManager.notify({
                type: ConfigChangeEventType.CONFIG_ERROR,
                error: error as Error,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Método protegido para fusionar configuraciones
     */
    protected mergeConfigs(base: KernelConfig, override: Partial<KernelConfig>): KernelConfig {
        const result = { ...base };

        Object.entries(override).forEach(([key, value]) => {
            if (value !== undefined) {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    result[key as keyof KernelConfig] = {
                        ...result[key as keyof KernelConfig] as any,
                        ...value
                    } as any;
                } else {
                    result[key as keyof KernelConfig] = value as any;
                }
            }
        });

        return result;
    }

    /**
     * Método para testing: permite acceso directo a notifyConfigChange
     */
    async testNotifyConfigChange(oldConfig: KernelConfig, newConfig: KernelConfig): Promise<void> {
        // Primero notificar a los listeners locales
        for (const listener of this.listeners) {
            try {
                if (listener.onConfigChange) {
                    await listener.onConfigChange(oldConfig, newConfig);
                }
            } catch (error) {
                console.error('Error in config change listener:', error);
                // No relanzar el error para que otros listeners puedan ejecutarse
            }
        }

        // Luego notificar a través del EventManager
        await this.notifyConfigChange(oldConfig, newConfig);
    }
}
