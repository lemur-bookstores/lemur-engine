import { Bulkhead } from '../../src/core/_Bulkhead';

describe('Bulkhead Queue Processing (Completely Isolated)', () => {
    it('should process queue after operation completes without timeout', async () => {
        // Create a bulkhead without timeout for this test
        const queueBulkhead = new Bulkhead({ maxConcurrent: 2, maxQueued: 2 });
        
        const operation = (id: string, delay: number) => {
            return new Promise<string>((resolve) => {
                setTimeout(() => {
                    resolve(`op${id}`);
                }, delay);
            });
        };

        // Start 3 operations: 2 should run immediately, 1 should be queued
        const promises = [
            queueBulkhead.execute(() => operation('1', 100)),
            queueBulkhead.execute(() => operation('2', 50)),
            queueBulkhead.execute(() => operation('3', 25))
        ];

        const results = await Promise.all(promises);
        
        expect(results).toEqual(['op1', 'op2', 'op3']);
    });
});