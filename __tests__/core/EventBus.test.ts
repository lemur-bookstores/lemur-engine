import { EventBus } from "../../src/core/EventBus";
import { KernelEvent, EventHandler } from "../../src/types";

// Mock EventHandler implementation for testing purposes, satisfying the interface.
const createMockHandler = (): EventHandler & { mock: jest.Mock } => {
  const mockFn = jest.fn(async (_event: KernelEvent) => {});
  const handler: any = {
    canHandle: jest.fn((_event: KernelEvent) => true),
    handle: mockFn,
    mock: mockFn, // Expose the mock function for easy expectation setting
  };
  return handler;
};

describe("EventBus (Core)", () => {
  let eventBus: EventBus;
  let mockHandler1: ReturnType<typeof createMockHandler>;
  let mockHandler2: ReturnType<typeof createMockHandler>;

  beforeEach(() => {
    eventBus = new EventBus();
    mockHandler1 = createMockHandler();
    mockHandler2 = createMockHandler();
  });

  describe("subscribe and publish", () => {
    it("debería publicar un evento y notificar a los suscriptores correctos", async () => {
      // Arrange
      const eventType = "test.event";
      const event: KernelEvent = {
        id: "1",
        type: eventType,
        payload: { data: "test" },
        timestamp: new Date(),
        source: "test",
      };
      eventBus.subscribe(eventType, mockHandler1);
      eventBus.subscribe("other.event", mockHandler2);

      // Act
      await eventBus.publish(event);

      // Assert
      expect(mockHandler1.handle).toHaveBeenCalledTimes(1);
      expect(mockHandler1.handle).toHaveBeenCalledWith(event);
      expect(mockHandler2.handle).not.toHaveBeenCalled();
    });

    it("debería ejecutar todos los handlers suscritos a un evento en paralelo", async () => {
      // Arrange
      const eventType = "user.created";
      const event: KernelEvent = {
        id: "2",
        type: eventType,
        payload: { userId: 123 },
        timestamp: new Date(),
        source: "test",
      };
      eventBus.subscribe(eventType, mockHandler1);
      eventBus.subscribe(eventType, mockHandler2);

      // Act
      await eventBus.publish(event);

      // Assert
      expect(mockHandler1.handle).toHaveBeenCalledTimes(1);
      expect(mockHandler2.handle).toHaveBeenCalledTimes(1);
    });

    it("debería usar canHandle para filtrar a qué handlers notificar", async () => {
      // Arrange
      const eventType = "critical.error";
      const event: KernelEvent = {
        id: "3",
        type: eventType,
        payload: {},
        timestamp: new Date(),
        source: "test",
      };

      (mockHandler1.canHandle as jest.Mock).mockReturnValue(true);
      (mockHandler2.canHandle as jest.Mock).mockReturnValue(false);

      eventBus.subscribe(eventType, mockHandler1);
      eventBus.subscribe(eventType, mockHandler2);

      // Act
      await eventBus.publish(event);

      // Assert
      expect(mockHandler1.canHandle).toHaveBeenCalledWith(event);
      expect(mockHandler2.canHandle).toHaveBeenCalledWith(event);
      expect(mockHandler1.handle).toHaveBeenCalledTimes(1);
      expect(mockHandler2.handle).not.toHaveBeenCalled();
    });

    it("no debería detenerse si un handler lanza un error y debería loguearlo", async () => {
      // Arrange
      const eventType = "system.update";
      const event: KernelEvent = {
        id: "4",
        type: eventType,
        payload: {},
        timestamp: new Date(),
        source: "test",
      };
      const erroringHandler = createMockHandler();
      (erroringHandler.handle as jest.Mock).mockRejectedValue(
        new Error("Handler failed!"),
      );

      eventBus.subscribe(eventType, erroringHandler);
      eventBus.subscribe(eventType, mockHandler1); // Handler que sí funciona

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Act
      await eventBus.publish(event);

      // Assert
      expect(erroringHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockHandler1.handle).toHaveBeenCalledTimes(1); // El otro handler debe ejecutarse
      expect(consoleErrorSpy).toHaveBeenCalled(); // Debería loguear el error

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Event Sourcing (getEventHistory)", () => {
    it("debería almacenar todos los eventos publicados en el eventStore", async () => {
      // Arrange
      const event1: KernelEvent = {
        id: "ev1",
        type: "event.one",
        payload: {},
        timestamp: new Date(),
        source: "test",
      };
      const event2: KernelEvent = {
        id: "ev2",
        type: "event.two",
        payload: {},
        timestamp: new Date(),
        source: "test",
      };

      // Act
      await eventBus.publish(event1);
      await eventBus.publish(event2);

      // Assert
      const history = eventBus.getEventHistory();
      expect(history).toHaveLength(2);
      expect(history).toEqual([event1, event2]);
    });

    it("debería permitir filtrar el historial de eventos por tipo", async () => {
      // Arrange
      const event1: KernelEvent = {
        id: "ev1",
        type: "event.one",
        payload: {},
        timestamp: new Date(),
        source: "test",
      };
      const event2: KernelEvent = {
        id: "ev2",
        type: "event.two",
        payload: {},
        timestamp: new Date(),
        source: "test",
      };
      const event3: KernelEvent = {
        id: "ev3",
        type: "event.one",
        payload: {},
        timestamp: new Date(),
        source: "test",
      };

      await eventBus.publish(event1);
      await eventBus.publish(event2);
      await eventBus.publish(event3);

      // Act
      const filteredHistory = eventBus.getEventHistory("event.one");

      // Assert
      expect(filteredHistory).toHaveLength(2);
      expect(filteredHistory).toEqual([event1, event3]);
    });
  });
});
