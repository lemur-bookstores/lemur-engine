import { AIMonitor } from "../monitoring/AIMonitor";
import { ModelPerformanceTracker } from "../monitoring/ModelPerformanceTracker";
import { ContextQualityScorer } from "../monitoring/ContextQualityScorer";
import { MonitoringConfig } from "../core/config/types";
import { IModule } from "../types/IModule";

interface MonitoringModuleConfig {
  enableTokenUsageTracking: boolean;
  enableModelPerformanceTracking: boolean;
  enableContextQualityScoring: boolean;
  contextQualityScorerConfig?: {
    piiDetectionEnabled?: boolean;
    harmfulContentFilterEnabled?: boolean;
    biasDetectionEnabled?: boolean;
  };
  aiConfig?: MonitoringConfig["ai"];
  modelPerformanceConfig?: MonitoringConfig["modelPerformance"];
  healthCheckConfig?: MonitoringConfig["healthCheck"];
  reportingConfig?: MonitoringConfig["reporting"];
}

class MonitoringModule implements IModule {
  public name = "monitoring";
  private config: MonitoringModuleConfig;

  public aiMonitor: AIMonitor;
  public modelPerformanceTracker: ModelPerformanceTracker;
  public contextQualityScorer: ContextQualityScorer;

  constructor(config: MonitoringModuleConfig) {
    this.config = config;
    this.aiMonitor = new AIMonitor();
    this.modelPerformanceTracker = new ModelPerformanceTracker();
    this.contextQualityScorer = new ContextQualityScorer(
      this.config.contextQualityScorerConfig || {},
    );
  }

  async initialize(_kernel: any): Promise<void> {
    console.log("MonitoringModule initialized");

    if (this.config.enableTokenUsageTracking) {
      console.log("Token usage tracking enabled.");
    }
    if (this.config.enableModelPerformanceTracking) {
      console.log("Model performance tracking enabled.");
    }
    if (this.config.enableContextQualityScoring) {
      console.log("Context quality scoring enabled.");
    }

    // Initialize extended monitoring features if configuration is provided
    if (this.config.aiConfig?.enabled) {
      console.log("Extended AI monitoring enabled");
    }

    if (this.config.modelPerformanceConfig?.enabled) {
      console.log("Extended model performance tracking enabled");
    }

    if (this.config.healthCheckConfig?.enabled) {
      console.log("Health check monitoring enabled");
    }
  }

  async destroy(): Promise<void> {
    console.log("MonitoringModule destroyed");
    // No resources to release in this simple implementation
  }

  public getService<T>(
    serviceName:
      | "AIMonitor"
      | "ModelPerformanceTracker"
      | "ContextQualityScorer",
  ): T {
    switch (serviceName) {
      case "AIMonitor":
        return this.aiMonitor as any;
      case "ModelPerformanceTracker":
        return this.modelPerformanceTracker as any;
      case "ContextQualityScorer":
        return this.contextQualityScorer as any;
      default:
        throw new Error(
          `Service ${serviceName} not found in MonitoringModule.`,
        );
    }
  }
}

export { MonitoringModule, MonitoringModuleConfig };
