export interface PluginConfig {
  settings: {
    [key: string]: any;
  };
  features: {
    [key: string]: boolean;
  };
  permissions: string[];
  environment: {
    [key: string]: string;
  };
  dependencies: {
    name: string;
    version: string;
    optional: boolean;
  }[];
  resources: {
    maxMemory?: number;
    maxCpu?: number;
    maxStorage?: number;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enabled: boolean;
    targets: ("console" | "file" | "remote")[];
  };
  lifecycle: {
    startupTimeout: number;
    shutdownTimeout: number;
    healthCheckInterval: number;
  };
}
