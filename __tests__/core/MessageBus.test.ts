// import { MessageBus } from '../../src/core/MessageBus';

// describe('MessageBus', () => {
//     let messageBus: MessageBus;

//     beforeEach(() => {
//         messageBus = new MessageBus();
//     });

//     test('should subscribe and publish events correctly', async () => {
//         const mockListener = jest.fn();
//         const event = { eventType: 'TestEvent', data: 'Hello' };

//         messageBus.subscribe(event.eventType, mockListener);
//         await messageBus.publish(event.eventType, event.data);

//         expect(mockListener).toHaveBeenCalledTimes(1);
//         expect(mockListener).toHaveBeenCalledWith(event);
//     });

//     test('should unsubscribe from events', async () => {
//         const mockListener = jest.fn();
//         const event = { eventType: 'AnotherEvent', data: 'World' };

//         messageBus.subscribe(event.eventType, mockListener);
//         messageBus.unsubscribe(event.eventType, mockListener);
//         await messageBus.publish(event.eventType, event.data);

//         expect(mockListener).not.toHaveBeenCalled();
//     });

//     test('should handle multiple subscribers for the same event', async () => {
//         const mockListener1 = jest.fn();
//         const mockListener2 = jest.fn();
//         const event = { eventType: 'MultiSubEvent', data: 123 };

//         messageBus.subscribe(event.eventType, mockListener1);
//         messageBus.subscribe(event.eventType, mockListener2);
//         await messageBus.publish(event.eventType, event.data);

//         expect(mockListener1).toHaveBeenCalledTimes(1);
//         expect(mockListener1).toHaveBeenCalledWith(event);
//         expect(mockListener2).toHaveBeenCalledTimes(1);
//         expect(mockListener2).toHaveBeenCalledWith(event);
//     });
// });