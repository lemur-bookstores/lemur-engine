import { Plugin, PluginMetadata, PluginStatus } from '../../src/core/plugins/PluginInterfaces';
import { Kernel } from '../../src/core/Kernel';
import { MemoryCacheService } from './cache-service';
import { CacheConfig } from './interfaces';
import { EventHandler, KernelEvent } from '../../src/types';

export class CachePlugin implements Plugin {
    private cacheService?: MemoryCacheService;
    private currentStatus: PluginStatus = PluginStatus.UNINITIALIZED;

    metadata: PluginMetadata = {
        name: 'example-cache-plugin',
        version: '1.0.0',
        description: 'Plugin de ejemplo que implementa un servicio de caché en memoria',
        author: 'Lemur Engine Team',
        tags: ['cache', 'memory', 'example']
    };

    hooks = {
        onBeforeInitialize: async () => {
            console.log('Cache plugin: preparing to initialize...');
        },
        onAfterInitialize: async () => {
            console.log('Cache plugin: initialization complete');
        },
        onBeforeShutdown: async () => {
            console.log('Cache plugin: preparing to shutdown...');
        },
        onAfterShutdown: async () => {
            console.log('Cache plugin: shutdown complete');
        },
        onError: async (error: Error) => {
            console.error('Cache plugin error:', error);
        },
        onStatusChange: async (oldStatus: PluginStatus, newStatus: PluginStatus) => {
            console.log(`Cache plugin: status changed from ${oldStatus} to ${newStatus}`);
        }
    };

    async initialize(kernel: Kernel): Promise<void> {
        try {
            this.currentStatus = PluginStatus.INITIALIZING;

            // Obtener la configuración del plugin
            const config: CacheConfig = {
                defaultTTL: 3600000, // 1 hora
                maxEntries: 1000,
                checkPeriod: 300000 // 5 minutos
            };

            // Crear el servicio de caché
            this.cacheService = new MemoryCacheService(
                kernel.getEventBus(),
                config
            );

            // Registrar el servicio en el contenedor
            kernel.getServiceContainer().register('cacheService', () => this.cacheService);

            this.currentStatus = PluginStatus.ACTIVE;
        } catch (error) {
            this.currentStatus = PluginStatus.ERROR;
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        this.currentStatus = PluginStatus.SHUTTING_DOWN;

        if (this.cacheService) {
            this.cacheService.dispose();
            this.cacheService = undefined;
        }

        this.currentStatus = PluginStatus.INACTIVE;
    }

    status(): PluginStatus {
        return this.currentStatus;
    }

    getEventHandlers(): EventHandler[] {
        return [{
            handle: function (event: KernelEvent<any>): any {
                // Aquí podrías implementar lógica adicional para los eventos de caché
                console.log(`Cache event received: ${event.type}`, event.payload);
            },
            canHandle: function (event: KernelEvent): boolean {
                throw new Error('Function not implemented.');
            }
        }];
    }
}
