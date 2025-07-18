import { PluginRegistry } from '../../src/core/PluginManager';
import { Plugin } from '../../src/core/plugins/PluginInterfaces';


// Helper to create mock plugins for testing
const createMockPlugin = (
    name: string,
    dependencies: string[] = []
): Plugin => ({
    metadata: {
        name,
        version: '1.0.0',
        dependencies,
    },
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    status: jest.fn().mockReturnValue('UNINITIALIZED'),
});

describe('PluginRegistry', () => {
    let registry: PluginRegistry;

    beforeEach(() => {
        registry = new PluginRegistry();
    });

    describe('register and get', () => {
        it('debería registrar un plugin y permitir recuperarlo', () => {
            // Arrange
            const pluginA = createMockPlugin('plugin-a');

            // Act
            registry.register(pluginA);
            const retrievedPlugin = registry.get('plugin-a');

            // Assert
            expect(retrievedPlugin).toBe(pluginA);
        });

        it('get debería retornar undefined para un plugin no registrado', () => {
            // Arrange
            const retrievedPlugin = registry.get('non-existent-plugin');

            // Assert
            expect(retrievedPlugin).toBeUndefined();
        });
    });

    describe('getInitializationOrder', () => {
        it('debería resolver el orden de inicialización basado en dependencias', () => {
            // Arrange
            const pluginA = createMockPlugin('plugin-a');
            const pluginB = createMockPlugin('plugin-b', ['plugin-a']);
            const pluginC = createMockPlugin('plugin-c', ['plugin-b']);

            registry.register(pluginA);
            registry.register(pluginB);
            registry.register(pluginC);

            // Act
            const order = registry.getInitializationOrder();

            // Assert
            expect(order).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
        });

        it('debería manejar grafos de dependencias más complejos correctamente', () => {
            // Arrange
            const pluginA = createMockPlugin('A');
            const pluginB = createMockPlugin('B', ['A']);
            const pluginC = createMockPlugin('C', ['A']);
            const pluginD = createMockPlugin('D', ['B', 'C']);

            registry.register(pluginD);
            registry.register(pluginB);
            registry.register(pluginA);
            registry.register(pluginC);

            // Act
            const order = registry.getInitializationOrder();

            // Assert
            // A debe estar antes que B y C. B y C deben estar antes que D.
            expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
            expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
            expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
            expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
            expect(order).toHaveLength(4);
        });

        it('debería lanzar un error si se detecta una dependencia circular', () => {
            // Arrange
            const pluginA = createMockPlugin('plugin-a', ['plugin-c']);
            const pluginB = createMockPlugin('plugin-b', ['plugin-a']);
            const pluginC = createMockPlugin('plugin-c', ['plugin-b']);

            registry.register(pluginA);
            registry.register(pluginB);
            registry.register(pluginC);

            // Act & Assert
            expect(() => registry.getInitializationOrder()).toThrow(/Circular dependency detected/);
        });

        it('debería lanzar un error si falta una dependencia', () => {
            // Arrange
            const pluginB = createMockPlugin('plugin-b', ['plugin-a']); // plugin-a no está registrado
            registry.register(pluginB);

            // Act & Assert
            expect(() => registry.getInitializationOrder()).toThrow('Missing dependency: plugin-a required by plugin-b');
        });

        it('debería retornar un arreglo vacío si no hay plugins registrados', () => {
            // Act
            const order = registry.getInitializationOrder();

            // Assert
            expect(order).toEqual([]);
        });
    });

    describe('getPlugins', () => {
        it('debería retornar un mapa de todos los plugins registrados', () => {
            // Arrange
            const pluginA = createMockPlugin('plugin-a');
            const pluginB = createMockPlugin('plugin-b');
            registry.register(pluginA);
            registry.register(pluginB);

            // Act
            const allPlugins = registry.getPlugins();

            // Assert
            expect(allPlugins.size).toBe(2);
            expect(allPlugins.get('plugin-a')).toBe(pluginA);
            expect(allPlugins.get('plugin-b')).toBe(pluginB);
        });

        it('debería retornar una copia del mapa, no la referencia interna', () => {
            // Arrange
            const pluginA = createMockPlugin('plugin-a');
            registry.register(pluginA);

            // Act
            const allPlugins = registry.getPlugins();
            allPlugins.delete('plugin-a'); // Modificar la copia

            // Assert
            expect(registry.get('plugin-a')).toBe(pluginA); // El original no debe cambiar
        });
    });
});