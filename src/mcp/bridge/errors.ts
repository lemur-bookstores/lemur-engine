export class MCPBridgeError extends Error {
    constructor(message: string, public code?: number, public data?: any) {
        super(message);
        this.name = 'MCPBridgeError';
    }
}

export class MCPBridgeTimeoutError extends MCPBridgeError {
    constructor(message: string) {
        super(message, -32000, 'Request timed out');
        this.name = 'MCPBridgeTimeoutError';
    }
}
