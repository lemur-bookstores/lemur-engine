import { HealthCheck } from '../types';

export class HealthMonitor {
    private healthChecks: Map<string, HealthCheck> = new Map();
    private lastCheckResults: Map<string, boolean> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(private intervalMs: number = 30000) { }

    registerHealthCheck(name: string, check: HealthCheck): void {
        this.healthChecks.set(name, check);
    }

    start(): void {
        if (this.checkInterval) return;

        this.checkInterval = setInterval(() => {
            this.runHealthChecks();
        }, this.intervalMs);
    }

    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    private async runHealthChecks(): Promise<void> {
        for (const [name, check] of this.healthChecks) {
            try {
                const isHealthy = await check();
                this.lastCheckResults.set(name, isHealthy);
            } catch (error) {
                this.lastCheckResults.set(name, false);
                console.error(`Health check failed for ${name}:`, error);
            }
        }
    }

    getStatus(): Map<string, boolean> {
        return new Map(this.lastCheckResults);
    }

    isHealthy(): boolean {
        return Array.from(this.lastCheckResults.values()).every(result => result);
    }
}
