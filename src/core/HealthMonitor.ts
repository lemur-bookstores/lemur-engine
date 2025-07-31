import { HealthCheck } from '../types';

export class HealthMonitor {
    private healthChecks: Map<string, HealthCheck> = new Map();
    private lastCheckResults: Map<string, boolean> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(private intervalMs: number = 30000) { }

    registerHealthCheck(name: string, check: HealthCheck): void {
        this.healthChecks.set(name, check);
    }

    async start(): Promise<void> {
        if (this.checkInterval) return;

        // Run initial health check
        await this.runHealthChecks();

        this.checkInterval = setInterval(async () => {
            await this.runHealthChecks();
        }, this.intervalMs);
    }

    async stop(): Promise<void> {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            // Ensure any pending health checks complete
            await Promise.resolve();
        }
    }

    private async runHealthChecks(): Promise<void> {
        const checks = Array.from(this.healthChecks.entries());
        await Promise.all(checks.map(async ([name, check]) => {
            try {
                const isHealthy = await Promise.resolve(check());
                this.lastCheckResults.set(name, Boolean(isHealthy));
            } catch (error) {
                this.lastCheckResults.set(name, false);
                console.error(`Health check failed for ${name}:`, error);
            }
        }));
    }

    getStatus(): Map<string, boolean> {
        return new Map(this.lastCheckResults);
    }

    isHealthy(): boolean {
        return Array.from(this.lastCheckResults.values()).every(result => result);
    }
}
