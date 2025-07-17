import { Kernel } from '../Kernel';
import { Plugin, PluginStatus } from '../plugins/PluginInterfaces';
import { jest } from '@jest/globals';

export class PluginTestFramework {
    private kernel: Kernel;

    constructor(kernel: Kernel) {
        this.kernel = kernel;
    }

    /**
     * Crea un mock de un plugin para testing
     */
    createMockPlugin(metadata: {
        name: string;
        version: string;
        dependencies?: string[];
    }): Plugin {
        return {
            metadata,
            status: () => PluginStatus.UNINITIALIZED,
            initialize: jest.fn().mockImplementation(() => Promise.resolve()) as unknown as (kernel: Kernel) => Promise<void>,
            shutdown: jest.fn().mockImplementation(() => Promise.resolve()) as unknown as () => Promise<void>
        };
    }

    /**
     * Simula el ciclo de vida completo de un plugin
     */
    async simulateLifecycle(plugin: Plugin): Promise<void> {
        await plugin.initialize(this.kernel);
        // Simular tiempo de ejecución
        await new Promise(resolve => setTimeout(resolve, 100));
        await plugin.shutdown();
    }

    /**
     * Helper para testing de dependencias
     */
    async validateDependencies(plugin: Plugin): Promise<boolean> {
        const deps = plugin.metadata.dependencies || [];
        const loadedPlugins = Array.from(this.kernel.getPlugins().keys());
        return deps.every(dep => loadedPlugins.includes(dep));
    }

    /**
     * Mock del contexto del plugin
     */
    createPluginContext(permissions: string[] = []) {
        return {
            getResource: jest.fn(),
            hasPermission: (permission: string) => permissions.includes(permission),
            logger: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn()
            }
        };
    }
}
