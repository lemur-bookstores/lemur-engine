import path from 'path';
import { Plugin } from './PluginInterfaces';
import { Kernel } from '../Kernel';
import { PluginLoader } from './PluginLoader';
import { EventBus } from '../EventBus';

export class PluginAutoloader {
    private kernel: Kernel;
    private pluginLoader: PluginLoader;
    private eventBus: EventBus;
    private pluginsPath: string;
    private autoloadTimeout: number;

    constructor(
        kernel: Kernel,
        eventBus: EventBus,
        pluginsPath: string = path.join(process.cwd(), 'plugins'),
        autoloadTimeout: number = 30000
    ) {
        this.kernel = kernel;
        this.eventBus = eventBus;
        this.pluginsPath = pluginsPath;
        this.autoloadTimeout = autoloadTimeout;
        this.pluginLoader = new PluginLoader(this.pluginsPath);
    }

    /**
     * Inicia la carga automática de plugins
     */
    async startAutoload(): Promise<void> {
        try {
            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'kernel.plugins.autoload.start',
                payload: { pluginsPath: this.pluginsPath },
                timestamp: new Date(),
                source: 'PluginAutoloader'
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Plugin autoload timeout')), this.autoloadTimeout);
            });

            const loadPromise = this.loadAndRegisterPlugins();
            await Promise.race([loadPromise, timeoutPromise]);

            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'kernel.plugins.autoload.complete',
                payload: { success: true },
                timestamp: new Date(),
                source: 'PluginAutoloader'
            });
        } catch (error) {
            await this.handleAutoloadError(error);
            throw error;
        }
    }

    /**
     * Carga y registra los plugins encontrados
     */
    private async loadAndRegisterPlugins(): Promise<void> {
        const loadedPlugins = await this.pluginLoader.loadPlugins();

        for (const [name, plugin] of loadedPlugins.entries()) {
            try {
                await this.validateAndRegisterPlugin(name, plugin);
            } catch (error) {
                await this.handlePluginError(name, error);
            }
        }
    }

    /**
     * Valida y registra un plugin individual
     */
    private async validateAndRegisterPlugin(name: string, plugin: Plugin): Promise<void> {
        // Validar dependencias y permisos antes de registrar
        if (await this.validatePluginRequirements(plugin)) {
            this.kernel.registerPlugin(plugin);

            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'kernel.plugin.registered',
                payload: {
                    name,
                    version: plugin.metadata.version,
                    dependencies: plugin.metadata.dependencies
                },
                timestamp: new Date(),
                source: 'PluginAutoloader'
            });
        }
    }

    /**
     * Valida los requerimientos del plugin
     */
    private async validatePluginRequirements(plugin: Plugin): Promise<boolean> {
        const dependenciesValid = await this.validateDependencies(plugin);
        const permissionsValid = await this.validatePermissions(plugin);

        return dependenciesValid && permissionsValid;
    }

    /**
     * Valida las dependencias del plugin
     */
    private async validateDependencies(plugin: Plugin): Promise<boolean> {
        if (!plugin.metadata.dependencies?.length) {
            return true;
        }

        const loadedPlugins = this.kernel.getPlugins();
        return plugin.metadata.dependencies.every(dep => loadedPlugins.has(dep));
    }

    /**
     * Valida los permisos del plugin
     */
    private async validatePermissions(_plugin: Plugin): Promise<boolean> {
        // Implementar validación de permisos según las reglas del sistema
        return true;
    }

    /**
     * Maneja errores de carga de plugins individuales
     */
    private async handlePluginError(pluginName: string, error: any): Promise<void> {
        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'kernel.plugin.load.error',
            payload: {
                pluginName,
                error: error.message
            },
            timestamp: new Date(),
            source: 'PluginAutoloader'
        });
    }

    /**
     * Maneja errores generales del proceso de autoload
     */
    private async handleAutoloadError(error: any): Promise<void> {
        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'kernel.plugins.autoload.error',
            payload: {
                error: error.message
            },
            timestamp: new Date(),
            source: 'PluginAutoloader'
        });
    }
}
