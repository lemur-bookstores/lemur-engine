import { MCPBridgeConfig } from "../../types/mcp";

export const DEFAULT_BRIDGE_CONFIG: MCPBridgeConfig = {
    pythonExecutable: 'python',
    mcpScriptPath: 'src/mcp/main.py', // Adjust this path
    timeout: 30000, // 30 seconds
    maxRetries: 3,
    logLevel: 'info',
};
