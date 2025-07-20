import { ConfigLoader } from './config/ConfigLoader';
import { KernelConfig } from './config/types';
import { EventBus } from './EventBus';
import { Kernel } from './Kernel';
import { KernelState } from './KernelState';
import { ServiceContainer } from './ServiceContainer';

export interface BootstrapOptions {
    configPath?: string;
    skipValidation?: boolean;
    preInitHooks?: Array<(kernel: Kernel) => Promise<void>>;
    postInitHooks?: Array<(kernel: Kernel) => Promise<void>>;
    errorStrategy?: 'fail-fast' | 'continue' | 'retry';
    initializationTimeout?: number;
}

export interface BootstrapResult {
    kernel: Kernel;
    config: KernelConfig;
    initializationTime: number;
    pluginsLoaded: number;
    warnings: string[];
    errors: string[];
}

export interface InitializationStep {
    name: string;
    description: string;
    execute: (context: InitializationContext) => Promise<void>;
    rollback?: (context: InitializationContext) => Promise<void>;
    timeout?: number;
    critical?: boolean;
}

export interface InitializationContext {
    kernel: Kernel;
    config: KernelConfig;
    eventBus: EventBus;
    serviceContainer: ServiceContainer;
    logger: any;
    metrics: Map<string, any>;
}

export class KernelBootstrap {
    private static instance: KernelBootstrap;
    private initializationSteps: InitializationStep[] = [];
    private executedSteps: InitializationStep[] = [];
    private logger: any;

    private constructor() {
        this.setupDefaultInitializationSteps();
        this.logger = console; // Temporalmente, luego se reemplazará por el logger configurado
    }

    static getInstance(): KernelBootstrap {
        if (!KernelBootstrap.instance) {
            KernelBootstrap.instance = new KernelBootstrap();
        }
        return KernelBootstrap.instance;
    }

    /**
     * Punto de entrada principal para crear e inicializar el kernel
     */
    async bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
        const startTime = Date.now();
        const warnings: string[] = [];
        const errors: string[] = [];

        try {
            // 1. Cargar configuración
            this.logger.info('Loading configuration...');
            const config = await this.loadConfiguration(options.configPath, options.skipValidation);

            // 2. Crear kernel
            this.logger.info('Creating kernel instance...');
            const kernel = new Kernel(config);

            // 3. Crear contexto de inicialización
            const context: InitializationContext = {
                kernel,
                config,
                eventBus: kernel.getEventBus(),
                serviceContainer: kernel.getServiceContainer(),
                logger: this.logger,
                metrics: new Map()
            };

            // 4. Ejecutar hooks pre-inicialización
            if (options.preInitHooks) {
                await this.executeHooks(options.preInitHooks, kernel, 'pre-initialization');
            }

            // 5. Ejecutar pasos de inicialización
            await this.executeInitializationSteps(context, options);

            // 6. Ejecutar hooks post-inicialización
            if (options.postInitHooks) {
                await this.executeHooks(options.postInitHooks, kernel, 'post-initialization');
            }

            // 7. Finalizar inicialización
            await this.finalizeInitialization(context);

            const endTime = Date.now();
            const initializationTime = endTime - startTime;

            this.logger.info(`Kernel bootstrapped successfully in ${initializationTime}ms`);

            return {
                kernel,
                config,
                initializationTime,
                pluginsLoaded: kernel.getPlugins().size,
                warnings,
                errors
            };

        } catch (error) {
            this.logger.error('Bootstrap failed:', error);

            // Intentar rollback si es posible
            await this.rollbackInitialization();

            throw new Error(`Kernel bootstrap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Configuración de los pasos de inicialización por defecto
     */
    private setupDefaultInitializationSteps(): void {
        this.initializationSteps = [
            {
                name: 'validate-environment',
                description: 'Validate runtime environment',
                execute: async (context) => {
                    await this.validateEnvironment(context);
                },
                timeout: 5000,
                critical: true
            },
            {
                name: 'setup-core-services',
                description: 'Setup core services and dependencies',
                execute: async (context) => {
                    await this.setupCoreServices(context);
                },
                rollback: async (context) => {
                    await this.cleanupCoreServices(context);
                },
                timeout: 10000,
                critical: true
            },
            {
                name: 'initialize-state-management',
                description: 'Initialize kernel state management',
                execute: async (context) => {
                    await this.initializeStateManagement(context);
                },
                timeout: 5000,
                critical: true
            },
            {
                name: 'setup-error-handling',
                description: 'Setup error handling system',
                execute: async (context) => {
                    await this.setupErrorHandling(context);
                },
                timeout: 5000,
                critical: true
            },
            {
                name: 'initialize-resilience-patterns',
                description: 'Initialize resilience patterns (Circuit Breaker, Retry, Bulkhead)',
                execute: async (context) => {
                    await this.initializeResiliencePatterns(context);
                },
                timeout: 5000,
                critical: true
            },
            {
                name: 'setup-plugin-system',
                description: 'Setup plugin registry and autoloader',
                execute: async (context) => {
                    await this.setupPluginSystem(context);
                },
                rollback: async (context) => {
                    await this.cleanupPluginSystem(context);
                },
                timeout: 10000,
                critical: true
            },
            {
                name: 'load-plugins',
                description: 'Load and initialize plugins',
                execute: async (context) => {
                    await this.loadPlugins(context);
                },
                rollback: async (context) => {
                    await this.unloadPlugins(context);
                },
                timeout: 30000,
                critical: false
            },
            {
                name: 'validate-system-integrity',
                description: 'Validate system integrity and dependencies',
                execute: async (context) => {
                    await this.validateSystemIntegrity(context);
                },
                timeout: 10000,
                critical: true
            }
        ];
    }

    /**
     * Cargar configuración usando el ConfigLoader
     */
    private async loadConfiguration(configPath?: string, skipValidation?: boolean): Promise<KernelConfig> {
        try {
            const config = await ConfigLoader.loadConfig(configPath);

            if (!skipValidation) {
                await this.validateConfiguration(config);
            }

            return config;
        } catch (error) {
            throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validar configuración específica del bootstrap
     */
    private async validateConfiguration(config: KernelConfig): Promise<void> {
        // Validaciones específicas del bootstrap
        if (config.plugin.initialization.timeout < 5000) {
            throw new Error('Plugin initialization timeout must be at least 5000ms');
        }

        if (config.environment === 'production' && config.logging.level === 'debug') {
            console.warn('Warning: Debug logging enabled in production environment');
        }

        // Validar que los directorios de plugins existan
        if (config.plugin.autoload.enabled) {
            const fs = await import('fs/promises');
            for (const dir of config.plugin.autoload.directories) {
                try {
                    await fs.access(dir);
                } catch {
                    throw new Error(`Plugin directory does not exist: ${dir}`);
                }
            }
        }
    }

    /**
     * Ejecutar pasos de inicialización
     */
    private async executeInitializationSteps(context: InitializationContext, options: BootstrapOptions): Promise<void> {
        // const timeout = options.initializationTimeout || 120000; // 2 minutos por defecto
        const errorStrategy = options.errorStrategy || 'fail-fast';

        for (const step of this.initializationSteps) {
            try {
                context.logger.info(`Executing step: ${step.name} - ${step.description}`);

                const stepStartTime = Date.now();

                // Ejecutar paso con timeout
                await this.executeStepWithTimeout(step, context, step.timeout || 30000);

                const stepEndTime = Date.now();
                const stepDuration = stepEndTime - stepStartTime;

                context.metrics.set(step.name, { duration: stepDuration, success: true });
                this.executedSteps.push(step);

                context.logger.info(`Step completed: ${step.name} (${stepDuration}ms)`);

                // Publicar evento de progreso
                await context.eventBus.publish({
                    id: crypto.randomUUID(),
                    type: 'kernel.bootstrap.step.completed',
                    payload: {
                        step: step.name,
                        duration: stepDuration,
                        totalSteps: this.initializationSteps.length,
                        completedSteps: this.executedSteps.length
                    },
                    timestamp: new Date(),
                    source: 'KernelBootstrap'
                });

            } catch (error) {
                context.logger.error(`Step failed: ${step.name}`, error);

                context.metrics.set(step.name, {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                // Publicar evento de error
                await context.eventBus.publish({
                    id: crypto.randomUUID(),
                    type: 'kernel.bootstrap.step.failed',
                    payload: {
                        step: step.name,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    },
                    timestamp: new Date(),
                    source: 'KernelBootstrap'
                });

                // Decidir qué hacer según la estrategia de error
                if (step.critical || errorStrategy === 'fail-fast') {
                    throw error;
                } else if (errorStrategy === 'retry') {
                    // Intentar el paso una vez más
                    try {
                        await this.executeStepWithTimeout(step, context, step.timeout || 30000);
                        this.executedSteps.push(step);
                        context.logger.info(`Step retried successfully: ${step.name}`);
                    } catch (retryError) {
                        if (step.critical) {
                            throw retryError;
                        }
                        context.logger.warn(`Step failed after retry: ${step.name}`, retryError);
                    }
                } else if (errorStrategy === 'continue') {
                    context.logger.warn(`Continuing despite step failure: ${step.name}`);
                }
            }
        }
    }

    /**
     * Ejecutar paso con timeout
     */
    private async executeStepWithTimeout(step: InitializationStep, context: InitializationContext, timeout: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Step timeout: ${step.name} exceeded ${timeout}ms`));
            }, timeout);

            step.execute(context)
                .then(() => {
                    clearTimeout(timer);
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Ejecutar hooks
     */
    private async executeHooks(hooks: Array<(kernel: Kernel) => Promise<void>>, kernel: Kernel, phase: string): Promise<void> {
        for (const hook of hooks) {
            try {
                await hook(kernel);
            } catch (error) {
                this.logger.error(`Hook failed during ${phase}:`, error);
                throw error;
            }
        }
    }

    /**
     * Rollback de inicialización
     */
    private async rollbackInitialization(): Promise<void> {
        this.logger.info('Starting rollback of initialization steps...');

        // Ejecutar rollback en orden inverso
        for (const step of this.executedSteps.reverse()) {
            if (step.rollback) {
                try {
                    this.logger.info(`Rolling back step: ${step.name}`);
                    // Nota: En un rollback, usamos un contexto mínimo
                    await step.rollback({} as InitializationContext);
                } catch (error) {
                    this.logger.error(`Rollback failed for step: ${step.name}`, error);
                }
            }
        }

        this.executedSteps = [];
        this.logger.info('Rollback completed');
    }

    /**
     * Finalizar inicialización
     */
    private async finalizeInitialization(context: InitializationContext): Promise<void> {
        // Cambiar estado del kernel a RUNNING
        await context.kernel.getStateManager().getCurrentState().exitMaintenance();

        // Publicar evento de inicialización completa
        await context.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'kernel.bootstrap.completed',
            payload: {
                totalSteps: this.initializationSteps.length,
                metrics: Object.fromEntries(context.metrics)
            },
            timestamp: new Date(),
            source: 'KernelBootstrap'
        });

        context.logger.info('Kernel bootstrap finalized successfully');
    }

    // ===== MÉTODOS DE IMPLEMENTACIÓN DE PASOS =====

    private async validateEnvironment(context: InitializationContext): Promise<void> {
        // Validar Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

        if (majorVersion < 16) {
            throw new Error(`Node.js version ${nodeVersion} is not supported. Minimum required: 16.x`);
        }

        // Validar memoria disponible
        const memoryUsage = process.memoryUsage();
        if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
            context.logger.warn('High memory usage detected during startup');
        }

        // Validar variables de entorno críticas
        const requiredEnvVars = context.config.environment === 'production'
            ? ['NODE_ENV', 'KERNEL_LOG_LEVEL']
            : [];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Required environment variable missing: ${envVar}`);
            }
        }
    }

    private async setupCoreServices(context: InitializationContext): Promise<void> {
        // Los servicios core ya están configurados en el Kernel
        // Aquí podríamos hacer validaciones adicionales o configuración específica

        // Validar que todos los servicios core estén registrados
        const requiredServices = [
            'eventBus', 'pluginRegistry', 'configManager', 'circuitBreaker',
            'errorHandler', 'mediator', 'stateManager', 'configFlyweight',
            'retryHandler', 'bulkhead'
        ];

        for (const service of requiredServices) {
            if (!context.serviceContainer.has(service)) {
                throw new Error(`Core service not registered: ${service}`);
            }
        }
    }

    private async cleanupCoreServices(context: InitializationContext): Promise<void> {
        // Limpiar servicios core si es necesario
        context.logger.info('Cleaning up core services...');
    }

    private async initializeStateManagement(context: InitializationContext): Promise<void> {
        // El state management ya está inicializado
        // Validar que esté en el estado correcto
        const currentState = context.kernel.getState();
        if (currentState !== KernelState.INITIALIZING) {
            throw new Error(`Invalid initial state: ${currentState}`);
        }
    }

    private async setupErrorHandling(context: InitializationContext): Promise<void> {
        // El error handling ya está configurado según la configuración
        // Aquí podríamos agregar validaciones o configuración adicional

        // Configurar el logger del bootstrap para usar el sistema de errores del kernel
        this.logger = {
            info: (message: string, ...args: any[]) => {
                console.log(`[INFO] ${message}`, ...args);
            },
            warn: (message: string, ...args: any[]) => {
                console.warn(`[WARN] ${message}`, ...args);
            },
            error: (message: string, ...args: any[]) => {
                console.error(`[ERROR] ${message}`, ...args);
                // También enviar al sistema de manejo de errores del kernel
                context.kernel.handleError(new Error(message));
            }
        };

        context.logger = this.logger;
    }

    private async initializeResiliencePatterns(context: InitializationContext): Promise<void> {
        // Validar que los patrones de resiliencia estén configurados correctamente
        const retryHandler = context.kernel.getRetryHandler();
        const bulkhead = context.kernel.getBulkhead();

        if (!retryHandler || !bulkhead) {
            throw new Error('Resilience patterns not properly initialized');
        }
    }

    private async setupPluginSystem(context: InitializationContext): Promise<void> {
        // El sistema de plugins ya está configurado
        // Validar configuración de autoloader
        if (context.config.plugin.autoload.enabled) {
            const directories = context.config.plugin.autoload.directories;
            if (directories.length === 0) {
                throw new Error('Plugin autoload enabled but no directories configured');
            }
        }
    }

    private async cleanupPluginSystem(context: InitializationContext): Promise<void> {
        // Limpiar sistema de plugins
        context.logger.info('Cleaning up plugin system...');
    }

    private async loadPlugins(context: InitializationContext): Promise<void> {
        // Delegar la carga de plugins al método initialize del kernel
        await context.kernel.initialize();
    }

    private async unloadPlugins(context: InitializationContext): Promise<void> {
        // Descargar plugins si es necesario
        await context.kernel.shutdown();
    }

    private async validateSystemIntegrity(context: InitializationContext): Promise<void> {
        // Validar integridad del sistema
        const pluginCount = context.kernel.getPlugins().size;
        const serviceCount = context.serviceContainer.size();

        context.logger.info(`System integrity check: ${pluginCount} plugins, ${serviceCount} services`);

        // Validar que al menos los servicios core estén disponibles
        if (serviceCount < 10) {
            throw new Error('Insufficient core services registered');
        }
    }

    // ===== MÉTODOS UTILITARIOS =====

    /**
     * Agregar paso de inicialización personalizado
     */
    addInitializationStep(step: InitializationStep, position?: number): void {
        if (position !== undefined) {
            this.initializationSteps.splice(position, 0, step);
        } else {
            this.initializationSteps.push(step);
        }
    }

    /**
     * Remover paso de inicialización
     */
    removeInitializationStep(stepName: string): void {
        this.initializationSteps = this.initializationSteps.filter(step => step.name !== stepName);
    }

    /**
     * Obtener métricas de inicialización
     */
    getInitializationMetrics(): Map<string, any> {
        const metrics = new Map();
        this.executedSteps.forEach(step => {
            metrics.set(step.name, { executed: true });
        });
        return metrics;
    }
}