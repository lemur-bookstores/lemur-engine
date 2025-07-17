import { EventBus } from './EventBus';
import { PluginRegistry } from './PluginManager';
import { ServiceContainer } from './ServiceContainer';
import { ConfigManager } from './ConfigManager';
import { CircuitBreaker } from './CircuitBreaker';
import { Plugin, KernelEvent } from '../types';
import { ErrorHandlerService } from './ErrorHandlerService';
import { ConsoleErrorHandler, LogErrorHandler, MetricsErrorHandler } from '../services/ErrorHandlers';
import { FileLogStorage, ConsoleMetricsStorage } from '../services/storage/StorageImplementations';
import { KernelMediator } from './KernelMediator';
import {
    KernelState,
    KernelStateManager,
    RunningState,
    MaintenanceState,
    InitializingState,
    IKernelState
} from './KernelState';
import { ConfigurationManager } from './ConfigurationFlyweight';
import { RetryHandler } from './RetryHandler';
import { Bulkhead } from './Bulkhead';
import { PluginAutoloader } from './plugins/PluginAutoloader';

export class Kernel {
    private eventBus: EventBus;
    private pluginRegistry: PluginRegistry;
    private pluginAutoloader: PluginAutoloader;
    private serviceContainer: ServiceContainer;
    private configManager: ConfigManager;
    private circuitBreaker: CircuitBreaker;
    private errorHandler: ErrorHandlerService;
    private mediator: KernelMediator;
    private stateManager: KernelStateManager;
    private configFlyweight: ConfigurationManager;
    private isInitialized = false;
    private retryHandler: RetryHandler;
    private bulkhead: Bulkhead;

    constructor() {
        // Inicializar componentes core
        this.eventBus = new EventBus();
        this.pluginRegistry = new PluginRegistry();
        this.serviceContainer = new ServiceContainer();
        this.configManager = new ConfigManager();
        this.circuitBreaker = new CircuitBreaker();
        this.errorHandler = new ErrorHandlerService(this.eventBus);
        this.mediator = new KernelMediator();
        this.configFlyweight = new ConfigurationManager();

        // Crear state manager primero
        const stateHandlers = new Map();
        this.stateManager = new KernelStateManager(stateHandlers);

        // Luego configurar los estados
        stateHandlers.set(KernelState.INITIALIZING, new InitializingState(this.stateManager));
        stateHandlers.set(KernelState.RUNNING, new RunningState(this.stateManager));
        stateHandlers.set(KernelState.MAINTENANCE, new MaintenanceState(this.stateManager));

        // Inicializar patrones de resiliencia
        this.retryHandler = new RetryHandler({
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 30000
        });

        this.bulkhead = new Bulkhead({
            maxConcurrent: 10,
            maxQueued: 20,
            timeout: 5000
        });

        // Inicializar autoloader de plugins
        this.pluginAutoloader = new PluginAutoloader(this, this.eventBus);

        this.registerCoreServices();
        this.setupErrorHandlers();
    }

    private setupErrorHandlers(): void {
        // Registrar manejadores de errores predeterminados
        this.errorHandler.registerHandler(new ConsoleErrorHandler());

        // Crear implementaciones de almacenamiento
        const logStorage = new FileLogStorage('./logs');
        const metricsStorage = new ConsoleMetricsStorage();

        // Registrar handlers con sus respectivos almacenamientos
        this.errorHandler.registerHandler(new LogErrorHandler(logStorage));
        this.errorHandler.registerHandler(new MetricsErrorHandler(metricsStorage));
    }

    private registerCoreServices(): void {
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
                    await this.circuitBreaker.execute(() => plugin.initialize(this));

                    // Register plugin event handlers if available
                    if (plugin.getEventHandlers) {
                        const handlers = plugin.getEventHandlers();
                        handlers?.forEach(handler => {
                            // Auto-subscribe based on handler capabilities
                            this.eventBus.subscribe('*', handler);
                        });
                    }

                    await this.eventBus.publish({
                        id: crypto.randomUUID(),
                        type: 'kernel.plugin.initialized',
                        payload: { pluginName },
                        timestamp: new Date(),
                        source: 'Kernel'
                    });
                }
            }

            this.isInitialized = true;

            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'kernel.initialized',
                payload: { pluginCount: initOrder.length },
                timestamp: new Date(),
                source: 'Kernel'
            });

        } catch (error: any) {
            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'kernel.initialization.failed',
                payload: { error: error.message },
                timestamp: new Date(),
                source: 'Kernel'
            });
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        if (!this.isInitialized) return;

        const shutdownOrder = this.pluginRegistry.getInitializationOrder().reverse();

        for (const pluginName of shutdownOrder) {
            const plugin = this.pluginRegistry.get(pluginName);
            if (plugin) {
                try {
                    await plugin.shutdown();
                } catch (error) {
                    console.error(`Error shutting down plugin ${pluginName}:`, error);
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
}
