import { LogEntry, LogStorage, MetricEntry, MetricsStorage } from '../../src/core/interfaces/storage';
import { ElasticsearchClient, Client } from '@elastic/elasticsearch';

/**
 * Ejemplo de implementación de LogStorage para Elasticsearch
 */
export class ElasticsearchLogStorage implements LogStorage {
    private client: Client;

    constructor(
        private indexPrefix: string = 'kernel-logs-',
        nodes: string[] = ['http://localhost:9200']
    ) {
        this.client = new Client({ nodes });
    }

    async save(entry: LogEntry): Promise<void> {
        const index = `${this.indexPrefix}${entry.timestamp.getFullYear()}-${(entry.timestamp.getMonth() + 1).toString().padStart(2, '0')}`;

        await this.client.index({
            index,
            document: {
                ...entry,
                '@timestamp': entry.timestamp,
                type: 'error_log'
            }
        });
    }
}

/**
 * Ejemplo de implementación de MetricsStorage para Elasticsearch
 */
export class ElasticsearchMetricsStorage implements MetricsStorage {
    private client: Client;

    constructor(
        private indexPrefix: string = 'kernel-metrics-',
        nodes: string[] = ['http://localhost:9200']
    ) {
        this.client = new Client({ nodes });
    }

    async publish(metric: MetricEntry): Promise<void> {
        const index = `${this.indexPrefix}${metric.timestamp.getFullYear()}-${(metric.timestamp.getMonth() + 1).toString().padStart(2, '0')}`;

        await this.client.index({
            index,
            document: {
                ...metric,
                '@timestamp': metric.timestamp,
                type: 'metric'
            }
        });
    }

    async publishBatch(metrics: MetricEntry[]): Promise<void> {
        if (metrics.length === 0) return;

        const operations = metrics.flatMap(metric => [
            {
                index: {
                    _index: `${this.indexPrefix}${metric.timestamp.getFullYear()}-${(metric.timestamp.getMonth() + 1).toString().padStart(2, '0')}`
                }
            },
            {
                ...metric,
                '@timestamp': metric.timestamp,
                type: 'metric'
            }
        ]);

        await this.client.bulk({ operations });
    }
}

/**
 * Ejemplo de uso:
 * 
 * // Para logs
 * const esLogStorage = new ElasticsearchLogStorage(
 *     'myapp-logs-',
 *     ['http://elasticsearch:9200']
 * );
 * const logHandler = new LogErrorHandler(esLogStorage);
 * kernel.errorHandler.registerHandler(logHandler);
 * 
 * // Para métricas
 * const esMetricsStorage = new ElasticsearchMetricsStorage(
 *     'myapp-metrics-',
 *     ['http://elasticsearch:9200']
 * );
 * const metricsHandler = new MetricsErrorHandler(esMetricsStorage);
 * kernel.errorHandler.registerHandler(metricsHandler);
 */
