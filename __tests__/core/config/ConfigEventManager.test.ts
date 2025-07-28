import { ConfigEventManager, ConfigChangeEventType, ConfigChangeEvent } from '../../../src/core/config/events/ConfigEventManager';
import { ConfigChangeListener } from '../../../src/core/config/events/ConfigChangeListener';
import { KernelConfig } from '../../../src/core/config/types';

describe('ConfigEventManager', () => {
    let eventManager: ConfigEventManager;
    let mockListener: ConfigChangeListener;
    let mockConfig: KernelConfig;

    beforeEach(() => {
        eventManager = ConfigEventManager.getInstance();
        eventManager.clearAllListeners();

        mockListener = {
            onConfigChange: jest.fn(),
            onEvent: jest.fn()
        };

        mockConfig = {
            environment: 'development'
        } as KernelConfig;
    });

    afterEach(() => {
        // Asegurar limpieza completa después de cada test
        eventManager.clearAllListeners();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = ConfigEventManager.getInstance();
            const instance2 = ConfigEventManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Event Subscription', () => {
        it('should allow subscribing to specific events', () => {
            eventManager.subscribe(ConfigChangeEventType.CONFIG_LOADED, mockListener);
            expect(eventManager.getListenerCount(ConfigChangeEventType.CONFIG_LOADED)).toBe(1);
        });

        it('should allow subscribing to all events', () => {
            eventManager.subscribeToAll(mockListener);
            Object.values(ConfigChangeEventType).forEach(eventType => {
                expect(eventManager.hasListeners(eventType)).toBe(true);
            });
        });

        it('should allow unsubscribing from specific events', () => {
            eventManager.subscribe(ConfigChangeEventType.CONFIG_LOADED, mockListener);
            eventManager.unsubscribe(ConfigChangeEventType.CONFIG_LOADED, mockListener);
            expect(eventManager.getListenerCount(ConfigChangeEventType.CONFIG_LOADED)).toBe(0);
        });

        it('should allow unsubscribing from all events', () => {
            eventManager.subscribeToAll(mockListener);
            eventManager.unsubscribeFromAll(mockListener);
            Object.values(ConfigChangeEventType).forEach(eventType => {
                expect(eventManager.hasListeners(eventType)).toBe(false);
            });
        });
    });

    describe('Event Notification', () => {
        it('should notify subscribers of config changes', async () => {
            eventManager.subscribe(ConfigChangeEventType.CONFIG_UPDATED, mockListener);

            const event: ConfigChangeEvent = {
                type: ConfigChangeEventType.CONFIG_UPDATED,
                oldConfig: mockConfig,
                newConfig: { ...mockConfig, environment: 'production' } as KernelConfig,
                timestamp: new Date()
            };

            await eventManager.notify(event);

            expect(mockListener.onConfigChange).toHaveBeenCalledWith(
                event.oldConfig,
                event.newConfig
            );
            expect(mockListener.onEvent).toHaveBeenCalledWith(event);
        });

        it('should handle errors in listeners gracefully', async () => {
            const errorListener: ConfigChangeListener = {
                onConfigChange: jest.fn().mockRejectedValue(new Error('Listener error')),
                onEvent: jest.fn()
            };

            eventManager.subscribe(ConfigChangeEventType.CONFIG_UPDATED, errorListener);
            eventManager.subscribe(ConfigChangeEventType.CONFIG_UPDATED, mockListener);

            const event: ConfigChangeEvent = {
                type: ConfigChangeEventType.CONFIG_UPDATED,
                oldConfig: mockConfig,
                newConfig: { ...mockConfig, environment: 'production' } as KernelConfig,
                timestamp: new Date()
            };

            // No debería lanzar error
            await expect(eventManager.notify(event)).resolves.not.toThrow();

            // El segundo listener debería ser llamado incluso si el primero falla
            expect(mockListener.onConfigChange).toHaveBeenCalled();
        });
    });

    describe('Error Events', () => {
        it('should handle error events properly', async () => {
            eventManager.subscribe(ConfigChangeEventType.CONFIG_ERROR, mockListener);

            const error = new Error('Configuration error');
            const event: ConfigChangeEvent = {
                type: ConfigChangeEventType.CONFIG_ERROR,
                error,
                timestamp: new Date()
            };

            await eventManager.notify(event);

            expect(mockListener.onEvent).toHaveBeenCalledWith(event);
        });
    });
});
