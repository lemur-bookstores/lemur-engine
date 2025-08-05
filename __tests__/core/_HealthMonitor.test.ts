import { HealthMonitor } from "../../src/core/HealthMonitor";

describe("HealthMonitor", () => {
  // Configurar el timeout para los tests
  jest.setTimeout(30000);
  jest.useFakeTimers();

  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    healthMonitor = new HealthMonitor(100);
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(global, "clearInterval");
  });

  afterEach(async () => {
    try {
      await healthMonitor.stop();
    } finally {
      jest.clearAllTimers();
      jest.clearAllMocks();
    }
  });

  describe("constructor", () => {
    it("should create health monitor with default interval", () => {
      const monitor = new HealthMonitor();
      expect(monitor).toBeInstanceOf(HealthMonitor);
    });

    it("should create health monitor with custom interval", () => {
      const monitor = new HealthMonitor(500);
      expect(monitor).toBeInstanceOf(HealthMonitor);
    });
  });

  describe("registerHealthCheck", () => {
    it("should register a health check", () => {
      const mockHealthCheck1 = jest.fn().mockResolvedValue(true);

      expect(() => {
        healthMonitor.registerHealthCheck("service1", mockHealthCheck1);
      }).not.toThrow();
    });

    it("should register multiple health checks", () => {
      const mockHealthCheck1 = jest.fn().mockResolvedValue(true);
      const mockHealthCheck2 = jest.fn().mockResolvedValue(true);

      healthMonitor.registerHealthCheck("service1", mockHealthCheck1);
      healthMonitor.registerHealthCheck("service2", mockHealthCheck2);

      expect(healthMonitor.getStatus().size).toBe(0); // No checks run yet
    });

    it("should allow overwriting existing health check", () => {
      const mockHealthCheck1 = jest.fn().mockResolvedValue(true);
      const mockHealthCheck2 = jest.fn().mockResolvedValue(false);

      healthMonitor.registerHealthCheck("service1", mockHealthCheck1);
      healthMonitor.registerHealthCheck("service1", mockHealthCheck2);

      // Only the second check should be registered
      expect(() => {
        healthMonitor.registerHealthCheck("service1", mockHealthCheck2);
      }).not.toThrow();
    });
  });

  describe("start and stop", () => {
    it("should start health monitoring", async () => {
      const mockHealthCheck1 = jest.fn().mockResolvedValue(true);
      healthMonitor.registerHealthCheck("service1", mockHealthCheck1);

      // Iniciar el monitoreo
      const startPromise = healthMonitor.start();

      // Esperar a que se complete la primera verificación
      jest.runAllTimers();
      await startPromise;

      expect(mockHealthCheck1).toHaveBeenCalledTimes(1);

      // Avanzar el tiempo para la siguiente verificación
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(mockHealthCheck1).toHaveBeenCalledTimes(2);

      // Detener el monitoreo
      await healthMonitor.stop();
    });

    it("should not start multiple intervals", async () => {
      const mockHealthCheck1 = jest.fn().mockResolvedValue(true);
      healthMonitor.registerHealthCheck("service1", mockHealthCheck1);

      // Primera llamada a start()
      await healthMonitor.start();
      expect(mockHealthCheck1).toHaveBeenCalledTimes(1); // Verificación inicial

      // Segunda llamada a start() no debería ejecutar verificaciones adicionales
      await healthMonitor.start();
      expect(mockHealthCheck1).toHaveBeenCalledTimes(1); // No debería haber llamadas adicionales

      await healthMonitor.stop();
    });

    it("should stop health monitoring", async () => {
      const mockHealthCheck1 = jest.fn().mockResolvedValue(true);
      healthMonitor.registerHealthCheck("service1", mockHealthCheck1);

      await healthMonitor.start();
      expect(mockHealthCheck1).toHaveBeenCalledTimes(1); // Verificación inicial

      await healthMonitor.stop();
      jest.advanceTimersByTime(100); // Avanzar el tiempo para ver si se ejecutan más verificaciones
      await Promise.resolve();

      expect(mockHealthCheck1).toHaveBeenCalledTimes(1); // No debería haber más llamadas después de stop()
    });
  });

  describe("health check execution", () => {
    let mockHealthCheck1: jest.Mock;
    let mockHealthCheck2: jest.Mock;
    let mockHealthCheck3: jest.Mock;

    beforeEach(() => {
      mockHealthCheck1 = jest.fn().mockResolvedValue(true);
      mockHealthCheck2 = jest.fn().mockResolvedValue(false);
      mockHealthCheck3 = jest
        .fn()
        .mockRejectedValue(new Error("Health check failed"));

      healthMonitor.registerHealthCheck("service1", mockHealthCheck1);
      healthMonitor.registerHealthCheck("service2", mockHealthCheck2);
      healthMonitor.registerHealthCheck("service3", mockHealthCheck3);
    });

    it("should execute all registered health checks", async () => {
      await healthMonitor.start();

      // Verificar la ejecución inicial
      expect(mockHealthCheck1).toHaveBeenCalledTimes(1);
      expect(mockHealthCheck2).toHaveBeenCalledTimes(1);
      expect(mockHealthCheck3).toHaveBeenCalledTimes(1);

      await healthMonitor.stop();
    });

    it("should update status based on health check results", async () => {
      await healthMonitor.start();

      // Verificar el estado después de la ejecución inicial
      const status = healthMonitor.getStatus();
      expect(status.get("service1")).toBe(true);
      expect(status.get("service2")).toBe(false);
      expect(status.get("service3")).toBe(false); // Failed check should be false

      await healthMonitor.stop();
    });

    it("should handle health check errors gracefully", async () => {
      await healthMonitor.start();

      // Verificar que el error no interrumpe la ejecución
      const status = healthMonitor.getStatus();
      expect(status.has("service3")).toBe(true);
      expect(status.get("service3")).toBe(false);

      await healthMonitor.stop();
    });
  });

  describe("getStatus", () => {
    it("should return empty status when no checks are registered", () => {
      const emptyMonitor = new HealthMonitor(100);
      const status = emptyMonitor.getStatus();
      expect(status.size).toBe(0);
    });

    it("should return empty status before any checks are run", () => {
      const mockHealthCheck = jest.fn().mockResolvedValue(true);
      healthMonitor.registerHealthCheck("service1", mockHealthCheck);

      const status = healthMonitor.getStatus();
      expect(status.size).toBe(0);
    });

    it("should return current status after checks are run", async () => {
      const mockHealthCheck1 = jest.fn().mockResolvedValue(true);
      const mockHealthCheck2 = jest.fn().mockResolvedValue(false);

      healthMonitor.registerHealthCheck("service1", mockHealthCheck1);
      healthMonitor.registerHealthCheck("service2", mockHealthCheck2);

      await healthMonitor.start();

      const status = healthMonitor.getStatus();
      expect(status.size).toBe(2);
      expect(status.get("service1")).toBe(true);
      expect(status.get("service2")).toBe(false);

      await healthMonitor.stop();
    });

    it("should return a copy of the status map", async () => {
      const mockHealthCheck = jest.fn().mockResolvedValue(true);
      healthMonitor.registerHealthCheck("service1", mockHealthCheck);

      await healthMonitor.start();

      const status1 = healthMonitor.getStatus();
      const status2 = healthMonitor.getStatus();

      expect(status1).not.toBe(status2); // Different instances
      expect(status1.get("service1")).toBe(status2.get("service1")); // Same values

      await healthMonitor.stop();
    });
  });
});
