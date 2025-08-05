import { BasicTemplateEngine } from "../templates/BasicTemplateEngine";
import { IModule } from "../types/IModule";

interface TemplateModuleConfig {
  engine: "mustache";
  aiReports: boolean;
  emailOnly: boolean;
  aiConfig?: {
    aiContentValidation: boolean;
    outputSanitization: boolean;
    tokenOptimization: boolean;
    maxTokens?: number;
  };
}

class TemplateModule implements IModule {
  public name = "templates";
  private config: TemplateModuleConfig;
  private templateEngine: BasicTemplateEngine;

  constructor(config: TemplateModuleConfig) {
    this.config = config;
    this.templateEngine = new BasicTemplateEngine(this.config.aiConfig);
  }

  async initialize(_kernel: any): Promise<void> {
    console.log("TemplateModule initialized");

    if (this.config.aiReports) {
      console.log("AI report generation enabled");
    }

    if (this.config.emailOnly) {
      console.log("Email-only template mode enabled");
    }

    console.log(`Template engine: ${this.config.engine}`);
  }

  async destroy(): Promise<void> {
    console.log("TemplateModule destroyed");
  }

  getService<T>(serviceName: string): T {
    switch (serviceName) {
      case "engine":
        return this.templateEngine as unknown as T;
      default:
        throw new Error(`Service ${serviceName} not found in TemplateModule`);
    }
  }

  // Convenience methods for common template operations
  async renderEmail(template: string, emailData: any): Promise<string> {
    return await this.templateEngine.renderEmail(template, emailData);
  }

  async renderAIReport(
    data: any,
    reportType: "performance" | "cost" | "quality" = "performance",
  ): Promise<string> {
    return await this.templateEngine.renderAIReport(data, reportType);
  }

  async renderNotification(
    type: "info" | "warning" | "error" | "success",
    message: string,
    details?: any,
  ): Promise<string> {
    return await this.templateEngine.renderSystemNotification(
      type,
      message,
      details,
    );
  }

  setTheme(theme: any): void {
    this.templateEngine.setTheme(theme);
  }
}

export { TemplateModule, TemplateModuleConfig };
