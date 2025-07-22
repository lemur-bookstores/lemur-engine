import { KernelBootstrap, BootstrapOptions } from './src/core/KernelBootstrap';
import { randomUUID } from 'crypto';

async function main() {
    console.log('🚀 Iniciando Lemur Engine usando KernelBootstrap...\n');

    try {
        // Configurar opciones de bootstrap
        const bootstrapOptions: BootstrapOptions = {
            skipValidation: false,
            errorStrategy: 'fail-fast',
            initializationTimeout: 60000,
            preInitHooks: [
                async (_kernel) => {
                    console.log('🔧 Ejecutando hook pre-inicialización...');
                    // Aquí podrías hacer configuración adicional antes de la inicialización
                }
            ],
            postInitHooks: [
                async (_kernel) => {
                    console.log('🎯 Ejecutando hook post-inicialización...');
                    // Aquí podrías hacer configuración adicional después de la inicialización
                }
            ]
        };

        // Inicializar kernel usando KernelBootstrap
        console.log('⚙️  Inicializando kernel con KernelBootstrap...');
        const bootstrap = KernelBootstrap.getInstance();
        const result = await bootstrap.bootstrap(bootstrapOptions);

        console.log('✅ Kernel bootstrapped exitosamente!\n');

        // Mostrar información del resultado del bootstrap
        console.log('📊 Resultado del Bootstrap:');
        console.log(`   - Tiempo de inicialización: ${result.initializationTime}ms`);
        console.log(`   - Plugins cargados: ${result.pluginsLoaded}`);
        console.log(`   - Warnings: ${result.warnings.length}`);
        console.log(`   - Errors: ${result.errors.length}\n`);

        const { kernel, config } = result;

        console.log('📋 Configuración del Kernel:');
        console.log(`   - Entorno: ${config.environment}`);
        console.log(`   - Versión: ${config.version}`);
        console.log(`   - Retry máx intentos: ${config.retry.maxAttempts}`);
        console.log(`   - Bulkhead máx concurrente: ${config.bulkhead.maxConcurrent}`);
        console.log(`   - Circuit Breaker habilitado: ${config.circuitBreaker.enabled}\n`);

        // Mostrar información del kernel
        console.log('📊 Estado del Kernel:');
        console.log(`   - Estado: ${kernel.getState()}`);
        console.log(`   - Plugins activos: ${kernel.getPlugins().size}`);

        // Probar configuración en tiempo real
        console.log('\n🔄 Probando actualización de configuración...');
        await kernel.updateConfig({
            environment: 'production',
            retry: {
                ...config.retry,
                maxAttempts: 5
            }
        });

        const updatedConfig = kernel.getConfig();
        console.log(`   - Nuevo entorno: ${updatedConfig.environment}`);
        console.log(`   - Nuevos intentos máx: ${updatedConfig.retry.maxAttempts}`);

        console.log('\n🎯 Lemur Engine está listo para usar!');

        // Demostrar uso de algunos servicios del kernel
        console.log('\n⚡ Demostrando funcionalidades del kernel...');

        // EventBus
        const eventBus = kernel.getEventBus();

        // Suscribirse a eventos
        eventBus.subscribe('demo-event', {
            canHandle: (event) => event.type === 'demo-event',
            handle: async (event) => {
                console.log(`   📡 Evento recibido: ${JSON.stringify(event.payload)}`);
            }
        });

        // Publicar un evento
        await eventBus.publish({
            id: randomUUID(),
            type: 'demo-event',
            payload: { message: 'Hola desde el EventBus!' },
            timestamp: new Date(),
            source: 'demo'
        });

        // ServiceContainer
        const serviceContainer = kernel.getServiceContainer();
        console.log(`   🏗️  Servicios registrados: ${serviceContainer.size()}`);

        // Mostrar algunos servicios disponibles
        if (serviceContainer.has('config')) {
            console.log(`   ⚙️  Servicio 'config' disponible`);
        }
        if (serviceContainer.has('eventBus')) {
            console.log(`   📡 Servicio 'eventBus' disponible`);
        }
        if (serviceContainer.has('configManager')) {
            console.log(`   🔧 Servicio 'configManager' disponible`);
        }
        if (serviceContainer.has('pluginRegistry')) {
            console.log(`   🔌 Servicio 'pluginRegistry' disponible`);
        }
        if (serviceContainer.has('stateManager')) {
            console.log(`   📊 Servicio 'stateManager' disponible`);
        }

        // Simular algún trabajo
        console.log('\n💼 Simulando trabajo del kernel...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Shutdown graceful
        console.log('\n🛑 Deteniendo kernel...');
        await kernel.shutdown();
        console.log('✅ Kernel detenido exitosamente!');

    } catch (error) {
        console.error('❌ Error durante la ejecución:', error);
        process.exit(1);
    }
}

// Manejo de señales para shutdown graceful
process.on('SIGINT', () => {
    console.log('\n🛑 Señal SIGINT recibida, deteniendo kernel...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Señal SIGTERM recibida, deteniendo kernel...');
    process.exit(0);
});

main().catch(console.error);
