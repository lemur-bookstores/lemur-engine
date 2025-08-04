/**
 * TypeScript types for MCP (Model Context Protocol) Bridge
 * These types mirror the Python implementation for seamless integration
 */

export enum MCPTransportType {
  STDIO = "stdio",
  HTTP = "http",
  WEBSOCKET = "websocket",
}

export enum MCPIntegrationType {
  SERVER = "server",
  CLIENT = "client",
  HYBRID = "hybrid",
}

export enum MCPMessageType {
  INITIALIZE = "initialize",
  INITIALIZED = "initialized",
  LIST_RESOURCES = "resources/list",
  READ_RESOURCE = "resources/read",
  LIST_TOOLS = "tools/list",
  CALL_TOOL = "tools/call",
  NOTIFICATION = "notification",
  ERROR = "error",
}

export interface MCPResource {
  uri: string;
  name: string;
  resource_type: string; // Añadido para coincidir con el uso
  content?: any;
  description?: string;
  mime_type?: string;
  metadata?: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  category?: string;
  metadata?: Record<string, any>;
}

export interface MCPCapabilities {
  resources?: {
    subscribe?: boolean;
    list_changed?: boolean;
  };
  tools?: {
    list_changed?: boolean;
  };
  prompts?: {
    list_changed?: boolean;
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPCapabilities;
  metadata?: Record<string, any>;
}

export interface MCPConnection {
  id: string;
  name: string;
  type: MCPIntegrationType;
  endpoint: string;
  transport: MCPTransportType;
  status: string;
  connected_at?: Date;
  server_info?: MCPServerInfo;
  metadata?: Record<string, any>;
}

export interface AITool {
  name: string;
  description: string;
  parameters: ToolParameters;
  handler: (args: any) => Promise<any>;
  security: ToolSecurity;
}

export interface ToolParameters {
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description: string;
      required?: boolean;
    }
  >;
  required?: string[];
}

export interface ToolSecurity {
  level: "low" | "medium" | "high";
  audit: boolean;
  permissions?: string[];
}

export interface RAGConfig {
  vectorStore: string;
  embeddingModel: string;
  chunkSize: number;
  overlapSize: number;
  retrievalCount: number;
}

export interface RAGPipeline {
  index(documents: string[]): Promise<void>;
  search(query: string): Promise<string[]>;
  generateResponse(query: string, context: string[]): Promise<string>;
}

export interface LLMProvider {
  name: "openai" | "anthropic" | "cohere" | "custom";
  apiKey?: string;
  endpoint?: string;
  model?: string;
  options?: Record<string, any>;
}

export interface MCPBridgeConfig {
  pythonExecutable?: string;
  mcpScriptPath?: string;
  timeout?: number;
  maxRetries?: number;
  logLevel?: "debug" | "info" | "warning" | "error";
}

export interface MCPBridgeMessage {
  id: string;
  method: string;
  params: any;
  timestamp: number;
}

export interface MCPBridgeResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  timestamp: number;
}

export interface TokenUsage {
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd?: number;
  timestamp: Date;
}

export interface AIMetrics {
  tokenUsage: TokenUsage[];
  modelLatency: { [model: string]: number[] };
  contextQuality: { score: number; metadata: any }[];
  errorRate: number;
}
