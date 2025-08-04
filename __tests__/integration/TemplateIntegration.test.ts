import {
  BasicTemplateEngine,
  TemplateContext,
  EmailData,
} from "../../src/templates/BasicTemplateEngine";
import {
  TemplateModule,
  TemplateModuleConfig,
} from "../../src/modules/TemplateModule";

describe("Template System Integration Tests", () => {
  let templateEngine: BasicTemplateEngine;
  let templateModule: TemplateModule;

  beforeEach(() => {
    templateEngine = new BasicTemplateEngine();

    const config: TemplateModuleConfig = {
      engine: "mustache",
      aiReports: true,
      emailOnly: false,
      aiConfig: {
        aiContentValidation: true,
        outputSanitization: true,
        tokenOptimization: true,
        maxTokens: 1000,
      },
    };

    templateModule = new TemplateModule(config);
  });

  describe("BasicTemplateEngine", () => {
    it("should render simple templates", async () => {
      const template = "Hello {{name}}!";
      const context: TemplateContext = { name: "World" };

      const result = await templateEngine.render(template, context);

      expect(result).toBe("Hello World!");
    });

    it("should render email templates with styling", async () => {
      const template = "<p>Welcome {{username}}!</p>";
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Welcome",
        data: { username: "testuser" },
      };

      const result = await templateEngine.renderEmail(template, emailData);

      expect(result).toContain("Welcome testuser!");
      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("Welcome"); // Subject in header
      expect(result).toContain("font-family: Arial"); // Default styles
    });

    it("should render AI performance reports", async () => {
      const reportData = {
        period: "2025-08-01 to 2025-08-03",
        totalRequests: 1500,
        successRate: 98.5,
        averageLatency: 245,
        models: [
          {
            name: "gpt-4",
            requests: 800,
            successRate: 99.1,
            avgLatency: 230,
          },
          {
            name: "gpt-3.5-turbo",
            requests: 700,
            successRate: 97.8,
            avgLatency: 180,
          },
        ],
      };

      const result = await templateEngine.renderAIReport(
        reportData,
        "performance",
      );

      expect(result).toContain("AI Performance Report");
      expect(result).toContain("1500"); // Total requests
      expect(result).toContain("98.5%"); // Success rate
      expect(result).toContain("gpt-4"); // Model name
      expect(result).toContain("ai-metrics"); // CSS class
    });

    it("should render AI cost reports", async () => {
      const costData = {
        period: "2025-08-01 to 2025-08-03",
        totalCost: 125.5,
        totalTokens: 1250000,
        costPerToken: 0.0001,
        models: [
          {
            name: "gpt-4",
            cost: 89.3,
            tokens: 893000,
            efficiency: "high",
          },
        ],
      };

      const result = await templateEngine.renderAIReport(costData, "cost");

      expect(result).toContain("AI Cost Report");
      expect(result).toContain("$125.5"); // Total cost
      expect(result).toContain("1250000"); // Total tokens
      expect(result).toContain("$89.3"); // Model cost
    });

    it("should render system notifications", async () => {
      const result = await templateEngine.renderSystemNotification(
        "warning",
        "High token usage detected",
        { model: "gpt-4", usage: 5000 },
      );

      expect(result).toContain("notification-warning");
      expect(result).toContain("Warning");
      expect(result).toContain("High token usage detected");
      expect(result).toContain('"model": "gpt-4"'); // JSON details
    });

    it("should validate AI content for PII", async () => {
      const template = "User email: {{email}}";
      const context: TemplateContext = {
        email: "john.doe@example.com",
        aiGenerated: true,
      };

      // Should render without throwing (PII detection logs warning but doesn't block)
      const result = await templateEngine.render(template, context);
      expect(result).toContain("john.doe@example.com");
    });

    it("should reject harmful content", async () => {
      const template = "Execute: {{command}}";
      const context: TemplateContext = {
        command: "rm -rf / --no-preserve-root",
        aiGenerated: true,
      };

      await expect(templateEngine.render(template, context)).rejects.toThrow(
        "Harmful content detected",
      );
    });

    it("should optimize token usage by truncating long content", async () => {
      const longContent = "a".repeat(2000); // Exceeds maxTokens
      const template = "Content: {{content}}";
      const context: TemplateContext = { content: longContent };

      const result = await templateEngine.render(template, context);

      expect(result).toContain("Content: ");
      expect(result.length).toBeLessThan(2000); // Should be truncated
      expect(result).toContain("..."); // Truncation indicator
    });

    it("should sanitize output to prevent XSS", async () => {
      const template = "Message: {{message}}";
      const context: TemplateContext = {
        message: '<script>alert("xss")</script>Hello',
      };

      const result = await templateEngine.render(template, context);

      expect(result).not.toContain("<script>");
      expect(result).toContain("Hello");
    });

    it("should handle custom themes", async () => {
      const customTheme = {
        id: "custom",
        name: "Custom Theme",
        emailStyles: "body { background: red; }",
        adminStyles: ".admin { color: blue; }",
      };

      templateEngine.setTheme(customTheme);

      const template = "<p>Themed content</p>";
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "Test",
        data: {},
      };

      const result = await templateEngine.renderEmail(template, emailData);

      expect(result).toContain("background: red"); // Custom email styles
    });
  });

  describe("TemplateModule Integration", () => {
    it("should initialize template module successfully", async () => {
      await templateModule.initialize(null);

      const engine = templateModule.getService("engine");
      expect(engine).toBeDefined();
    });

    it("should render emails through module", async () => {
      await templateModule.initialize(null);

      const template = "<p>Hello {{name}}!</p>";
      const emailData = {
        to: "test@example.com",
        subject: "Test Email",
        data: { name: "User" },
      };

      const result = await templateModule.renderEmail(template, emailData);

      expect(result).toContain("Hello User!");
      expect(result).toContain("Test Email");
    });

    it("should render AI reports through module", async () => {
      await templateModule.initialize(null);

      const data = {
        period: "test",
        totalRequests: 100,
        successRate: 95,
        averageLatency: 200,
        models: [],
      };

      const result = await templateModule.renderAIReport(data, "performance");

      expect(result).toContain("AI Performance Report");
      expect(result).toContain("100"); // Total requests
    });

    it("should render notifications through module", async () => {
      await templateModule.initialize(null);

      const result = await templateModule.renderNotification(
        "success",
        "Operation completed",
        { duration: "5s" },
      );

      expect(result).toContain("notification-success");
      expect(result).toContain("Success");
      expect(result).toContain("Operation completed");
    });

    it("should handle theme changes through module", async () => {
      await templateModule.initialize(null);

      const customTheme = {
        id: "test",
        name: "Test Theme",
        emailStyles: "body { color: green; }",
        adminStyles: ".admin { background: yellow; }",
      };

      templateModule.setTheme(customTheme);

      // Verify theme was set (through successful email rendering)
      const result = await templateModule.renderEmail("<p>Test</p>", {
        to: "test@example.com",
        subject: "Test",
        data: {},
      });

      expect(result).toContain("color: green"); // Custom theme applied
    });

    it("should handle module destruction", async () => {
      await templateModule.initialize(null);
      await templateModule.destroy();

      // Module should still be accessible after destroy (just cleanup)
      expect(templateModule.name).toBe("templates");
    });
  });

  describe("AI-Specific Template Features", () => {
    it("should handle context quality metrics in reports", async () => {
      const qualityData = {
        period: "2025-08-01 to 2025-08-03",
        averageScore: 0.85,
        totalEvaluations: 500,
        piiDetected: 12,
        harmfulContent: 3,
        qualityBreakdown: [
          { metric: "Clarity", score: 0.9, count: 450 },
          { metric: "Relevance", score: 0.8, count: 500 },
        ],
      };

      const result = await templateEngine.renderAIReport(
        qualityData,
        "quality",
      );

      expect(result).toContain("AI Quality Report");
      expect(result).toContain("0.85"); // Average score
      expect(result).toContain("500"); // Total evaluations
      expect(result).toContain("Clarity"); // Quality metric
      expect(result).toContain("0.90"); // Metric score
    });

    it("should mark AI-generated content appropriately", async () => {
      const template = "<p>{{content}}</p>";
      const context: TemplateContext = {
        content: "This is AI generated content",
        aiGenerated: true,
      };

      const result = await templateEngine.render(template, context);

      // Should process AI-generated content (validation passes)
      expect(result).toContain("This is AI generated content");
    });

    it("should handle email templates with AI-generated flags", async () => {
      const template = "<p>{{message}}</p>";
      const emailData: EmailData = {
        to: "test@example.com",
        subject: "AI Newsletter",
        data: {
          message: "Welcome to our AI-powered newsletter!",
          aiGenerated: true,
        },
      };

      const result = await templateEngine.renderEmail(template, emailData);

      expect(result).toContain("Welcome to our AI-powered newsletter!");
      expect(result).toContain("This content was generated with AI assistance");
    });
  });
});
