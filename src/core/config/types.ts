// 1. Definir interfaces para las configuraciones
export interface RetryConfig {
    maxAttempts: number;
    delay: number;
    backoffFactor: number;
    retryableErrors?: string[];
    initialDelay?: number;
    maxDelay?: number;
    timeout?: number;
    backoffStrategy?: 'exponential' | 'linear' | 'fixed';
}

export interface BulkheadConfig {
    maxConcurrent: number;
    maxQueueSize: number;
    queueTimeout: number;
    maxQueued?: number;
    timeout?: number;
    rejectionStrategy?: 'throw' | 'queue' | 'drop';
}

export interface CircuitBreakerConfig {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
    halfOpenSuccessThreshold: number;
    failureCondition?: (error: Error) => boolean;
    monitoringPeriod?: number;
}

export interface ConsoleHandlerConfig {
    enabled: boolean;
    level?: 'error' | 'warn' | 'info' | 'debug'; // Opcional con valor por defecto
}

export interface FileHandlerConfig {
    enabled: boolean;
    path: string;
    maxSize?: string; // Opcional con valor por defecto
    maxFiles?: number; // Opcional con valor por defecto
}

export interface MetricsConfig {
    enabled: boolean;
    storage?: 'console' | 'file' | 'database'; // Opcional con valor por defecto
    aggregationInterval?: number; // Opcional con valor por defecto
}

export interface ErrorHandlerConfig {
    console: ConsoleHandlerConfig;
    file: FileHandlerConfig;
    metrics?: MetricsConfig; // Opcional
}

export interface AutoloadConfig {
    enabled: boolean;
    directories: string[];
    patterns?: string[];
    watchMode?: boolean;
}

export interface InitializationConfig {
    parallel?: boolean;
    timeout?: number;
    failureStrategy?: 'fail-fast' | 'continue' | 'retry';
}

export interface PluginMetadata {
    name: string;
    version: string;
    enabled: boolean;
    dependencies?: string[];
    config?: Record<string, any>;
}

export interface PluginConfig {
    metadata: PluginMetadata;
    autoload: AutoloadConfig;
    initialization?: InitializationConfig;
}

export interface LoggingConfig {
    level?: 'error' | 'warn' | 'info' | 'debug'; // Opcional con valor por defecto
    format?: 'json' | 'text'; // Opcional con valor por defecto
    destination?: 'console' | 'file' | 'both'; // Opcional con valor por defecto
}

export interface EventsConfig {
    maxListeners?: number; // Opcional con valor por defecto
    asyncTimeout?: number; // Opcional con valor por defecto
}

export interface MonitoringConfig {
    ai: {
        enabled: boolean;
        tokenTracking: {
            enabled: boolean;
            alertThresholds: {
                costPerHour: number;
                tokensPerMinute: number;
            };
        };
        latencyTracking: {
            enabled: boolean;
            alertThresholds: {
                averageLatency: number;
                p95Latency: number;
            };
        };
        contextQuality: {
            enabled: boolean;
            minimumScore: number;
            piiDetection: boolean;
            harmfulContentDetection: boolean;
        };
        mcpOperations: {
            enabled: boolean;
            alertThresholds: {
                errorRate: number;
                responseTime: number;
            };
        };
    };
    modelPerformance: {
        enabled: boolean;
        trackingWindow: number; // in hours
        alertThresholds: {
            successRate: number;
            averageLatency: number;
            costEfficiency: number;
        };
    };
    healthCheck: {
        enabled: boolean;
        interval: number; // in ms
        timeout: number; // in ms
    };
    reporting: {
        enabled: boolean;
        interval: number; // in ms
        destination: 'console' | 'file' | 'both';
        filePath?: string;
    };
}

export interface KernelConfig {
    environment: 'development' | 'staging' | 'production';
    version: string;
    retry: RetryConfig;
    plugins: PluginMetadata[];
    bulkhead: BulkheadConfig;
    circuitBreaker: CircuitBreakerConfig;
    errorHandler: ErrorHandlerConfig;
    pluginConfig: PluginConfig;
    logging: LoggingConfig;
    events?: EventsConfig;
    monitoring?: MonitoringConfig;
}

// 2. Configuraciones por defecto
export const defaultKernelConfig: KernelConfig = {
    environment: 'development',
    version: '1.0.0',
    retry: {
        maxAttempts: 3,
        delay: 1000,
        backoffFactor: 2,
        initialDelay: 1000,
        maxDelay: 5000,
        timeout: 30000,
        backoffStrategy: 'exponential'
    },
    bulkhead: {
        maxConcurrent: 10,
        maxQueueSize: 100,
        queueTimeout: 5000,
        maxQueued: 20,
        timeout: 5000,
        rejectionStrategy: 'throw'
    },
    circuitBreaker: {
        enabled: true,
        failureThreshold: 4,
        resetTimeout: 60000,
        halfOpenSuccessThreshold: 3,
        monitoringPeriod: 10000
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
    plugins: [],
    pluginConfig: {
        metadata: {
            name: 'default',
            version: '1.0.0',
            enabled: true
        },
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
    },
    monitoring: {
        ai: {
            enabled: true,
            tokenTracking: {
                enabled: true,
                alertThresholds: {
                    costPerHour: 10.0,
                    tokensPerMinute: 1000
                }
            },
            latencyTracking: {
                enabled: true,
                alertThresholds: {
                    averageLatency: 2000,
                    p95Latency: 5000
                }
            },
            contextQuality: {
                enabled: true,
                minimumScore: 0.7,
                piiDetection: true,
                harmfulContentDetection: true
            },
            mcpOperations: {
                enabled: true,
                alertThresholds: {
                    errorRate: 0.1,
                    responseTime: 3000
                }
            }
        },
        modelPerformance: {
            enabled: true,
            trackingWindow: 24,
            alertThresholds: {
                successRate: 0.95,
                averageLatency: 1500,
                costEfficiency: 0.8
            }
        },
        healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000
        },
        reporting: {
            enabled: true,
            interval: 300000,
            destination: 'console'
        }
    }
};