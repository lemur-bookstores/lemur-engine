import { ServiceContainer } from '../../src/core/ServiceContainer';

// Una clase de servicio simple para las pruebas
class TestService {
    public readonly id = Math.random();
}

describe('ServiceContainer', () => {
    let container: ServiceContainer;

    beforeEach(() => {
        container = new ServiceContainer();
    });

    describe('lifetime: singleton', () => {
        it('debería retornar siempre la misma instancia para un servicio singleton', () => {
            // Arrange
            container.register('testService', () => new TestService(), 'singleton');

            // Act
            const instance1 = container.resolve<TestService>('testService');
            const instance2 = container.resolve<TestService>('testService');

            // Assert
            expect(instance1).toBe(instance2);
            expect(instance1.id).toBe(instance2.id);
        });
    });

    describe('lifetime: transient', () => {
        it('debería retornar una nueva instancia cada vez para un servicio transient', () => {
            // Arrange
            container.register('testService', () => new TestService(), 'transient');

            // Act
            const instance1 = container.resolve<TestService>('testService');
            const instance2 = container.resolve<TestService>('testService');

            // Assert
            expect(instance1).not.toBe(instance2);
            expect(instance1.id).not.toBe(instance2.id);
        });
    });

    describe('lifetime: scoped', () => {
        it('debería retornar la misma instancia dentro de un scope', () => {
            // Arrange
            container.register('testService', () => new TestService(), 'scoped');

            // Act
            const instance1 = container.resolve<TestService>('testService');
            const instance2 = container.resolve<TestService>('testService');

            // Assert
            expect(instance1).toBe(instance2);
        });

        it('debería retornar una nueva instancia después de limpiar el scope', () => {
            // Arrange
            container.register('testService', () => new TestService(), 'scoped');
            const instance1 = container.resolve<TestService>('testService');

            // Act
            container.clearScope();
            const instance2 = container.resolve<TestService>('testService');

            // Assert
            expect(instance1).not.toBe(instance2);
        });
    });

    it('debería lanzar un error si se intenta resolver un servicio no registrado', () => {
        // Arrange, Act & Assert
        expect(() => container.resolve('unregisteredService')).toThrow(
            'Service unregisteredService not registered'
        );
    });
});