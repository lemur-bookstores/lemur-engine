import { KernelConfigBuilder } from '../../../src/core/config/builders/KernelConfigBuilder';

describe('KernelConfigBuilder', () => {
    let builder: KernelConfigBuilder;

    beforeEach(() => {
        builder = new KernelConfigBuilder();
    });

    describe('Basic Configuration', () => {
        it('should create a valid default configuration', () => {
            const config = builder.build();
            expect(config.environment).toBe('development');
            expect(config.retry).toBeDefined();
            expect(config.bulkhead).toBeDefined();
            expect(config.circuitBreaker).toBeDefined();
        });

        it('should allow environment change', () => {
            const config = builder
                .setEnvironment('production')
                .build();
            expect(config.environment).toBe('production');
        });
    });

    describe('Preset Configurations', () => {
        it('should create development configuration', () => {
            const config = KernelConfigBuilder.development().build();
            expect(config.environment).toBe('development');
            expect(config.logging.level).toBe('debug');
        });

        it('should create production configuration', () => {
            const config = KernelConfigBuilder.production().build();
            expect(config.environment).toBe('production');
            expect(config.logging.level).toBe('info');
            expect(config.errorHandler.console.level).toBe('error');
        });

        it('should create staging configuration', () => {
            const config = KernelConfigBuilder.staging().build();
            expect(config.environment).toBe('staging');
            expect(config.logging.destination).toBe('both');
        });
    });

    describe('Custom Configurations', () => {
        it('should allow custom retry configuration', () => {
            const config = builder
                .configureRetry({
                    maxAttempts: 5,
                    initialDelay: 2000,
                    maxDelay: 0,
                    timeout: 0
                })
                .build();

            expect(config.retry.maxAttempts).toBe(5);
            expect(config.retry.initialDelay).toBe(2000);
        });

        it('should allow custom error handler configuration', () => {
            const config = builder
                .configureErrorHandler(
                    { enabled: true, level: 'debug' },
                    { enabled: true, path: './custom.log' }
                )
                .build();

            expect(config.errorHandler.console.level).toBe('debug');
            expect(config.errorHandler.file.path).toBe('./custom.log');
        });
    });

    describe('Validation', () => {
        it('should throw error if required properties are missing', () => {
            const invalidBuilder = new KernelConfigBuilder();
            // @ts-ignore - Testing invalid state
            invalidBuilder['config'].retry = undefined;

            expect(() => invalidBuilder.build()).toThrow('Retry configuration must be specified');
        });
    });

    describe('Fluent Interface', () => {
        it('should support method chaining', () => {
            const config = builder
                .setEnvironment('production')
                .configureRetry({
                    maxAttempts: 5,
                    initialDelay: 1000,
                    maxDelay: 5000,
                    timeout: 30000
                })
                .configureLogging({ level: 'info' })
                .configureErrorHandler({ enabled: true })
                .build();

            expect(config.environment).toBe('production');
            expect(config.retry.maxAttempts).toBe(5);
            expect(config.logging.level).toBe('info');
            expect(config.errorHandler.console.enabled).toBe(true);
        });
    });
});
