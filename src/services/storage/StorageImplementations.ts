import { LogEntry, LogStorage, MetricEntry, MetricsStorage } from '../../core/interfaces/storage';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileLogStorage implements LogStorage {
    constructor(private logDirectory: string) {
        // Asegurarse de que el directorio existe
        fs.mkdir(logDirectory, { recursive: true }).catch(console.error);
    }

    async save(entry: LogEntry): Promise<void> {
        const logFile = path.join(this.logDirectory, `kernel-${entry.timestamp.toISOString().split('T')[0]}.log`);
        const logLine = JSON.stringify({
            ...entry,
            timestamp: entry.timestamp.toISOString()
        }) + '\n';

        await fs.appendFile(logFile, logLine, 'utf8');
    }
}

export class InMemoryMetricsStorage implements MetricsStorage {
    private metrics: MetricEntry[] = [];

    async publish(metric: MetricEntry): Promise<void> {
        this.metrics.push(metric);
        this.pruneOldMetrics();
    }

    async publishBatch(metrics: MetricEntry[]): Promise<void> {
        this.metrics.push(...metrics);
        this.pruneOldMetrics();
    }

    getMetrics(): MetricEntry[] {
        return [...this.metrics];
    }

    private pruneOldMetrics(): void {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);
    }
}

export class ConsoleMetricsStorage implements MetricsStorage {
    async publish(metric: MetricEntry): Promise<void> {
        console.log('[Metric]', {
            timestamp: metric.timestamp.toISOString(),
            type: metric.type,
            value: metric.value,
            tags: metric.tags,
            metadata: metric.metadata
        });
    }

    async publishBatch(metrics: MetricEntry[]): Promise<void> {
        metrics.forEach(metric => {
            this.publish(metric).catch(console.error);
        });
    }
}
