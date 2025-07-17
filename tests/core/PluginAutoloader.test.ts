import { PluginAutoloader } from '../../src/core/plugins/PluginAutoloader';
import { Kernel } from '../../src/core/Kernel';
import { EventBus } from '../../src/core/EventBus';
import { Plugin } from '../../src/core/plugins/PluginInterfaces';
import path from 'path';

describe('PluginAutoloader', () => {
    let kernel: Kernel;
    let eventBus: EventBus;
    let autoloader: PluginAutoloader;
    const testPluginsPath = path.join(__dirname, '../fixtures/plugins');

    beforeEach(() => {
        kernel = new Kernel();
        eventBus = new EventBus();
        autoloader = new PluginAutoloader(kernel, eventBus, testPluginsPath);
    });

    describe('startAutoload', () => {
        it('debería cargar y registrar plugins correctamente', async () => {
            // Arrange
            const mockPlugin: Plugin = {
                metadata: {
                    name: 'test-plugin',
                    version: '1.0.0'
                },
                initialize: jest.fn(),
                shutdown: jest.fn(),
                status: jest.fn()
            };

            jest.spyOn(autoloader['pluginLoader'], 'loadPlugins')
                .mockResolvedValue(new Map([['test-plugin', mockPlugin]]));

            // Act
            await autoloader.startAutoload();

            // Assert
            expect(kernel.getPlugins().has('test-plugin')).toBeTruthy();
        });

        it('debería manejar timeout correctamente', async () => {
            // Arrange
            autoloader = new PluginAutoloader(kernel, eventBus, testPluginsPath, 100);
            jest.spyOn(autoloader['pluginLoader'], 'loadPlugins')
                .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));

            // Act & Assert
            await expect(autoloader.startAutoload()).rejects.toThrow('Plugin autoload timeout');
        });

        it('debería validar dependencias correctamente', async () => {
            // Arrange
            const mockPluginWithDeps: Plugin = {
                metadata: {
                    name: 'dependent-plugin',
                    version: '1.0.0',
                    dependencies: ['base-plugin']
                },
                initialize: jest.fn(),
                shutdown: jest.fn(),
                status: jest.fn()
            };

            // Act & Assert
            const isValid = await autoloader['validateDependencies'](mockPluginWithDeps);
            expect(isValid).toBeFalsy();
        });

        it('debería emitir eventos apropiados', async () => {
            // Arrange
            const eventSpy = jest.spyOn(eventBus, 'publish');

            // Act
            try {
                await autoloader.startAutoload();
            } catch (error) {
                // Ignorar error esperado
            }

            // Assert
            expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'kernel.plugins.autoload.start'
            }));
        });
    });
});
