export type PluginTemplate = "default" | "minimal" | "full";

export interface PluginConfig {
  name: string;
  template: PluginTemplate;
  typescript: boolean;
  description?: string;
  author?: string;
  version: string;
  dependencies: string[];
}

export interface TemplateConfig {
  name: string;
  description: string;
  files: TemplateFile[];
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface CommandOptions {
  type: "singleton" | "transient";
  interfaces: string;
  dependencies: string;
  plugin?: string;
}

export interface MonitorCommandOptions {
  port: string;
  host: string;
  updateInterval: string;
  metrics: string;
  logLevel: string;
  dashboard: string;
  format: string;
  output?: string;
  alerts?: string;
}

export interface ServiceConfig {
  name: string;
  type: "singleton" | "transient";
  interfaces?: string[];
  dependencies?: string[];
}

export interface DeployConfig {
  environment: "development" | "staging" | "production";
  configPath?: string;
  dryRun?: boolean;
  force?: boolean;
  rollbackVersion?: string;
}

export interface MonitorConfig {
  port: number;
  host: string;
  updateInterval: number;
  metrics?: string[];
  logLevel: string;
  dashboard: boolean;
  export: {
    format: string;
    output?: string;
  };
  alerts?: AlertRule[];
  maxHistorySize?: number; // Agregada la propiedad opcional maxHistorySize
}

export interface AlertRule {
  metric: string;
  threshold: number;
  operator: ">" | "<" | "==" | ">=" | "<=";
  action: string;
}

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    load: number[];
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  process: {
    pid: number;
    uptime: number;
    memory: number;
    cpu: number;
  };
}
