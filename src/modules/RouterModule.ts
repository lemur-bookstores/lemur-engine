import { BasicRouter } from "../router/BasicRouter";
import { IModule } from "../types/IModule";

interface RouterModuleConfig {
  framework?: "express" | "fastify" | "custom";
  aiEndpoints: boolean;
  mcpRoutes: boolean;
  healthChecks: boolean;
  middleware?: {
    cors?: boolean;
    logging?: boolean;
    rateLimit?: boolean;
    security?: boolean;
  };
}

class RouterModule implements IModule {
  public name = "router";
  private config: RouterModuleConfig;
  private router: BasicRouter;
  private externalApp: any = null;

  constructor(config: RouterModuleConfig) {
    this.config = config;
    this.router = new BasicRouter();
  }

  async initialize(_kernel: any): Promise<void> {
    console.log("RouterModule initialized");

    // Configurar middleware básico
    if (this.config.middleware?.logging !== false) {
      console.log("Request logging middleware enabled");
    }

    if (this.config.middleware?.security) {
      this.addSecurityMiddleware();
    }

    if (this.config.middleware?.cors) {
      this.addCORSMiddleware();
    }

    // Configurar rutas AI si están habilitadas
    if (this.config.aiEndpoints) {
      this.setupAIEndpoints();
    }

    // Configurar rutas MCP si están habilitadas
    if (this.config.mcpRoutes) {
      this.setupMCPEndpoints();
    }

    // Configurar health checks si están habilitados
    if (this.config.healthChecks) {
      this.router.setupHealthRoutes();
    }

    console.log(
      `Router configured for framework: ${this.config.framework || "none"}`,
    );
  }

  async destroy(): Promise<void> {
    console.log("RouterModule destroyed");
  }

  getService<T>(serviceName: string): T {
    switch (serviceName) {
      case "router":
        return this.router as unknown as T;
      case "stats":
        return this.router.getStats() as unknown as T;
      default:
        throw new Error(`Service ${serviceName} not found in RouterModule`);
    }
  }

  // Integrar con app externa (Express/Fastify)
  integrateWith(app: any, framework: "express" | "fastify" = "express"): void {
    this.externalApp = app;

    switch (framework) {
      case "express":
        this.router.useExpress(app);
        break;
      case "fastify":
        this.router.useFastify(app);
        break;
    }

    console.log(`Integrated with ${framework} application`);
  }

  // Registrar todas las rutas
  async registerRoutes(): Promise<void> {
    if (!this.externalApp) {
      console.warn("No external app configured, routes not registered");
      return;
    }

    await this.router.registerRoutes(this.config.framework || "express");
  }

  private setupAIEndpoints(): void {
    // Endpoint para completions de AI
    this.router.addAIRoute("/ai/complete", async (aiRequest, _res) => {
      const startTime = Date.now();

      try {
        // Simulación de llamada a modelo AI
        const response = {
          result: `AI response for: ${aiRequest.input}`,
          model: aiRequest.model,
          type: aiRequest.type,
        };

        const latency = Date.now() - startTime;
        const tokenCount = Math.floor(aiRequest.input.length / 4); // Estimación básica

        return {
          success: true,
          result: response,
          metrics: {
            tokens: tokenCount,
            cost: tokenCount * 0.0001, // Precio estimado
            latency,
            quality: 0.95,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          metrics: {
            tokens: 0,
            cost: 0,
            latency: Date.now() - startTime,
          },
        };
      }
    });

    // Endpoint para análisis de AI
    this.router.addAIRoute("/ai/analyze", async (aiRequest, _res) => {
      const startTime = Date.now();

      try {
        const analysis = {
          sentiment: "positive",
          confidence: 0.85,
          keywords: aiRequest.input.split(" ").slice(0, 5),
          summary: `Analysis of: ${aiRequest.input.substring(0, 100)}...`,
        };

        const latency = Date.now() - startTime;
        const tokenCount = Math.floor(aiRequest.input.length / 4);

        return {
          success: true,
          result: analysis,
          metrics: {
            tokens: tokenCount,
            cost: tokenCount * 0.0001,
            latency,
            quality: 0.9,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          metrics: {
            tokens: 0,
            cost: 0,
            latency: Date.now() - startTime,
          },
        };
      }
    });

    console.log("AI endpoints configured");
  }

  private setupMCPEndpoints(): void {
    // Endpoint principal MCP
    this.router.addMCPRoute("/mcp/execute", async (mcpRequest, _res) => {
      try {
        // Simulación de operación MCP
        const result = {
          operation: mcpRequest.operation,
          model: mcpRequest.model,
          result: `MCP operation ${mcpRequest.operation} executed successfully`,
          context: mcpRequest.context,
          tools: mcpRequest.tools,
        };

        const tokenCount = JSON.stringify(mcpRequest.context).length / 4;

        return {
          success: true,
          data: result,
          tokens: tokenCount,
          cost: tokenCount * 0.0001,
          latency: Math.random() * 1000 + 100,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Endpoint para herramientas MCP
    this.router.addMCPRoute("/mcp/tools", async (_mcpRequest, _res) => {
      try {
        const availableTools = [
          { name: "database-query", description: "Query database" },
          { name: "file-operation", description: "File operations" },
          { name: "api-call", description: "External API calls" },
          { name: "calculation", description: "Mathematical calculations" },
        ];

        return {
          success: true,
          data: { tools: availableTools },
          tokens: 50,
          cost: 0.005,
          latency: 50,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    console.log("MCP endpoints configured");
  }

  private addSecurityMiddleware(): void {
    this.router.addMiddleware(async (req: any, _res: any, next: any) => {
      // Validación básica de seguridad
      const userAgent = req.headers["user-agent"];
      if (!userAgent || userAgent.includes("bot")) {
        console.warn(`Suspicious request from: ${req.ip}`);
      }

      // Rate limiting básico (en producción usar redis)
      req.requestCount = (req.requestCount || 0) + 1;

      await next();
    });

    console.log("Security middleware added");
  }

  private addCORSMiddleware(): void {
    this.router.addMiddleware(async (req: any, res: any, next: any) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Methods",
        "GET,PUT,POST,DELETE,PATCH,OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }

      await next();
    });

    console.log("CORS middleware added");
  }

  // Métodos de conveniencia
  addCustomRoute(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    handler: any,
  ): void {
    this.router.addRoute({
      path,
      method,
      handler,
    });
  }

  getRouterStats(): any {
    return this.router.getStats();
  }
}

export { RouterModule, RouterModuleConfig };
