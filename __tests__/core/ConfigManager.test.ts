import { ConfigManager } from "../../src/core/ConfigManager";
import { ConfigProvider } from "../../src/types";

describe("ConfigManager", () => {
  let configManager: ConfigManager;
  let mockProvider1: jest.Mocked<ConfigProvider>;
  let mockProvider2: jest.Mocked<ConfigProvider>;
  let mockProvider3: jest.Mocked<ConfigProvider>;

  beforeEach(() => {
    configManager = new ConfigManager();

    mockProvider1 = {
      get: jest.fn(),
      set: jest.fn(),
      watch: jest.fn(),
    };

    mockProvider2 = {
      get: jest.fn(),
      set: jest.fn(),
      watch: jest.fn(),
    };

    mockProvider3 = {
      get: jest.fn(),
      set: jest.fn(),
      watch: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create config manager with empty providers and watchers", () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
      expect((configManager as any).providers).toEqual([]);
      expect((configManager as any).watchers).toBeInstanceOf(Map);
      expect((configManager as any).watchers.size).toBe(0);
    });
  });

  describe("addProvider", () => {
    it("should add a single provider", () => {
      configManager.addProvider(mockProvider1);

      const providers = (configManager as any).providers;
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mockProvider1);
    });

    it("should add multiple providers in order", () => {
      configManager.addProvider(mockProvider1);
      configManager.addProvider(mockProvider2);
      configManager.addProvider(mockProvider3);

      const providers = (configManager as any).providers;
      expect(providers).toHaveLength(3);
      expect(providers[0]).toBe(mockProvider1);
      expect(providers[1]).toBe(mockProvider2);
      expect(providers[2]).toBe(mockProvider3);
    });

    it("should allow adding the same provider multiple times", () => {
      configManager.addProvider(mockProvider1);
      configManager.addProvider(mockProvider1);

      const providers = (configManager as any).providers;
      expect(providers).toHaveLength(2);
      expect(providers[0]).toBe(mockProvider1);
      expect(providers[1]).toBe(mockProvider1);
    });

    it("should maintain provider order for priority", () => {
      // First provider has highest priority
      configManager.addProvider(mockProvider1);
      configManager.addProvider(mockProvider2);

      const providers = (configManager as any).providers;
      expect(providers[0]).toBe(mockProvider1); // Highest priority
      expect(providers[1]).toBe(mockProvider2); // Lower priority
    });
  });

  describe("get", () => {
    beforeEach(() => {
      configManager.addProvider(mockProvider1);
      configManager.addProvider(mockProvider2);
      configManager.addProvider(mockProvider3);
    });

    it("should return value from first provider that has it", () => {
      mockProvider1.get.mockReturnValue("value1");
      mockProvider2.get.mockReturnValue("value2");
      mockProvider3.get.mockReturnValue("value3");

      const result = configManager.get("test.key");

      expect(result).toBe("value1");
      expect(mockProvider1.get).toHaveBeenCalledWith("test.key");
      expect(mockProvider2.get).not.toHaveBeenCalled();
      expect(mockProvider3.get).not.toHaveBeenCalled();
    });

    it("should check providers in order until value is found", () => {
      mockProvider1.get.mockReturnValue(undefined);
      mockProvider2.get.mockReturnValue("value2");
      mockProvider3.get.mockReturnValue("value3");

      const result = configManager.get("test.key");

      expect(result).toBe("value2");
      expect(mockProvider1.get).toHaveBeenCalledWith("test.key");
      expect(mockProvider2.get).toHaveBeenCalledWith("test.key");
      expect(mockProvider3.get).not.toHaveBeenCalled();
    });

    it("should return undefined if no provider has the value", () => {
      mockProvider1.get.mockReturnValue(undefined);
      mockProvider2.get.mockReturnValue(undefined);
      mockProvider3.get.mockReturnValue(undefined);

      const result = configManager.get("test.key");

      expect(result).toBeUndefined();
      expect(mockProvider1.get).toHaveBeenCalledWith("test.key");
      expect(mockProvider2.get).toHaveBeenCalledWith("test.key");
      expect(mockProvider3.get).toHaveBeenCalledWith("test.key");
    });

    it("should return undefined if no providers are registered", () => {
      const emptyConfigManager = new ConfigManager();
      const result = emptyConfigManager.get("test.key");

      expect(result).toBeUndefined();
    });

    it("should handle different data types", () => {
      const testCases = [
        { value: "string", expected: "string" },
        { value: 42, expected: 42 },
        { value: true, expected: true },
        { value: false, expected: false },
        { value: null, expected: null },
        { value: { nested: "object" }, expected: { nested: "object" } },
        { value: [1, 2, 3], expected: [1, 2, 3] },
      ];

      testCases.forEach(({ value, expected }) => {
        mockProvider1.get.mockReturnValue(value);
        const result = configManager.get(`test.${typeof value}`);
        expect(result).toEqual(expected);
        mockProvider1.get.mockClear();
      });
    });

    it("should handle generic type parameters", () => {
      interface TestConfig {
        name: string;
        count: number;
      }

      const testConfig: TestConfig = { name: "test", count: 5 };
      mockProvider1.get.mockReturnValue(testConfig);

      const result = configManager.get<TestConfig>("test.config");

      expect(result).toEqual(testConfig);
      expect(result?.name).toBe("test");
      expect(result?.count).toBe(5);
    });

    it("should treat null as a valid value (not undefined)", () => {
      mockProvider1.get.mockReturnValue(null);
      mockProvider2.get.mockReturnValue("fallback");

      const result = configManager.get("test.key");

      expect(result).toBeNull();
      expect(mockProvider2.get).not.toHaveBeenCalled();
    });

    it("should treat false as a valid value (not undefined)", () => {
      mockProvider1.get.mockReturnValue(false);
      mockProvider2.get.mockReturnValue(true);

      const result = configManager.get("test.key");

      expect(result).toBe(false);
      expect(mockProvider2.get).not.toHaveBeenCalled();
    });

    it("should treat 0 as a valid value (not undefined)", () => {
      mockProvider1.get.mockReturnValue(0);
      mockProvider2.get.mockReturnValue(42);

      const result = configManager.get("test.key");

      expect(result).toBe(0);
      expect(mockProvider2.get).not.toHaveBeenCalled();
    });

    it("should treat empty string as a valid value (not undefined)", () => {
      mockProvider1.get.mockReturnValue("");
      mockProvider2.get.mockReturnValue("fallback");

      const result = configManager.get("test.key");

      expect(result).toBe("");
      expect(mockProvider2.get).not.toHaveBeenCalled();
    });
  });

  describe("set", () => {
    beforeEach(() => {
      configManager.addProvider(mockProvider1);
      configManager.addProvider(mockProvider2);
    });

    it("should set value on first provider", () => {
      configManager.set("test.key", "test.value");

      expect(mockProvider1.set).toHaveBeenCalledWith("test.key", "test.value");
      expect(mockProvider2.set).not.toHaveBeenCalled();
    });

    it("should not set on other providers", () => {
      configManager.set("test.key", "test.value");

      expect(mockProvider1.set).toHaveBeenCalledTimes(1);
      expect(mockProvider2.set).not.toHaveBeenCalled();
    });

    it("should handle setting different data types", () => {
      const testCases = [
        "string",
        42,
        true,
        false,
        null,
        undefined,
        { nested: "object" },
        [1, 2, 3],
      ];

      testCases.forEach((value, index) => {
        configManager.set(`test.${index}`, value);
        expect(mockProvider1.set).toHaveBeenCalledWith(`test.${index}`, value);
      });

      expect(mockProvider1.set).toHaveBeenCalledTimes(testCases.length);
    });

    it("should notify watchers after setting value", () => {
      const mockCallback = jest.fn();
      configManager.watch("test.key", mockCallback);

      configManager.set("test.key", "test.value");

      expect(mockProvider1.set).toHaveBeenCalledWith("test.key", "test.value");
      expect(mockCallback).toHaveBeenCalledWith("test.value");
    });

    it("should handle case when no providers are registered", () => {
      const emptyConfigManager = new ConfigManager();

      expect(() => {
        emptyConfigManager.set("test.key", "test.value");
      }).not.toThrow();
    });

    it("should handle case when first provider is undefined", () => {
      const configManagerWithUndefined = new ConfigManager();
      (configManagerWithUndefined as any).providers = [
        undefined,
        mockProvider1,
      ];

      expect(() => {
        configManagerWithUndefined.set("test.key", "test.value");
      }).not.toThrow();

      expect(mockProvider1.set).not.toHaveBeenCalled();
    });
  });

  describe("watch", () => {
    it("should register a watcher for a key", () => {
      const mockCallback = jest.fn();

      configManager.watch("test.key", mockCallback);

      const watchers = (configManager as any).watchers;
      expect(watchers.has("test.key")).toBe(true);
      expect(watchers.get("test.key")).toContain(mockCallback);
    });

    it("should register multiple watchers for the same key", () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      const mockCallback3 = jest.fn();

      configManager.watch("test.key", mockCallback1);
      configManager.watch("test.key", mockCallback2);
      configManager.watch("test.key", mockCallback3);

      const watchers = (configManager as any).watchers;
      const callbacks = watchers.get("test.key");
      expect(callbacks).toHaveLength(3);
      expect(callbacks).toContain(mockCallback1);
      expect(callbacks).toContain(mockCallback2);
      expect(callbacks).toContain(mockCallback3);
    });

    it("should register watchers for different keys", () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      configManager.watch("key1", mockCallback1);
      configManager.watch("key2", mockCallback2);

      const watchers = (configManager as any).watchers;
      expect(watchers.has("key1")).toBe(true);
      expect(watchers.has("key2")).toBe(true);
      expect(watchers.get("key1")).toContain(mockCallback1);
      expect(watchers.get("key2")).toContain(mockCallback2);
    });

    it("should allow the same callback to watch multiple keys", () => {
      const mockCallback = jest.fn();

      configManager.watch("key1", mockCallback);
      configManager.watch("key2", mockCallback);

      const watchers = (configManager as any).watchers;
      expect(watchers.get("key1")).toContain(mockCallback);
      expect(watchers.get("key2")).toContain(mockCallback);
    });

    it("should allow the same callback to be registered multiple times for the same key", () => {
      const mockCallback = jest.fn();

      configManager.watch("test.key", mockCallback);
      configManager.watch("test.key", mockCallback);

      const watchers = (configManager as any).watchers;
      const callbacks = watchers.get("test.key");
      expect(callbacks).toHaveLength(2);
      expect(callbacks[0]).toBe(mockCallback);
      expect(callbacks[1]).toBe(mockCallback);
    });
  });

  describe("notifyWatchers (private method)", () => {
    it("should notify all watchers for a key", () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      const mockCallback3 = jest.fn();

      configManager.watch("test.key", mockCallback1);
      configManager.watch("test.key", mockCallback2);
      configManager.watch("other.key", mockCallback3);

      // Trigger notification through set method
      configManager.addProvider(mockProvider1);
      configManager.set("test.key", "test.value");

      expect(mockCallback1).toHaveBeenCalledWith("test.value");
      expect(mockCallback2).toHaveBeenCalledWith("test.value");
      expect(mockCallback3).not.toHaveBeenCalled();
    });

    it("should handle case when no watchers exist for a key", () => {
      configManager.addProvider(mockProvider1);

      expect(() => {
        configManager.set("nonexistent.key", "value");
      }).not.toThrow();

      expect(mockProvider1.set).toHaveBeenCalledWith(
        "nonexistent.key",
        "value",
      );
    });

    it("should handle errors in watcher callbacks gracefully", () => {
      const mockCallback1 = jest.fn(() => {
        throw new Error("Callback error");
      });
      const mockCallback2 = jest.fn();

      configManager.watch("test.key", mockCallback1);
      configManager.watch("test.key", mockCallback2);
      configManager.addProvider(mockProvider1);

      expect(() => {
        configManager.set("test.key", "test.value");
      }).not.toThrow();

      expect(mockCallback1).toHaveBeenCalledWith("test.value");
      expect(mockCallback2).toHaveBeenCalledWith("test.value");
    });

    it("should notify watchers with the correct value", () => {
      const mockCallback = jest.fn();
      configManager.watch("test.key", mockCallback);
      configManager.addProvider(mockProvider1);

      const testValues = [
        "string",
        42,
        true,
        false,
        null,
        undefined,
        { nested: "object" },
        [1, 2, 3],
      ];

      testValues.forEach((value) => {
        configManager.set(`test.key`, value);
        expect(mockCallback).toHaveBeenCalledWith(value);
      });
    });
  });

  describe("integration scenarios", () => {
    it("should work with complete provider lifecycle", () => {
      const mockCallback = jest.fn();

      // Setup
      configManager.addProvider(mockProvider1);
      configManager.watch("app.name", mockCallback);

      // Initial get (no value)
      mockProvider1.get.mockReturnValue(undefined);
      expect(configManager.get("app.name")).toBeUndefined();

      // Set value
      configManager.set("app.name", "MyApp");
      expect(mockProvider1.set).toHaveBeenCalledWith("app.name", "MyApp");
      expect(mockCallback).toHaveBeenCalledWith("MyApp");

      // Get value after setting
      mockProvider1.get.mockReturnValue("MyApp");
      expect(configManager.get("app.name")).toBe("MyApp");
    });

    it("should handle provider priority correctly", () => {
      // High priority provider (added first)
      configManager.addProvider(mockProvider1);
      // Low priority provider (added second)
      configManager.addProvider(mockProvider2);

      // High priority has value
      mockProvider1.get.mockReturnValue("high-priority-value");
      mockProvider2.get.mockReturnValue("low-priority-value");

      expect(configManager.get("test.key")).toBe("high-priority-value");

      // High priority doesn't have value, low priority does
      mockProvider1.get.mockReturnValue(undefined);
      mockProvider2.get.mockReturnValue("low-priority-value");

      expect(configManager.get("test.key")).toBe("low-priority-value");
    });

    it("should handle multiple watchers and providers together", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      configManager.addProvider(mockProvider1);
      configManager.addProvider(mockProvider2);
      configManager.watch("config.value", callback1);
      configManager.watch("config.value", callback2);

      configManager.set("config.value", "new-value");

      expect(mockProvider1.set).toHaveBeenCalledWith(
        "config.value",
        "new-value",
      );
      expect(mockProvider2.set).not.toHaveBeenCalled();
      expect(callback1).toHaveBeenCalledWith("new-value");
      expect(callback2).toHaveBeenCalledWith("new-value");
    });

    it("should handle complex nested configuration objects", () => {
      const complexConfig = {
        database: {
          host: "localhost",
          port: 5432,
          credentials: {
            username: "admin",
            password: "secret",
          },
        },
        features: {
          enableLogging: true,
          maxRetries: 3,
        },
      };

      mockProvider1.get.mockReturnValue(complexConfig);
      configManager.addProvider(mockProvider1);

      const result = configManager.get("app.config") as any;
      expect(result).toEqual(complexConfig);
      expect(result.database.host).toBe("localhost");
      expect(result.features.enableLogging).toBe(true);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle empty string keys", () => {
      configManager.addProvider(mockProvider1);
      mockProvider1.get.mockReturnValue("empty-key-value");

      const result = configManager.get("");
      expect(result).toBe("empty-key-value");
      expect(mockProvider1.get).toHaveBeenCalledWith("");
    });

    it("should handle very long keys", () => {
      const longKey = "a".repeat(1000);
      configManager.addProvider(mockProvider1);
      mockProvider1.get.mockReturnValue("long-key-value");

      const result = configManager.get(longKey);
      expect(result).toBe("long-key-value");
      expect(mockProvider1.get).toHaveBeenCalledWith(longKey);
    });

    it("should handle special characters in keys", () => {
      const specialKey = "key.with-special_chars@#$%^&*()";
      configManager.addProvider(mockProvider1);
      mockProvider1.get.mockReturnValue("special-value");

      const result = configManager.get(specialKey);
      expect(result).toBe("special-value");
      expect(mockProvider1.get).toHaveBeenCalledWith(specialKey);
    });

    it("should handle providers that throw errors", () => {
      const errorProvider: ConfigProvider = {
        get: () => {
          throw new Error("Provider error");
        },
        set: () => {
          throw new Error("Provider error");
        },
        watch: () => {
          throw new Error("Provider error");
        },
      };

      configManager.addProvider(errorProvider);
      configManager.addProvider(mockProvider1);
      mockProvider1.get.mockReturnValue("fallback-value");

      expect(() => {
        configManager.get("test.key");
        // Should not reach here due to error, but if it does, should be fallback
      }).toThrow("Provider error");
    });

    it("should handle circular references in configuration values", () => {
      const circularConfig: any = { name: "test" };
      circularConfig.self = circularConfig;

      configManager.addProvider(mockProvider1);
      mockProvider1.get.mockReturnValue(circularConfig);

      const result = configManager.get("circular.config") as any;
      expect(result).toBe(circularConfig);
      expect(result.self).toBe(result);
    });

    it("should handle very large configuration objects", () => {
      const largeConfig = {
        data: new Array(10000)
          .fill(0)
          .map((_, i) => ({ id: i, value: `item_${i}` })),
      };

      configManager.addProvider(mockProvider1);
      mockProvider1.get.mockReturnValue(largeConfig);

      const result = configManager.get("large.config") as any;
      expect(result).toEqual(largeConfig);
      expect(result.data).toHaveLength(10000);
    });

    it("should handle concurrent access", async () => {
      configManager.addProvider(mockProvider1);

      const promises = Array.from({ length: 100 }, (_, i) => {
        mockProvider1.get.mockReturnValue(`value_${i}`);
        return Promise.resolve(configManager.get(`key_${i}`));
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
    });
  });
});
