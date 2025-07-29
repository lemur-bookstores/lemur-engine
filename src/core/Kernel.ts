import { EventBus } from './EventBus';
import { PluginRegistry } from './PluginManager';
import { ServiceContainer } from './ServiceContainer';
import { ConfigManager } from './ConfigManager';
import { CircuitBreaker } from './CircuitBreaker';
import { Plugin, KernelEvent } from '../types';
import { ErrorHandlerService } from './ErrorHandlerService';
import { ConsoleErrorHandler, LogErrorHandler, MetricsErrorHandler } from '../services/ErrorHandlers';
import { FileLogStorage, ConsoleMetricsStorage, InMemoryMetricsStorage } from '../services/storage/StorageImplementations';
import { KernelMediator } from './KernelMediator';
import {
    KernelState,
    KernelStateManager,
    RunningState,
    MaintenanceState,
    InitializingState,
    ShuttingDownState,
    ErrorState,
    IKernelState
} from './KernelState';
import { ConfigurationManager } from './ConfigurationFlyweight';
import { RetryHandler } from './RetryHandler';
import { Bulkhead } from './Bulkhead';
import { PluginAutoloader } from './plugins/PluginAutoloader';
import { defaultKernelConfig, KernelConfig } from './config/types';
import { ConfigLoader } from './config/ConfigLoader';
import { MetricsStorage } from './interfaces/storage';

export class Kernel {
    private config: KernelConfig;
    private eventBus!: EventBus;
    private pluginRegistry!: PluginRegistry;
    private serviceContainer!: ServiceContainer;
    private configManager!: ConfigManager;
    private circuitBreaker!: CircuitBreaker;
    private errorHandler!: ErrorHandlerService;
    private mediator!: KernelMediator;
    private configFlyweight!: ConfigurationManager;
    private stateManager!: KernelStateManager;
    private retryHandler!: RetryHandler;
    private bulkhead!: Bulkhead;
    private pluginAutoloader!: PluginAutoloader;
    private isInitialized = false;

    constructor(config?: KernelConfig) {
        this.config = config || defaultKernelConfig;
        this.initializeComponents();
        this.registerCoreServices();
        this.setupErrorHandlers();
    }

    private initializeComponents(): void {
        // Inicializar componentes core
        this.eventBus = new EventBus();
        this.pluginRegistry = new PluginRegistry();
        this.serviceContainer = new ServiceContainer();
        this.configManager = new ConfigManager();

        // Inicializar circuit breaker con configuración
        this.circuitBreaker = new CircuitBreaker(
            this.config.circuitBreaker.failureThreshold,
            this.config.circuitBreaker.resetTimeout
        );

        this.errorHandler = new ErrorHandlerService(this.eventBus);
        this.mediator = new KernelMediator();
        this.configFlyweight = new ConfigurationManager();

        // Crear state manager
        this.stateManager = new KernelStateManager();
        
        // Configurar los estados
        const initializingState = new InitializingState(this.stateManager);
        const runningState = new RunningState(this.stateManager);
        const maintenanceState = new MaintenanceState(this.stateManager);
        const shuttingDownState = new ShuttingDownState(this.stateManager);
        const errorState = new ErrorState(this.stateManager);
        
        // Registrar los estados
        this.stateManager.registerState(KernelState.INITIALIZING, initializingState);
        this.stateManager.registerState(KernelState.RUNNING, runningState);
        this.stateManager.registerState(KernelState.MAINTENANCE, maintenanceState);
        this.stateManager.registerState(KernelState.SHUTTING_DOWN, shuttingDownState);
        this.stateManager.registerState(KernelState.ERROR, errorState);

        // Inicializar patrones de resiliencia con configuración
        // this.retryHandler = new RetryHandler(this.config.retry); <- Corregir compatibilidad de interface
        // this.bulkhead = new Bulkhead(this.config.bulkhead); <- Corregir compatibilidad de interface
        this.retryHandler = new RetryHandler({
            maxAttempts: this.config.retry.maxAttempts,
            initialDelay: this.config.retry.initialDelay ?? 0,
            maxDelay: this.config.retry.maxDelay ?? 0,
            // exponentialBase: this.config.retry.exponentialBase,
            timeout: this.config.retry.timeout,
            retryableErrors: this.config.retry.retryableErrors,
        }); // this.config.retry

        this.bulkhead = new Bulkhead({
            maxConcurrent: this.config.bulkhead.maxConcurrent,
            maxQueued: this.config.bulkhead.maxQueued ?? 255,
            timeout: this.config.bulkhead.timeout,
        }); // this.config.bulkhead

        // Inicializar autoloader de plugins con configuración
        this.pluginAutoloader = new PluginAutoloader(this, this.eventBus);
    }

    private setupErrorHandlers(): void {
        const { errorHandler } = this.config;

        // Registrar manejadores según configuración
        if (errorHandler.console.enabled) {
            this.errorHandler.registerHandler(
                new ConsoleErrorHandler()
            );
        }

        if (errorHandler.file.enabled) {
            const logStorage = new FileLogStorage(
                errorHandler.file.path,
                // errorHandler.file.maxSize,
                // errorHandler.file.maxFiles
            );
            this.errorHandler.registerHandler(new LogErrorHandler(logStorage));
        }

        if (errorHandler?.metrics && errorHandler?.metrics?.enabled) {
            const metricsStorage = this.createMetricsStorage(errorHandler.metrics.storage || 'any');
            this.errorHandler.registerHandler(
                new MetricsErrorHandler(metricsStorage, /*errorHandler.metrics.aggregationInterval*/)
            );
        }
    }

    private createMetricsStorage(type: string): MetricsStorage {
        switch (type) {
            case 'console':
                return new ConsoleMetricsStorage();
            case 'file':
            // return new FileMetricsStorage('./metrics');
            case 'database':
            // return new DatabaseMetricsStorage();
            default:
                return new InMemoryMetricsStorage();
        }
    }

    // Método estático para crear Kernel con configuración externa
    static async create(configPath?: string): Promise<Kernel> {
        const config = await ConfigLoader.loadConfig(configPath);
        return new Kernel(config);
    }

    // Método para obtener la configuración actual
    getConfig(): KernelConfig {
        return { ...this.config };
    }

    private mergeConfigs(base: KernelConfig, override: Partial<KernelConfig>): KernelConfig {
        const result = { ...base };

        Object.entries(override).forEach(([key, value]) => {
            if (value !== undefined) {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Merge recursivo para objetos
                    result[key as keyof KernelConfig] = {
                        ...result[key as keyof KernelConfig] as any,
                        ...value
                    } as any;
                } else {
                    result[key as keyof KernelConfig] = value as any;
                }
            }
        });

        return result;
    }

    // Método para actualizar configuración en tiempo de ejecución
    async updateConfig(newConfig: Partial<KernelConfig>): Promise<void> {
        const configLoader = ConfigLoader.getInstance();
        const updatedConfig = this.mergeConfigs(this.config, newConfig);
        configLoader.validateConfig(updatedConfig);

        this.config = updatedConfig;

        // Reinicializar componentes que dependan de la configuración
        await this.reinitializeConfigurableComponents();

        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'kernel.config.updated',
            payload: { config: updatedConfig },
            timestamp: new Date(),
            source: 'Kernel'
        });
    }

    private async reinitializeConfigurableComponents(): Promise<void> {
        // Reinicializar componentes que dependan de la configuración
        // Esto podría requerir lógica específica para cada componente

        // Por ejemplo, reinicializar retry handler
        // this.retryHandler = new RetryHandler(this.config.retry);

        // Reinicializar bulkhead
        // this.bulkhead = new Bulkhead(this.config.bulkhead);

        // this.retryHandler = new RetryHandler(this.config.retry); <- Corregir compatibilidad de interface
        // this.bulkhead = new Bulkhead(this.config.bulkhead); <- Corregir compatibilidad de interface
        this.retryHandler = new RetryHandler({
            maxAttempts: this.config.retry.maxAttempts,
            initialDelay: this.config.retry.initialDelay ?? 0,
            maxDelay: this.config.retry.maxDelay ?? 0,
            // exponentialBase: this.config.retry.exponentialBase,
            timeout: this.config.retry.timeout,
            retryableErrors: this.config.retry.retryableErrors,
        }); // this.config.retry

        // Reregistrar en el service container
        this.serviceContainer.register('retryHandler', () => this.retryHandler);
        this.serviceContainer.register('bulkhead', () => this.bulkhead);
    }


    // private setupErrorHandlers(): void {
    //     // Registrar manejadores de errores predeterminados
    //     this.errorHandler.registerHandler(new ConsoleErrorHandler());

    //     // Crear implementaciones de almacenamiento
    //     const logStorage = new FileLogStorage('./logs');
    //     const metricsStorage = new ConsoleMetricsStorage();

    //     // Registrar handlers con sus respectivos almacenamientos
    //     this.errorHandler.registerHandler(new LogErrorHandler(logStorage));
    //     this.errorHandler.registerHandler(new MetricsErrorHandler(metricsStorage));
    // }

    private registerCoreServices(): void {
        this.serviceContainer.register('config', () => this.config);
        this.serviceContainer.register('eventBus', () => this.eventBus);
        this.serviceContainer.register('pluginRegistry', () => this.pluginRegistry);
        this.serviceContainer.register('configManager', () => this.configManager);
        this.serviceContainer.register('circuitBreaker', () => this.circuitBreaker);
        this.serviceContainer.register('errorHandler', () => this.errorHandler);
        this.serviceContainer.register('mediator', () => this.mediator);
        this.serviceContainer.register('stateManager', () => this.stateManager);
        this.serviceContainer.register('configFlyweight', () => this.configFlyweight);
        this.serviceContainer.register('retryHandler', () => this.retryHandler);
        this.serviceContainer.register('bulkhead', () => this.bulkhead);
    }

    /**
     * Inicializa el kernel y carga los plugins automáticamente
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            throw new Error('Kernel already initialized');
        }

        try {
            // Iniciar carga automática de plugins
            await this.pluginAutoloader.startAutoload();

            // Initialize plugins in dependency order
            const initOrder = this.pluginRegistry.getInitializationOrder();

            for (const pluginName of initOrder) {
                const plugin = this.pluginRegistry.get(pluginName);
                if (plugin) {
                    try {
                        await this.executePluginHook(plugin, 'onBeforeInitialize');

                        const oldStatus = plugin.status();
                        await this.circuitBreaker.execute(() => plugin.initialize(this));
                        await this.handlePluginStatusChange(plugin, oldStatus, plugin.status());

                        // Register plugin event handlers if available
                        if (plugin.getEventHandlers) {
                            const handlers = plugin.getEventHandlers();
                            handlers?.forEach(handler => {
                                // Auto-subscribe based on handler capabilities
                                this.eventBus.subscribe('*', handler);
                            });
                        }

                        await this.executePluginHook(plugin, 'onAfterInitialize');

                        await this.eventBus.publish({
                            id: crypto.randomUUID(),
                            type: 'kernel.plugin.initialized',
                            payload: { pluginName },
                            timestamp: new Date(),
                            source: 'Kernel'
                        });
                    } catch (error) {
                        await this.eventBus.publish({
                            id: crypto.randomUUID(),
                            type: 'kernel.plugin.initialization.failed',
                            payload: { pluginName, error: error instanceof Error ? error.message : 'Unknown error' },
                            timestamp: new Date(),
                            source: 'Kernel'
                        });
                        throw error;
                    }
                }
            }

            // Publicar evento de inicialización completada
            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'kernel.initialized',
                payload: { pluginCount: initOrder.length },
                timestamp: new Date(),
                source: 'Kernel'
            });

            this.isInitialized = true;

            // Cambiar estado a RUNNING
            await this.stateManager.getCurrentState().initialize();

        } catch (error: any) {
            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'kernel.initialization.failed',
                payload: { error: error.message },
                timestamp: new Date(),
                source: 'Kernel'
            });
            await this.errorHandler.handleError(error as Error);
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        if (!this.isInitialized) return;

        // Cambiar el estado del kernel a SHUTTING_DOWN
        await this.stateManager.getCurrentState().shutdown();

        const shutdownOrder = this.pluginRegistry.getInitializationOrder().reverse();

        for (const pluginName of shutdownOrder) {
            const plugin = this.pluginRegistry.get(pluginName);
            if (plugin) {
                try {
                    await this.executePluginHook(plugin, 'onBeforeShutdown');

                    const oldStatus = plugin.status();
                    await plugin.shutdown();
                    await this.handlePluginStatusChange(plugin, oldStatus, plugin.status());

                    await this.executePluginHook(plugin, 'onAfterShutdown');
                } catch (error) {
                    if (plugin.hooks?.onError) {
                        await plugin.hooks.onError(error as Error);
                    }
                    console.error(`Error shutting down plugin ${pluginName}:`, error);

                    await this.eventBus.publish({
                        id: crypto.randomUUID(),
                        type: 'kernel.plugin.shutdown.failed',
                        payload: { pluginName, error: error instanceof Error ? error.message : 'Unknown error' },
                        timestamp: new Date(),
                        source: 'Kernel'
                    });
                }
            }
        }

        this.isInitialized = false;

        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'kernel.shutdown',
            payload: {},
            timestamp: new Date(),
            source: 'Kernel'
        });
    }

    // Public API
    getEventBus(): EventBus { return this.eventBus; }
    getPluginRegistry(): PluginRegistry { return this.pluginRegistry; }
    getServiceContainer(): ServiceContainer { return this.serviceContainer; }
    getConfigManager(): ConfigManager { return this.configManager; }

    registerPlugin(plugin: Plugin): void {
        this.pluginRegistry.register(plugin);
    }

    async publishEvent<T>(event: Omit<KernelEvent<T>, 'id' | 'timestamp'>): Promise<void> {
        await this.eventBus.publish({
            ...event,
            id: crypto.randomUUID(),
            timestamp: new Date()
        });
    }

    // Método público para manejar errores
    async handleError(error: Error): Promise<void> {
        await this.errorHandler.handleError(error);
    }

    // Métodos públicos para gestión de estado
    async enterMaintenance(): Promise<void> {
        await this.stateManager.getCurrentState().enterMaintenance();
    }

    async exitMaintenance(): Promise<void> {
        await this.stateManager.getCurrentState().exitMaintenance();
    }

    getState(): KernelState {
        return this.stateManager.getCurrentStateEnum();
    }

    getCurrentStateHandler(): IKernelState {
        return this.stateManager.getCurrentState();
    }

    // Método para acceder al mediator
    getMediator(): KernelMediator {
        return this.mediator;
    }

    // Método para acceder a la configuración optimizada
    getConfigurationManager(): ConfigurationManager {
        return this.configFlyweight;
    }

    // Método para acceder al state manager
    getStateManager(): KernelStateManager {
        return this.stateManager;
    }

    // Métodos públicos para acceder a los patrones de resiliencia
    getRetryHandler(): RetryHandler {
        return this.retryHandler;
    }

    getBulkhead(): Bulkhead {
        return this.bulkhead;
    }

    /**
     * Retorna el mapa de plugins registrados
     */
    getPlugins(): Map<string, Plugin> {
        return this.pluginRegistry.getPlugins();
    }

    private async executePluginHook(
        plugin: Plugin,
        hookName: 'onBeforeInitialize' | 'onAfterInitialize' | 'onBeforeShutdown' | 'onAfterShutdown'
    ): Promise<void> {
        if (plugin.hooks?.[hookName]) {
            try {
                await plugin.hooks[hookName]();
            } catch (error) {
                // Si hay un hook de error, lo llamamos
                if (plugin.hooks?.onError) {
                    await plugin.hooks.onError(error as Error);
                }
                throw error; // Re-lanzamos el error para manejo superior
            }
        }
    }

    private async handlePluginStatusChange(plugin: Plugin, oldStatus: string, newStatus: string): Promise<void> {
        if (plugin.hooks?.onStatusChange) {
            await plugin.hooks.onStatusChange(oldStatus as any, newStatus as any);
        }
    }
}
