# Guía de Implementación: Sistema de Comunicación Multi-Protocolo con MCP

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Análisis de Viabilidad](#análisis-de-viabilidad)
3. [Arquitectura de Comunicación Multi-Protocolo](#arquitectura-de-comunicación-multi-protocolo)
4. [Fases de Implementación](#fases-de-implementación)
5. [Especificaciones Técnicas](#especificaciones-técnicas)
6. [Patrones de Diseño](#patrones-de-diseño)
7. [Comunicación Real-time](#comunicación-real-time)
8. [Roadmap Detallado](#roadmap-detallado)
9. [Consideraciones de Seguridad](#consideraciones-de-seguridad)
10. [Ejemplos de Implementación](#ejemplos-de-implementación)

---

## Introducción

### ¿Qué es el Sistema de Comunicación Multi-Protocolo?

Un sistema unificado que soporta múltiples protocolos de comunicación:

- **HTTP/REST**: APIs tradicionales para operaciones CRUD
- **WebSockets**: Comunicación real-time bidireccional
- **gRPC**: RPC eficiente para comunicación inter-servicios
- **MCP**: Model Context Protocol para integración con LLMs

### ¿Por qué Multi-Protocolo en nuestro Micro-Kernel?

**Ventajas Estratégicas:**

- **Flexibility**: Protocolo óptimo para cada caso de uso
- **Performance**: Latencia ultra-baja cuando se necesite
- **Real-time**: Aplicaciones colaborativas y dashboards en vivo
- **Scalability**: Manejo eficiente de miles de conexiones
- **Future-Proofing**: Preparación para aplicaciones modernas

---

## Análisis de Viabilidad

### **Agente 1 (Arquitectura de Software):**

**Recomendación: SÍ implementar Sistema Multi-Protocolo con MCP**

**Razones Arquitectónicas:**

1. **Protocol Specialization**: Cada protocolo optimizado para casos específicos
2. **Unified Interface**: Single API para múltiples protocolos
3. **Plugin Ecosystem**: Plugins pueden elegir el protocolo óptimo
4. **Modern Applications**: Soporte nativo para apps real-time y AI-powered

**Casos de Uso por Protocolo:**

- **HTTP**: REST APIs, operaciones CRUD, integración con sistemas legacy
- **WebSockets**: Notificaciones real-time, colaboración, live dashboards
- **gRPC**: Comunicación inter-plugin eficiente, microservicios internos
- **MCP**: Integración con LLMs, herramientas AI, context sharing

**Posición en la Arquitectura:**

```
Clean Architecture Layers:
├── Domain Layer (Entities, Business Rules)
├── Application Layer (Use Cases)
├── Infrastructure Layer
│   └── Communication Layer ← Multi-Protocol Support
│       ├── HTTP Adapter
│       ├── WebSocket Adapter
│       ├── gRPC Adapter
│       └── MCP Adapter
└── Presentation Layer
```

### **Agente 2 (Patrones de Diseño):**

**Patrones Recomendados para Multi-Protocolo:**

- **Strategy Pattern**: Diferentes implementaciones de protocolo
- **Adapter Pattern**: Unificación de interfaces dispares
- **Facade Pattern**: Interface simplificada para plugins
- **Observer Pattern**: Eventos en tiempo real
- **Proxy Pattern**: Control de acceso y load balancing
- **Bridge Pattern**: Separación entre abstracción e implementación

---

## Arquitectura de Comunicación Multi-Protocolo

### Estructura General

```typescript
interface CommunicationLayer {
  http: HTTPAdapter; // REST APIs tradicionales
  websocket: WebSocketAdapter; // Real-time bidireccional
  grpc: GRPCAdapter; // RPC eficiente
  mcp: MCPAdapter; // Model Context Protocol
  router: MessageRouter; // Enrutamiento inteligente
  gateway: UnifiedGateway; // API Gateway unificado
}
```

### Componentes Principales

#### 1. HTTP Adapter

- APIs REST tradicionales
- Operaciones CRUD estándar
- Integración con sistemas legacy
- Rate limiting y caching

#### 2. WebSocket Adapter

- Comunicación bidireccional real-time
- Notificaciones push
- Live updates y colaboración
- Connection pooling

#### 3. gRPC Adapter

- Comunicación eficiente inter-servicios
- Type-safe contracts
- Streaming bidireccional
- Load balancing automático

#### 4. MCP Adapter

- Integración con LLMs
- Context sharing
- Tool exposition
- Resource management

#### 5. Unified Gateway

- Enrutamiento inteligente de mensajes
- Protocol translation
- Authentication/Authorization
- Monitoring y observabilidad

---

## Fases de Implementación

### Fase 2.5: HTTP Foundation (Semana 5)

**Objetivo**: Establecer base HTTP sólida en el kernel

**Deliverables:**

- HTTP Server robusto con middleware system
- REST API framework para plugins
- Request/Response validation
- Rate limiting y security básica

**Tasks:**

1. Implementar HTTP Server core con Express/Fastify
2. Crear middleware chain para plugins
3. Sistema de routing dinámico
4. Validation y error handling

### Fase 3.0: WebSocket Integration (Semana 6)

**Objetivo**: Comunicación real-time bidireccional

**Deliverables:**

- WebSocket Server implementation
- Connection management y rooms
- Real-time event broadcasting
- Plugin WebSocket APIs

**Tasks:**

1. Implementar WebSocket Server
2. Connection pooling y management
3. Room/Channel system
4. Integration con Event Bus

### Fase 3.5: gRPC Implementation (Semana 7)

**Objetivo**: Comunicación eficiente inter-servicios

**Deliverables:**

- gRPC Server y Client
- Service definition framework
- Streaming support
- Plugin gRPC integration

**Tasks:**

1. Setup gRPC infrastructure
2. Service definition system
3. Code generation para plugins
4. Load balancing y health checks

### Fase 4.0: MCP Integration (Semana 8)

**Objetivo**: Integración con ecosistema AI

**Deliverables:**

- MCP Client y Server
- LLM integration framework
- Tool exposition system
- Advanced AI capabilities

**Tasks:**

1. Implementar MCP protocol
2. LLM adapters
3. Tool registration system
4. AI-powered features

---

## Especificaciones Técnicas

### Multi-Protocol Interface Definitions

```typescript
// Unified Communication Interface
interface CommunicationStrategy {
  initialize(config: ProtocolConfig): Promise<void>;
  send(message: Message, target: Target): Promise<void>;
  receive(handler: MessageHandler): void;
  supports(protocol: string): boolean;
  getCapabilities(): ProtocolCapabilities;
}

// HTTP Strategy
interface HTTPConfig extends ProtocolConfig {
  port: number;
  host: string;
  middleware: MiddlewareConfig[];
  cors: CORSConfig;
  rateLimit: RateLimitConfig;
}

// WebSocket Strategy
interface WebSocketConfig extends ProtocolConfig {
  port: number;
  path: string;
  rooms: RoomConfig[];
  heartbeat: HeartbeatConfig;
  compression: boolean;
}

// gRPC Strategy
interface GRPCConfig extends ProtocolConfig {
  port: number;
  services: ServiceDefinition[];
  reflection: boolean;
  maxReceiveMessageLength: number;
  credentials: CredentialsConfig;
}

// MCP Strategy
interface MCPConfig extends ProtocolConfig {
  transport: "stdio" | "http" | "websocket";
  resources: ResourceConfig[];
  tools: ToolConfig[];
  authentication: AuthConfig;
}

// Unified Message Format
interface UnifiedMessage {
  id: string;
  type: string;
  protocol: "http" | "websocket" | "grpc" | "mcp";
  payload: any;
  metadata: MessageMetadata;
  routing: RoutingInfo;
}

// Protocol Capabilities
interface ProtocolCapabilities {
  bidirectional: boolean;
  realtime: boolean;
  streaming: boolean;
  typeStrict: boolean;
  efficient: boolean;
  compression: boolean;
}
```

### Plugin Multi-Protocol Integration

```typescript
// Enhanced Plugin with Multi-Protocol Support
interface MultiProtocolPlugin extends Plugin {
  getHTTPRoutes(): RouteDefinition[];
  getWebSocketHandlers(): WebSocketHandler[];
  getGRPCServices(): ServiceDefinition[];
  getMCPResources(): MCPResource[];
  getMCPTools(): MCPTool[];
}

abstract class UnifiedCommunicationPlugin extends Plugin {
  protected communicationManager: CommunicationManager;

  async initialize(kernel: Kernel): Promise<void> {
    await super.initialize(kernel);
    this.communicationManager = kernel.getCommunicationManager();
    await this.registerCommunicationEndpoints();
  }

  private async registerCommunicationEndpoints(): Promise<void> {
    // Register HTTP routes
    const routes = this.getHTTPRoutes();
    for (const route of routes) {
      await this.communicationManager.registerHTTPRoute(route);
    }

    // Register WebSocket handlers
    const wsHandlers = this.getWebSocketHandlers();
    for (const handler of wsHandlers) {
      await this.communicationManager.registerWebSocketHandler(handler);
    }

    // Register gRPC services
    const grpcServices = this.getGRPCServices();
    for (const service of grpcServices) {
      await this.communicationManager.registerGRPCService(service);
    }

    // Register MCP resources and tools
    const mcpResources = this.getMCPResources();
    const mcpTools = this.getMCPTools();
    await this.communicationManager.registerMCPCapabilities(
      mcpResources,
      mcpTools
    );
  }

  // Helper methods for protocol-specific communication
  protected async sendHTTPResponse(response: HTTPResponse): Promise<void> {
    await this.communicationManager.sendHTTP(response);
  }

  protected async broadcastWebSocket(
    message: WebSocketMessage,
    room?: string
  ): Promise<void> {
    await this.communicationManager.broadcastWebSocket(message, room);
  }

  protected async callGRPCService(
    service: string,
    method: string,
    data: any
  ): Promise<any> {
    return await this.communicationManager.callGRPC(service, method, data);
  }

  protected async exposeMCPResource(resource: MCPResource): Promise<void> {
    await this.communicationManager.exposeMCPResource(resource);
  }
}
```

---

## Patrones de Diseño

### 1. Strategy Pattern - Para Múltiples Protocolos

```typescript
interface CommunicationStrategy {
  initialize(config: ProtocolConfig): Promise<void>;
  send(message: Message, target: Target): Promise<void>;
  receive(handler: MessageHandler): void;
  supports(protocol: string): boolean;
  getCapabilities(): ProtocolCapabilities;
}

class WebSocketStrategy implements CommunicationStrategy {
  private server: WebSocketServer;
  private connections: Map<string, WebSocket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();

  supports(protocol: string): boolean {
    return protocol === "websocket" || protocol === "ws";
  }

  async initialize(config: WebSocketConfig): Promise<void> {
    this.server = new WebSocketServer({
      port: config.port,
      path: config.path,
    });

    this.server.on("connection", this.handleConnection.bind(this));
  }

  async send(message: Message, target: Target): Promise<void> {
    if (target.type === "connection") {
      const connection = this.connections.get(target.id);
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
      }
    } else if (target.type === "room") {
      await this.broadcastToRoom(target.id, message);
    }
  }

  private async broadcastToRoom(
    roomId: string,
    message: Message
  ): Promise<void> {
    const connectionIds = this.rooms.get(roomId) || new Set();
    const promises = Array.from(connectionIds).map((connectionId) => {
      const connection = this.connections.get(connectionId);
      if (connection && connection.readyState === WebSocket.OPEN) {
        return new Promise<void>((resolve) => {
          connection.send(JSON.stringify(message), () => resolve());
        });
      }
      return Promise.resolve();
    });
    await Promise.all(promises);
  }

  getCapabilities(): ProtocolCapabilities {
    return {
      bidirectional: true,
      realtime: true,
      streaming: true,
      compression: true,
      typeStrict: false,
      efficient: true,
    };
  }
}

class GRPCStrategy implements CommunicationStrategy {
  private server: grpc.Server;
  private clients: Map<string, grpc.Client> = new Map();

  supports(protocol: string): boolean {
    return protocol === "grpc";
  }

  async initialize(config: GRPCConfig): Promise<void> {
    this.server = new grpc.Server();

    // Load service definitions from plugins
    for (const serviceDefinition of config.services) {
      await this.loadService(serviceDefinition);
    }

    this.server.bindAsync(
      `${config.host}:${config.port}`,
      grpc.ServerCredentials.createInsecure(),
      () => this.server.start()
    );
  }

  async send(message: Message, target: Target): Promise<void> {
    const client = this.clients.get(target.service);
    if (!client) {
      throw new Error(`gRPC client not found for service: ${target.service}`);
    }

    return new Promise((resolve, reject) => {
      client[target.method](message.payload, (error: any, response: any) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  getCapabilities(): ProtocolCapabilities {
    return {
      bidirectional: true,
      realtime: true,
      streaming: true,
      compression: true,
      typeStrict: true,
      efficient: true,
    };
  }
}
```

### 2. Adapter Pattern - Para Unificar Interfaces

```typescript
interface UnifiedCommunicationAdapter {
  send(message: UnifiedMessage): Promise<void>;
  subscribe(pattern: string, handler: MessageHandler): void;
  broadcast(message: UnifiedMessage, scope?: BroadcastScope): Promise<void>;
  createChannel(name: string, protocol: string): CommunicationChannel;
}

class MultiProtocolAdapter implements UnifiedCommunicationAdapter {
  private strategies: Map<string, CommunicationStrategy> = new Map();
  private router: MessageRouter;
  private subscriptions: Map<string, MessageHandler[]> = new Map();

  constructor() {
    this.router = new MessageRouter();
    this.registerStrategies();
  }

  private registerStrategies(): void {
    this.strategies.set("http", new HTTPStrategy());
    this.strategies.set("websocket", new WebSocketStrategy());
    this.strategies.set("grpc", new GRPCStrategy());
    this.strategies.set("mcp", new MCPStrategy());
  }

  async send(message: UnifiedMessage): Promise<void> {
    const strategy = this.strategies.get(message.protocol);
    if (!strategy) {
      throw new Error(`Protocol not supported: ${message.protocol}`);
    }

    const target = await this.router.resolveTarget(message);
    await strategy.send(message, target);
  }

  async broadcast(
    message: UnifiedMessage,
    scope?: BroadcastScope
  ): Promise<void> {
    const strategy = this.strategies.get(message.protocol);
    if (!strategy) {
      throw new Error(`Protocol not supported: ${message.protocol}`);
    }

    const targets = await this.router.resolveBroadcastTargets(message, scope);
    const promises = targets.map((target) => strategy.send(message, target));
    await Promise.all(promises);
  }

  subscribe(pattern: string, handler: MessageHandler): void {
    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, []);
    }
    this.subscriptions.get(pattern)!.push(handler);
  }

  createChannel(name: string, protocol: string): CommunicationChannel {
    const strategy = this.strategies.get(protocol);
    if (!strategy) {
      throw new Error(`Protocol not supported: ${protocol}`);
    }

    return new CommunicationChannel(name, strategy, this.router);
  }
}
```

### 3. Bridge Pattern - Separación de Abstracción e Implementación

````typescript
// Abstraction
abstract class CommunicationBridge {
  protected implementation: CommunicationImplementation;

  constructor(implementation: CommunicationImplementation) {
    this.implementation = implementation;
  }

  abstract sendMessage(message: Message): Promise<void>;
  abstract receiveMessage(): Promise<Message>;
}

// Refined Abstraction
class RealtimeCommunicationBridge extends CommunicationBridge {
  async sendMessage(message: Message): Promise<void> {
    // Add real-time specific logic
    message.timestamp = Date.now();
    message.priority = 'high';

    await this.implementation.send(message);
  }

  async receiveMessage(): Promise<Message> {
    const message = await this.implementation.receive();

    // Add real-time processing
    if (Date.now() - message.timestamp > 5000) {
      throw new Error('Message expired');
    }

    return message;
  }
}

// Implementation Interface
interface CommunicationImplementation {
  send(message: Message): Promise<void>;
  receive(): Promise<Message>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

// Concrete Implementations
class WebSocketImplementation implements CommunicationImplementation {
  private connection: WebSocket;

  async send(message: Message): Promise<void> {
    if (this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify(message));
    }
  }

  async receive(): Promise<Message> {
    return new Promise((resolve) => {
      this.connection.onmessage = (event) => {
        resolve(JSON.parse(event.data));
      };
    });
  }
}

class GRPCImplementation implements CommunicationImplementation {
  private client: grpc.Client;

  async send(message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.send(message, (error: any, response: any) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async receive(): Promise<Message> {
    return new Promise((resolve) => {
      const stream = this.client.listen();
      stream.on('data', (message: Message) => {
        resolve(message);
      });
    });
  }
}
```pluginId: string, message: any): Promise<any> {
    return await this.bridge.sendMessage(pluginId, message);
  }
}
````

### 3. Strategy Pattern - Diferentes Serializadores

```typescript
interface MCPSerializer {
  serialize(data: any): string;
  deserialize(data: string): any;
  getMimeType(): string;
}

class JSONMCPSerializer implements MCPSerializer {
  serialize(data: any): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): any {
    return JSON.parse(data);
  }

  getMimeType(): string {
    return "application/json";
  }
}

class MessagePackMCPSerializer implements MCPSerializer {
  serialize(data: any): string {
    return msgpack.encode(data);
  }

  deserialize(data: string): any {
    return msgpack.decode(data);
  }

  getMimeType(): string {
    return "application/msgpack";
  }
}
```

### 4. Observer Pattern - Eventos MCP

```typescript
interface MCPEventHandler {
  handleResourceChanged(resource: MCPResource): Promise<void>;
  handleToolCalled(toolName: string, args: any, result: any): Promise<void>;
  handleConnectionStateChanged(state: ConnectionState): Promise<void>;
}

class MCPEventBus {
  private handlers: Set<MCPEventHandler> = new Set();

  subscribe(handler: MCPEventHandler): void {
    this.handlers.add(handler);
  }

  async emitResourceChanged(resource: MCPResource): Promise<void> {
    for (const handler of this.handlers) {
      await handler.handleResourceChanged(resource);
    }
  }

  async emitToolCalled(
    toolName: string,
    args: any,
    result: any
  ): Promise<void> {
    for (const handler of this.handlers) {
      await handler.handleToolCalled(toolName, args, result);
    }
  }
}
```

---

## Roadmap Detallado

### Semana 5: MCP Foundation

**Día 1-2: Arquitectura Base**

- [ ] Definir interfaces MCP core
- [ ] Implementar MCPServer básico
- [ ] Crear MCPResourceRegistry
- [ ] Setup testing framework

**Día 3-4: Resource Management**

- [ ] Sistema de registro de recursos
- [ ] Validación de recursos
- [ ] Serialización/deserialización
- [ ] Error handling básico

**Día 5-7: Tool System**

- [ ] Framework de herramientas
- [ ] Registro de tools
- [ ] Ejecución de herramientas
- [ ] Validación de schemas

### Semana 6: MCP Client Integration

**Día 1-2: Client Implementation**

- [ ] MCPClient base
- [ ] Connection management
- [ ] Protocol adapters (STDIO, HTTP)
- [ ] Connection pooling

**Día 3-4: External Integration**

- [ ] LLM adapters
- [ ] Resource discovery
- [ ] Caching mechanism
- [ ] Retry logic

**Día 5-7: Error Handling & Resilience**

- [ ] Circuit breakers
- [ ] Timeout management
- [ ] Fallback mechanisms
- [ ] Health checks

### Semana 7: Plugin Integration

**Día 1-2: Plugin SDK**

- [ ] MCPEnabledPlugin base class
- [ ] Resource registration helpers
- [ ] Tool registration helpers
- [ ] Documentation y ejemplos

**Día 3-4: Inter-Plugin Communication**

- [ ] MCPBridge implementation
- [ ] Plugin discovery
- [ ] Message routing
- [ ] Load balancing

**Día 5-7: Performance & Monitoring**

- [ ] Métricas de MCP
- [ ] Performance profiling
- [ ] Resource usage tracking
- [ ] Alerting system

### Semana 8: Advanced Features

**Día 1-2: Advanced Resource Management**

- [ ] Resource versioning
- [ ] Dependency tracking
- [ ] Lifecycle management
- [ ] Garbage collection

**Día 3-4: Real-time Features**

- [ ] WebSocket support
- [ ] Real-time notifications
- [ ] Live resource updates
- [ ] Collaborative editing

**Día 5-7: Production Hardening**

- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation completa
- [ ] Integration testing

---

## Consideraciones de Seguridad

### Autenticación y Autorización

```typescript
interface MCPSecurityManager {
  authenticateConnection(credentials: MCPCredentials): Promise<MCPPrincipal>;
  authorizeResourceAccess(
    principal: MCPPrincipal,
    resource: MCPResource
  ): Promise<boolean>;
  authorizeToolExecution(
    principal: MCPPrincipal,
    tool: MCPTool
  ): Promise<boolean>;
}

class DefaultMCPSecurityManager implements MCPSecurityManager {
  async authenticateConnection(
    credentials: MCPCredentials
  ): Promise<MCPPrincipal> {
    // Validar credenciales (API key, JWT, etc.)
    if (!(await this.validateCredentials(credentials))) {
      throw new MCPAuthenticationError("Invalid credentials");
    }

    return new MCPPrincipal(credentials.userId, credentials.permissions);
  }

  async authorizeResourceAccess(
    principal: MCPPrincipal,
    resource: MCPResource
  ): Promise<boolean> {
    const requiredPermission = `resource:${resource.name}:read`;
    return principal.hasPermission(requiredPermission);
  }

  async authorizeToolExecution(
    principal: MCPPrincipal,
    tool: MCPTool
  ): Promise<boolean> {
    const requiredPermission = `tool:${tool.name}:execute`;
    return principal.hasPermission(requiredPermission);
  }
}
```

### Rate Limiting

```typescript
class MCPRateLimiter {
  private limits: Map<string, RateLimit> = new Map();

  async checkRateLimit(
    principalId: string,
    operation: string
  ): Promise<boolean> {
    const key = `${principalId}:${operation}`;
    const limit = this.limits.get(key) || this.getDefaultLimit(operation);

    return await limit.tryConsume();
  }

  private getDefaultLimit(operation: string): RateLimit {
    const config = {
      "resource:read": { requests: 1000, window: "1h" },
      "tool:execute": { requests: 100, window: "1h" },
      "connection:establish": { requests: 10, window: "1m" },
    };

    return new RateLimit(config[operation] || config["default"]);
  }
}
```

---

## Ejemplos de Implementación

### Ejemplo 1: Plugin de Evaluación con MCP

```typescript
class EvaluacionMCPPlugin extends MCPEnabledPlugin {
  name = "EvaluacionAlumno";
  version = "1.0.0";

  protected mcpExtension = new EvaluacionMCPExtension();

  async initialize(kernel: Kernel): Promise<void> {
    await super.initialize(kernel);

    // Registrar recursos específicos
    await this.registerEvaluacionResources();
  }

  private async registerEvaluacionResources(): Promise<void> {
    const mcpServer = this.kernel.getMCPServer();

    // Recurso: Lista de evaluaciones
    await mcpServer.registerResource(
      {
        uri: "evaluacion://evaluaciones",
        name: "Evaluaciones",
        description: "Lista de todas las evaluaciones",
        mimeType: "application/json",
      },
      this.mcpExtension
    );

    // Herramienta: Crear evaluación
    await mcpServer.registerTool(
      {
        name: "crear_evaluacion",
        description: "Crear una nueva evaluación",
        inputSchema: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            fecha: { type: "string", format: "date" },
            alumnoId: { type: "string" },
          },
          required: ["titulo", "fecha", "alumnoId"],
        },
        outputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" },
          },
        },
        execute: this.crearEvaluacion.bind(this),
      },
      this.mcpExtension
    );
  }

  private async crearEvaluacion(args: any): Promise<any> {
    // Implementación del caso de uso
    const useCase = new CrearEvaluacionUseCase(
      this.getRepository("evaluacion"),
      this.getUnitOfWork()
    );

    const result = await useCase.execute(args);

    return {
      id: result.id,
      status: "created",
    };
  }
}

class EvaluacionMCPExtension implements PluginMCPExtension {
  getResources(): MCPResource[] {
    return [
      {
        uri: "evaluacion://evaluaciones",
        name: "Evaluaciones",
        description: "Lista de evaluaciones del sistema",
        mimeType: "application/json",
        metadata: {
          version: "1.0",
          cacheable: true,
          ttl: 300, // 5 minutos
        },
      },
      {
        uri: "evaluacion://plantillas",
        name: "Plantillas de Evaluación",
        description: "Plantillas predefinidas para evaluaciones",
        mimeType: "application/json",
        metadata: {
          version: "1.0",
          cacheable: true,
          ttl: 3600, // 1 hora
        },
      },
    ];
  }

  getTools(): MCPTool[] {
    return [
      {
        name: "crear_evaluacion",
        description: "Crear una nueva evaluación para un alumno",
        inputSchema: {
          type: "object",
          properties: {
            titulo: {
              type: "string",
              description: "Título de la evaluación",
            },
            fecha: {
              type: "string",
              format: "date",
              description: "Fecha de la evaluación (YYYY-MM-DD)",
            },
            alumnoId: {
              type: "string",
              description: "ID del alumno a evaluar",
            },
            plantillaId: {
              type: "string",
              description: "ID de la plantilla a usar (opcional)",
            },
          },
          required: ["titulo", "fecha", "alumnoId"],
        },
        outputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID de la evaluación creada",
            },
            status: {
              type: "string",
              enum: ["created", "error"],
              description: "Estado de la operación",
            },
            message: {
              type: "string",
              description: "Mensaje descriptivo del resultado",
            },
          },
        },
        execute: this.ejecutarCrearEvaluacion.bind(this),
      },
      {
        name: "consultar_notas",
        description: "Consultar las notas de un alumno",
        inputSchema: {
          type: "object",
          properties: {
            alumnoId: {
              type: "string",
              description: "ID del alumno",
            },
            materiaId: {
              type: "string",
              description: "ID de la materia (opcional)",
            },
            periodo: {
              type: "string",
              description: "Período académico (opcional)",
            },
          },
          required: ["alumnoId"],
        },
        outputSchema: {
          type: "object",
          properties: {
            notas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  evaluacionId: { type: "string" },
                  titulo: { type: "string" },
                  nota: { type: "number" },
                  fecha: { type: "string" },
                  materia: { type: "string" },
                },
              },
            },
            promedio: { type: "number" },
            totalEvaluaciones: { type: "number" },
          },
        },
        execute: this.ejecutarConsultarNotas.bind(this),
      },
    ];
  }

  async handleResourceRequest(uri: string): Promise<MCPResourceContent> {
    switch (uri) {
      case "evaluacion://evaluaciones":
        return await this.getEvaluacionesList();
      case "evaluacion://plantillas":
        return await this.getPlantillasList();
      default:
        throw new MCPError(`Resource not found: ${uri}`);
    }
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case "crear_evaluacion":
        return await this.ejecutarCrearEvaluacion(args);
      case "consultar_notas":
        return await this.ejecutarConsultarNotas(args);
      default:
        throw new MCPError(`Tool not found: ${name}`);
    }
  }

  private async ejecutarCrearEvaluacion(args: any): Promise<any> {
    try {
      // Validar argumentos
      await this.validarArgumentosCrearEvaluacion(args);

      // Crear evaluación usando el caso de uso
      const useCase = container.resolve<CrearEvaluacionUseCase>(
        "CrearEvaluacionUseCase"
      );
      const evaluacion = await useCase.execute({
        titulo: args.titulo,
        fecha: new Date(args.fecha),
        alumnoId: args.alumnoId,
        plantillaId: args.plantillaId,
      });

      return {
        id: evaluacion.id,
        status: "created",
        message: `Evaluación "${args.titulo}" creada exitosamente`,
      };
    } catch (error) {
      return {
        id: null,
        status: "error",
        message: error.message,
      };
    }
  }

  private async ejecutarConsultarNotas(args: any): Promise<any> {
    try {
      const useCase = container.resolve<ConsultarNotasUseCase>(
        "ConsultarNotasUseCase"
      );
      const resultado = await useCase.execute({
        alumnoId: args.alumnoId,
        materiaId: args.materiaId,
        periodo: args.periodo,
      });

      return {
        notas: resultado.notas.map((nota) => ({
          evaluacionId: nota.evaluacionId,
          titulo: nota.titulo,
          nota: nota.valor,
          fecha: nota.fecha.toISOString(),
          materia: nota.materia,
        })),
        promedio: resultado.promedio,
        totalEvaluaciones: resultado.total,
      };
    } catch (error) {
      throw new MCPError(`Error consultando notas: ${error.message}`);
    }
  }

  private async getEvaluacionesList(): Promise<MCPResourceContent> {
    const repository = container.resolve<EvaluacionRepository>(
      "EvaluacionRepository"
    );
    const evaluaciones = await repository.findAll();

    return {
      content: JSON.stringify(
        evaluaciones.map((e) => ({
          id: e.id,
          titulo: e.titulo,
          fecha: e.fecha,
          alumno: e.alumno.nombre,
          estado: e.estado,
        }))
      ),
      mimeType: "application/json",
    };
  }

  private async getPlantillasList(): Promise<MCPResourceContent> {
    const repository = container.resolve<PlantillaRepository>(
      "PlantillaRepository"
    );
    const plantillas = await repository.findAll();

    return {
      content: JSON.stringify(
        plantillas.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          criterios: p.criterios.length,
        }))
      ),
      mimeType: "application/json",
    };
  }

  private async validarArgumentosCrearEvaluacion(args: any): Promise<void> {
    if (!args.titulo || args.titulo.trim().length === 0) {
      throw new ValidationError("El título es requerido");
    }

    if (!args.fecha || !this.isValidDate(args.fecha)) {
      throw new ValidationError("La fecha debe tener formato YYYY-MM-DD");
    }

    if (!args.alumnoId) {
      throw new ValidationError("El ID del alumno es requerido");
    }

    // Validar que el alumno existe
    const alumnoRepository =
      container.resolve<AlumnoRepository>("AlumnoRepository");
    const alumno = await alumnoRepository.findById(args.alumnoId);
    if (!alumno) {
      throw new ValidationError(`Alumno con ID ${args.alumnoId} no encontrado`);
    }
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
}
```

### Ejemplo 2: Integración con LLM Externo

```typescript
class LLMIntegrationService {
  private mcpClient: MCPClient;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  async generateEvaluationQuestions(
    context: EvaluationContext
  ): Promise<Question[]> {
    // Conectar con un servidor MCP de un LLM
    await this.mcpClient.connect("mcp://llm-service/claude");

    // Obtener el contexto educativo como recurso
    const contextResource = await this.mcpClient.readResource(
      "education://curriculum/math-grade-5"
    );

    // Llamar herramienta para generar preguntas
    const result = await this.mcpClient.callTool("generate_questions", {
      subject: context.subject,
      difficulty: context.difficulty,
      context: contextResource.content,
      questionCount: context.questionCount,
    });

    return result.questions.map((q) => new Question(q));
  }

  async analyzeStudentResponse(
    response: StudentResponse
  ): Promise<AnalysisResult> {
    await this.mcpClient.connect("mcp://llm-service/claude");

    const analysis = await this.mcpClient.callTool("analyze_response", {
      question: response.question,
      studentAnswer: response.answer,
      correctAnswer: response.expectedAnswer,
      analysisType: "detailed",
    });

    return new AnalysisResult(analysis);
  }
}
```

---

## Conclusiones y Recomendaciones

### Recomendación Final: **SÍ IMPLEMENTAR MCP**

**Razones Clave:**

1. **Strategic Value**: Posiciona el kernel para la era AI-first
2. **Ecosystem Integration**: Conexión natural con herramientas modernas
3. **Plugin Enhancement**: Los plugins pueden exponer capacidades vía MCP
4. **Future-Proofing**: Preparación para próximas generaciones de aplicaciones

### Timeline Recomendado:

- **Semana 5**: Foundation
- **Semana 6**: Client Integration
- **Semana 7**: Plugin Integration
- **Semana 8**: Advanced Features

### Métricas de Éxito:

- [ ] Tiempo de respuesta MCP < 100ms
- [ ] Disponibilidad > 99.9%
- [ ] Plugins con MCP > 80%
- [ ] Integraciones externas > 5

### Próximos Pasos:

1. Definir arquitectura detallada MCP
2. Crear MVP del MCP Server
3. Desarrollar primer plugin MCP-enabled
4. Integrar con LLM externo como proof-of-concept

---

_Este documento será actualizado conforme avance la implementación del sistema MCP en el micro-kernel._
