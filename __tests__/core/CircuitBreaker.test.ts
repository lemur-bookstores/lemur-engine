import { CircuitBreaker } from "../../src/core/CircuitBreaker";

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  let mockOperation: jest.Mock;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(3, 1000); // threshold: 3, timeout: 1000ms
    mockOperation = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create circuit breaker with default values", () => {
      const cb = new CircuitBreaker();
      expect(cb).toBeInstanceOf(CircuitBreaker);
    });

    it("should create circuit breaker with custom threshold and timeout", () => {
      const cb = new CircuitBreaker(5, 2000);
      expect(cb).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe("CLOSED state", () => {
    it("should execute operation successfully when circuit is closed", async () => {
      const expectedResult = "success";
      mockOperation.mockResolvedValue(expectedResult);

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe(expectedResult);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should remain closed after successful operations", async () => {
      mockOperation.mockResolvedValue("success");

      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it("should handle single failure without opening circuit", async () => {
      mockOperation
        .mockRejectedValueOnce(new Error("failure"))
        .mockResolvedValue("success");

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );

      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("should open circuit after threshold failures", async () => {
      mockOperation.mockRejectedValue(new Error("failure"));

      // First 3 failures should reach threshold
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );

      // Fourth call should fail with circuit breaker open
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "Circuit breaker is OPEN",
      );

      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe("OPEN state", () => {
    beforeEach(async () => {
      // Force circuit to open by causing threshold failures
      mockOperation.mockRejectedValue(new Error("failure"));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (e) {
          // Expected failures
        }
      }
      mockOperation.mockClear();
    });

    it("should reject immediately when circuit is open", async () => {
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "Circuit breaker is OPEN",
      );
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it("should transition to half-open after timeout", async () => {
      mockOperation.mockResolvedValue("success");

      // Advance time past timeout
      jest.advanceTimersByTime(1001);

      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should remain open if timeout has not elapsed", async () => {
      // Advance time but not past timeout
      jest.advanceTimersByTime(500);

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "Circuit breaker is OPEN",
      );
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe("HALF_OPEN state", () => {
    beforeEach(async () => {
      // Force circuit to open
      mockOperation.mockRejectedValue(new Error("failure"));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (e) {
          // Expected failures
        }
      }

      // Advance time to trigger half-open state
      jest.advanceTimersByTime(1001);
      mockOperation.mockClear();
    });

    it("should close circuit on successful operation in half-open state", async () => {
      mockOperation.mockResolvedValue("success");

      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBe("success");

      // Should be able to execute again (circuit is closed)
      const result2 = await circuitBreaker.execute(mockOperation);
      expect(result2).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("should open circuit again on failure in half-open state", async () => {
      mockOperation.mockRejectedValue(new Error("failure"));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );

      // Next call should be rejected immediately (circuit is open again)
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "Circuit breaker is OPEN",
      );
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe("state transitions", () => {
    it("should reset failure count on successful operation", async () => {
      mockOperation
        .mockRejectedValueOnce(new Error("failure"))
        .mockRejectedValueOnce(new Error("failure"))
        .mockResolvedValueOnce("success")
        .mockRejectedValue(new Error("failure"));

      // Two failures
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );

      // Success should reset counter
      await circuitBreaker.execute(mockOperation);

      // Should need 3 more failures to open circuit
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );

      // Now circuit should be open
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "Circuit breaker is OPEN",
      );
    });

    it("should handle rapid state changes correctly", async () => {
      // Open the circuit
      mockOperation.mockRejectedValue(new Error("failure"));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (e) {
          // Expected
        }
      }

      // Move to half-open
      jest.advanceTimersByTime(1001);

      // Fail in half-open (back to open)
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "failure",
      );

      // Should be open again
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "Circuit breaker is OPEN",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle operations that throw non-Error objects", async () => {
      mockOperation.mockRejectedValue("string error");

      await expect(circuitBreaker.execute(mockOperation)).rejects.toBe(
        "string error",
      );
    });

    it("should handle async operations correctly", async () => {
      mockOperation.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve("delayed success"), 100),
          ),
      );

      jest.useRealTimers();
      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBe("delayed success");
      jest.useFakeTimers();
    });

    it("should handle operations that return undefined", async () => {
      mockOperation.mockResolvedValue(undefined);

      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBeUndefined();
    });

    it("should handle operations that return null", async () => {
      mockOperation.mockResolvedValue(null);

      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBeNull();
    });
  });
});
