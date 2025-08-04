import { ConfigLoaderMediator } from "../../../../src/core/config/mediator/ConfigLoaderMediator";
import {
  ConfigEventManager,
  ConfigChangeEventType,
} from "../../../../src/core/config/events/ConfigEventManager";
import { IConfigLoader } from "../../../../src/core/config/interfaces/IConfigLoader";
import { KernelConfig } from "../../../../src/core/config/types";

describe("ConfigLoaderMediator", () => {
  let mediator: ConfigLoaderMediator;
  let mockLoader: jest.Mocked<IConfigLoader>;

  beforeEach(() => {
    mediator = ConfigLoaderMediator.getInstance();
    mockLoader = {
      loadConfig: jest.fn(),
      validateConfig: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
  });

  describe("Singleton Pattern", () => {
    it("should always return the same instance", () => {
      const instance1 = ConfigLoaderMediator.getInstance();
      const instance2 = ConfigLoaderMediator.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Loader Management", () => {
    it("should register and retrieve a loader", () => {
      mediator.registerLoader("test-loader", mockLoader);
      expect(mediator.getLoader("test-loader")).toBe(mockLoader);
    });

    it("should unregister a loader", () => {
      mediator.registerLoader("test-loader", mockLoader);
      mediator.unregisterLoader("test-loader");
      expect(mediator.getLoader("test-loader")).toBeUndefined();
    });

    it("should get all registered loaders", () => {
      mediator.registerLoader("loader1", mockLoader);
      mediator.registerLoader("loader2", mockLoader);
      const loaders = mediator.getAllLoaders();
      expect(loaders.size).toBe(2);
      expect(loaders.has("loader1")).toBeTruthy();
      expect(loaders.has("loader2")).toBeTruthy();
    });
  });

  describe("Configuration Loading", () => {
    it("should load configuration using specified loader", async () => {
      const mockConfig: KernelConfig = {
        environment: "development",
        version: "1.0.0",
        plugins: [],
        retry: {
          maxAttempts: 3,
          delay: 1000,
          backoffFactor: 2,
          retryableErrors: [],
        },
        bulkhead: {
          maxConcurrent: 10,
          maxQueueSize: 100,
          queueTimeout: 5000,
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 0.5,
          resetTimeout: 30000,
          halfOpenSuccessThreshold: 2,
        },
        logging: {
          level: "info",
          format: "json",
        },
        pluginConfig: {
          metadata: {
            name: "",
            version: "",
            enabled: false,
          },
          autoload: {
            enabled: false,
            directories: [],
          },
        },
        errorHandler: {
          console: {
            enabled: true,
          },
          file: {
            enabled: false,
            path: "",
          },
        },
      };

      mockLoader.loadConfig.mockResolvedValue(mockConfig);
      mediator.registerLoader("test-loader", mockLoader);

      const config = await mediator.loadConfig("test-loader");
      expect(config).toEqual(mockConfig);
      expect(mockLoader.loadConfig).toHaveBeenCalled();
    });

    it("should throw error when loader not found", async () => {
      await expect(mediator.loadConfig("non-existent")).rejects.toThrow(
        "Config loader not found",
      );
    });
  });

  describe("Event Management", () => {
    it("should register event hooks", () => {
      const mockHook = {
        onConfigChange: jest.fn(),
      };

      mediator.registerEventHook(ConfigChangeEventType.CONFIG_LOADED, mockHook);
      const eventManager = ConfigEventManager.getInstance();
      expect(
        eventManager.hasListeners(ConfigChangeEventType.CONFIG_LOADED),
      ).toBeTruthy();
    });
  });
});
