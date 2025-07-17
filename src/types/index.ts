export type HealthCheck = () => Promise<boolean>;

export interface HealthStatus {
    name: string;
    status: boolean;
    lastCheck: Date;
    details?: Record<string, any>;
}

export interface KernelEvent<T = any> {
    id: string;
    type: string;
    payload: T;
    timestamp: Date;
    source: string;
    metadata?: Record<string, any>;
}

export interface EventHandler<T = any> {
    handle(event: KernelEvent<T>): Promise<void>;
    canHandle(event: KernelEvent): boolean;
}

export interface Plugin {
    name: string;
    version: string;
    dependencies?: string[];
    initialize(kernel: any): Promise<void>;
    shutdown(): Promise<void>;
    getEventHandlers(): EventHandler[];
}

export interface ConfigProvider {
    get<T>(key: string): T | undefined;
    set(key: string, value: any): void;
    watch(key: string, callback: (value: any) => void): void;
}
