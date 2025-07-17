import { MetricEntry, MetricsStorage } from '../../src/core/interfaces/storage';
import { register, Gauge } from 'prom-client';

/**
 * Ejemplo de implementación de MetricsStorage para Prometheus
 */
export class PrometheusMetricsStorage implements MetricsStorage {
    private metrics: Map<string, Gauge<string>> = new Map();

    constructor(private prefix: string = 'kernel_') { }

    async publish(metric: MetricEntry): Promise<void> {
        const gauge = this.getOrCreateMetric(metric);

        const labels = metric.tags || {};
        gauge.set(labels, metric.value);
    }

    async publishBatch(metrics: MetricEntry[]): Promise<void> {
        await Promise.all(metrics.map(m => this.publish(m)));
    }

    private getOrCreateMetric(metric: MetricEntry): Gauge<string> {
        const metricName = `${this.prefix}${metric.type}`;

        if (!this.metrics.has(metricName)) {
            const gauge = new Gauge({
                name: metricName,
                help: `Kernel metric for ${metric.type}`,
                labelNames: Object.keys(metric.tags || {})
            });

            this.metrics.set(metricName, gauge);
            register.registerMetric(gauge);
        }

        return this.metrics.get(metricName)!;
    }
}

/**
 * Ejemplo de uso:
 * 
 * const prometheusStorage = new PrometheusMetricsStorage('myapp_');
 * const metricsHandler = new MetricsErrorHandler(prometheusStorage);
 * kernel.errorHandler.registerHandler(metricsHandler);
 * 
 * // Acceder a las métricas
 * app.get('/metrics', async (req, res) => {
 *     res.set('Content-Type', register.contentType);
 *     res.send(await register.metrics());
 * });
 */
