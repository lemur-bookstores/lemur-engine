import { KernelEvent, EventHandler } from '../types';

export class EventBus {
    private handlers: Map<string, Set<EventHandler>> = new Map();
    private eventStore: KernelEvent[] = [];

    subscribe<T>(eventType: string, handler: EventHandler<T>): void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType)!.add(handler);
    }

    async publish<T>(event: KernelEvent<T>): Promise<void> {
        // Event Sourcing - Store all events
        this.eventStore.push(event);

        const handlers = this.handlers.get(event.type) || new Set();

        // Parallel execution with error isolation
        const promises = Array.from(handlers).map(async (handler) => {
            try {
                if (handler.canHandle(event)) {
                    await handler.handle(event);
                }
            } catch (error) {
                console.error(`Handler error for event ${event.type}:`, error);
                // Emit error event for monitoring
                await this.publish({
                    id: crypto.randomUUID(),
                    type: 'kernel.error',
                    payload: { originalEvent: event, error },
                    timestamp: new Date(),
                    source: 'EventBus'
                });
            }
        });

        await Promise.all(promises);
    }

    getEventHistory(eventType?: string): KernelEvent[] {
        return eventType
            ? this.eventStore.filter(e => e.type === eventType)
            : [...this.eventStore];
    }
}
