import {
    KernelConfig,
    RetryConfig,
    BulkheadConfig,
    CircuitBreakerConfig,
    PluginConfig
} from './types';

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    delay: 1000,
    backoffFactor: 2,
    initialDelay: 1000,
    maxDelay: 10000,
    timeout: 30000,
    backoffStrategy: 'exponential',
    retryableErrors: ['NetworkError', 'TimeoutError']
};

export const DEFAULT_BULKHEAD_CONFIG: BulkheadConfig = {
    maxConcurrent: 10,
    maxQueueSize: 100,
    queueTimeout: 5000,
    maxQueued: 100,
    timeout: 30000,
    rejectionStrategy: 'queue'
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
    enabled: true,
    failureThreshold: 5, // Number of consecutive failures before opening the circuit
    resetTimeout: 30000,
    halfOpenSuccessThreshold: 5,
    monitoringPeriod: 60000,
    failureCondition: (error: Error) => error.name !== 'BusinessError'
};

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
    metadata: {
        name: '',
        version: '1.0.0',
        enabled: false
    },
    autoload: {
        enabled: false,
        directories: []
    }
};

export const DEFAULT_KERNEL_CONFIG: KernelConfig = {
    environment: 'development',
    version: '1.0.0',
    retry: DEFAULT_RETRY_CONFIG,
    bulkhead: DEFAULT_BULKHEAD_CONFIG,
    circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
    plugins: [{
        name: 'default',
        version: '1.0.0',
        enabled: true,
        dependencies: [],
        config: {}
    }],
    pluginConfig: DEFAULT_PLUGIN_CONFIG,
    errorHandler: {
        console: {
            enabled: false,
            level: 'error'
        },
        file: {
            enabled: false,
            path: '',
            maxSize: '10mb',
            maxFiles: 5
        }
    },
    logging: {
        level: 'info',
        format: 'text',
        destination: 'console'
    }
};
