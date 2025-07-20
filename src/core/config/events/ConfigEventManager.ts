import { KernelConfig } from "../types";
import { ConfigChangeListener } from "./ConfigChangeListener";
import { ConfigChangeListenerOptions, ConfigBatchEvent } from "./types";

export enum ConfigChangeEventType {
    CONFIG_LOADED = 'configLoaded',
    CONFIG_VALIDATED = 'configValidated',
    CONFIG_UPDATED = 'configUpdated',
    CONFIG_ERROR = 'configError',
    CONFIG_BATCH = 'configBatch'
}

export interface ConfigChangeEvent {
    type: ConfigChangeEventType;
    oldConfig?: KernelConfig;
    newConfig?: KernelConfig;
    timestamp: Date;
    error?: Error;
    changes?: string[];
}

interface ListenerEntry {
    listener: ConfigChangeListener;
    options: ConfigChangeListenerOptions;
}

export class ConfigEventManager {
    private listeners: Map<ConfigChangeEventType, ListenerEntry[]> = new Map();
    private static instance: ConfigEventManager;
    private batchedEvents: Map<ConfigChangeListener, ConfigChangeEvent[]> = new Map();
    private debounceTimers: Map<ConfigChangeListener, NodeJS.Timeout> = new Map();

    private constructor() {
        Object.values(ConfigChangeEventType).forEach(eventType => {
            this.listeners.set(eventType, []);
        });
    }

    public static getInstance(): ConfigEventManager {
        if (!ConfigEventManager.instance) {
            ConfigEventManager.instance = new ConfigEventManager();
        }
        return ConfigEventManager.instance;
    }

    public subscribe(
        eventType: ConfigChangeEventType,
        listener: ConfigChangeListener,
        options: ConfigChangeListenerOptions = {}
    ): void {
        const eventListeners = this.listeners.get(eventType);
        if (eventListeners) {
            // Insertar en orden de prioridad
            const entry: ListenerEntry = { listener, options };
            const index = eventListeners.findIndex(l =>
                (l.options.priority || 0) < (options.priority || 0)
            );

            if (index === -1) {
                eventListeners.push(entry);
            } else {
                eventListeners.splice(index, 0, entry);
            }
        }
    }

    public subscribeToAll(
        listener: ConfigChangeListener,
        options: ConfigChangeListenerOptions = {}
    ): void {
        Object.values(ConfigChangeEventType).forEach(eventType => {
            this.subscribe(eventType, listener, options);
        });
    }

    public unsubscribe(eventType: ConfigChangeEventType, listener: ConfigChangeListener): void {
        const eventListeners = this.listeners.get(eventType);
        if (eventListeners) {
            const index = eventListeners.findIndex(entry => entry.listener === listener);
            if (index !== -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    public unsubscribeFromAll(listener: ConfigChangeListener): void {
        Object.values(ConfigChangeEventType).forEach(eventType => {
            this.unsubscribe(eventType, listener);
        });
    }

    private shouldNotifyListener(
        entry: ListenerEntry,
        event: ConfigChangeEvent
    ): boolean {
        const { filter } = entry.options;
        if (!filter) return true;

        if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
            return false;
        }

        if (filter.environmentFilter && event.newConfig) {
            if (!filter.environmentFilter.includes(event.newConfig.environment)) {
                return false;
            }
        }

        if (filter.propertyFilter && event.changes) {
            if (!event.changes.some(change => filter.propertyFilter!.includes(change))) {
                return false;
            }
        }

        return true;
    }

    private async notifyListener(
        entry: ListenerEntry,
        event: ConfigChangeEvent
    ): Promise<void> {
        const { listener, options } = entry;

        if (!this.shouldNotifyListener(entry, event)) {
            return;
        }

        if (options.batchSize && options.batchSize > 1) {
            await this.handleBatchNotification(entry, event);
            return;
        }

        if (options.debounceTime) {
            this.handleDebounceNotification(entry, event);
            return;
        }

        try {
            if (event.oldConfig && event.newConfig) {
                await listener.onConfigChange(event.oldConfig, event.newConfig);
            }

            if (listener.onEvent) {
                await listener.onEvent(event);
            }
        } catch (error) {
            console.error(`Error in listener for event ${event.type}:`, error);
        }
    }

    private async handleBatchNotification(
        entry: ListenerEntry,
        event: ConfigChangeEvent
    ): Promise<void> {
        const { listener, options } = entry;
        const events = this.batchedEvents.get(listener) || [];
        events.push(event);

        if (events.length >= (options.batchSize || 1)) {
            const batchEvent: ConfigBatchEvent = {
                events: [...events],
                timestamp: new Date()
            };

            this.batchedEvents.delete(listener);

            if (listener.onBatchEvent) {
                await listener.onBatchEvent(batchEvent);
            }
        } else {
            this.batchedEvents.set(listener, events);
        }
    }

    private handleDebounceNotification(
        entry: ListenerEntry,
        event: ConfigChangeEvent
    ): void {
        const { listener, options } = entry;
        const existingTimer = this.debounceTimers.get(listener);

        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            try {
                if (event.oldConfig && event.newConfig) {
                    await listener.onConfigChange(event.oldConfig, event.newConfig);
                }
                if (listener.onEvent) {
                    await listener.onEvent(event);
                }
            } catch (error) {
                console.error(`Error in debounced listener for event ${event.type}:`, error);
            } finally {
                this.debounceTimers.delete(listener);
            }
        }, options.debounceTime);

        this.debounceTimers.set(listener, timer);
    }

    public async notify(event: ConfigChangeEvent): Promise<void> {
        const eventListeners = this.listeners.get(event.type);
        if (!eventListeners) return;

        const notificationPromises = eventListeners.map(entry =>
            this.notifyListener(entry, event)
        );

        await Promise.all(notificationPromises);
    }

    public clearAllListeners(): void {
        this.listeners.forEach(listeners => listeners.length = 0);
        this.batchedEvents.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }

    public getListenerCount(eventType: ConfigChangeEventType): number {
        return this.listeners.get(eventType)?.length || 0;
    }

    public hasListeners(eventType: ConfigChangeEventType): boolean {
        return this.getListenerCount(eventType) > 0;
    }
}
