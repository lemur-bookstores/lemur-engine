interface TemplateContext {
  [key: string]: any;
}

interface EmailData {
  to: string;
  subject: string;
  data: TemplateContext;
}

interface SimpleTheme {
  id: string;
  name: string;
  emailStyles: string;
  adminStyles: string;
}

interface AITemplateConfig {
  aiContentValidation: boolean;
  outputSanitization: boolean;
  tokenOptimization: boolean;
  maxTokens?: number;
}

class BasicTemplateEngine {
  private themes: Map<string, SimpleTheme> = new Map();
  private currentTheme: SimpleTheme | null = null;
  private aiConfig: AITemplateConfig;

  constructor(
    aiConfig: AITemplateConfig = {
      aiContentValidation: true,
      outputSanitization: true,
      tokenOptimization: true,
      maxTokens: 4000,
    },
  ) {
    this.aiConfig = aiConfig;
    this.initializeDefaultTheme();
  }

  private initializeDefaultTheme(): void {
    const defaultTheme: SimpleTheme = {
      id: "default",
      name: "Default Theme",
      emailStyles: `
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .header { background: #f4f4f4; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .footer { background: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; }
                .ai-generated { border-left: 3px solid #007acc; padding-left: 10px; margin: 10px 0; }
            `,
      adminStyles: `
                .admin-panel { background: #fff; border: 1px solid #ddd; border-radius: 4px; }
                .admin-header { background: #007acc; color: white; padding: 15px; }
                .admin-content { padding: 20px; }
                .ai-metrics { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 10px 0; }
            `,
    };

    this.themes.set("default", defaultTheme);
    this.currentTheme = defaultTheme;
  }

  async render(template: string, context: TemplateContext): Promise<string> {
    try {
      // Validar contexto AI si está habilitado
      if (this.aiConfig.aiContentValidation) {
        await this.validateAIContent(context);
      }

      // Optimizar tokens si está habilitado
      if (this.aiConfig.tokenOptimization) {
        context = this.optimizeTokenUsage(context);
      }

      // Renderizar con Mustache
      const Mustache = require("mustache");
      let rendered = Mustache.render(template, {
        ...context,
        theme: this.currentTheme,
        timestamp: new Date().toISOString(),
        aiGenerated: context.aiGenerated || false,
      });

      // Sanitizar output si está habilitado
      if (this.aiConfig.outputSanitization) {
        rendered = this.sanitizeOutput(rendered);
      }

      console.log(`Template rendered: ${template.substring(0, 50)}...`);
      return rendered;
    } catch (error: any) {
      console.error("Template rendering error:", error);
      throw new Error(`Template rendering failed: ${error}`);
    }
  }

  async renderEmail(template: string, emailData: EmailData): Promise<string> {
    const emailContext = {
      ...emailData.data,
      subject: emailData.subject,
      recipient: emailData.to,
      emailStyles: this.currentTheme?.emailStyles || "",
      isEmail: true,
    };

    const emailTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>{{subject}}</title>
                <style>{{{emailStyles}}}</style>
            </head>
            <body>
                <div class="header">
                    <h1>{{subject}}</h1>
                </div>
                <div class="content">
                    ${template}
                    {{#aiGenerated}}
                    <div class="ai-generated">
                        <small>This content was generated with AI assistance</small>
                    </div>
                    {{/aiGenerated}}
                </div>
                <div class="footer">
                    <p>Generated on {{timestamp}}</p>
                </div>
            </body>
            </html>
        `;

    return await this.render(emailTemplate, emailContext);
  }

  setTheme(theme: SimpleTheme): void {
    this.themes.set(theme.id, theme);
    this.currentTheme = theme;
    console.log(`Theme set to: ${theme.name}`);
  }

  getTheme(themeId: string): SimpleTheme | undefined {
    return this.themes.get(themeId);
  }

  listThemes(): SimpleTheme[] {
    return Array.from(this.themes.values());
  }

  // AI-specific template rendering for reports
  async renderAIReport(
    data: any,
    reportType: "performance" | "cost" | "quality" = "performance",
  ): Promise<string> {
    const reportTemplates = {
      performance: `
                <div class="ai-metrics">
                    <h2>AI Performance Report</h2>
                    <p><strong>Period:</strong> {{period}}</p>
                    <p><strong>Total Requests:</strong> {{totalRequests}}</p>
                    <p><strong>Success Rate:</strong> {{successRate}}%</p>
                    <p><strong>Average Latency:</strong> {{averageLatency}}ms</p>
                    {{#models}}
                    <div class="model-metrics">
                        <h3>{{name}}</h3>
                        <ul>
                            <li>Requests: {{requests}}</li>
                            <li>Success Rate: {{successRate}}%</li>
                            <li>Avg Latency: {{avgLatency}}ms</li>
                        </ul>
                    </div>
                    {{/models}}
                </div>
            `,
      cost:
        `
                <div class="ai-metrics">
                    <h2>AI Cost Report</h2>
                    <p><strong>Period:</strong> {{period}}</p>
                    <p><strong>Total Cost:</strong> $` +
        `{{totalCost}}` +
        `</p>
                    <p><strong>Total Tokens:</strong> {{totalTokens}}</p>
                    <p><strong>Cost per Token:</strong> $` +
        `{{costPerToken}}` +
        `</p>
                    {{#models}}
                    <div class="model-cost">
                        <h3>{{name}}</h3>
                        <ul>
                            <li>Cost: $` +
        `{{cost}}` +
        `</li>
                            <li>Tokens: {{tokens}}</li>
                            <li>Efficiency: {{efficiency}}</li>
                        </ul>
                    </div>
                    {{/models}}
                </div>
            `,
      quality: `
                <div class="ai-metrics">
                    <h2>AI Quality Report</h2>
                    <p><strong>Period:</strong> {{period}}</p>
                    <p><strong>Average Score:</strong> {{averageScore}}</p>
                    <p><strong>Total Evaluations:</strong> {{totalEvaluations}}</p>
                    <p><strong>PII Detected:</strong> {{piiDetected}}</p>
                    <p><strong>Harmful Content:</strong> {{harmfulContent}}</p>
                    {{#qualityBreakdown}}
                    <div class="quality-metric">
                        <h3>{{metric}}</h3>
                        <p>Score: {{score}} | Count: {{count}}</p>
                    </div>
                    {{/qualityBreakdown}}
                </div>
            `,
    };

    const template = reportTemplates[reportType];
    return await this.render(template, {
      ...data,
      aiGenerated: true,
      reportType,
    });
  }

  private async validateAIContent(context: TemplateContext): Promise<void> {
    // Validar contenido generado por AI
    if (context.aiGenerated) {
      // Verificar PII
      if (this.containsPII(JSON.stringify(context))) {
        console.warn("PII detected in AI-generated content");
        // En producción, aquí se implementaría la lógica de filtrado
      }

      // Verificar contenido dañino
      if (this.containsHarmfulContent(JSON.stringify(context))) {
        throw new Error("Harmful content detected in AI-generated template");
      }
    }
  }

  private optimizeTokenUsage(context: TemplateContext): TemplateContext {
    // Optimizar uso de tokens reduciendo contenido redundante
    const optimized = { ...context };

    // Truncar strings largos si exceden límites de tokens
    if (this.aiConfig.maxTokens) {
      Object.keys(optimized).forEach((key) => {
        if (
          typeof optimized[key] === "string" &&
          optimized[key].length > this.aiConfig.maxTokens!
        ) {
          optimized[key] =
            optimized[key].substring(0, this.aiConfig.maxTokens!) + "...";
          console.log(`Content truncated for token optimization: ${key}`);
        }
      });
    }

    return optimized;
  }

  private sanitizeOutput(output: string): string {
    // Sanitizar output para prevenir XSS
    return output
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "");
  }

  private containsPII(content: string): boolean {
    // Detectar información personal identificable
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    ];

    return piiPatterns.some((pattern) => pattern.test(content));
  }

  private containsHarmfulContent(content: string): boolean {
    // Detectar contenido potencialmente dañino
    const harmfulPatterns = [
      /\b(attack|hack|exploit|malware|virus)\b/i,
      /\b(password|secret|token|key)\s*[:=]\s*\w+/i,
    ];

    return harmfulPatterns.some((pattern) => pattern.test(content));
  }

  // Método para generar notificaciones del sistema
  async renderSystemNotification(
    type: "info" | "warning" | "error" | "success",
    message: string,
    details?: any,
  ): Promise<string> {
    const notificationTemplate = `
            <div class="notification notification-{{type}}">
                <div class="notification-header">
                    <strong>{{typeLabel}}</strong>
                    <span class="timestamp">{{timestamp}}</span>
                </div>
                <div class="notification-content">
                    <p>{{message}}</p>
                    {{#details}}
                    <div class="notification-details">
                        <pre>{{details}}</pre>
                    </div>
                    {{/details}}
                </div>
            </div>
        `;

    const typeLabels = {
      info: "Information",
      warning: "Warning",
      error: "Error",
      success: "Success",
    };

    return await this.render(notificationTemplate, {
      type,
      typeLabel: typeLabels[type],
      message,
      details: details ? JSON.stringify(details, null, 2) : null,
      timestamp: new Date().toLocaleString(),
    });
  }
}

export {
  BasicTemplateEngine,
  TemplateContext,
  EmailData,
  SimpleTheme,
  AITemplateConfig,
};
