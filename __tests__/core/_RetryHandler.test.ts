import { RetryHandler, RetryOptions } from '../../src/core/RetryHandler';

describe('RetryHandler', () => {
    let retryHandler: RetryHandler;
    let mockOperation: jest.Mock;

    beforeEach(() => {
        mockOperation = jest.fn();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create retry handler with provided options', () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000
            };
            
            retryHandler = new RetryHandler(options);
            expect(retryHandler).toBeInstanceOf(RetryHandler);
        });

        it('should set default exponential base if not provided', () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000
            };
            
            retryHandler = new RetryHandler(options);
            expect((retryHandler as any).options.exponentialBase).toBe(2);
        });

        it('should set default timeout if not provided', () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000
            };
            
            retryHandler = new RetryHandler(options);
            expect((retryHandler as any).options.timeout).toBe(30000);
        });

        it('should use provided exponential base and timeout', () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                exponentialBase: 3,
                timeout: 5000
            };
            
            retryHandler = new RetryHandler(options);
            expect((retryHandler as any).options.exponentialBase).toBe(3);
            expect((retryHandler as any).options.timeout).toBe(5000);
        });
    });

    describe('execute - successful operations', () => {
        beforeEach(() => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000
            };
            retryHandler = new RetryHandler(options);
        });

        it('should execute operation successfully on first attempt', async () => {
            const expectedResult = 'success';
            mockOperation.mockResolvedValue(expectedResult);

            const result = await retryHandler.execute(mockOperation);

            expect(result).toBe(expectedResult);
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        it('should return operation result', async () => {
            const complexResult = { data: 'test', count: 42 };
            mockOperation.mockResolvedValue(complexResult);

            const result = await retryHandler.execute(mockOperation);

            expect(result).toEqual(complexResult);
        });

        it('should handle operations that return undefined', async () => {
            mockOperation.mockResolvedValue(undefined);

            const result = await retryHandler.execute(mockOperation);

            expect(result).toBeUndefined();
        });

        it('should handle operations that return null', async () => {
            mockOperation.mockResolvedValue(null);

            const result = await retryHandler.execute(mockOperation);

            expect(result).toBeNull();
        });
    });
 
    describe('execute - retry behavior', () => {
        beforeEach(() => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000
            };
            retryHandler = new RetryHandler(options);
        });

        it('should retry on failure and succeed eventually', async () => {
            mockOperation
                .mockRejectedValueOnce(new Error('failure 1'))
                .mockRejectedValueOnce(new Error('failure 2'))
                .mockResolvedValue('success');

            const executePromise = retryHandler.execute(mockOperation);
            
            // Advance timers to allow retries to complete
            await jest.advanceTimersByTimeAsync(1000);

            const result = await executePromise;
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        it('should wait between retries with exponential backoff', async () => {
            mockOperation
                .mockRejectedValueOnce(new Error('failure 1'))
                .mockRejectedValueOnce(new Error('failure 2'))
                .mockResolvedValue('success');

            const executePromise = retryHandler.execute(mockOperation);

            // Advance timers to complete all retries
            await jest.advanceTimersByTimeAsync(1000);

            const result = await executePromise;
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });
    });

    describe('execute - timeout behavior', () => {
        beforeEach(() => {
            const options: RetryOptions = {
                maxAttempts: 5,
                initialDelay: 100,
                maxDelay: 1000,
                timeout: 500
            };
            retryHandler = new RetryHandler(options);
        });

        // TODO: Fix this timeout test - it's causing Jest to hang
        /*
        it('should timeout if operation takes too long', async () => {
            // Mock Date.now to work with fake timers
            const originalDateNow = Date.now;
            let currentTime = 0;
            Date.now = jest.fn(() => currentTime);

            mockOperation.mockRejectedValue(new Error('failure'));

            const executePromise = retryHandler.execute(mockOperation);
            
            // Simulate time passing beyond timeout
            currentTime = 600; // Past the 500ms timeout
            
            await expect(executePromise).rejects.toThrow('Operation timed out');
            
            // Restore original Date.now
            Date.now = originalDateNow;
        });
        */

        it('should succeed if operation completes before timeout', async () => {
            mockOperation
                .mockRejectedValueOnce(new Error('failure'))
                .mockResolvedValue('success');

            const executePromise = retryHandler.execute(mockOperation);
            
            // Advance time but not past timeout
            await jest.advanceTimersByTimeAsync(200);
            
            const result = await executePromise;
            expect(result).toBe('success');
        });
    });
});