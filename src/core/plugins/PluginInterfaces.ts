import { Kernel } from '../Kernel';

export interface PluginMetadata {
    name: string;
    version: string;
    dependencies?: string[];
    description?: string;
}

export interface Plugin {
    metadata: PluginMetadata;
    initialize(kernel: Kernel): Promise<void>;
    shutdown(): Promise<void>;
    status(): PluginStatus;
}

export enum PluginStatus {
    UNINITIALIZED = 'UNINITIALIZED',
    INITIALIZING = 'INITIALIZING',
    ACTIVE = 'ACTIVE',
    SHUTTING_DOWN = 'SHUTTING_DOWN',
    INACTIVE = 'INACTIVE',
    ERROR = 'ERROR'
}

export interface PluginLifecycleHooks {
    onBeforeInitialize?: () => Promise<void>;
    onAfterInitialize?: () => Promise<void>;
    onBeforeShutdown?: () => Promise<void>;
    onAfterShutdown?: () => Promise<void>;
    onError?: (error: Error) => Promise<void>;
}
