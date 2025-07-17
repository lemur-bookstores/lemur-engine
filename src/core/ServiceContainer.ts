type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

interface ServiceDescriptor {
    name: string;
    factory: () => any;
    lifetime: ServiceLifetime;
    instance?: any;
}

export class ServiceContainer {
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
