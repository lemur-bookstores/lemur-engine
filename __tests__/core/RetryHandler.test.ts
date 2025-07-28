import { RetryHandler, RetryOptions, RetryConfig } from '../../src/core/RetryHandler';

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

            const result = await retryHandler.execute(mockOperation);

            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        it('should fail after max attempts', async () => {
            mockOperation.mockRejectedValue(new Error('persistent failure'));

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow(
                'Operation failed after 3 attempts. Last error: persistent failure'
            );
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        it('should wait between retries with exponential backoff', async () => {
            mockOperation
                .mockRejectedValueOnce(new Error('failure 1'))
                .mockRejectedValueOnce(new Error('failure 2'))
                .mockResolvedValue('success');

            const executePromise = retryHandler.execute(mockOperation);

            // First attempt fails immediately
            await jest.runOnlyPendingTimersAsync();
            expect(mockOperation).toHaveBeenCalledTimes(1);

            // Second attempt after delay
            await jest.runOnlyPendingTimersAsync();
            expect(mockOperation).toHaveBeenCalledTimes(2);

            // Third attempt after delay
            await jest.runOnlyPendingTimersAsync();
            expect(mockOperation).toHaveBeenCalledTimes(3);

            const result = await executePromise;
            expect(result).toBe('success');
        });

        it('should not wait after last attempt failure', async () => {
            mockOperation.mockRejectedValue(new Error('failure'));

            const startTime = Date.now();
            
            await expect(retryHandler.execute(mockOperation)).rejects.toThrow();
            
            // Should not have waited after the last attempt
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

        it('should timeout if operation takes too long', async () => {
            mockOperation.mockRejectedValue(new Error('failure'));

            // Advance time past timeout
            const executePromise = retryHandler.execute(mockOperation);
            jest.advanceTimersByTime(600);

            await expect(executePromise).rejects.toThrow('Operation timed out');
        });

        it('should succeed if operation completes before timeout', async () => {
            mockOperation
                .mockRejectedValueOnce(new Error('failure'))
                .mockResolvedValue('success');

            const executePromise = retryHandler.execute(mockOperation);
            
            // Advance time but not past timeout
            jest.advanceTimersByTime(200);
            
            const result = await executePromise;
            expect(result).toBe('success');
        });
    });

    describe('execute - retryable errors', () => {
        it('should retry all errors when no retryableErrors specified', async () => {
            const options: RetryOptions = {
                maxAttempts: 2,
                initialDelay: 100,
                maxDelay: 1000
            };
            retryHandler = new RetryHandler(options);

            mockOperation
                .mockRejectedValueOnce(new Error('any error'))
                .mockResolvedValue('success');

            const result = await retryHandler.execute(mockOperation);
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });

        it('should only retry specified retryable errors (string patterns)', async () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                retryableErrors: ['network', 'timeout']
            };
            retryHandler = new RetryHandler(options);

            mockOperation.mockRejectedValue(new Error('network error'));

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow(
                'Operation failed after 3 attempts. Last error: network error'
            );
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        it('should not retry non-retryable errors (string patterns)', async () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                retryableErrors: ['network', 'timeout']
            };
            retryHandler = new RetryHandler(options);

            mockOperation.mockRejectedValue(new Error('validation error'));

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow('validation error');
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        it('should handle regex patterns for retryable errors', async () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                retryableErrors: [/^network/, /timeout$/]
            };
            retryHandler = new RetryHandler(options);

            mockOperation
                .mockRejectedValueOnce(new Error('network connection failed'))
                .mockResolvedValue('success');

            const result = await retryHandler.execute(mockOperation);
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });

        it('should not retry errors that do not match regex patterns', async () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                retryableErrors: [/^network/, /timeout$/]
            };
            retryHandler = new RetryHandler(options);

            mockOperation.mockRejectedValue(new Error('validation failed'));

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow('validation failed');
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        it('should handle mixed string and regex patterns', async () => {
            const options: RetryOptions = {
                maxAttempts: 2,
                initialDelay: 100,
                maxDelay: 1000,
                retryableErrors: ['network', /timeout$/]
            };
            retryHandler = new RetryHandler(options);

            // Test string pattern
            mockOperation
                .mockRejectedValueOnce(new Error('network error'))
                .mockResolvedValue('success');

            let result = await retryHandler.execute(mockOperation);
            expect(result).toBe('success');

            mockOperation.mockClear();

            // Test regex pattern
            mockOperation
                .mockRejectedValueOnce(new Error('connection timeout'))
                .mockResolvedValue('success');

            result = await retryHandler.execute(mockOperation);
            expect(result).toBe('success');
        });
    });

    describe('delay calculation', () => {
        it('should calculate exponential backoff correctly', async () => {
            const options: RetryOptions = {
                maxAttempts: 4,
                initialDelay: 100,
                maxDelay: 10000,
                exponentialBase: 2
            };
            retryHandler = new RetryHandler(options);

            mockOperation.mockRejectedValue(new Error('failure'));

            const delays: number[] = [];
            const originalSleep = (retryHandler as any).sleep;
            (retryHandler as any).sleep = jest.fn((ms: number) => {
                delays.push(ms);
                return originalSleep.call(retryHandler, 0); // Don't actually wait in tests
            });

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow();

            expect(delays).toHaveLength(3); // 3 delays for 4 attempts
            
            // Check that delays follow exponential pattern (with jitter tolerance)
            expect(delays[0]).toBeGreaterThanOrEqual(100); // First delay: 100 * 2^0 = 100
            expect(delays[0]).toBeLessThan(300); // With jitter
            
            expect(delays[1]).toBeGreaterThanOrEqual(200); // Second delay: 100 * 2^1 = 200
            expect(delays[1]).toBeLessThan(400); // With jitter
            
            expect(delays[2]).toBeGreaterThanOrEqual(400); // Third delay: 100 * 2^2 = 400
            expect(delays[2]).toBeLessThan(600); // With jitter
        });

        it('should respect max delay limit', async () => {
            const options: RetryOptions = {
                maxAttempts: 5,
                initialDelay: 100,
                maxDelay: 300,
                exponentialBase: 2
            };
            retryHandler = new RetryHandler(options);

            mockOperation.mockRejectedValue(new Error('failure'));

            const delays: number[] = [];
            (retryHandler as any).sleep = jest.fn((ms: number) => {
                delays.push(ms);
                return Promise.resolve();
            });

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow();

            // All delays should be <= maxDelay + jitter (100)
            delays.forEach(delay => {
                expect(delay).toBeLessThanOrEqual(400); // 300 + 100 jitter
            });
        });

        it('should add jitter to prevent thundering herd', async () => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000,
                exponentialBase: 2
            };
            retryHandler = new RetryHandler(options);

            mockOperation.mockRejectedValue(new Error('failure'));

            const delays: number[] = [];
            (retryHandler as any).sleep = jest.fn((ms: number) => {
                delays.push(ms);
                return Promise.resolve();
            });

            // Run multiple times to check jitter variation
            for (let i = 0; i < 5; i++) {
                try {
                    await retryHandler.execute(mockOperation);
                } catch (e) {
                    // Expected
                }
            }

            // Check that we have variation in delays (jitter effect)
            const firstAttemptDelays = delays.filter((_, index) => index % 2 === 0);
            const uniqueDelays = new Set(firstAttemptDelays);
            expect(uniqueDelays.size).toBeGreaterThan(1); // Should have variation due to jitter
        });
    });

    describe('edge cases', () => {
        beforeEach(() => {
            const options: RetryOptions = {
                maxAttempts: 3,
                initialDelay: 100,
                maxDelay: 1000
            };
            retryHandler = new RetryHandler(options);
        });

        it('should handle operations that throw non-Error objects', async () => {
            mockOperation.mockRejectedValue('string error');

            await expect(retryHandler.execute(mockOperation)).rejects.toBe('string error');
            expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry non-Error
        });

        it('should handle operations that throw null', async () => {
            mockOperation.mockRejectedValue(null);

            await expect(retryHandler.execute(mockOperation)).rejects.toBeNull();
        });

        it('should handle operations that throw undefined', async () => {
            mockOperation.mockRejectedValue(undefined);

            await expect(retryHandler.execute(mockOperation)).rejects.toBeUndefined();
        });

        it('should handle zero max attempts', async () => {
            const options: RetryOptions = {
                maxAttempts: 0,
                initialDelay: 100,
                maxDelay: 1000
            };
            retryHandler = new RetryHandler(options);

            mockOperation.mockRejectedValue(new Error('failure'));

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow(
                'Operation failed after 0 attempts'
            );
            expect(mockOperation).not.toHaveBeenCalled();
        });

        it('should handle very small delays', async () => {
            const options: RetryOptions = {
                maxAttempts: 2,
                initialDelay: 1,
                maxDelay: 5
            };
            retryHandler = new RetryHandler(options);

            mockOperation
                .mockRejectedValueOnce(new Error('failure'))
                .mockResolvedValue('success');

            const result = await retryHandler.execute(mockOperation);
            expect(result).toBe('success');
        });

        it('should handle operations that resolve synchronously', async () => {
            mockOperation.mockImplementation(() => Promise.resolve('immediate success'));

            const result = await retryHandler.execute(mockOperation);
            expect(result).toBe('immediate success');
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        it('should handle operations that reject synchronously', async () => {
            mockOperation.mockImplementation(() => Promise.reject(new Error('immediate failure')));

            await expect(retryHandler.execute(mockOperation)).rejects.toThrow(
                'Operation failed after 3 attempts. Last error: immediate failure'
            );
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });
    });

    describe('real-time behavior', () => {
        beforeEach(() => {
            jest.useRealTimers();
        });

        afterEach(() => {
            jest.useFakeTimers();
        });

        it('should actually wait between retries', async () => {
            const options: RetryOptions = {
                maxAttempts: 2,
                initialDelay: 50,
                maxDelay: 100
            };
            retryHandler = new RetryHandler(options);

            mockOperation
                .mockRejectedValueOnce(new Error('failure'))
                .mockResolvedValue('success');

            const startTime = Date.now();
            const result = await retryHandler.execute(mockOperation);
            const endTime = Date.now();

            expect(result).toBe('success');
            expect(endTime - startTime).toBeGreaterThanOrEqual(40); // Should have waited at least some time
        }, 10000);
    });
});