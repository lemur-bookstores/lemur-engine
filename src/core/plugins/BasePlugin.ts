import { Plugin, PluginStatus } from './PluginRegistry';
import { Kernel } from '../Kernel';

export abstract class BasePlugin implements Plugin {
    private currentStatus: PluginStatus = PluginStatus.UNINITIALIZED;

    abstract get name(): string;
    abstract get version(): string;
    dependencies?: string[];

    protected constructor(dependencies?: string[]) {
        this.dependencies = dependencies;
    }

    status(): PluginStatus {
        return this.currentStatus;
    }

    protected setStatus(status: PluginStatus): void {
        this.currentStatus = status;
    }

    async initialize(kernel: Kernel): Promise<void> {
        try {
            this.setStatus(PluginStatus.INITIALIZING);
            await this.onInitialize(kernel);
            this.setStatus(PluginStatus.ACTIVE);
        } catch (error) {
            this.setStatus(PluginStatus.ERROR);
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        try {
            this.setStatus(PluginStatus.SHUTTING_DOWN);
            await this.onShutdown();
            this.setStatus(PluginStatus.INACTIVE);
        } catch (error) {
            this.setStatus(PluginStatus.ERROR);
            throw error;
        }
    }

    protected abstract onInitialize(kernel: Kernel): Promise<void>;
    protected abstract onShutdown(): Promise<void>;
}
