import { Request, Response } from "express";

interface Route {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  handler: RouteHandler;
  middleware?: Middleware[];
  aiConfig?: AIRouteConfig;
}

interface RouteHandler {
  (request: Request, response: any, next?: any): Promise<any> | any;
}

interface Middleware {
  (request: Request, response: any, next: any): Promise<void> | void;
}

interface AIRouteConfig {
  mcpEnabled: boolean;
  tokenTracking: boolean;
  contextPreservation: boolean;
  costOptimization: boolean;
  safetyValidation: boolean;
}

interface RouterAdapter {
  framework: "express" | "fastify" | "koa" | "custom";
  register(routes: Route[]): Promise<void>;
  middleware: Middleware[];
  app: any;
}

interface MCPHandler {
  (mcpRequest: MCPRequest, response: any): Promise<MCPResponse>;
}

interface MCPRequest {
  model: string;
  operation: string;
  context: any;
  tools?: string[];
  metadata?: Record<string, any>;
}

interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  tokens?: number;
  cost?: number;
  latency?: number;
}

interface AIHandler {
  (aiRequest: AIRequest, response: any): Promise<AIResponse>;
}

interface AIRequest {
  type: "completion" | "embedding" | "analysis";
  model: string;
  input: string;
  options?: AIRequestOptions;
  context?: any;
}

interface AIRequestOptions {
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
  safetyLevel?: "strict" | "moderate" | "minimal";
}

interface AIResponse {
  success: boolean;
  result?: any;
  error?: string;
  metrics: {
    tokens: number;
    cost: number;
    latency: number;
    quality?: number;
  };
}

class BasicRouter {
  private routes: Route[] = [];
  private adapters: Map<string, RouterAdapter> = new Map();
  private mcpRoutes: Map<string, MCPHandler> = new Map();
  private aiRoutes: Map<string, AIHandler> = new Map();
  private globalMiddleware: Middleware[] = [];

  constructor() {
    this.initializeDefaultMiddleware();
  }

  private initializeDefaultMiddleware(): void {
    // Middleware básico para logging
    this.globalMiddleware.push(
      async (req: Request, _res: Response, next: any) => {
        const start = Date.now();
        console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);

        // Continuar con el siguiente middleware
        await next();

        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} - ${duration}ms`);
      },
    );

    // Middleware para AI request tracking
    this.globalMiddleware.push(
      async (req: Request, _res: Response, next: any) => {
        if (req.url.startsWith("/ai/") || req.url.startsWith("/mcp/")) {
          req.aiRequest = true;
          req.requestStart = Date.now();
        }
        await next();
      },
    );
  }

  // Integración con Express
  useExpress(app: any): void {
    const adapter: RouterAdapter = {
      framework: "express",
      middleware: this.globalMiddleware,
      app,
      register: async (routes: Route[]) => {
        routes.forEach((route) => {
          const middlewares = [
            ...this.globalMiddleware,
            ...(route.middleware || []),
          ];

          switch (route.method) {
            case "GET":
              app.get(route.path, ...middlewares, route.handler);
              break;
            case "POST":
              app.post(route.path, ...middlewares, route.handler);
              break;
            case "PUT":
              app.put(route.path, ...middlewares, route.handler);
              break;
            case "DELETE":
              app.delete(route.path, ...middlewares, route.handler);
              break;
            case "PATCH":
              app.patch(route.path, ...middlewares, route.handler);
              break;
          }
        });
      },
    };

    this.adapters.set("express", adapter);
    console.log("Express adapter registered");
  }

  // Integración con Fastify
  useFastify(app: any): void {
    const adapter: RouterAdapter = {
      framework: "fastify",
      middleware: this.globalMiddleware,
      app,
      register: async (routes: Route[]) => {
        for (const route of routes) {
          await app.register(async (fastify: any) => {
            // Registrar middleware
            for (const middleware of [
              ...this.globalMiddleware,
              ...(route.middleware || []),
            ]) {
              fastify.addHook("onRequest", middleware);
            }

            // Registrar ruta
            fastify.route({
              method: route.method,
              url: route.path,
              handler: route.handler,
            });
          });
        }
      },
    };

    this.adapters.set("fastify", adapter);
    console.log("Fastify adapter registered");
  }

  // Uso de adaptador custom
  useCustom(adapter: RouterAdapter): void {
    this.adapters.set("custom", adapter);
    console.log(`Custom ${adapter.framework} adapter registered`);
  }

  // Añadir ruta MCP específica
  addMCPRoute(path: string, handler: MCPHandler): void {
    this.mcpRoutes.set(path, handler);

    const mcpRouteHandler: RouteHandler = async (
      req: Request,
      res: Response,
    ) => {
      try {
        const mcpRequest: MCPRequest = {
          model: req.body.model || "default",
          operation: req.body.operation,
          context: req.body.context,
          tools: req.body.tools,
          metadata: {
            ...req.body.metadata,
            timestamp: Date.now(),
            clientIP: req.ip,
            userAgent: req.headers["user-agent"],
          },
        };

        const response = await handler(mcpRequest, res);

        // Tracking para MCP
        if (req.aiRequest && req.requestStart) {
          const latency = Date.now() - req.requestStart;
          console.log(
            `MCP operation ${mcpRequest.operation} completed in ${latency}ms`,
          );
        }

        res.json(response);
      } catch (error: any) {
        console.error("MCP route error:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    this.addRoute({
      path,
      method: "POST",
      handler: mcpRouteHandler,
      aiConfig: {
        mcpEnabled: true,
        tokenTracking: true,
        contextPreservation: true,
        costOptimization: true,
        safetyValidation: true,
      },
    });

    console.log(`MCP route added: ${path}`);
  }

  // Añadir ruta AI específica
  addAIRoute(path: string, handler: AIHandler): void {
    this.aiRoutes.set(path, handler);

    const aiRouteHandler: RouteHandler = async (
      req: Request,
      res: Response,
    ) => {
      try {
        const aiRequest: AIRequest = {
          type: req.body.type || "completion",
          model: req.body.model || "gpt-3.5-turbo",
          input: req.body.input,
          options: req.body.options,
          context: req.body.context,
        };

        // Validación de seguridad para AI
        if (this.containsUnsafeContent(aiRequest.input)) {
          return res.status(400).json({
            success: false,
            error: "Unsafe content detected",
          });
        }

        const response = await handler(aiRequest, res);

        // Tracking para AI
        if (req.aiRequest && req.requestStart) {
          const latency = Date.now() - req.requestStart;
          console.log(
            `AI ${aiRequest.type} completed in ${latency}ms, tokens: ${response.metrics.tokens}`,
          );
        }

        res.json(response);
      } catch (error: any) {
        console.error("AI route error:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    this.addRoute({
      path,
      method: "POST",
      handler: aiRouteHandler,
      aiConfig: {
        mcpEnabled: false,
        tokenTracking: true,
        contextPreservation: true,
        costOptimization: true,
        safetyValidation: true,
      },
    });

    console.log(`AI route added: ${path}`);
  }

  // Añadir ruta general
  addRoute(route: Route): void {
    this.routes.push(route);
    console.log(`Route added: ${route.method} ${route.path}`);
  }

  // Añadir middleware global
  addMiddleware(middleware: Middleware): void {
    this.globalMiddleware.push(middleware);
    console.log("Global middleware added");
  }

  // Registrar todas las rutas en el adaptador activo
  async registerRoutes(adapterName: string = "express"): Promise<void> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter ${adapterName} not found`);
    }

    await adapter.register(this.routes);
    console.log(
      `${this.routes.length} routes registered with ${adapterName} adapter`,
    );
  }

  // Rutas de health check automáticas
  setupHealthRoutes(): void {
    this.addRoute({
      path: "/health",
      method: "GET",
      handler: (_req: Request, res: Response) => {
        res.json({
          status: "healthy",
          timestamp: new Date().toISOString(),
          routes: this.routes.length,
          adapters: Array.from(this.adapters.keys()),
        });
      },
    });

    this.addRoute({
      path: "/health/ai",
      method: "GET",
      handler: (_req: Request, res: Response) => {
        res.json({
          status: "healthy",
          mcpRoutes: this.mcpRoutes.size,
          aiRoutes: this.aiRoutes.size,
          timestamp: new Date().toISOString(),
        });
      },
    });

    console.log("Health check routes added");
  }

  private containsUnsafeContent(content: string): boolean {
    const unsafePatterns = [
      /\b(hack|exploit|attack|malware)\b/i,
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
    ];

    return unsafePatterns.some((pattern) => pattern.test(content));
  }

  // Obtener estadísticas del router
  getStats(): any {
    return {
      totalRoutes: this.routes.length,
      mcpRoutes: this.mcpRoutes.size,
      aiRoutes: this.aiRoutes.size,
      adapters: Array.from(this.adapters.keys()),
      middleware: this.globalMiddleware.length,
    };
  }
}

export {
  BasicRouter,
  Route,
  RouteHandler,
  Middleware,
  RouterAdapter,
  MCPHandler,
  AIHandler,
  MCPRequest,
  MCPResponse,
  AIRequest,
  AIResponse,
  AIRouteConfig,
};
