interface ModelMetrics {
    model: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    totalTokens: number;
    totalCost: number;
    lastActivity: Date;
}

interface PerformanceSnapshot {
    timestamp: Date;
    model: string;
    latency: number;
    tokens: number;
    cost: number;
    success: boolean;
    errorType?: string;
}

class ModelPerformanceTracker {
    private performanceHistory: PerformanceSnapshot[] = [];
    private modelMetrics: Map<string, ModelMetrics> = new Map();

    // Track performance for a specific model operation
    trackModelPerformance(
        model: string,
        latency: number,
        tokens: number,
        cost: number,
        success: boolean,
        errorType?: string
    ): void {
        const snapshot: PerformanceSnapshot = {
            timestamp: new Date(),
            model,
            latency,
            tokens,
            cost,
            success,
            errorType
        };

        this.performanceHistory.push(snapshot);
        this.updateModelMetrics(snapshot);

        console.log(`Performance tracked for ${model}: ${latency}ms, ${tokens} tokens, $${cost}, success: ${success}`);

        // Limpiar historial antiguo (mantener solo últimas 5000 entradas)
        if (this.performanceHistory.length > 5000) {
            this.performanceHistory = this.performanceHistory.slice(-5000);
        }
    }

    private updateModelMetrics(snapshot: PerformanceSnapshot): void {
        const existing = this.modelMetrics.get(snapshot.model);

        if (!existing) {
            // Crear nueva entrada de métricas
            this.modelMetrics.set(snapshot.model, {
                model: snapshot.model,
                totalRequests: 1,
                successfulRequests: snapshot.success ? 1 : 0,
                failedRequests: snapshot.success ? 0 : 1,
                averageLatency: snapshot.latency,
                totalTokens: snapshot.tokens,
                totalCost: snapshot.cost,
                lastActivity: snapshot.timestamp
            });
        } else {
            // Actualizar métricas existentes
            const totalRequests = existing.totalRequests + 1;
            const successfulRequests = existing.successfulRequests + (snapshot.success ? 1 : 0);
            const failedRequests = existing.failedRequests + (snapshot.success ? 0 : 1);

            // Calcular nueva latencia promedio
            const newAverageLatency = (
                (existing.averageLatency * existing.totalRequests) + snapshot.latency
            ) / totalRequests;

            this.modelMetrics.set(snapshot.model, {
                model: snapshot.model,
                totalRequests,
                successfulRequests,
                failedRequests,
                averageLatency: newAverageLatency,
                totalTokens: existing.totalTokens + snapshot.tokens,
                totalCost: existing.totalCost + snapshot.cost,
                lastActivity: snapshot.timestamp
            });
        }
    }

    // Get performance metrics for a specific model
    getModelMetrics(model: string): ModelMetrics | null {
        return this.modelMetrics.get(model) || null;
    }

    // Get performance metrics for all models
    getAllModelMetrics(): ModelMetrics[] {
        return Array.from(this.modelMetrics.values());
    }

    // Get success rate for a model
    getSuccessRate(model: string, timeWindow?: number): number {
        let snapshots = this.performanceHistory.filter(s => s.model === model);

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            snapshots = snapshots.filter(s => s.timestamp >= cutoff);
        }

        if (snapshots.length === 0) return 1; // Assume 100% if no data

        const successful = snapshots.filter(s => s.success).length;
        return successful / snapshots.length;
    }

    // Get average latency for a model
    getAverageLatency(model: string, timeWindow?: number): number {
        let snapshots = this.performanceHistory.filter(s => s.model === model && s.success);

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            snapshots = snapshots.filter(s => s.timestamp >= cutoff);
        }

        if (snapshots.length === 0) return 0;

        const totalLatency = snapshots.reduce((sum, s) => sum + s.latency, 0);
        return totalLatency / snapshots.length;
    }

    // Get token efficiency (tokens per second)
    getTokenEfficiency(model: string, timeWindow?: number): number {
        let snapshots = this.performanceHistory.filter(s => s.model === model && s.success);

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            snapshots = snapshots.filter(s => s.timestamp >= cutoff);
        }

        if (snapshots.length === 0) return 0;

        const totalTokens = snapshots.reduce((sum, s) => sum + s.tokens, 0);
        const totalLatency = snapshots.reduce((sum, s) => sum + s.latency, 0) / 1000; // Convert to seconds

        return totalLatency > 0 ? totalTokens / totalLatency : 0;
    }

    // Get cost efficiency (cost per token)
    getCostEfficiency(model: string, timeWindow?: number): number {
        let snapshots = this.performanceHistory.filter(s => s.model === model && s.success);

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            snapshots = snapshots.filter(s => s.timestamp >= cutoff);
        }

        if (snapshots.length === 0) return 0;

        const totalCost = snapshots.reduce((sum, s) => sum + s.cost, 0);
        const totalTokens = snapshots.reduce((sum, s) => sum + s.tokens, 0);

        return totalTokens > 0 ? totalCost / totalTokens : 0;
    }

    // Get error analysis for a model
    getErrorAnalysis(model: string, timeWindow?: number): Record<string, number> {
        let snapshots = this.performanceHistory.filter(s => s.model === model && !s.success);

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            snapshots = snapshots.filter(s => s.timestamp >= cutoff);
        }

        const errorCounts: Record<string, number> = {};

        snapshots.forEach(snapshot => {
            const errorType = snapshot.errorType || 'unknown';
            errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
        });

        return errorCounts;
    }

    // Get performance trends
    getPerformanceTrends(model: string, timeWindow: number = 3600): any {
        const cutoff = new Date(Date.now() - timeWindow * 1000);
        const snapshots = this.performanceHistory.filter(
            s => s.model === model && s.timestamp >= cutoff
        );

        if (snapshots.length === 0) {
            return {
                latencyTrend: 'stable',
                successRateTrend: 'stable',
                tokenEfficiencyTrend: 'stable',
                dataPoints: 0
            };
        }

        // Dividir en buckets de tiempo para análisis de tendencias
        const bucketSize = Math.max(timeWindow / 10, 60); // Mínimo 1 minuto por bucket
        const buckets: PerformanceSnapshot[][] = [];

        for (let i = 0; i < 10; i++) {
            const bucketStart = new Date(cutoff.getTime() + (i * bucketSize * 1000));
            const bucketEnd = new Date(cutoff.getTime() + ((i + 1) * bucketSize * 1000));

            buckets.push(snapshots.filter(s => s.timestamp >= bucketStart && s.timestamp < bucketEnd));
        }

        // Calcular métricas por bucket
        const bucketMetrics = buckets.map(bucket => {
            if (bucket.length === 0) return null;

            const successful = bucket.filter(s => s.success);
            return {
                averageLatency: successful.length > 0 ? successful.reduce((sum, s) => sum + s.latency, 0) / successful.length : 0,
                successRate: bucket.filter(s => s.success).length / bucket.length,
                tokenEfficiency: this.calculateBucketTokenEfficiency(successful)
            };
        }).filter(m => m !== null);

        if (bucketMetrics.length < 2) {
            return {
                latencyTrend: 'stable',
                successRateTrend: 'stable',
                tokenEfficiencyTrend: 'stable',
                dataPoints: bucketMetrics.length
            };
        }

        return {
            latencyTrend: this.analyzeTrend(bucketMetrics.map(m => m!.averageLatency)),
            successRateTrend: this.analyzeTrend(bucketMetrics.map(m => m!.successRate)),
            tokenEfficiencyTrend: this.analyzeTrend(bucketMetrics.map(m => m!.tokenEfficiency)),
            dataPoints: bucketMetrics.length
        };
    }

    private calculateBucketTokenEfficiency(snapshots: PerformanceSnapshot[]): number {
        if (snapshots.length === 0) return 0;

        const totalTokens = snapshots.reduce((sum, s) => sum + s.tokens, 0);
        const totalLatency = snapshots.reduce((sum, s) => sum + s.latency, 0) / 1000;

        return totalLatency > 0 ? totalTokens / totalLatency : 0;
    }

    private analyzeTrend(values: number[]): 'improving' | 'degrading' | 'stable' {
        if (values.length < 2) return 'stable';

        const first = values[0];
        const last = values[values.length - 1];
        const change = (last - first) / first;

        if (Math.abs(change) < 0.1) return 'stable'; // Menos del 10% de cambio
        return change > 0 ? 'improving' : 'degrading';
    }

    // Generate performance report
    generatePerformanceReport(model?: string): any {
        const models = model ? [model] : Array.from(this.modelMetrics.keys());

        return models.map(modelName => {
            const metrics = this.getModelMetrics(modelName);
            if (!metrics) return null;

            return {
                model: modelName,
                metrics,
                successRate: this.getSuccessRate(modelName, 3600), // Last hour
                averageLatency: this.getAverageLatency(modelName, 3600),
                tokenEfficiency: this.getTokenEfficiency(modelName, 3600),
                costEfficiency: this.getCostEfficiency(modelName, 3600),
                errorAnalysis: this.getErrorAnalysis(modelName, 3600),
                trends: this.getPerformanceTrends(modelName, 3600)
            };
        }).filter(report => report !== null);
    }
}

export { ModelPerformanceTracker, ModelMetrics, PerformanceSnapshot };
