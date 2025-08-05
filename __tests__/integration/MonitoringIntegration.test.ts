import { Kernel } from "../../src/core/Kernel";
import { MonitoringModule } from "../../src/modules/MonitoringModule";
import { KernelConfig } from "../../src/core/config/types";

describe("Monitoring Integration Tests", () => {
  let kernel: Kernel;
  let testConfig: KernelConfig;

  beforeEach(() => {
    testConfig = {
      environment: "development",
      version: "1.0.0-test",
      retry: {
        maxAttempts: 3,
        delay: 1000,
        backoffFactor: 2,
        initialDelay: 1000,
        maxDelay: 5000,
        timeout: 30000,
        backoffStrategy: "exponential",
      },
      bulkhead: {
        maxConcurrent: 10,
        maxQueueSize: 100,
        queueTimeout: 5000,
        maxQueued: 20,
        timeout: 5000,
        rejectionStrategy: "throw",
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 4,
        resetTimeout: 60000,
        halfOpenSuccessThreshold: 3,
        monitoringPeriod: 10000,
      },
      errorHandler: {
        console: {
          enabled: true,
          level: "error",
        },
        file: {
          enabled: false,
          path: "./logs",
          maxSize: "10MB",
          maxFiles: 5,
        },
        metrics: {
          enabled: false,
          storage: "console",
          aggregationInterval: 5000,
        },
      },
      plugins: [],
      pluginConfig: {
        metadata: {
          name: "test",
          version: "1.0.0",
          enabled: true,
        },
        autoload: {
          enabled: false,
          directories: [],
          patterns: [],
          watchMode: false,
        },
        initialization: {
          parallel: false,
          timeout: 30000,
          failureStrategy: "fail-fast",
        },
      },
      logging: {
        level: "error", // Reduce noise in tests
        format: "text",
        destination: "console",
      },
      monitoring: {
        ai: {
          enabled: true,
          tokenTracking: {
            enabled: true,
            alertThresholds: {
              costPerHour: 5.0,
              tokensPerMinute: 500,
            },
          },
          latencyTracking: {
            enabled: true,
            alertThresholds: {
              averageLatency: 1000,
              p95Latency: 2000,
            },
          },
          contextQuality: {
            enabled: true,
            minimumScore: 0.8,
            piiDetection: true,
            harmfulContentDetection: true,
          },
          mcpOperations: {
            enabled: true,
            alertThresholds: {
              errorRate: 0.05,
              responseTime: 2000,
            },
          },
        },
        modelPerformance: {
          enabled: true,
          trackingWindow: 1, // 1 hour for testing
          alertThresholds: {
            successRate: 0.98,
            averageLatency: 800,
            costEfficiency: 0.9,
          },
        },
        healthCheck: {
          enabled: true,
          interval: 10000, // 10 seconds for testing
          timeout: 2000,
        },
        reporting: {
          enabled: true,
          interval: 60000, // 1 minute for testing
          destination: "console",
        },
      },
    };
  });

  afterEach(async () => {
    if (kernel) {
      await kernel.shutdown();
    }
  });

  describe("Kernel Monitoring Integration", () => {
    it("should initialize kernel with monitoring module enabled", async () => {
      kernel = new Kernel(testConfig);

      expect(kernel).toBeDefined();

      // Initialize the kernel
      await kernel.initialize();

      // Check if monitoring module is registered
      const monitoringService = kernel
        .getServiceContainer()
        .resolve<MonitoringModule>("monitoring");
      expect(monitoringService).toBeDefined();
      expect(monitoringService).toBeInstanceOf(MonitoringModule);
    });

    it("should have monitoring components properly initialized", async () => {
      kernel = new Kernel(testConfig);
      await kernel.initialize();

      const monitoringService = kernel
        .getServiceContainer()
        .resolve<MonitoringModule>("monitoring");

      // Check that all monitoring components are available
      expect(monitoringService.aiMonitor).toBeDefined();
      expect(monitoringService.modelPerformanceTracker).toBeDefined();
      expect(monitoringService.contextQualityScorer).toBeDefined();
    });

    it("should track token usage through monitoring module", async () => {
      kernel = new Kernel(testConfig);
      await kernel.initialize();

      const monitoringService = kernel
        .getServiceContainer()
        .resolve<MonitoringModule>("monitoring");
      const aiMonitor = monitoringService.aiMonitor;

      // Track some token usage
      aiMonitor.trackTokenUsage("gpt-4", 100, 0.01);

      // Get metrics
      const stats = aiMonitor.getTokenUsageStats();
      expect(stats.totalTokens).toBe(100);
      expect(stats.totalCost).toBe(0.01);
      expect(stats.operations).toBe(1);
    });

    it("should track model performance through monitoring module", async () => {
      kernel = new Kernel(testConfig);
      await kernel.initialize();

      const monitoringService = kernel
        .getServiceContainer()
        .resolve<MonitoringModule>("monitoring");
      const performanceTracker = monitoringService.modelPerformanceTracker;

      // Track model performance
      performanceTracker.trackModelPerformance("gpt-4", 500, 100, 0.01, true);

      // Get performance report
      const reports = performanceTracker.generatePerformanceReport("gpt-4");
      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBe(1);

      const report = reports[0];
      expect(report.model).toBe("gpt-4");
      expect(report.metrics.totalRequests).toBe(1);
      expect(report.successRate).toBe(1.0);
      expect(report.averageLatency).toBe(500);
    });

    it("should score context quality through monitoring module", async () => {
      kernel = new Kernel(testConfig);
      await kernel.initialize();

      const monitoringService = kernel
        .getServiceContainer()
        .resolve<MonitoringModule>("monitoring");
      const contextScorer = monitoringService.contextQualityScorer;

      // Score some context
      const score = contextScorer.scoreContext(
        "This is a well-structured context with clear information about the user's request. It includes relevant details and follows good formatting practices.",
      );

      expect(score).toBeDefined();
      expect(score.score).toBeGreaterThan(0);
      expect(score.score).toBeLessThanOrEqual(1);
      expect(Array.isArray(score.reasons)).toBe(true);
      expect(Array.isArray(score.suggestions)).toBe(true);
    });

    it("should handle monitoring module with disabled components", async () => {
      // Disable monitoring
      testConfig.monitoring!.ai.enabled = false;
      testConfig.monitoring!.modelPerformance.enabled = false;

      kernel = new Kernel(testConfig);
      await kernel.initialize();

      const monitoringService = kernel
        .getServiceContainer()
        .resolve<MonitoringModule>("monitoring");

      // Components should still exist but configuration should reflect disabled state
      expect(monitoringService).toBeDefined();
      expect(monitoringService.aiMonitor).toBeDefined();
      expect(monitoringService.modelPerformanceTracker).toBeDefined();
    });
  });

  describe("Monitoring Configuration Validation", () => {
    it("should handle missing monitoring configuration gracefully", async () => {
      // Remove monitoring config
      delete testConfig.monitoring;

      kernel = new Kernel(testConfig);
      await kernel.initialize();

      // Should not have monitoring service registered
      expect(() =>
        kernel.getServiceContainer().resolve("monitoring"),
      ).toThrow();
    });

    it("should use default monitoring configuration when partial config provided", async () => {
      // Provide minimal monitoring config
      testConfig.monitoring = {
        ai: {
          enabled: true,
          tokenTracking: {
            enabled: true,
            alertThresholds: { costPerHour: 1, tokensPerMinute: 100 },
          },
          latencyTracking: {
            enabled: true,
            alertThresholds: { averageLatency: 1000, p95Latency: 2000 },
          },
          contextQuality: {
            enabled: true,
            minimumScore: 0.7,
            piiDetection: true,
            harmfulContentDetection: true,
          },
          mcpOperations: {
            enabled: true,
            alertThresholds: { errorRate: 0.1, responseTime: 1000 },
          },
        },
        modelPerformance: {
          enabled: true,
          trackingWindow: 24,
          alertThresholds: {
            successRate: 0.95,
            averageLatency: 1000,
            costEfficiency: 0.8,
          },
        },
        healthCheck: { enabled: true, interval: 30000, timeout: 5000 },
        reporting: { enabled: true, interval: 300000, destination: "console" },
      };

      kernel = new Kernel(testConfig);
      await kernel.initialize();

      const monitoringService = kernel
        .getServiceContainer()
        .resolve<MonitoringModule>("monitoring");
      expect(monitoringService).toBeDefined();
    });
  });
});
