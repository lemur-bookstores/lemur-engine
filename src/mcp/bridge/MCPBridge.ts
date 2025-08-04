import { spawn, ChildProcess } from "child_process";
import { v4 as uuidv4 } from "uuid";
import {
  MCPBridgeConfig,
  MCPBridgeMessage,
  MCPBridgeResponse,
} from "../../types/mcp";
import { MCPBridgeError, MCPBridgeTimeoutError } from "./errors";
import { DEFAULT_BRIDGE_CONFIG } from "./config";

export class MCPBridge {
  private config: MCPBridgeConfig;
  private pythonProcess: ChildProcess | null = null;
  private pendingRequests: Map<string, (response: MCPBridgeResponse) => void> =
    new Map();

  constructor(config: Partial<MCPBridgeConfig> = {}) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
  }

  public async start(): Promise<void> {
    if (this.pythonProcess) {
      console.warn("MCP Bridge is already running.");
      return;
    }
    this.spawnPythonProcess();
  }

  public async stop(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }

  public async call(method: string, params: any): Promise<any> {
    if (!this.pythonProcess) {
      throw new MCPBridgeError(
        "Python process is not running. Call start() first.",
      );
    }

    const id = uuidv4();
    const message: MCPBridgeMessage = {
      id,
      method,
      params,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new MCPBridgeTimeoutError(
            `Request ${id} timed out after ${this.config.timeout}ms`,
          ),
        );
      }, this.config.timeout);

      this.pendingRequests.set(id, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(
            new MCPBridgeError(
              response.error.message,
              response.error.code,
              response.error.data,
            ),
          );
        } else {
          resolve(response.result);
        }
      });

      this.pythonProcess?.stdin?.write(JSON.stringify(message) + "\n");
    });
  }

  private spawnPythonProcess(): void {
    const { pythonExecutable, mcpScriptPath } = this.config;

    if (!pythonExecutable || !mcpScriptPath) {
      throw new MCPBridgeError(
        "Python executable or MCP script path not configured.",
      );
    }

    this.pythonProcess = spawn(pythonExecutable, [mcpScriptPath]);

    this.pythonProcess.stdout?.on("data", (data) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((line: string) => line.trim() !== "");
      for (const line of lines) {
        try {
          const response: MCPBridgeResponse = JSON.parse(line);
          if (this.pendingRequests.has(response.id)) {
            this.pendingRequests.get(response.id)!(response);
            this.pendingRequests.delete(response.id);
          }
        } catch (error: any) {
          console.error("Failed to parse response from Python:", line, error);
        }
      }
    });

    this.pythonProcess.stderr?.on("data", (data) => {
      console.error(`MCP_BRIDGE_PYTHON_STDERR: ${data}`);
    });

    this.pythonProcess.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      this.pythonProcess = null;
      // Optional: Implement restart logic
    });

    this.pythonProcess.on("error", (err) => {
      console.error("Failed to start Python process.", err);
      this.pythonProcess = null;
    });
  }
}
