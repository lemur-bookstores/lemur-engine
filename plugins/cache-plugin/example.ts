import { CachePlugin } from './index';
import { ICacheService } from './interfaces';
import { Kernel } from '../../src/core/Kernel';

async function testPlugin() {
    try {
        // Crear y configurar el kernel
        const kernel = await Kernel.create();

        // Crear instancia del plugin
        const cachePlugin = new CachePlugin();

        // Registrar el plugin
        kernel.registerPlugin(cachePlugin);

        // Inicializar el kernel (esto inicializará el plugin)
        await kernel.initialize();

        // Obtener el servicio de caché del contenedor
        const cacheService = kernel.getServiceContainer().resolve<ICacheService>('cacheService');

        if (!cacheService) {
            throw 'Error: Obtener el servicio de caché del contenedor ("cacheService")';
        }

        // Usar el servicio
        await cacheService.set('test-key', { data: 'test-value' }, 60000); // TTL 1 minuto
        const value = await cacheService.get('test-key');
        console.log('Cached value:', value);

        const stats = await cacheService.getStats();
        console.log('Cache stats:', stats);

        // Limpiar
        await kernel.shutdown();
    } catch (error) {
        console.error('Test error:', error);
    }
}

// Ejecutar el test
testPlugin().catch(console.error);
