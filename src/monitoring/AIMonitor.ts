interface TokenUsage {
    model: string;
    tokens: number;
    cost: number;
    timestamp: Date;
    operation: string;
}

interface ModelLatency {
    model: string;
    latency: number;
    timestamp: Date;
    operation: string;
}

interface ContextQuality {
    score: number;
    metadata: Record<string, any>;
    timestamp: Date;
    model: string;
}

interface AICondition {
    metric: 'token_usage' | 'model_latency' | 'context_quality' | 'error_rate';
    threshold: number;
    window: TimeWindow;
    severity: 'warning' | 'error' | 'critical';
}

interface TimeWindow {
    duration: number; // en segundos
    unit: 'seconds' | 'minutes' | 'hours';
}

interface AlertAction {
    type: 'log' | 'email' | 'webhook' | 'slack';
    target: string;
    message: string;
}

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    timestamp: Date;
}

interface MCPOperation {
    operationType: 'request' | 'response' | 'error';
    model: string;
    tokens?: number;
    latency: number;
    success: boolean;
    timestamp: Date;
}

class AIMonitor {
    private tokenUsageHistory: TokenUsage[] = [];
    private latencyHistory: ModelLatency[] = [];
    private contextQualityHistory: ContextQuality[] = [];
    private alerts: Map<string, AICondition> = new Map();
    private mcpOperations: MCPOperation[] = [];

    // Métricas específicas de AI
    trackTokenUsage(model: string, tokens: number, cost: number, operation: string = 'general'): void {
        const usage: TokenUsage = {
            model,
            tokens,
            cost,
            timestamp: new Date(),
            operation
        };

        this.tokenUsageHistory.push(usage);
        console.log(`Token usage tracked: ${tokens} tokens, $${cost} for model ${model}`);

        // Verificar alertas
        this.checkTokenUsageAlerts(usage);

        // Limpiar historial antiguo (mantener solo últimas 1000 entradas)
        if (this.tokenUsageHistory.length > 1000) {
            this.tokenUsageHistory = this.tokenUsageHistory.slice(-1000);
        }
    }

    trackModelLatency(model: string, latency: number, operation: string = 'general'): void {
        const latencyRecord: ModelLatency = {
            model,
            latency,
            timestamp: new Date(),
            operation
        };

        this.latencyHistory.push(latencyRecord);
        console.log(`Model latency tracked: ${latency}ms for model ${model}`);

        // Verificar alertas
        this.checkLatencyAlerts(latencyRecord);

        // Limpiar historial antiguo
        if (this.latencyHistory.length > 1000) {
            this.latencyHistory = this.latencyHistory.slice(-1000);
        }
    }

    trackContextQuality(score: number, metadata: Record<string, any>, model: string): void {
        const quality: ContextQuality = {
            score,
            metadata,
            timestamp: new Date(),
            model
        };

        this.contextQualityHistory.push(quality);
        console.log(`Context quality tracked: ${score} for model ${model}`);

        // Verificar alertas
        this.checkContextQualityAlerts(quality);

        // Limpiar historial antiguo
        if (this.contextQualityHistory.length > 1000) {
            this.contextQualityHistory = this.contextQualityHistory.slice(-1000);
        }
    }

    // Integración MCP
    trackMCPOperations(operation: MCPOperation): void {
        this.mcpOperations.push(operation);
        console.log(`MCP operation tracked: ${operation.operationType} - ${operation.success ? 'success' : 'failed'}`);

        // Track tokens if available
        if (operation.tokens) {
            this.trackTokenUsage(operation.model, operation.tokens, 0, 'mcp');
        }

        // Track latency
        this.trackModelLatency(operation.model, operation.latency, 'mcp');

        // Limpiar historial antiguo
        if (this.mcpOperations.length > 1000) {
            this.mcpOperations = this.mcpOperations.slice(-1000);
        }
    }

    monitorMCPHealth(): HealthStatus {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);

        // Verificar operaciones MCP recientes
        const recentOperations = this.mcpOperations.filter(op => op.timestamp >= oneMinuteAgo);
        const successfulOps = recentOperations.filter(op => op.success);
        const successRate = recentOperations.length > 0 ? successfulOps.length / recentOperations.length : 1;

        // Verificar latencia promedio
        const avgLatency = recentOperations.length > 0
            ? recentOperations.reduce((sum, op) => sum + op.latency, 0) / recentOperations.length
            : 0;

        const checks = {
            'mcp_success_rate': successRate >= 0.95,
            'mcp_latency': avgLatency <= 2000, // 2 segundos máximo
            'mcp_connectivity': recentOperations.length > 0 || this.mcpOperations.length === 0
        };

        const allHealthy = Object.values(checks).every(check => check);
        const anyUnhealthy = Object.values(checks).some(check => !check);

        const status: HealthStatus = {
            status: allHealthy ? 'healthy' : (anyUnhealthy ? 'unhealthy' : 'degraded'),
            checks,
            timestamp: now
        };

        console.log(`MCP Health Status: ${status.status}`);
        return status;
    }

    // Alertas inteligentes
    setAIAlert(id: string, condition: AICondition, _action: AlertAction): void {
        this.alerts.set(id, condition);
        console.log(`AI Alert configured: ${id} - ${condition.metric} > ${condition.threshold}`);
    }

    private checkTokenUsageAlerts(usage: TokenUsage): void {
        this.alerts.forEach((condition, alertId) => {
            if (condition.metric === 'token_usage') {
                if (usage.tokens > condition.threshold) {
                    this.triggerAlert(alertId, condition, `Token usage exceeded: ${usage.tokens} > ${condition.threshold}`);
                }
            }
        });
    }

    private checkLatencyAlerts(latency: ModelLatency): void {
        this.alerts.forEach((condition, alertId) => {
            if (condition.metric === 'model_latency') {
                if (latency.latency > condition.threshold) {
                    this.triggerAlert(alertId, condition, `Model latency exceeded: ${latency.latency}ms > ${condition.threshold}ms`);
                }
            }
        });
    }

    private checkContextQualityAlerts(quality: ContextQuality): void {
        this.alerts.forEach((condition, alertId) => {
            if (condition.metric === 'context_quality') {
                if (quality.score < condition.threshold) {
                    this.triggerAlert(alertId, condition, `Context quality below threshold: ${quality.score} < ${condition.threshold}`);
                }
            }
        });
    }

    private triggerAlert(alertId: string, condition: AICondition, message: string): void {
        console.log(`🚨 ALERT [${condition.severity.toUpperCase()}] ${alertId}: ${message}`);
        // Aquí se implementarían las acciones de alerta específicas
    }

    // Métodos para obtener métricas agregadas
    getTokenUsageStats(model?: string, timeWindow?: number): any {
        let data = this.tokenUsageHistory;

        if (model) {
            data = data.filter(usage => usage.model === model);
        }

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            data = data.filter(usage => usage.timestamp >= cutoff);
        }

        if (data.length === 0) {
            return { totalTokens: 0, totalCost: 0, operations: 0 };
        }

        return {
            totalTokens: data.reduce((sum, usage) => sum + usage.tokens, 0),
            totalCost: data.reduce((sum, usage) => sum + usage.cost, 0),
            operations: data.length,
            averageTokensPerOperation: data.reduce((sum, usage) => sum + usage.tokens, 0) / data.length
        };
    }

    getLatencyStats(model?: string, timeWindow?: number): any {
        let data = this.latencyHistory;

        if (model) {
            data = data.filter(latency => latency.model === model);
        }

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            data = data.filter(latency => latency.timestamp >= cutoff);
        }

        if (data.length === 0) {
            return { averageLatency: 0, maxLatency: 0, minLatency: 0, operations: 0 };
        }

        const latencies = data.map(l => l.latency);
        return {
            averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
            maxLatency: Math.max(...latencies),
            minLatency: Math.min(...latencies),
            operations: data.length
        };
    }

    getContextQualityStats(model?: string, timeWindow?: number): any {
        let data = this.contextQualityHistory;

        if (model) {
            data = data.filter(quality => quality.model === model);
        }

        if (timeWindow) {
            const cutoff = new Date(Date.now() - timeWindow * 1000);
            data = data.filter(quality => quality.timestamp >= cutoff);
        }

        if (data.length === 0) {
            return { averageScore: 0, maxScore: 0, minScore: 0, evaluations: 0 };
        }

        const scores = data.map(q => q.score);
        return {
            averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
            maxScore: Math.max(...scores),
            minScore: Math.min(...scores),
            evaluations: data.length
        };
    }
}

export { AIMonitor, TokenUsage, ModelLatency, ContextQuality, AICondition, AlertAction, HealthStatus, MCPOperation };
