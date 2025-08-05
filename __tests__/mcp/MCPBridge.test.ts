import { MCPBridge } from "../../src/mcp/bridge/MCPBridge";
import { MCPResource } from "../../src/types/mcp";
import path from "path";

describe("MCPBridge Integration", () => {
  let bridge: MCPBridge;

  // Aumentar el timeout de Jest para este test suite, ya que involucra un proceso externo
  jest.setTimeout(30000);

  beforeAll(async () => {
    const projectRoot = path.resolve(__dirname, "..", "..");
    const mcpScriptPath = path.join(projectRoot, "src", "mcp", "main.py");

    bridge = new MCPBridge({
      mcpScriptPath: mcpScriptPath,
      logLevel: "debug", // Habilitar logs para depuración durante el test
    });
    await bridge.start();
    // Dar un pequeño margen para que el proceso de Python se inicialice completamente
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await bridge.stop();
  });

  it("should successfully call a synchronous method (registerResource)", async () => {
    const resourceParams = {
      uri: "mcp://resources/test-resource",
      name: "Test Resource",
      resource_type: "FILE",
      content: "Hello from the bridge!",
      description: "A resource for integration testing",
    };

    const result: MCPResource = await bridge.call(
      "registerResource",
      resourceParams,
    );

    expect(result).toBeDefined();
    expect(result.uri).toEqual(resourceParams.uri);
    expect(result.name).toEqual(resourceParams.name);
    expect(result.description).toEqual(resourceParams.description);
  });

  it("should successfully call an asynchronous method (readResource)", async () => {
    const resourceUri = "mcp://resources/test-resource";

    // Primero, nos aseguramos de que el recurso exista (usando el mismo del test anterior)
    await bridge.call("registerResource", {
      uri: resourceUri,
      name: "Test Resource",
      resource_type: "FILE",
      content: "Hello again!",
    });

    const content = await bridge.call("readResource", { uri: resourceUri });

    expect(content).toEqual("Hello again!");
  });

  it("should handle method not found errors from Python", async () => {
    expect.assertions(3);
    try {
      await bridge.call("nonExistentMethod", { param: 1 });
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.message).toContain("Method not found: nonExistentMethod");
      expect(error.code).toEqual(-32601);
    }
  });

  it("should handle errors from the Python method execution", async () => {
    expect.assertions(2);
    try {
      // Llamar a readResource con un URI que no existe
      await bridge.call("readResource", {
        uri: "mcp://resources/non-existent",
      });
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.message).toContain("Resource not found");
    }
  });
});
