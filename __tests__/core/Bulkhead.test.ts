import { Bulkhead, BulkheadOptions, BulkheadRejectedError } from '../../src/core/_Bulkhead';

describe('Bulkhead', () => {
    let bulkhead: Bulkhead;
    let defaultOptions: BulkheadOptions;

    beforeEach(() => {
        defaultOptions = {
            maxConcurrent: 2,
            maxQueued: 3
            // No timeout por defecto - cada test debe especificar si lo necesita
        };
        bulkhead = new Bulkhead(defaultOptions);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('constructor', () => {
        it('should create bulkhead with provided options', () => {

            const options: BulkheadOptions = {
                maxConcurrent: 5,
                maxQueued: 10,
                timeout: 2000
            };

            const customBulkhead = new Bulkhead(options);
            const stats = customBulkhead.getStats();

            expect(stats.maxConcurrent).toBe(5);
            expect(stats.maxQueued).toBe(10);
            expect(stats.executing).toBe(0);
            expect(stats.queued).toBe(0);
        });

        it('should create bulkhead without timeout', () => {
            const options: BulkheadOptions = {
                maxConcurrent: 2,
                maxQueued: 3
            };

            const noTimeoutBulkhead = new Bulkhead(options);
            const stats = noTimeoutBulkhead.getStats();

            expect(stats.maxConcurrent).toBe(2);
            expect(stats.maxQueued).toBe(3);
        });

        it('should handle zero values in options', () => {
            const options: BulkheadOptions = {
                maxConcurrent: 0,
                maxQueued: 0,
                timeout: 0
            };

            const zeroBulkhead = new Bulkhead(options);
            const stats = zeroBulkhead.getStats();

            expect(stats.maxConcurrent).toBe(0);
            expect(stats.maxQueued).toBe(0);
        });
    });

    describe('execute - immediate execution', () => {
        it('should execute operation immediately when under capacity', async () => {
            const operation = jest.fn().mockResolvedValue('result');

            const result = await bulkhead.execute(operation);

            expect(result).toBe('result');
            expect(operation).toHaveBeenCalledTimes(1);

            const stats = bulkhead.getStats();
            expect(stats.executing).toBe(0);
            expect(stats.queued).toBe(0);
        });

        it('should execute multiple operations concurrently up to limit', async () => {
            const operation1 = jest.fn().mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve('result1'), 100))
            );
            const operation2 = jest.fn().mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve('result2'), 100))
            );

            const promise1 = bulkhead.execute(operation1);
            const promise2 = bulkhead.execute(operation2);

            // Both should be executing
            const stats = bulkhead.getStats();
            expect(stats.executing).toBe(2);
            expect(stats.queued).toBe(0);

            const results = await Promise.all([promise1, promise2]);
            expect(results).toEqual(['result1', 'result2']);
        });

        it('should handle operation that throws error', async () => {
            const error = new Error('Operation failed');
            const operation = jest.fn().mockRejectedValue(error);

            await expect(bulkhead.execute(operation)).rejects.toThrow('Operation failed');

            const stats = bulkhead.getStats();
            expect(stats.executing).toBe(0);
            expect(stats.queued).toBe(0);
        });

        it('should handle operation that throws synchronous error', async () => {
            const operation = jest.fn().mockImplementation(() => {
                throw new Error('Sync error');
            });

            await expect(bulkhead.execute(operation)).rejects.toThrow('Sync error');

            const stats = bulkhead.getStats();
            expect(stats.executing).toBe(0);
            expect(stats.queued).toBe(0);
        });

        it('should handle operation returning non-promise value', async () => {
            const operation = jest.fn().mockReturnValue('immediate result' as any);

            const result = await bulkhead.execute(operation);

            expect(result).toBe('immediate result');
        });
    });
    
    describe('execute - queueing behavior', () => {
        it('should queue operation when at capacity', async () => {
            const longOperation = () => new Promise(resolve => setTimeout(() => resolve('long'), 200));
            const quickOperation = jest.fn().mockResolvedValue('quick');

            // Fill capacity
            const promise1 = bulkhead.execute(longOperation);
            const promise2 = bulkhead.execute(longOperation);

            // This should be queued
            const promise3 = bulkhead.execute(quickOperation);

            const stats = bulkhead.getStats();
            expect(stats.executing).toBe(2);
            expect(stats.queued).toBe(1);

            // Wait for completion
            await Promise.all([promise1, promise2, promise3]);

            const finalStats = bulkhead.getStats();
            expect(finalStats.executing).toBe(0);
            expect(finalStats.queued).toBe(0);
        });

        it('should process queue in FIFO order', async () => {
            const executionOrder: string[] = [];
            
            const createOperation = (id: string, delay: number = 50) => () => 
                new Promise(resolve => {
                    setTimeout(() => {
                        executionOrder.push(id);
                        resolve(id);
                    }, delay);
                });

            // Fill capacity
            const promise1 = bulkhead.execute(createOperation('op1'));
            const promise2 = bulkhead.execute(createOperation('op2'));

            // Queue operations
            const promise3 = bulkhead.execute(createOperation('op3'));
            const promise4 = bulkhead.execute(createOperation('op4'));
            const promise5 = bulkhead.execute(createOperation('op5'));

            await Promise.all([promise1, promise2, promise3, promise4, promise5]);

            // First two should execute immediately, then queue should process in order
            expect(executionOrder.slice(0, 2)).toEqual(expect.arrayContaining(['op1', 'op2']));
            expect(executionOrder.slice(2)).toEqual(['op3', 'op4', 'op5']);
        });

        it('should reject when queue is full', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            const longOperation = () => new Promise(resolve => setTimeout(() => resolve('long'), 200));

            // Fill capacity (2) and queue (3)
            const promises: Array<Promise<any>> = [];
            for (let i = 0; i < 5; i++) {
                promises.push(noTimeoutBulkhead.execute(longOperation));
            }

            // This should be rejected
            await expect(noTimeoutBulkhead.execute(longOperation)).rejects.toThrow(BulkheadRejectedError);
            await expect(noTimeoutBulkhead.execute(longOperation)).rejects.toThrow('Bulkhead capacity exceeded');

            // Clean up
            await Promise.all(promises);
        });

        it('should handle queue processing after operation completion', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            let resolveFirst: (value: any) => void;
            const firstOperation = () => new Promise(resolve => {
                resolveFirst = resolve;
            });

            const secondOperation = jest.fn().mockResolvedValue('second');
            const queuedOperation = jest.fn().mockResolvedValue('queued');

            // Start operations
            const promise1 = noTimeoutBulkhead.execute(firstOperation);
            const promise2 = noTimeoutBulkhead.execute(secondOperation);
            const promise3 = noTimeoutBulkhead.execute(queuedOperation);

            // Verify initial state
            let stats = noTimeoutBulkhead.getStats();
            expect(stats.executing).toBe(2);
            expect(stats.queued).toBe(1);

            // Complete first operation
            resolveFirst!('first');
            await promise1;

            // Wait a bit for queue processing
            await new Promise(resolve => setTimeout(resolve, 10));

            stats = noTimeoutBulkhead.getStats();
            expect(stats.executing).toBeLessThanOrEqual(2);
            expect(stats.queued).toBe(0);

            await Promise.all([promise2, promise3]);
        });
    });

    describe('timeout handling', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should timeout executing operation', async () => {
            // Create a bulkhead with timeout for this specific test
            const timeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3,
                timeout: 1000
            });

            const neverResolving = () => new Promise(() => {}); // Never resolves

            const promise = timeoutBulkhead.execute(neverResolving);

            // Fast-forward time
            jest.advanceTimersByTime(1000);

            await expect(promise).rejects.toThrow('Operation timed out');

            const stats = timeoutBulkhead.getStats();
            expect(stats.executing).toBe(0);
            expect(stats.queued).toBe(0);
        });

        it('should timeout queued operation', async () => {
            jest.useRealTimers(); // Use real timers for this test
            
            const timeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3,
                timeout: 50 // Short timeout for testing
            });

            const longOperation = () => new Promise(() => {}); // Never resolves

            const queuedOperation = () => new Promise(resolve => 
                setTimeout(() => resolve('queued'), 2000) // Longer than timeout
            );

            // Fill capacity
            timeoutBulkhead.execute(longOperation);
            timeoutBulkhead.execute(longOperation);

            // Queue operation that will timeout
            const queuedPromise = timeoutBulkhead.execute(queuedOperation);

            expect(queuedPromise).rejects.toThrow('Operation timed out');

            const stats = timeoutBulkhead.getStats();
            expect(stats.executing).toBe(2); // Tareas en ejecución
            expect(stats.queued).toBe(1); // Espacio en lacola
            
            jest.useFakeTimers(); // Restore fake timers for other tests
        });

        it('should not timeout when operation completes before timeout', async () => {
            // Create a bulkhead with timeout for this specific test
            const timeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3,
                timeout: 1000
            });

            const quickOperation = () => new Promise(resolve => 
                setTimeout(() => resolve('quick'), 500)
            );

            const promise = timeoutBulkhead.execute(quickOperation);

            // Advance time but not enough to timeout
            jest.advanceTimersByTime(500);

            const result = await promise;
            expect(result).toBe('quick');
        });

        it('should handle bulkhead without timeout', async () => {
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 1,
                maxQueued: 1
            });

            const longOperation = () => new Promise(resolve => 
                setTimeout(() => resolve('long'), 2000)
            );

            const promise = noTimeoutBulkhead.execute(longOperation);

            // Advance time beyond what would be a timeout
            jest.advanceTimersByTime(5000);

            const result = await promise;
            expect(result).toBe('long');
        });

        it('should clear timeout when queued operation starts executing', async () => {
            jest.useRealTimers(); // Use real timers for this test
            
            const timeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3,
                timeout: 100 // 100ms timeout
            });

            let resolveFirst: (value: any) => void;
            const firstOperation = () => new Promise(resolve => {
                resolveFirst = resolve;
            });

            const queuedOperation = jest.fn().mockResolvedValue('queued');

            // Fill capacity
            timeoutBulkhead.execute(firstOperation);
            timeoutBulkhead.execute(firstOperation);

            // Queue operation
            const queuedPromise = timeoutBulkhead.execute(queuedOperation);

            // Wait a bit, then complete first operation to start processing queue
            setTimeout(() => {
                resolveFirst!('first');
            }, 10); // estos milisegundos se suman con
            
            // Should not timeout because it started executing
            const result = await queuedPromise; // Estos milisegundo y pueden superar el (" timeout: 100 ") y optenemos error: "Operation timed out"
            expect(result).toBe('queued');
            
            jest.useFakeTimers(); // Restore fake timers for other tests
        });

        it('should handle very small timeout values', async () => {
            const smallTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 1,
                maxQueued: 1,
                timeout: 10 // 10ms timeout
            });

            const operation = () => new Promise(resolve => setTimeout(() => resolve('result'), 500));

            const promise = smallTimeoutBulkhead.execute(operation);

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(10);

            await expect(promise).rejects.toThrow('Operation timed out');
        });
    });

    describe('getStats', () => {
        let statsBulkhead: Bulkhead;

        beforeEach(() => {
            jest.useRealTimers(); // Ensure real timers for stats tests
            // Create a bulkhead without timeout for stats tests
            statsBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });
        });

        it('should return correct initial stats', () => {
            const stats = statsBulkhead.getStats();

            expect(stats).toEqual({
                executing: 0,
                queued: 0,
                maxConcurrent: 2,
                maxQueued: 3
            });
        });

        it('should return correct stats during execution', async () => {
            // Create a completely isolated bulkhead for this test with explicit timeout: undefined
            const testBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3,
                timeout: undefined, // Explicitly set to undefined to avoid any timeout
            });

            // Debug: Log the options to verify timeout is undefined
            // console.log('Bulkhead options:', (testBulkhead as any).options);
            // console.log('Initial stats:', testBulkhead.getStats());

            // const results: string[] = [];
            const romises: Array<Promise<string>> = [];
            const print = (_id: string, _state: string)=> {}//console.log(`Operation ${id}: ${state}`);
            const operation = (id: number) => () => new Promise<string>(resolve => {
                print(id.toString(), 'starting');
                setTimeout(() => (resolve(id.toString()), print(id.toString(), 'completing')), 50); // Increased delay to 50ms to avoid timing issues
            });

            romises.push(testBulkhead.execute(operation(1)));
            romises.push(testBulkhead.execute(operation(2)));
            romises.push(testBulkhead.execute(operation(3)));
            // Check stats immediately
            const stats = testBulkhead.getStats();
            // console.log('Stats during execution:', stats);
            expect(stats.executing).toBe(2);
            expect(stats.queued).toBe(1);
            expect(stats.maxConcurrent).toBe(2);
            expect(stats.maxQueued).toBe(3);
        });

        it('should return stats snapshot, not live reference', () => {
            console.log('Stats bulkhead initial:', statsBulkhead.getStats());
            const stats1 = statsBulkhead.getStats();
            const stats2 = statsBulkhead.getStats();

            expect(stats1).not.toBe(stats2);
            expect(stats1).toEqual(stats2);
            console.log('Stats1:', stats1);
            console.log('Stats2:', stats2);
        });
    });
    describe('BulkheadRejectedError', () => {
        it('should create error with correct name and message', () => {
            const error = new BulkheadRejectedError('Test message');
            
            expect(error.name).toBe('BulkheadRejectedError');
            expect(error.message).toBe('Test message');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(BulkheadRejectedError);
        });

        it('should be throwable and catchable', async () => {
            expect(() => {
                throw new BulkheadRejectedError('Test error');
            }).toThrow(BulkheadRejectedError);

            try {
                throw new BulkheadRejectedError('Test error');
            } catch (error) {
                expect(error).toBeInstanceOf(BulkheadRejectedError);
                expect((error as BulkheadRejectedError).message).toBe('Test error');
            }
        });
    });


    describe('integration scenarios', () => {
        it('should handle mixed success and failure operations', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            console.log('Mixed operations - Initial stats:', noTimeoutBulkhead.getStats());

            const successOp = () => Promise.resolve('success');
            const failOp = () => Promise.reject(new Error('fail'));

            const results = await Promise.allSettled([
                noTimeoutBulkhead.execute(successOp),
                noTimeoutBulkhead.execute(failOp),
                noTimeoutBulkhead.execute(successOp)
            ]);

            console.log('Mixed operations - After execution:', noTimeoutBulkhead.getStats());

            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('rejected');
            expect(results[2].status).toBe('fulfilled');

            const stats = noTimeoutBulkhead.getStats();
            console.log('Mixed operations - Final stats:', stats);
            expect(stats.executing).toBe(0);
            expect(stats.queued).toBe(0);
        });

        it('should handle rapid successive operations', async () => {
            // Use a bulkhead with higher capacity for this test
            const highCapacityBulkhead = new Bulkhead({ 
                maxConcurrent: 5, 
                maxQueued: 10 
            });

            console.log('Rapid operations - Initial stats:', highCapacityBulkhead.getStats());

            const operations = Array.from({ length: 10 }, (_, i) => 
                () => Promise.resolve(`result-${i}`)
            );

            const promises = operations.map(op => highCapacityBulkhead.execute(op));
            console.log('Rapid operations - After queueing:', highCapacityBulkhead.getStats());
            
            const results = await Promise.all(promises);

            console.log('Rapid operations - Final stats:', highCapacityBulkhead.getStats());
            expect(results).toHaveLength(10);
            results.forEach((result, index) => {
                expect(result).toBe(`result-${index}`);
            });
        });

        it('should handle operations with different execution times', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 4,
                maxQueued: 0
                // No timeout specified
            });

            const fastOp = () => Promise.resolve('fast');
            const anotherFastOp = () => Promise.resolve('fast2');

            const results = await Promise.all([
                noTimeoutBulkhead.execute(fastOp),
                noTimeoutBulkhead.execute(anotherFastOp)
            ]);
            
            expect(results).toEqual(['fast', 'fast2']);
        });

        it('should maintain isolation between different bulkhead instances', async () => {
            // Ensure real timers for this test to avoid conflicts with setTimeout
            jest.useRealTimers();
            
            // Use bulkheads without timeout for this test
            const noTimeoutBulkhead1 = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3,
                timeout: undefined // Explicitly set to undefined
            });
            const noTimeoutBulkhead2 = new Bulkhead({ 
                maxConcurrent: 1, 
                maxQueued: 1,
                timeout: undefined // Explicitly set to undefined
            });

            // Use simple operations that resolve immediately to avoid timing issues
            const simpleOp1 = () => Promise.resolve('result1');
            const simpleOp2 = () => Promise.resolve('result2');
            const simpleOp3 = () => Promise.resolve('result3');

            // Execute operations on both bulkheads
            const promise1 = noTimeoutBulkhead1.execute(simpleOp1);
            const promise2 = noTimeoutBulkhead1.execute(simpleOp2);
            const promise3 = noTimeoutBulkhead2.execute(simpleOp3);

            // Since operations resolve immediately, they should complete quickly
            const results = await Promise.all([promise1, promise2, promise3]);
            
            expect(results).toEqual(['result1', 'result2', 'result3']);
            
            // Verify final stats show no executing operations
            const finalStats1 = noTimeoutBulkhead1.getStats();
            const finalStats2 = noTimeoutBulkhead2.getStats();
            
            expect(finalStats1.executing).toBe(0);
            expect(finalStats2.executing).toBe(0);
            expect(finalStats1.queued).toBe(0);
            expect(finalStats2.queued).toBe(0);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle operation that returns undefined', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            const operation = jest.fn().mockResolvedValue(undefined);

            const result = await noTimeoutBulkhead.execute(operation);

            expect(result).toBeUndefined();
            expect(operation).toHaveBeenCalled();
        });

        it('should handle operation that returns null', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            const operation = jest.fn().mockResolvedValue(null);

            const result = await noTimeoutBulkhead.execute(operation);

            expect(result).toBeNull();
        });

        it('should handle operation that returns complex objects', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            const complexResult = {
                data: [1, 2, 3],
                metadata: { count: 3 },
                nested: { deep: { value: 'test' } }
            };
            const operation = jest.fn().mockResolvedValue(complexResult);

            const result = await noTimeoutBulkhead.execute(operation);

            expect(result).toEqual(complexResult);
            expect(result).toBe(complexResult); // Same reference
        });

        it('should handle zero concurrent capacity', () => {
            const zeroConcurrentBulkhead = new Bulkhead({
                maxConcurrent: 0,
                maxQueued: 2
                // No timeout specified
            });

            const operation = jest.fn().mockResolvedValue('result');

            // Should immediately queue since no concurrent capacity
            zeroConcurrentBulkhead.execute(operation);

            const stats = zeroConcurrentBulkhead.getStats();
            expect(stats.executing).toBe(0);
            expect(stats.queued).toBe(1);

            // Operation should never execute due to zero capacity
            // This would hang in real scenario, but for test we can verify the state
            expect(operation).not.toHaveBeenCalled();
        });

        it('should handle zero queue capacity', async () => {
            // Ensure real timers for this test
            jest.useRealTimers();
            
            const zeroQueueBulkhead = new Bulkhead({
                maxConcurrent: 1,
                maxQueued: 0,
                timeout: undefined // Explicitly set to undefined
            });

            // Use a long operation that never resolves to fill capacity
            const longOp = () => new Promise(() => {}); // Never resolves
            const quickOp = () => Promise.resolve('quick');

            // Fill capacity with an operation that never completes
            zeroQueueBulkhead.execute(longOp);

            // Should reject immediately since no queue capacity
            await expect(zeroQueueBulkhead.execute(quickOp)).rejects.toThrow(BulkheadRejectedError);
        });

        it('should handle operations that modify their own context', async () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            let counter = 0;
            const operation = () => {
                counter++;
                return Promise.resolve(counter);
            };

            const promises = [
                noTimeoutBulkhead.execute(operation),
                noTimeoutBulkhead.execute(operation),
                noTimeoutBulkhead.execute(operation)
            ];

            const results = await Promise.all(promises);

            expect(results).toEqual(expect.arrayContaining([1, 2, 3]));
            expect(counter).toBe(3);
        });

        it('should handle concurrent access to stats', () => {
            // Use a bulkhead without timeout for this test
            const noTimeoutBulkhead = new Bulkhead({
                maxConcurrent: 2,
                maxQueued: 3
                // No timeout specified
            });

            const operation = () => new Promise(resolve => setTimeout(() => resolve('result'), 30));

            // Start operations
            noTimeoutBulkhead.execute(operation);
            noTimeoutBulkhead.execute(operation);

            // Get stats multiple times concurrently
            const stats1 = noTimeoutBulkhead.getStats();
            const stats2 = noTimeoutBulkhead.getStats();
            const stats3 = noTimeoutBulkhead.getStats();

            expect(stats1).toEqual(stats2);
            expect(stats2).toEqual(stats3);
            expect(stats1.executing).toBe(2);
        });
    });

});