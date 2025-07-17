export interface LogEntry {
    timestamp: Date;
    type: string;
    message: string;
    code?: string;
    sourceModule?: string;
    details?: Record<string, any>;
    stack?: string;
}

export interface LogStorage {
    save(entry: LogEntry): Promise<void>;
}

export interface MetricEntry {
    timestamp: Date;
    type: string;
    value: number;
    tags?: Record<string, string | number>;
    metadata?: Record<string, any>;
}

export interface MetricsStorage {
    publish(metric: MetricEntry): Promise<void>;
    publishBatch(metrics: MetricEntry[]): Promise<void>;
}
