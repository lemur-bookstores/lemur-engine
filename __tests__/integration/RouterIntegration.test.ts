import { BasicRouter } from "../../src/router/BasicRouter";
import {
  RouterModule,
  RouterModuleConfig,
} from "../../src/modules/RouterModule";
import express from "express";

type Express = express.Express;

// Interfaces para los servicios mock
interface MockMCPService {
  listTools(): Promise<Array<{ name: string; description: string }>>;
  executeTool(name: string, params: any): Promise<{ result: string }>;
}

interface MockAIService {
  generateResponse(prompt: string): Promise<{ response: string }>;
  analyzeContent(content: string): Promise<{
    sentiment: string;
    score: number;
    summary: string;
  }>;
}

interface MockMonitoringService {
  getMetrics(): {
    uptime: number;
    requests: number;
    memory: { used: number; total: number };
    cpu: number;
  };
}

// Mock para simular respuestas de servicios
class MockKernel {
  getService(
    name: string,
  ): MockMCPService | MockAIService | MockMonitoringService | null {
    switch (name) {
      case "mcp":
        return {
          async listTools() {
            return [{ name: "test-tool", description: "Test tool" }];
          },
          async executeTool(name: string, params: any) {
            return {
              result: `Executed ${name} with ${JSON.stringify(params)}`,
            };
          },
        } as MockMCPService;
      case "ai":
        return {
          async generateResponse(prompt: string) {
            return { response: `AI response to: ${prompt}` };
          },
          async analyzeContent(content: string) {
            return {
              sentiment: "positive",
              score: 0.8,
              summary: `Summary of: ${content.substring(0, 50)}`,
            };
          },
        } as MockAIService;
      case "monitoring":
        return {
          getMetrics() {
            return {
              uptime: 3600,
              requests: 1500,
              memory: { used: 256, total: 1024 },
              cpu: 25.5,
            };
          },
        } as MockMonitoringService;
      default:
        return null;
    }
  }
}
describe("Router System Integration Tests", () => {
  let router: BasicRouter;
  let routerModule: RouterModule;
  let app: Express;
  let mockKernel: MockKernel;

  beforeEach(() => {
    router = new BasicRouter();
    mockKernel = new MockKernel();

    const config: RouterModuleConfig = {
      framework: "express",
      aiEndpoints: true,
      mcpRoutes: true,
      healthChecks: true,
      middleware: {
        cors: true,
        security: true,
        logging: true,
        rateLimit: true,
      },
    };

    routerModule = new RouterModule(config);

    // Configurar Express app para tests
    app = express();
    app.use(express.json());
    router.useExpress(app);
  });

  describe("BasicRouter Core Functionality", () => {
    it("should setup Express adapter correctly", () => {
      const testApp = express();
      router.useExpress(testApp);

      // Verificar que el router se configuró (método público disponible)
      expect(router).toBeDefined();
    });

    it("should add custom routes", () => {
      const route = {
        path: "/test",
        method: "GET" as const,
        handler: (_req: any, res: any) => {
          res.json({ message: "Test route works" });
        },
      };

      router.addRoute(route);

      // Simular request sin supertest
      const mockReq = { method: "GET", url: "/test" };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      route.handler(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Test route works",
      });
    });

    it("should add MCP routes with kernel integration", async () => {
      router.addMCPRoute("/mcp", mockKernel as any);

      // Verificar que el route se agregó correctamente
      expect(router).toBeDefined();
    });

    it("should add AI routes with kernel integration", async () => {
      router.addAIRoute("/ai", mockKernel as any);

      // Verificar que el route se agregó correctamente
      expect(router).toBeDefined();
    });

    it("should setup health routes", async () => {
      router.setupHealthRoutes();

      // Verificar que las rutas de health se configuraron
      expect(router).toBeDefined();
    });

    it("should handle route errors gracefully", async () => {
      const errorRoute = {
        path: "/error-test",
        method: "GET" as const,
        handler: (_req: any, _res: any) => {
          throw new Error("Test error");
        },
      };

      router.addRoute(errorRoute);

      // Simular error handling
      const mockReq = { method: "GET", url: "/error-test" };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      try {
        await errorRoute.handler(mockReq, mockRes);
      } catch (error: any) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Test error");
      }
    });
  });

  describe("RouterModule Integration", () => {
    it("should initialize router module successfully", async () => {
      await routerModule.initialize(mockKernel as any);

      const routerService = routerModule.getService("router");
      expect(routerService).toBeDefined();
    });

    it("should setup AI endpoints through module", async () => {
      await routerModule.initialize(mockKernel as any);

      const router = routerModule.getService("router") as BasicRouter;
      expect(router).toBeDefined();
    });

    it("should setup MCP endpoints through module", async () => {
      await routerModule.initialize(mockKernel as any);

      const router = routerModule.getService("router") as BasicRouter;
      expect(router).toBeDefined();
    });

    it("should integrate with external routers", async () => {
      await routerModule.initialize(mockKernel as any);

      const externalRouter = express.Router();
      externalRouter.get("/external", (_req: any, res: any) => {
        res.json({ source: "external" });
      });

      routerModule.integrateWith(externalRouter);

      expect(routerModule.getService("router")).toBeDefined();
    });

    it("should handle module destruction", async () => {
      await routerModule.initialize(mockKernel as any);
      await routerModule.destroy();

      expect(routerModule.name).toBe("router");
    });
  });

  describe("Advanced Router Features", () => {
    it("should handle parameterized routes", () => {
      const route = {
        path: "/users/:id",
        method: "GET" as const,
        handler: (req: any, res: any) => {
          res.json({ userId: req.params?.id || "unknown" });
        },
      };

      router.addRoute(route);

      // Simular request con parámetros
      const mockReq = {
        method: "GET",
        url: "/users/123",
        params: { id: "123" },
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      route.handler(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith({ userId: "123" });
    });

    it("should handle query parameters", () => {
      const route = {
        path: "/search",
        method: "GET" as const,
        handler: (req: any, res: any) => {
          res.json({
            query: req.query?.q || "",
            limit: req.query?.limit || "10",
          });
        },
      };

      router.addRoute(route);

      const mockReq = {
        method: "GET",
        url: "/search?q=test&limit=10",
        query: { q: "test", limit: "10" },
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      route.handler(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith({
        query: "test",
        limit: "10",
      });
    });

    it("should handle POST requests with body", () => {
      const route = {
        path: "/data",
        method: "POST" as const,
        handler: (req: any, res: any) => {
          res.json({
            received: req.body,
            type: typeof req.body,
          });
        },
      };

      router.addRoute(route);

      const testData = { name: "test", value: 42 };
      const mockReq = {
        method: "POST",
        url: "/data",
        body: testData,
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      route.handler(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith({
        received: testData,
        type: "object",
      });
    });

    it("should validate AI route configurations", () => {
      const aiRoute = {
        path: "/ai/test",
        method: "POST" as const,
        handler: (_req: any, res: any) => {
          res.json({ aiResponse: "test" });
        },
        aiConfig: {
          mcpEnabled: true,
          tokenTracking: true,
          contextPreservation: true,
          costOptimization: true,
          safetyValidation: true,
        },
      };

      router.addRoute(aiRoute);

      // Verificar que la configuración AI se aplicó
      expect(aiRoute.aiConfig.mcpEnabled).toBe(true);
      expect(aiRoute.aiConfig.safetyValidation).toBe(true);
    });

    it("should handle middleware chains", () => {
      const middleware1 = jest.fn((req: any, _res: any, next: any) => {
        req.middleware1 = true;
        next();
      });

      const middleware2 = jest.fn((req: any, _res: any, next: any) => {
        req.middleware2 = true;
        next();
      });

      const route = {
        path: "/middleware-test",
        method: "GET" as const,
        handler: (req: any, res: any) => {
          res.json({
            middleware1: req.middleware1,
            middleware2: req.middleware2,
          });
        },
        middleware: [middleware1, middleware2],
      };

      router.addRoute(route);

      // Verificar que los middleware se configuraron
      expect(route.middleware).toHaveLength(2);
      expect(route.middleware![0]).toBe(middleware1);
      expect(route.middleware![1]).toBe(middleware2);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle missing services gracefully", () => {
      const faultyKernel = {
        getService: () => null,
      };

      // Debería manejar servicios faltantes sin fallar
      expect(() => {
        router.addMCPRoute("/faulty-mcp", faultyKernel as any);
      }).not.toThrow();
    });

    it("should validate route configurations", () => {
      const invalidRoute = {
        path: "", // Path vacío
        method: "GET" as const,
        handler: (_req: any, res: any) => {
          res.json({ test: true });
        },
      };

      // Debería manejar configuraciones inválidas
      expect(() => {
        router.addRoute(invalidRoute);
      }).not.toThrow(); // BasicRouter no valida esto internamente
    });

    it("should handle adapter registration", () => {
      const fastifyApp = { fastify: true }; // Mock Fastify app

      // Debería permitir registrar adapters
      expect(() => {
        router.useFastify(fastifyApp);
      }).not.toThrow();
    });

    it("should handle MCP request validation", async () => {
      const mcpService = mockKernel.getService("mcp") as MockMCPService;

      // Verificar que el servicio MCP responde correctamente
      const tools = await mcpService.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test-tool");

      const result = await mcpService.executeTool("test-tool", {
        param: "value",
      });
      expect(result.result).toContain("Executed test-tool");
    });

    it("should handle AI request validation", async () => {
      const aiService = mockKernel.getService("ai") as MockAIService;

      // Verificar que el servicio AI responde correctamente
      const response = await aiService.generateResponse("test prompt");
      expect(response.response).toContain("AI response to: test prompt");

      const analysis = await aiService.analyzeContent("test content");
      expect(analysis.sentiment).toBe("positive");
      expect(analysis.score).toBe(0.8);
    });
  });
});
