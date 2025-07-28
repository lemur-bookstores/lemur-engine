import { KernelMediator, KernelComponent } from '../../src/core/KernelMediator';

describe('KernelMediator', () => {
    let mediator: KernelMediator;
    let mockComponent1: jest.Mocked<KernelComponent>;
    let mockComponent2: jest.Mocked<KernelComponent>;
    let mockComponent3: jest.Mocked<KernelComponent>;

    beforeEach(() => {
        mediator = new KernelMediator();

        mockComponent1 = {
            getId: jest.fn().mockReturnValue('component1'),
            handleMessage: jest.fn().mockResolvedValue(undefined)
        };

        mockComponent2 = {
            getId: jest.fn().mockReturnValue('component2'),
            handleMessage: jest.fn().mockResolvedValue(undefined)
        };

        mockComponent3 = {
            getId: jest.fn().mockReturnValue('component3'),
            handleMessage: jest.fn().mockResolvedValue(undefined)
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create mediator with empty components map', () => {
            expect(mediator).toBeInstanceOf(KernelMediator);
            expect((mediator as any).components).toBeInstanceOf(Map);
            expect((mediator as any).components.size).toBe(0);
        });
    });

    describe('register', () => {
        it('should register a single component', () => {
            mediator.register(mockComponent1);

            const components = (mediator as any).components;
            expect(components.size).toBe(1);
            expect(components.has('component1')).toBe(true);
            expect(components.get('component1')).toBe(mockComponent1);
        });

        it('should register multiple components', () => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);
            mediator.register(mockComponent3);

            const components = (mediator as any).components;
            expect(components.size).toBe(3);
            expect(components.has('component1')).toBe(true);
            expect(components.has('component2')).toBe(true);
            expect(components.has('component3')).toBe(true);
        });

        it('should replace component if same ID is registered again', () => {
            const newComponent: jest.Mocked<KernelComponent> = {
                getId: jest.fn().mockReturnValue('component1'),
                handleMessage: jest.fn().mockResolvedValue(undefined)
            };

            mediator.register(mockComponent1);
            mediator.register(newComponent);

            const components = (mediator as any).components;
            expect(components.size).toBe(1);
            expect(components.get('component1')).toBe(newComponent);
            expect(components.get('component1')).not.toBe(mockComponent1);
        });

        it('should call getId() to get component identifier', () => {
            mediator.register(mockComponent1);

            expect(mockComponent1.getId).toHaveBeenCalled();
        });

        it('should handle components with dynamic IDs', () => {
            let idCounter = 0;
            const dynamicComponent: jest.Mocked<KernelComponent> = {
                getId: jest.fn().mockImplementation(() => `dynamic-${++idCounter}`),
                handleMessage: jest.fn().mockResolvedValue(undefined)
            };

            mediator.register(dynamicComponent);
            const firstId = dynamicComponent.getId();
            
            mediator.register(dynamicComponent);
            const secondId = dynamicComponent.getId();

            expect(firstId).not.toBe(secondId);
            expect(dynamicComponent.getId).toHaveBeenCalledTimes(2);
        });
    });

    describe('unregister', () => {
        beforeEach(() => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);
            mediator.register(mockComponent3);
        });

        it('should unregister existing component', () => {
            mediator.unregister('component2');

            const components = (mediator as any).components;
            expect(components.size).toBe(2);
            expect(components.has('component1')).toBe(true);
            expect(components.has('component2')).toBe(false);
            expect(components.has('component3')).toBe(true);
        });

        it('should handle unregistering non-existent component', () => {
            mediator.unregister('nonexistent');

            const components = (mediator as any).components;
            expect(components.size).toBe(3);
        });

        it('should handle unregistering already unregistered component', () => {
            mediator.unregister('component2');
            mediator.unregister('component2');

            const components = (mediator as any).components;
            expect(components.size).toBe(2);
            expect(components.has('component2')).toBe(false);
        });

        it('should unregister all components when called for each', () => {
            mediator.unregister('component1');
            mediator.unregister('component2');
            mediator.unregister('component3');

            const components = (mediator as any).components;
            expect(components.size).toBe(0);
        });
    });

    describe('sendMessage - direct messaging', () => {
        beforeEach(() => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);
            mediator.register(mockComponent3);
        });

        it('should send message to specific component', async () => {
            const message = { type: 'test', data: 'hello' };

            await mediator.sendMessage(message, 'component1', 'component2');

            expect(mockComponent2.handleMessage).toHaveBeenCalledWith(message, 'component1');
            expect(mockComponent1.handleMessage).not.toHaveBeenCalled();
            expect(mockComponent3.handleMessage).not.toHaveBeenCalled();
        });

        it('should handle sending to non-existent component', async () => {
            const message = { type: 'test', data: 'hello' };

            await expect(mediator.sendMessage(message, 'component1', 'nonexistent')).resolves.not.toThrow();

            expect(mockComponent1.handleMessage).not.toHaveBeenCalled();
            expect(mockComponent2.handleMessage).not.toHaveBeenCalled();
            expect(mockComponent3.handleMessage).not.toHaveBeenCalled();
        });

        it('should handle different message types', async () => {
            const messages = [
                { type: 'string', data: 'test' },
                { type: 'number', data: 42 },
                { type: 'boolean', data: true },
                { type: 'object', data: { nested: 'value' } },
                { type: 'array', data: [1, 2, 3] },
                null,
                undefined,
                'simple string',
                123
            ];

            for (const message of messages) {
                await mediator.sendMessage(message, 'component1', 'component2');
                expect(mockComponent2.handleMessage).toHaveBeenCalledWith(message, 'component1');
            }

            expect(mockComponent2.handleMessage).toHaveBeenCalledTimes(messages.length);
        });

        it('should handle async component message handling', async () => {
            let resolveHandler: () => void;
            const handlerPromise = new Promise<void>(resolve => {
                resolveHandler = resolve;
            });

            mockComponent2.handleMessage.mockImplementation(async () => {
                await handlerPromise;
            });

            const message = { type: 'async', data: 'test' };
            const sendPromise = mediator.sendMessage(message, 'component1', 'component2');

            // Message should not be handled yet
            expect(mockComponent2.handleMessage).toHaveBeenCalledWith(message, 'component1');

            // Resolve the handler
            resolveHandler!();
            await sendPromise;

            // Should complete without error
            expect(mockComponent2.handleMessage).toHaveBeenCalledTimes(1);
        });

        it('should handle component that throws error', async () => {
            const error = new Error('Component error');
            mockComponent2.handleMessage.mockRejectedValue(error);

            const message = { type: 'error', data: 'test' };

            await expect(mediator.sendMessage(message, 'component1', 'component2')).rejects.toThrow('Component error');
        });
    });

    describe('sendMessage - broadcast messaging', () => {
        beforeEach(() => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);
            mediator.register(mockComponent3);
        });

        it('should broadcast message to all components except sender', async () => {
            const message = { type: 'broadcast', data: 'hello all' };

            await mediator.sendMessage(message, 'component1');

            expect(mockComponent1.handleMessage).not.toHaveBeenCalled();
            expect(mockComponent2.handleMessage).toHaveBeenCalledWith(message, 'component1');
            expect(mockComponent3.handleMessage).toHaveBeenCalledWith(message, 'component1');
        });

        it('should broadcast to all when sender is not registered', async () => {
            const message = { type: 'broadcast', data: 'hello all' };

            await mediator.sendMessage(message, 'unknown-sender');

            expect(mockComponent1.handleMessage).toHaveBeenCalledWith(message, 'unknown-sender');
            expect(mockComponent2.handleMessage).toHaveBeenCalledWith(message, 'unknown-sender');
            expect(mockComponent3.handleMessage).toHaveBeenCalledWith(message, 'unknown-sender');
        });

        it('should handle broadcast with no components registered', async () => {
            const emptyMediator = new KernelMediator();
            const message = { type: 'broadcast', data: 'hello' };

            await expect(emptyMediator.sendMessage(message, 'sender')).resolves.not.toThrow();
        });

        it('should handle broadcast with only sender registered', async () => {
            const singleMediator = new KernelMediator();
            singleMediator.register(mockComponent1);

            const message = { type: 'broadcast', data: 'hello' };

            await singleMediator.sendMessage(message, 'component1');

            expect(mockComponent1.handleMessage).not.toHaveBeenCalled();
        });

        it('should handle errors from multiple components during broadcast', async () => {
            const error1 = new Error('Component 2 error');
            const error2 = new Error('Component 3 error');

            mockComponent2.handleMessage.mockRejectedValue(error1);
            mockComponent3.handleMessage.mockRejectedValue(error2);

            const message = { type: 'broadcast', data: 'error test' };

            await expect(mediator.sendMessage(message, 'component1')).rejects.toThrow();
        });

        it('should handle partial errors during broadcast', async () => {
            const error = new Error('Component 2 error');
            mockComponent2.handleMessage.mockRejectedValue(error);
            // component3 succeeds

            const message = { type: 'broadcast', data: 'partial error test' };

            await expect(mediator.sendMessage(message, 'component1')).rejects.toThrow();
            expect(mockComponent3.handleMessage).toHaveBeenCalledWith(message, 'component1');
        });

        it('should wait for all components to handle message', async () => {
            const delays = [100, 200, 50];
            const startTime = Date.now();

            mockComponent1.handleMessage.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, delays[0]))
            );
            mockComponent2.handleMessage.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, delays[1]))
            );
            mockComponent3.handleMessage.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, delays[2]))
            );

            const message = { type: 'timing', data: 'test' };
            await mediator.sendMessage(message, 'external-sender');

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should wait for the longest delay (200ms)
            expect(duration).toBeGreaterThanOrEqual(190); // Allow some tolerance
            expect(mockComponent1.handleMessage).toHaveBeenCalled();
            expect(mockComponent2.handleMessage).toHaveBeenCalled();
            expect(mockComponent3.handleMessage).toHaveBeenCalled();
        });
    });

    describe('getComponent', () => {
        beforeEach(() => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);
        });

        it('should return existing component', () => {
            const component = mediator.getComponent('component1');

            expect(component).toBe(mockComponent1);
        });

        it('should return undefined for non-existent component', () => {
            const component = mediator.getComponent('nonexistent');

            expect(component).toBeUndefined();
        });

        it('should return correct component after registration', () => {
            const component = mediator.getComponent('component2');

            expect(component).toBe(mockComponent2);
        });

        it('should return undefined after component is unregistered', () => {
            mediator.unregister('component1');
            const component = mediator.getComponent('component1');

            expect(component).toBeUndefined();
        });
    });

    describe('getAllComponents', () => {
        it('should return empty array when no components registered', () => {
            const components = mediator.getAllComponents();

            expect(components).toEqual([]);
            expect(Array.isArray(components)).toBe(true);
        });

        it('should return all registered components', () => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);
            mediator.register(mockComponent3);

            const components = mediator.getAllComponents();

            expect(components).toHaveLength(3);
            expect(components).toContain(mockComponent1);
            expect(components).toContain(mockComponent2);
            expect(components).toContain(mockComponent3);
        });

        it('should return array copy, not reference to internal map', () => {
            mediator.register(mockComponent1);
            
            const components1 = mediator.getAllComponents();
            const components2 = mediator.getAllComponents();

            expect(components1).not.toBe(components2);
            expect(components1).toEqual(components2);
        });

        it('should reflect changes after registration/unregistration', () => {
            mediator.register(mockComponent1);
            let components = mediator.getAllComponents();
            expect(components).toHaveLength(1);

            mediator.register(mockComponent2);
            components = mediator.getAllComponents();
            expect(components).toHaveLength(2);

            mediator.unregister('component1');
            components = mediator.getAllComponents();
            expect(components).toHaveLength(1);
            expect(components).toContain(mockComponent2);
            expect(components).not.toContain(mockComponent1);
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete component lifecycle', async () => {
            // Register components
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);

            // Send direct message
            await mediator.sendMessage({ type: 'init' }, 'component1', 'component2');
            expect(mockComponent2.handleMessage).toHaveBeenCalledWith({ type: 'init' }, 'component1');

            // Broadcast message
            await mediator.sendMessage({ type: 'broadcast' }, 'component1');
            expect(mockComponent2.handleMessage).toHaveBeenCalledWith({ type: 'broadcast' }, 'component1');

            // Unregister and verify
            mediator.unregister('component2');
            expect(mediator.getComponent('component2')).toBeUndefined();
        });

        it('should handle complex message routing scenarios', async () => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);
            mediator.register(mockComponent3);

            // Component 1 sends to Component 2
            await mediator.sendMessage({ step: 1 }, 'component1', 'component2');
            
            // Component 2 broadcasts to others
            await mediator.sendMessage({ step: 2 }, 'component2');
            
            // Component 3 sends to Component 1
            await mediator.sendMessage({ step: 3 }, 'component3', 'component1');

            expect(mockComponent2.handleMessage).toHaveBeenCalledWith({ step: 1 }, 'component1');
            expect(mockComponent1.handleMessage).toHaveBeenCalledWith({ step: 2 }, 'component2');
            expect(mockComponent3.handleMessage).toHaveBeenCalledWith({ step: 2 }, 'component2');
            expect(mockComponent1.handleMessage).toHaveBeenCalledWith({ step: 3 }, 'component3');
        });

        it('should handle dynamic component registration during messaging', async () => {
            mediator.register(mockComponent1);

            // Start a broadcast
            const broadcastPromise = mediator.sendMessage({ type: 'dynamic' }, 'external');

            // Register new component during broadcast (should not receive this message)
            mediator.register(mockComponent2);

            await broadcastPromise;

            expect(mockComponent1.handleMessage).toHaveBeenCalledWith({ type: 'dynamic' }, 'external');
            expect(mockComponent2.handleMessage).not.toHaveBeenCalled();

            // New broadcast should include the new component
            await mediator.sendMessage({ type: 'after-registration' }, 'external');
            expect(mockComponent2.handleMessage).toHaveBeenCalledWith({ type: 'after-registration' }, 'external');
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle component with null/undefined ID', () => {
            const nullIdComponent: jest.Mocked<KernelComponent> = {
                getId: jest.fn().mockReturnValue(null as any),
                handleMessage: jest.fn().mockResolvedValue(undefined)
            };

            mediator.register(nullIdComponent);
            
            const components = (mediator as any).components;
            expect(components.has(null)).toBe(true);
        });

        it('should handle component that changes ID between calls', () => {
            let idCounter = 0;
            const changingComponent: jest.Mocked<KernelComponent> = {
                getId: jest.fn().mockImplementation(() => `changing-${++idCounter}`),
                handleMessage: jest.fn().mockResolvedValue(undefined)
            };

            mediator.register(changingComponent);
            const firstId = changingComponent.getId.mock.results[0].value;
            
            // Component should be registered with the ID from registration time
            expect(mediator.getComponent(firstId)).toBe(changingComponent);
        });

        it('should handle very large number of components', async () => {
            const components: KernelComponent[] = [];
            
            // Register 1000 components
            for (let i = 0; i < 1000; i++) {
                const component: jest.Mocked<KernelComponent> = {
                    getId: jest.fn().mockReturnValue(`component-${i}`),
                    handleMessage: jest.fn().mockResolvedValue(undefined)
                };
                components.push(component);
                mediator.register(component);
            }

            // Broadcast to all
            await mediator.sendMessage({ type: 'mass-broadcast' }, 'external');

            // All components should have received the message
            components.forEach(component => {
                expect((component as jest.Mocked<KernelComponent>).handleMessage).toHaveBeenCalledWith(
                    { type: 'mass-broadcast' }, 
                    'external'
                );
            });
        });

        it('should handle concurrent message sending', async () => {
            mediator.register(mockComponent1);
            mediator.register(mockComponent2);

            const messages = Array.from({ length: 100 }, (_, i) => ({ id: i, data: `message-${i}` }));
            
            const promises = messages.map(message => 
                mediator.sendMessage(message, 'component1', 'component2')
            );

            await Promise.all(promises);

            expect(mockComponent2.handleMessage).toHaveBeenCalledTimes(100);
            messages.forEach(message => {
                expect(mockComponent2.handleMessage).toHaveBeenCalledWith(message, 'component1');
            });
        });

        it('should handle message with circular references', async () => {
            const circularMessage: any = { type: 'circular' };
            circularMessage.self = circularMessage;

            mediator.register(mockComponent1);
            mediator.register(mockComponent2);

            await mediator.sendMessage(circularMessage, 'component1', 'component2');

            expect(mockComponent2.handleMessage).toHaveBeenCalledWith(circularMessage, 'component1');
        });

        it('should handle component handleMessage that returns non-promise', async () => {
            const syncComponent: KernelComponent = {
                getId: () => 'sync-component',
                handleMessage: jest.fn().mockReturnValue(undefined as any) // Not a promise
            };

            mediator.register(syncComponent);
            
            await expect(mediator.sendMessage({ type: 'sync' }, 'external', 'sync-component')).resolves.not.toThrow();
        });
    });
});