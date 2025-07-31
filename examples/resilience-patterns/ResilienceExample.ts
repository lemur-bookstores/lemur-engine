import { RetryHandler, RetryOptions } from '../../src/core/RetryHandler';
import { Bulkhead, BulkheadOptions } from '../../src/core/_Bulkhead';

async function resilientOperationExample() {
    // 1. Configurar Retry Handler
    const retryOptions: RetryOptions = {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        exponentialBase: 2,
        timeout: 30000,
        retryableErrors: [
            'ETIMEDOUT',
            'ECONNRESET',
            /network error/i
        ]
    };
    const retryHandler = new RetryHandler(retryOptions);

    // 2. Configurar Bulkhead
    const bulkheadOptions: BulkheadOptions = {
        maxConcurrent: 10,
        maxQueued: 20,
        timeout: 5000
    };
    const bulkhead = new Bulkhead(bulkheadOptions);

    // 3. Ejemplo de operación resiliente
    try {
        const result = await retryHandler.execute(async () => {
            return await bulkhead.execute(async () => {
                // Simular operación que puede fallar
                const randomFail = Math.random() > 0.7;
                if (randomFail) {
                    throw new Error('network error: connection reset');
                }
                return 'Operation successful';
            });
        });

        console.log('Operation result:', result);
        console.log('Bulkhead stats:', bulkhead.getStats());

    } catch (error) {
        console.error('Operation failed:', error);
    }
}

// Ejemplo de uso en operaciones paralelas
async function parallelOperationsExample() {
    const bulkhead = new Bulkhead({
        maxConcurrent: 3,
        maxQueued: 5
    });

    // Crear 10 operaciones
    const operations = Array.from({ length: 10 }, (_, i) => {
        return async () => {
            try {
                await bulkhead.execute(async () => {
                    console.log(`Operation ${i + 1} starting...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    console.log(`Operation ${i + 1} completed`);
                    return `Result ${i + 1}`;
                });
            } catch (error) {
                console.error(`Operation ${i + 1} failed:`, error);
            }
        };
    });

    // Ejecutar todas las operaciones en paralelo
    await Promise.all(operations.map(op => op()));
    console.log('Final bulkhead stats:', bulkhead.getStats());
}

// Ejecutar ejemplos
async function runExamples() {
    console.log('Running resilient operation example...');
    await resilientOperationExample();

    console.log('\nRunning parallel operations example...');
    await parallelOperationsExample();
}

runExamples().catch(console.error);
