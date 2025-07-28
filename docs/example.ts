// Micro-Kernel Architecture Implementation
// Combining Clean Architecture with Design Patterns

// ============================================================================
// CORE INTERFACES
// ============================================================================

interface KernelEvent<T = any> {
    id: string;
    type: string;
    payload: T;
    timestamp: Date;
    source: string;
    metadata?: Record<string, any>;
}

interface EventHandler<T = any> {
    handle(event: KernelEvent<T>): Promise<void>;
    canHandle(event: KernelEvent): boolean;
}

interface Plugin {
    name: string;
    version: string;
    dependencies?: string[];
    initialize(kernel: ExampleKernel): Promise<void>;
    shutdown(): Promise<void>;
    getEventHandlers(): EventHandler[];
}

// ============================================================================
// EVENT BUS IMPLEMENTATION
// ============================================================================

class EventBus {
    private handlers: Map<string, Set<EventHandler>> = new Map();
    private eventStore: KernelEvent[] = [];

    subscribe<T>(eventType: string, handler: EventHandler<T>): void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType)!.add(handler);
    }

    async publish<T>(event: KernelEvent<T>): Promise<void> {
        // Event Sourcing - Store all events
        this.eventStore.push(event);

        const handlers = this.handlers.get(event.type) || new Set();

        // Parallel execution with error isolation
        const promises = Array.from(handlers).map(async (handler) => {
            try {
                if (handler.canHandle(event)) {
                    await handler.handle(event);
                }
            } catch (error) {
                console.error(`Handler error for event ${event.type}:`, error);
                // Emit error event for monitoring
                this.publish({
                    id: crypto.randomUUID(),
                    type: 'kernel.error',
                    payload: { originalEvent: event, error },
                    timestamp: new Date(),
                    source: 'EventBus'
                });
            }
        });

        await Promise.all(promises);
    }

    getEventHistory(eventType?: string): KernelEvent[] {
        return eventType
            ? this.eventStore.filter(e => e.type === eventType)
            : [...this.eventStore];
    }
}

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

class PluginRegistry {
    private plugins: Map<string, Plugin> = new Map();
    private dependencyGraph: Map<string, string[]> = new Map();

    register(plugin: Plugin): void {
        this.plugins.set(plugin.name, plugin);
        this.dependencyGraph.set(plugin.name, plugin.dependencies || []);
    }

    get(name: string): Plugin | undefined {
        return this.plugins.get(name);
    }

    // Topological sort for dependency resolution
    getInitializationOrder(): string[] {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const result: string[] = [];

        const visit = (pluginName: string) => {
            if (visiting.has(pluginName)) {
                throw new Error(`Circular dependency detected: ${pluginName}`);
            }

            if (visited.has(pluginName)) return;

            visiting.add(pluginName);

            const dependencies = this.dependencyGraph.get(pluginName) || [];
            for (const dep of dependencies) {
                visit(dep);
            }

            visiting.delete(pluginName);
            visited.add(pluginName);
            result.push(pluginName);
        };

        for (const pluginName of this.plugins.keys()) {
            visit(pluginName);
        }

        return result;
    }
}

// ============================================================================
// DEPENDENCY INJECTION CONTAINER
// ============================================================================

type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

interface ServiceDescriptor {
    name: string;
    factory: () => any;
    lifetime: ServiceLifetime;
    instance?: any;
}

class ServiceContainer {
    private services: Map<string, ServiceDescriptor> = new Map();
    private scopedInstances: Map<string, any> = new Map();

    register<T>(
        name: string,
        factory: () => T,
        lifetime: ServiceLifetime = 'singleton'
    ): void {
        this.services.set(name, { name, factory, lifetime });
    }

    resolve<T>(name: string): T {
        const descriptor = this.services.get(name);
        if (!descriptor) {
            throw new Error(`Service ${name} not registered`);
        }

        switch (descriptor.lifetime) {
            case 'singleton':
                if (!descriptor.instance) {
                    descriptor.instance = descriptor.factory();
                }
                return descriptor.instance;

            case 'transient':
                return descriptor.factory();

            case 'scoped':
                if (!this.scopedInstances.has(name)) {
                    this.scopedInstances.set(name, descriptor.factory());
                }
                return this.scopedInstances.get(name);

            default:
                throw new Error(`Unknown lifetime: ${descriptor.lifetime}`);
        }
    }

    clearScope(): void {
        this.scopedInstances.clear();
    }
}

// ============================================================================
// CIRCUIT BREAKER PATTERN
// ============================================================================

class CircuitBreaker {
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    private failures = 0;
    private lastFailureTime = 0;

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000
    ) { }

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
        }
    }
}

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

interface ConfigProvider {
    get<T>(key: string): T | undefined;
    set(key: string, value: any): void;
    watch(key: string, callback: (value: any) => void): void;
}

class ConfigManager {
    private providers: ConfigProvider[] = [];
    private watchers: Map<string, ((value: any) => void)[]> = new Map();

    addProvider(provider: ConfigProvider): void {
        this.providers.push(provider);
    }

    get<T>(key: string): T | undefined {
        // Check providers in order of priority
        for (const provider of this.providers) {
            const value = provider.get<T>(key);
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }

    set(key: string, value: any): void {
        const [firstProvider] = this.providers;
        if (firstProvider) firstProvider.set(key, value);
        this.notifyWatchers(key, value);
    }

    watch(key: string, callback: (value: any) => void): void {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, []);
        }
        this.watchers.get(key)!.push(callback);
    }

    private notifyWatchers(key: string, value: any): void {
        const callbacks = this.watchers.get(key) || [];
        callbacks.forEach(callback => callback(value));
    }
}

// ============================================================================
// MAIN KERNEL IMPLEMENTATION
// ============================================================================

class ExampleKernel {
    private eventBus: EventBus;
    private pluginRegistry: PluginRegistry;
    private serviceContainer: ServiceContainer;
    private configManager: ConfigManager;
    private circuitBreaker: CircuitBreaker;
    private isInitialized = false;

    constructor() {
        this.eventBus = new EventBus();
        this.pluginRegistry = new PluginRegistry();
        this.serviceContainer = new ServiceContainer();
        this.configManager = new ConfigManager();
        this.circuitBreaker = new CircuitBreaker();

        this.registerCoreServices();
    }

    private registerCoreServices(): void {
        this.serviceContainer.register('eventBus', () => this.eventBus);
        this.serviceContainer.register('pluginRegistry', () => this.pluginRegistry);
        this.serviceContainer.register('configManager', () => this.configManager);
        this.serviceContainer.register('circuitBreaker', () => this.circuitBreaker);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            throw new Error('Kernel already initialized');
        }

        try {
            // Initialize plugins in dependency order
            const initOrder = this.pluginRegistry.getInitializationOrder();

            for (const pluginName of initOrder) {
                const plugin = this.pluginRegistry.get(pluginName);
                if (plugin) {
                    await this.circuitBreaker.execute(() => plugin.initialize(this));

                    // Register plugin event handlers
                    const handlers = plugin.getEventHandlers();
                    handlers.forEach(handler => {
                        // Auto-subscribe based on handler capabilities
                        this.eventBus.subscribe('*', handler);
                    });

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
                payload: { pluginCount: this.pluginRegistry.getInitializationOrder().length },
                timestamp: new Date(),
                source: 'Kernel'
            });

        } catch (error) {
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
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

// Example plugin implementation
class WebServerPlugin implements Plugin {
    name = 'webserver';
    version = '1.0.0';
    dependencies = ['logging', 'config'];

    async initialize(kernel: ExampleKernel): Promise<void> {
        const config = kernel.getConfigManager().get<any>('webserver') || { port: 3000 };
        console.log(`Web server initializing on port ${config.port}`);

        // Register as service
        kernel.getServiceContainer().register('webserver', () => ({
            start: () => console.log('Web server started'),
            stop: () => console.log('Web server stopped')
        }));
    }

    async shutdown(): Promise<void> {
        console.log('Web server shutting down');
    }

    getEventHandlers(): EventHandler[] {
        return [
            {
                canHandle: (event) => event.type === 'http.request',
                handle: async (event) => {
                    console.log('Handling HTTP request:', event.payload);
                }
            }
        ];
    }
}

// Usage example
async function main() {
    const kernel = new ExampleKernel();

    // Register plugins
    kernel.registerPlugin(new WebServerPlugin());

    // Initialize kernel
    await kernel.initialize();

    // Use the kernel
    await kernel.publishEvent({
        type: 'http.request',
        payload: { url: '/api/users', method: 'GET' },
        source: 'WebServer'
    });

    // Shutdown
    await kernel.shutdown();
}

export { ExampleKernel, Plugin, EventHandler, KernelEvent };