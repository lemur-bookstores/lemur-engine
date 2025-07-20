// 1. Definir interfaces para las configuraciones
export interface RetryConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    timeout: number;
    backoffStrategy?: 'exponential' | 'linear' | 'fixed';
}

export interface BulkheadConfig {
    maxConcurrent: number;
    maxQueued: number;
    timeout: number;
    rejectionStrategy?: 'throw' | 'queue' | 'drop';
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
    enabled: boolean;
}

export interface ErrorHandlerConfig {
    console: {
        enabled: boolean;
        level: 'error' | 'warn' | 'info' | 'debug';
    };
    file: {
        enabled: boolean;
        path: string;
        maxSize: string;
        maxFiles: number;
    };
    metrics: {
        enabled: boolean;
        storage: 'console' | 'file' | 'database';
        aggregationInterval: number;
    };
}

export interface PluginConfig {
    autoload: {
        enabled: boolean;
        directories: string[];
        patterns: string[];
        watchMode: boolean;
    };
    initialization: {
        parallel: boolean;
        timeout: number;
        failureStrategy: 'fail-fast' | 'continue' | 'retry';
    };
}

export interface KernelConfig {
    environment: 'development' | 'staging' | 'production';
    retry: RetryConfig;
    bulkhead: BulkheadConfig;
    circuitBreaker: CircuitBreakerConfig;
    errorHandler: ErrorHandlerConfig;
    plugin: PluginConfig;
    logging: {
        level: 'error' | 'warn' | 'info' | 'debug';
        format: 'json' | 'text';
        destination: 'console' | 'file' | 'both';
    };
    events: {
        maxListeners: number;
        asyncTimeout: number;
    };
}

// 2. Configuraciones por defecto
export const defaultKernelConfig: KernelConfig = {
    environment: 'development',
    retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        timeout: 30000,
        backoffStrategy: 'exponential'
    },
    bulkhead: {
        maxConcurrent: 10,
        maxQueued: 20,
        timeout: 5000,
        rejectionStrategy: 'throw'
    },
    circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 10000,
        enabled: true
    },
    errorHandler: {
        console: {
            enabled: true,
            level: 'error'
        },
        file: {
            enabled: true,
            path: './logs',
            maxSize: '10MB',
            maxFiles: 5
        },
        metrics: {
            enabled: true,
            storage: 'console',
            aggregationInterval: 5000
        }
    },
    plugin: {
        autoload: {
            enabled: true,
            directories: ['./plugins'],
            patterns: ['**/*.plugin.js', '**/*.plugin.ts'],
            watchMode: false
        },
        initialization: {
            parallel: false,
            timeout: 30000,
            failureStrategy: 'fail-fast'
        }
    },
    logging: {
        level: 'info',
        format: 'text',
        destination: 'console'
    },
    events: {
        maxListeners: 100,
        asyncTimeout: 5000
    }
};