import { HealthMonitor } from '../../src/core/HealthMonitor';

describe('HealthMonitor', () => {
    let healthMonitor: HealthMonitor;
    let mockHealthCheck1: jest.Mock<Promise<boolean>>;
    let mockHealthCheck2: jest.Mock<Promise<boolean>>;
    let mockHealthCheck3: jest.Mock<Promise<boolean>>;

    beforeEach(() => {
        healthMonitor = new HealthMonitor(100); // 100ms interval for faster tests
        mockHealthCheck1 = jest.fn();
        mockHealthCheck2 = jest.fn();
        mockHealthCheck3 = jest.fn();
        jest.useFakeTimers();
        
        // Mock console.error to avoid noise in tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        healthMonitor.stop();
        jest.useRealTimers();
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create health monitor with default interval', () => {
            const monitor = new HealthMonitor();
            expect(monitor).toBeInstanceOf(HealthMonitor);
        });

        it('should create health monitor with custom interval', () => {
            const monitor = new HealthMonitor(5000);
            expect(monitor).toBeInstanceOf(HealthMonitor);
        });
    });

    describe('registerHealthCheck', () => {
        it('should register a health check', () => {
            mockHealthCheck1.mockResolvedValue(true);
            
            expect(() => {
                healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            }).not.toThrow();
        });

        it('should register multiple health checks', () => {
            mockHealthCheck1.mockResolvedValue(true);
            mockHealthCheck2.mockResolvedValue(true);
            
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            healthMonitor.registerHealthCheck('service2', mockHealthCheck2);
            
            expect(healthMonitor.getStatus().size).toBe(0); // No checks run yet
        });

        it('should allow overwriting existing health check', () => {
            mockHealthCheck1.mockResolvedValue(true);
            mockHealthCheck2.mockResolvedValue(false);
            
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            healthMonitor.registerHealthCheck('service1', mockHealthCheck2);
            
            // Only the second check should be registered
            expect(() => {
                healthMonitor.registerHealthCheck('service1', mockHealthCheck2);
            }).not.toThrow();
        });
    });

    describe('start and stop', () => {
        it('should start health monitoring', () => {
            mockHealthCheck1.mockResolvedValue(true);
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            
            healthMonitor.start();
            
            // Advance time to trigger health check
            jest.advanceTimersByTime(100);
            
            expect(mockHealthCheck1).toHaveBeenCalled();
        });

        it('should not start multiple intervals', () => {
            mockHealthCheck1.mockResolvedValue(true);
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            
            healthMonitor.start();
            healthMonitor.start(); // Second start should be ignored
            
            jest.advanceTimersByTime(100);
            
            expect(mockHealthCheck1).toHaveBeenCalledTimes(1);
        });

        it('should stop health monitoring', () => {
            mockHealthCheck1.mockResolvedValue(true);
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            expect(mockHealthCheck1).toHaveBeenCalledTimes(1);
            
            healthMonitor.stop();
            jest.advanceTimersByTime(100);
            
            // Should not be called again after stop
            expect(mockHealthCheck1).toHaveBeenCalledTimes(1);
        });

        it('should handle stop when not started', () => {
            expect(() => {
                healthMonitor.stop();
            }).not.toThrow();
        });
    });

    describe('health check execution', () => {
        beforeEach(() => {
            mockHealthCheck1.mockResolvedValue(true);
            mockHealthCheck2.mockResolvedValue(false);
            mockHealthCheck3.mockRejectedValue(new Error('Health check failed'));
            
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            healthMonitor.registerHealthCheck('service2', mockHealthCheck2);
            healthMonitor.registerHealthCheck('service3', mockHealthCheck3);
        });

        it('should execute all registered health checks', async () => {
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            
            // Wait for async operations to complete
            await new Promise(resolve => setImmediate(resolve));
            
            expect(mockHealthCheck1).toHaveBeenCalled();
            expect(mockHealthCheck2).toHaveBeenCalled();
            expect(mockHealthCheck3).toHaveBeenCalled();
        });

        it('should update status based on health check results', async () => {
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            
            // Wait for async operations to complete
            await new Promise(resolve => setImmediate(resolve));
            
            const status = healthMonitor.getStatus();
            expect(status.get('service1')).toBe(true);
            expect(status.get('service2')).toBe(false);
            expect(status.get('service3')).toBe(false); // Failed check should be false
        });

        it('should handle health check errors gracefully', async () => {
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            
            // Wait for async operations to complete
            await new Promise(resolve => setImmediate(resolve));
            
            expect(console.error).toHaveBeenCalledWith(
                'Health check failed for service3:',
                expect.any(Error)
            );
            
            const status = healthMonitor.getStatus();
            expect(status.get('service3')).toBe(false);
        });

        it('should continue checking after errors', async () => {
            healthMonitor.start();
            
            // First check
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            // Second check
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            expect(mockHealthCheck1).toHaveBeenCalledTimes(2);
            expect(mockHealthCheck2).toHaveBeenCalledTimes(2);
            expect(mockHealthCheck3).toHaveBeenCalledTimes(2);
        });
    });

    describe('getStatus', () => {
        it('should return empty status when no checks are registered', () => {
            const status = healthMonitor.getStatus();
            expect(status.size).toBe(0);
        });

        it('should return empty status before any checks are run', () => {
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            
            const status = healthMonitor.getStatus();
            expect(status.size).toBe(0);
        });

        it('should return current status after checks are run', async () => {
            mockHealthCheck1.mockResolvedValue(true);
            mockHealthCheck2.mockResolvedValue(false);
            
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            healthMonitor.registerHealthCheck('service2', mockHealthCheck2);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            const status = healthMonitor.getStatus();
            expect(status.size).toBe(2);
            expect(status.get('service1')).toBe(true);
            expect(status.get('service2')).toBe(false);
        });

        it('should return a copy of the status map', async () => {
            mockHealthCheck1.mockResolvedValue(true);
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            const status1 = healthMonitor.getStatus();
            const status2 = healthMonitor.getStatus();
            
            expect(status1).not.toBe(status2); // Different instances
            expect(status1.get('service1')).toBe(status2.get('service1')); // Same values
        });
    });

    describe('isHealthy', () => {
        it('should return true when no checks are registered', () => {
            expect(healthMonitor.isHealthy()).toBe(true);
        });

        it('should return true when no checks have been run', () => {
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            expect(healthMonitor.isHealthy()).toBe(true);
        });

        it('should return true when all checks pass', async () => {
            mockHealthCheck1.mockResolvedValue(true);
            mockHealthCheck2.mockResolvedValue(true);
            
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            healthMonitor.registerHealthCheck('service2', mockHealthCheck2);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            expect(healthMonitor.isHealthy()).toBe(true);
        });

        it('should return false when any check fails', async () => {
            mockHealthCheck1.mockResolvedValue(true);
            mockHealthCheck2.mockResolvedValue(false);
            
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            healthMonitor.registerHealthCheck('service2', mockHealthCheck2);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            expect(healthMonitor.isHealthy()).toBe(false);
        });

        it('should return false when any check throws an error', async () => {
            mockHealthCheck1.mockResolvedValue(true);
            mockHealthCheck2.mockRejectedValue(new Error('Check failed'));
            
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            healthMonitor.registerHealthCheck('service2', mockHealthCheck2);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            expect(healthMonitor.isHealthy()).toBe(false);
        });
    });

    describe('periodic execution', () => {
        it('should execute health checks at specified intervals', async () => {
            mockHealthCheck1.mockResolvedValue(true);
            healthMonitor.registerHealthCheck('service1', mockHealthCheck1);
            
            healthMonitor.start();
            
            // First execution
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            expect(mockHealthCheck1).toHaveBeenCalledTimes(1);
            
            // Second execution
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            expect(mockHealthCheck1).toHaveBeenCalledTimes(2);
            
            // Third execution
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            expect(mockHealthCheck1).toHaveBeenCalledTimes(3);
        });

        it('should handle slow health checks without overlapping', async () => {
            let resolveCheck: (value: boolean) => void;
            const slowCheck = jest.fn(() => new Promise<boolean>(resolve => {
                resolveCheck = resolve;
            }));
            
            healthMonitor.registerHealthCheck('slow-service', slowCheck);
            healthMonitor.start();
            
            // Start first check
            jest.advanceTimersByTime(100);
            expect(slowCheck).toHaveBeenCalledTimes(1);
            
            // Advance time for second interval while first is still running
            jest.advanceTimersByTime(100);
            expect(slowCheck).toHaveBeenCalledTimes(2); // Should start second check
            
            // Resolve first check
            resolveCheck!(true);
            await new Promise(resolve => setImmediate(resolve));
        });
    });

    describe('edge cases', () => {
        it('should handle health checks that return non-boolean values', async () => {
            const weirdCheck = jest.fn().mockResolvedValue('not a boolean' as any);
            healthMonitor.registerHealthCheck('weird-service', weirdCheck);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            const status = healthMonitor.getStatus();
            expect(status.get('weird-service')).toBe('not a boolean');
        });

        it('should handle health checks that return promises of non-boolean values', async () => {
            const weirdCheck = jest.fn().mockResolvedValue(42 as any);
            healthMonitor.registerHealthCheck('weird-service', weirdCheck);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            const status = healthMonitor.getStatus();
            expect(status.get('weird-service')).toBe(42);
        });

        it('should handle health checks that throw synchronously', async () => {
            const throwingCheck = jest.fn(() => {
                throw new Error('Sync error');
            });
            
            healthMonitor.registerHealthCheck('throwing-service', throwingCheck);
            
            healthMonitor.start();
            jest.advanceTimersByTime(100);
            await new Promise(resolve => setImmediate(resolve));
            
            expect(console.error).toHaveBeenCalledWith(
                'Health check failed for throwing-service:',
                expect.any(Error)
            );
            
            const status = healthMonitor.getStatus();
            expect(status.get('throwing-service')).toBe(false);
        });
    });
});