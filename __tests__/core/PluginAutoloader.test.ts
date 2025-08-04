import { PluginAutoloader } from "../../src/core/plugins/PluginAutoloader";
import { Kernel } from "../../src/core/Kernel";
import { EventBus } from "../../src/core/EventBus";
import { Plugin } from "../../src/core/plugins/PluginInterfaces";
import { defaultKernelConfig } from "../../src/core/config/types";
import path from "path";

// Mock del Kernel para evitar problemas de inicialización
jest.mock("../../src/core/Kernel");

describe("PluginAutoloader", () => {
  let mockKernel: jest.Mocked<Kernel>;
  let eventBus: EventBus;
  let autoloader: PluginAutoloader;
  const testPluginsPath = path.join(__dirname, "../fixtures/plugins");

  beforeEach(() => {
    // Crear un mapa de plugins para el mock
    const pluginsMap = new Map();

    // Crear un mock del Kernel
    mockKernel = {
      getConfig: jest.fn().mockReturnValue(defaultKernelConfig),
      initialize: jest.fn(),
      getPlugins: jest.fn().mockReturnValue(pluginsMap),
      registerPlugin: jest.fn().mockImplementation((plugin: Plugin) => {
        pluginsMap.set(plugin.metadata.name, plugin);
      }),
      // Añadir otras propiedades necesarias
    } as any;

    eventBus = new EventBus();
    autoloader = new PluginAutoloader(mockKernel, eventBus, testPluginsPath);
  });

  describe("startAutoload", () => {
    it("debería cargar y registrar plugins correctamente", async () => {
      // Arrange
      const mockPlugin: Plugin = {
        metadata: {
          name: "test-plugin",
          version: "1.0.0",
          dependencies: [],
        },
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
        status: jest.fn().mockReturnValue("UNINITIALIZED"),
        hooks: {
          onBeforeInitialize: jest.fn().mockResolvedValue(undefined),
          onAfterInitialize: jest.fn().mockResolvedValue(undefined),
        },
      };

      jest
        .spyOn(autoloader["pluginLoader"], "loadPlugins")
        .mockResolvedValue(new Map([["test-plugin", mockPlugin]]));

      // Act
      await autoloader.startAutoload();

      // Assert
      expect(mockKernel.getPlugins().has("test-plugin")).toBeTruthy();
    });

    it("debería manejar timeout correctamente", async () => {
      // Arrange
      autoloader = new PluginAutoloader(
        mockKernel,
        eventBus,
        testPluginsPath,
        100,
      );
      jest
        .spyOn(autoloader["pluginLoader"], "loadPlugins")
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 200)),
        );

      // Act & Assert
      await expect(autoloader.startAutoload()).rejects.toThrow(
        "Plugin autoload timeout",
      );
    });

    it("debería validar dependencias correctamente", async () => {
      // Arrange
      const mockPluginWithDeps: Plugin = {
        metadata: {
          name: "dependent-plugin",
          version: "1.0.0",
          dependencies: ["base-plugin"],
        },
        initialize: jest.fn(),
        shutdown: jest.fn(),
        status: jest.fn(),
      };

      // Act & Assert
      const isValid =
        await autoloader["validateDependencies"](mockPluginWithDeps);
      expect(isValid).toBeFalsy();
    });

    it("debería emitir eventos apropiados", async () => {
      // Arrange
      const eventSpy = jest.spyOn(eventBus, "publish");

      // Act
      try {
        await autoloader.startAutoload();
      } catch (error: any) {
        // Ignorar error esperado
      }

      // Assert
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "kernel.plugins.autoload.start",
        }),
      );
    });
  });
});
