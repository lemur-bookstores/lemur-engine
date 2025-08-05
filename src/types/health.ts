export type HealthCheck = () => Promise<boolean>;

export interface HealthStatus {
  name: string;
  status: boolean;
  lastCheck: Date;
  details?: Record<string, any>;
}
