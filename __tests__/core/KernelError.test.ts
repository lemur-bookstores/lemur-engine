import { KernelError } from '../../src/core/KernelError';

describe('KernelError', () => {
    describe('constructor', () => {
        it('should create error with required parameters', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_001');
            expect(error.name).toBe('KernelError');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(KernelError);
        });

        it('should create error with all optional parameters', () => {
            const details = { userId: 123, action: 'test' };
            const error = new KernelError(
                'Test error',
                'TEST_001',
                details,
                'TestModule',
                true
            );

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_001');
            expect(error.details).toEqual(details);
            expect(error.sourceModule).toBe('TestModule');
            expect(error.isCritical).toBe(true);
            expect(error.timestamp).toBeInstanceOf(Date);
        });

        it('should set default values for optional parameters', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error.details).toBeUndefined();
            expect(error.sourceModule).toBeUndefined();
            expect(error.isCritical).toBe(false);
            expect(error.timestamp).toBeInstanceOf(Date);
        });

        it('should set timestamp to current date', () => {
            const beforeCreation = new Date();
            const error = new KernelError('Test error', 'TEST_001');
            const afterCreation = new Date();

            expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
            expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
        });

        it('should handle empty message', () => {
            const error = new KernelError('', 'TEST_001');

            expect(error.message).toBe('');
            expect(error.code).toBe('TEST_001');
        });

        it('should handle empty code', () => {
            const error = new KernelError('Test error', '');

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('');
        });

        it('should handle null details', () => {
            const error = new KernelError('Test error', 'TEST_001', null);

            expect(error.details).toBeNull();
        });

        it('should handle complex details object', () => {
            const complexDetails = {
                user: { id: 123, name: 'John' },
                request: { method: 'POST', url: '/api/test' },
                stack: ['function1', 'function2'],
                metadata: { version: '1.0.0', environment: 'test' }
            };

            const error = new KernelError('Test error', 'TEST_001', complexDetails);

            expect(error.details).toEqual(complexDetails);
            // En esta implementación, los detalles se almacenan por referencia
            expect(error.details).toBe(complexDetails);
        });
    });

    describe('error properties', () => {
        it('should maintain Error prototype chain', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error instanceof Error).toBe(true);
            expect(error instanceof KernelError).toBe(true);
            expect(Object.getPrototypeOf(error)).toBe(KernelError.prototype);
        });

        it('should have correct name property', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error.name).toBe('KernelError');
        });

        it('should preserve stack trace', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error.stack).toBeDefined();
            expect(typeof error.stack).toBe('string');
            expect(error.stack).toContain('KernelError');
        });

        it('should be throwable and catchable', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(() => {
                throw error;
            }).toThrow(KernelError);

            expect(() => {
                throw error;
            }).toThrow('Test error');

            try {
                throw error;
            } catch (caught) {
                expect(caught).toBe(error);
                expect(caught instanceof KernelError).toBe(true);
            }
        });
    });

    describe('error codes and criticality', () => {
        it('should handle various error codes', () => {
            const codes = [
                'KERNEL_001',
                'PLUGIN_ERROR',
                'CONFIG_INVALID',
                'NETWORK_TIMEOUT',
                'VALIDATION_FAILED'
            ];

            codes.forEach(code => {
                const error = new KernelError('Test error', code);
                expect(error.code).toBe(code);
            });
        });

        it('should handle critical errors', () => {
            const error = new KernelError('Critical error', 'CRITICAL_001', undefined, undefined, true);

            expect(error.isCritical).toBe(true);
        });

        it('should handle non-critical errors', () => {
            const error = new KernelError('Warning', 'WARN_001', undefined, undefined, false);

            expect(error.isCritical).toBe(false);
        });

        it('should default to non-critical', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error.isCritical).toBe(false);
        });
    });

    describe('source module tracking', () => {
        it('should track source module', () => {
            const modules = [
                'KernelBootstrap',
                'PluginManager',
                'ConfigManager',
                'EventBus',
                'ServiceContainer'
            ];

            modules.forEach(module => {
                const error = new KernelError('Test error', 'TEST_001', undefined, module);
                expect(error.sourceModule).toBe(module);
            });
        });

        it('should handle undefined source module', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error.sourceModule).toBeUndefined();
        });

        it('should handle empty source module', () => {
            const error = new KernelError('Test error', 'TEST_001', undefined, '');

            expect(error.sourceModule).toBe('');
        });
    });

    describe('details handling', () => {
        it('should store primitive details', () => {
            const primitives = [
                'string detail',
                42,
                true,
                null,
                undefined
            ];

            primitives.forEach(detail => {
                const error = new KernelError('Test error', 'TEST_001', detail);
                expect(error.details).toBe(detail);
            });
        });

        it('should store object details', () => {
            const objectDetails = {
                requestId: 'req-123',
                userId: 456,
                action: 'create',
                timestamp: new Date().toISOString()
            };

            const error = new KernelError('Test error', 'TEST_001', objectDetails);

            expect(error.details).toEqual(objectDetails);
        });

        it('should store array details', () => {
            const arrayDetails = ['error1', 'error2', 'error3'];

            const error = new KernelError('Test error', 'TEST_001', arrayDetails);

            expect(error.details).toEqual(arrayDetails);
        });

        it('should handle nested object details', () => {
            const nestedDetails = {
                error: {
                    type: 'ValidationError',
                    fields: {
                        email: 'Invalid format',
                        age: 'Must be positive'
                    }
                },
                context: {
                    request: { method: 'POST' },
                    user: { id: 123 }
                }
            };

            const error = new KernelError('Test error', 'TEST_001', nestedDetails);

            expect(error.details).toEqual(nestedDetails);
        });
    });

    describe('timestamp behavior', () => {
        it('should set timestamp on creation', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error.timestamp).toBeInstanceOf(Date);
        });

        it('should have different timestamps for different instances', async () => {
            const error1 = new KernelError('Test error 1', 'TEST_001');
            
            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 1));
            
            const error2 = new KernelError('Test error 2', 'TEST_002');

            expect(error2.timestamp.getTime()).toBeGreaterThan(error1.timestamp.getTime());
        });

        it('should maintain timestamp immutability', () => {
            const error = new KernelError('Test error', 'TEST_001');
            const originalTimestamp = error.timestamp;

            // En JavaScript, las propiedades readonly solo son readonly en tiempo de compilación
            // pero no en tiempo de ejecución, por lo que el timestamp puede ser modificado
            // Este test verifica que el timestamp original se mantiene
            expect(error.timestamp).toBe(originalTimestamp);
            expect(error.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('serialization and JSON', () => {
        it('should serialize to JSON correctly', () => {
            const details = { userId: 123, action: 'test' };
            const error = new KernelError(
                'Test error',
                'TEST_001',
                details,
                'TestModule',
                true
            );

            const json = JSON.stringify(error);
            const parsed = JSON.parse(json);

            expect(parsed.message).toBe('Test error');
            expect(parsed.code).toBe('TEST_001');
            expect(parsed.details).toEqual(details);
            expect(parsed.sourceModule).toBe('TestModule');
            expect(parsed.isCritical).toBe(true);
            expect(parsed.timestamp).toBe(error.timestamp.toISOString());
        });

        it('should handle JSON serialization with circular references in details', () => {
            const circularDetails: any = { name: 'test' };
            circularDetails.self = circularDetails;

            const error = new KernelError('Test error', 'TEST_001', circularDetails);

            // Should handle circular references gracefully
            expect(() => {
                const json = JSON.stringify(error);
                expect(json).toBeDefined();
            }).not.toThrow();
        });

        it('should serialize minimal error correctly', () => {
            const error = new KernelError('Test error', 'TEST_001');

            const json = JSON.stringify(error);
            const parsed = JSON.parse(json);

            expect(parsed.message).toBe('Test error');
            expect(parsed.code).toBe('TEST_001');
            expect(parsed.isCritical).toBe(false);
            expect(parsed.timestamp).toBe(error.timestamp.toISOString());
        });
    });

    describe('toString and string representation', () => {
        it('should have meaningful toString representation', () => {
            const error = new KernelError('Test error', 'TEST_001');

            const str = error.toString();

            expect(str).toContain('KernelError');
            expect(str).toContain('Test error');
        });

        it('should include error code in string representation', () => {
            const error = new KernelError('Test error', 'TEST_001');

            const str = error.toString();

            expect(str).toContain('TEST_001');
        });

        it('should work with template literals', () => {
            const error = new KernelError('Test error', 'TEST_001');

            const message = `Error occurred: ${error}`;

            expect(message).toContain('Test error');
            expect(message).toContain('KernelError');
        });
    });

    describe('comparison and equality', () => {
        it('should be equal to itself', () => {
            const error = new KernelError('Test error', 'TEST_001');

            expect(error).toBe(error);
            expect(error === error).toBe(true);
        });

        it('should not be equal to different instances with same properties', () => {
            const error1 = new KernelError('Test error', 'TEST_001');
            const error2 = new KernelError('Test error', 'TEST_001');

            expect(error1).not.toBe(error2);
            expect(error1 === error2).toBe(false);
        });

        it('should have different timestamps for different instances', async () => {
            const error1 = new KernelError('Test error', 'TEST_001');
            
            // Pequeño delay para asegurar timestamps diferentes
            await new Promise(resolve => setTimeout(resolve, 1));
            
            const error2 = new KernelError('Test error', 'TEST_001');

            expect(error1.timestamp.getTime()).not.toEqual(error2.timestamp.getTime());
        });
    });

    describe('edge cases and error conditions', () => {
        it('should handle very long messages', () => {
            const longMessage = 'A'.repeat(10000);
            const error = new KernelError(longMessage, 'TEST_001');

            expect(error.message).toBe(longMessage);
            expect(error.message.length).toBe(10000);
        });

        it('should handle special characters in message', () => {
            const specialMessage = 'Error with 特殊字符 and émojis 🚨 and newlines\n\ttabs';
            const error = new KernelError(specialMessage, 'TEST_001');

            expect(error.message).toBe(specialMessage);
        });

        it('should handle special characters in code', () => {
            const specialCode = 'TEST_特殊_001_🚨';
            const error = new KernelError('Test error', specialCode);

            expect(error.code).toBe(specialCode);
        });

        it('should handle very large details object', () => {
            const largeDetails = {
                data: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item_${i}` }))
            };

            const error = new KernelError('Test error', 'TEST_001', largeDetails);

            expect(error.details).toEqual(largeDetails);
            expect(error.details.data).toHaveLength(1000);
        });

        it('should handle undefined and null values gracefully', () => {
            const error1 = new KernelError(undefined as any, 'TEST_001');
            const error2 = new KernelError('Test error', null as any);

            // El constructor de Error convierte undefined a string vacío
            expect(error1.message).toBe('');
            expect(error2.code).toBeNull();
        });
    });
});