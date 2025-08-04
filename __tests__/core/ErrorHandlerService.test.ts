import {
  ErrorHandlerService,
  ErrorHandler,
} from "../../src/core/ErrorHandlerService";
import { KernelError } from "../../src/core/KernelError";
import { EventBus } from "../../src/core/EventBus";

describe("ErrorHandlerService", () => {
  let errorHandlerService: ErrorHandlerService;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockHandler1: jest.Mocked<ErrorHandler>;
  let mockHandler2: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      getEventHistory: jest.fn().mockReturnValue([]),
    } as any;

    mockHandler1 = {
      canHandle: jest.fn(),
      handleError: jest.fn().mockResolvedValue(undefined),
    };

    mockHandler2 = {
      canHandle: jest.fn(),
      handleError: jest.fn().mockResolvedValue(undefined),
    };

    errorHandlerService = new ErrorHandlerService(mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create error handler service with event bus", () => {
      expect(errorHandlerService).toBeInstanceOf(ErrorHandlerService);
      expect((errorHandlerService as any).eventBus).toBe(mockEventBus);
      expect((errorHandlerService as any).handlers).toEqual([]);
    });

    it("should initialize with empty handlers array", () => {
      const handlers = (errorHandlerService as any).handlers;
      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers).toHaveLength(0);
    });
  });

  describe("registerHandler", () => {
    it("should register a single handler", () => {
      errorHandlerService.registerHandler(mockHandler1);

      const handlers = (errorHandlerService as any).handlers;
      expect(handlers).toHaveLength(1);
      expect(handlers[0]).toBe(mockHandler1);
    });

    it("should register multiple handlers", () => {
      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler2);

      const handlers = (errorHandlerService as any).handlers;
      expect(handlers).toHaveLength(2);
      expect(handlers[0]).toBe(mockHandler1);
      expect(handlers[1]).toBe(mockHandler2);
    });

    it("should allow registering the same handler multiple times", () => {
      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler1);

      const handlers = (errorHandlerService as any).handlers;
      expect(handlers).toHaveLength(2);
      expect(handlers[0]).toBe(mockHandler1);
      expect(handlers[1]).toBe(mockHandler1);
    });

    it("should maintain registration order", () => {
      const handler3: jest.Mocked<ErrorHandler> = {
        canHandle: jest.fn(),
        handleError: jest.fn(),
      };

      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler2);
      errorHandlerService.registerHandler(handler3);

      const handlers = (errorHandlerService as any).handlers;
      expect(handlers[0]).toBe(mockHandler1);
      expect(handlers[1]).toBe(mockHandler2);
      expect(handlers[2]).toBe(handler3);
    });
  });

  describe("handleError", () => {
    let testError: KernelError;

    beforeEach(() => {
      testError = new KernelError(
        "Test error",
        "TEST_001",
        { test: true },
        "TestModule",
      );
    });

    it("should handle error with appropriate handler", async () => {
      mockHandler1.canHandle.mockReturnValue(true);
      mockHandler1.handleError.mockResolvedValue(undefined);
      errorHandlerService.registerHandler(mockHandler1);

      await errorHandlerService.handleError(testError);

      expect(mockHandler1.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler1.handleError).toHaveBeenCalledWith(testError);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "kernel.error",
          payload: expect.objectContaining({
            eventType: "ErrorOccurred",
            error: testError,
          }),
          source: "ErrorHandlerService",
        }),
      );
    });

    it("should try handlers in registration order", async () => {
      mockHandler1.canHandle.mockReturnValue(false);
      mockHandler2.canHandle.mockReturnValue(true);
      mockHandler2.handleError.mockResolvedValue(undefined);

      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler2);

      await errorHandlerService.handleError(testError);

      expect(mockHandler1.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler1.handleError).not.toHaveBeenCalled();
      expect(mockHandler2.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler2.handleError).toHaveBeenCalledWith(testError);
    });

    it("should use first handler that can handle the error", async () => {
      mockHandler1.canHandle.mockReturnValue(true);
      mockHandler1.handleError.mockResolvedValue(undefined);
      mockHandler2.canHandle.mockReturnValue(true);
      mockHandler2.handleError.mockResolvedValue(undefined);

      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler2);

      await errorHandlerService.handleError(testError);

      expect(mockHandler1.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler1.handleError).toHaveBeenCalledWith(testError);
      expect(mockHandler2.canHandle).not.toHaveBeenCalled();
      expect(mockHandler2.handleError).not.toHaveBeenCalled();
    });

    it("should emit unhandled error event when no handler can handle", async () => {
      mockHandler1.canHandle.mockReturnValue(false);
      mockHandler2.canHandle.mockReturnValue(false);

      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler2);

      await errorHandlerService.handleError(testError);

      expect(mockHandler1.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler2.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler1.handleError).not.toHaveBeenCalled();
      expect(mockHandler2.handleError).not.toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "kernel.error",
          payload: expect.objectContaining({
            eventType: "ErrorOccurred",
            error: testError,
          }),
          source: "ErrorHandlerService",
        }),
      );
    });

    it("should emit unhandled error event when no handlers registered", async () => {
      await errorHandlerService.handleError(testError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle errors thrown by handlers", async () => {
      const handlerError = new Error("Handler failed");
      mockHandler1.canHandle.mockReturnValue(true);
      mockHandler1.handleError.mockRejectedValue(handlerError);

      errorHandlerService.registerHandler(mockHandler1);

      await errorHandlerService.handleError(testError);

      expect(mockHandler1.handleError).toHaveBeenCalledWith(testError);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should continue to next handler if current handler throws", async () => {
      const handlerError = new Error("Handler 1 failed");
      mockHandler1.canHandle.mockReturnValue(true);
      mockHandler1.handleError.mockRejectedValue(handlerError);
      mockHandler2.canHandle.mockReturnValue(true);
      mockHandler2.handleError.mockResolvedValue(undefined);

      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler2);

      await errorHandlerService.handleError(testError);

      expect(mockHandler1.handleError).toHaveBeenCalledWith(testError);
      expect(mockHandler2.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler2.handleError).toHaveBeenCalledWith(testError);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle errors thrown by canHandle method", async () => {
      mockHandler1.canHandle.mockImplementation(() => {
        throw new Error("canHandle failed");
      });
      mockHandler2.canHandle.mockReturnValue(true);
      mockHandler2.handleError.mockResolvedValue(undefined);

      errorHandlerService.registerHandler(mockHandler1);
      errorHandlerService.registerHandler(mockHandler2);

      await errorHandlerService.handleError(testError);

      expect(mockHandler2.canHandle).toHaveBeenCalledWith(testError);
      expect(mockHandler2.handleError).toHaveBeenCalledWith(testError);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle async canHandle methods", async () => {
      const asyncHandler: jest.Mocked<ErrorHandler> = {
        canHandle: jest.fn().mockResolvedValue(true),
        handleError: jest.fn().mockResolvedValue(undefined),
      };

      errorHandlerService.registerHandler(asyncHandler);

      await errorHandlerService.handleError(testError);

      expect(asyncHandler.canHandle).toHaveBeenCalledWith(testError);
      expect(asyncHandler.handleError).toHaveBeenCalledWith(testError);
    });
  });

  describe("handleCriticalError", () => {
    let criticalError: KernelError;

    beforeEach(() => {
      criticalError = new KernelError(
        "Critical error",
        "CRIT_001",
        { severity: "high" },
        "CriticalModule",
        true,
      );
    });

    it("should handle critical error and emit critical event", async () => {
      mockHandler1.canHandle.mockReturnValue(true);
      mockHandler1.handleError.mockResolvedValue(undefined);
      errorHandlerService.registerHandler(mockHandler1);

      await errorHandlerService.handleError(criticalError);

      expect(mockHandler1.canHandle).toHaveBeenCalledWith(criticalError);
      expect(mockHandler1.handleError).toHaveBeenCalledWith(criticalError);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "kernel.critical_error",
          payload: expect.objectContaining({
            eventType: "CriticalErrorOccurred",
            error: criticalError,
          }),
          source: "ErrorHandlerService",
        }),
      );
    });
  });

  describe("error handler interface compliance", () => {
    it("should work with handlers that return promises", async () => {
      const asyncHandler: ErrorHandler = {
        canHandle: (error: KernelError) => error.code === "ASYNC_001",
        handleError: (_error: KernelError) => Promise.resolve(),
      };

      errorHandlerService.registerHandler(asyncHandler);

      const asyncError = new KernelError("Async error", "ASYNC_001");
      await errorHandlerService.handleError(asyncError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should work with handlers that return boolean directly", async () => {
      const syncHandler: ErrorHandler = {
        canHandle: (error: KernelError) => error.code === "SYNC_001",
        handleError: (_error: KernelError) => Promise.resolve(),
      };

      errorHandlerService.registerHandler(syncHandler);

      const syncError = new KernelError("Sync error", "SYNC_001");
      await errorHandlerService.handleError(syncError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle handlers with complex canHandle logic", async () => {
      const complexHandler: ErrorHandler = {
        canHandle: (error: KernelError) => {
          return (
            error.isCritical &&
            error.sourceModule === "ComplexModule" &&
            error.details?.type === "complex"
          );
        },
        handleError: (_error: KernelError) => Promise.resolve(),
      };

      errorHandlerService.registerHandler(complexHandler);

      const complexError = new KernelError(
        "Complex error",
        "COMPLEX_001",
        { type: "complex" },
        "ComplexModule",
        true,
      );

      await errorHandlerService.handleError(complexError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe("event emission details", () => {
    it("should emit correct event structure for handled errors", async () => {
      mockHandler1.canHandle.mockReturnValue(true);
      mockHandler1.handleError.mockResolvedValue(undefined);
      errorHandlerService.registerHandler(mockHandler1);

      const testError = new KernelError("Test", "TEST_001");
      await errorHandlerService.handleError(testError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should emit correct event structure for unhandled errors", async () => {
      const testError = new KernelError("Test", "TEST_001");
      await errorHandlerService.handleError(testError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe("edge cases and error conditions", () => {
    it("should handle null error gracefully", async () => {
      await expect(
        errorHandlerService.handleError(null as any),
      ).rejects.toThrow();
    });

    it("should handle undefined error gracefully", async () => {
      await expect(
        errorHandlerService.handleError(undefined as any),
      ).rejects.toThrow();
    });

    it("should handle handler that returns undefined from canHandle", async () => {
      const undefinedHandler: ErrorHandler = {
        canHandle: () => undefined as any,
        handleError: jest.fn().mockResolvedValue(undefined),
      };

      errorHandlerService.registerHandler(undefinedHandler);

      const testError = new KernelError("Test", "TEST_001");
      await errorHandlerService.handleError(testError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle handler that returns null from canHandle", async () => {
      const nullHandler: ErrorHandler = {
        canHandle: () => null as any,
        handleError: jest.fn().mockResolvedValue(undefined),
      };

      errorHandlerService.registerHandler(nullHandler);

      const testError = new KernelError("Test", "TEST_001");
      await errorHandlerService.handleError(testError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle very large number of handlers", async () => {
      const handlers: ErrorHandler[] = [];

      // Register 100 handlers that can't handle the error
      for (let i = 0; i < 100; i++) {
        const handler: ErrorHandler = {
          canHandle: () => false,
          handleError: jest.fn(),
        };
        handlers.push(handler);
        errorHandlerService.registerHandler(handler);
      }

      // Register one handler that can handle it
      const finalHandler: ErrorHandler = {
        canHandle: () => true,
        handleError: jest.fn().mockResolvedValue(undefined),
      };
      errorHandlerService.registerHandler(finalHandler);

      const testError = new KernelError("Test", "TEST_001");
      await errorHandlerService.handleError(testError);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle concurrent error processing", async () => {
      mockHandler1.canHandle.mockReturnValue(true);
      mockHandler1.handleError.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10)),
      );
      errorHandlerService.registerHandler(mockHandler1);

      const errors = Array.from(
        { length: 10 },
        (_, i) => new KernelError(`Error ${i}`, `ERR_${i}`),
      );

      const promises = errors.map((error) =>
        errorHandlerService.handleError(error),
      );
      await Promise.all(promises);

      expect(mockHandler1.handleError).toHaveBeenCalledTimes(10);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(10);
    });
  });
});
