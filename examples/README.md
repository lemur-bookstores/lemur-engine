# Ejemplos de Implementación

Este directorio contiene ejemplos de implementación para diferentes aspectos del micro-kernel.

## Error Handling

### Implementaciones de Storage

1. **MongoLogStorageExample.ts**

   - Implementación de LogStorage para MongoDB
   - Guarda los logs de errores en una colección de MongoDB
   - Dependencias: `mongodb`

2. **PrometheusMetricsExample.ts**

   - Implementación de MetricsStorage para Prometheus
   - Expone métricas en formato Prometheus
   - Dependencias: `prom-client`

3. **S3LogStorageExample.ts**

   - Implementación de LogStorage para Amazon S3
   - Guarda los logs en buckets de S3 organizados por fecha
   - Dependencias: `@aws-sdk/client-s3`

4. **ElasticsearchStorageExample.ts**
   - Implementación dual de LogStorage y MetricsStorage para Elasticsearch
   - Organiza los datos en índices por mes
   - Dependencias: `@elastic/elasticsearch`

## Uso de los Ejemplos

1. Instalar las dependencias necesarias:

```bash
npm install mongodb prom-client @aws-sdk/client-s3 @elastic/elasticsearch
```

2. Importar la implementación deseada:

```typescript
import { MongoLogStorage } from "./examples/error-handling/MongoLogStorageExample";
import { LogErrorHandler } from "./src/services/ErrorHandlers";

// Inicializar el storage
const mongoStorage = new MongoLogStorage(
  "mongodb://localhost:27017",
  "kernel_logs",
  "error_logs"
);
await mongoStorage.initialize();

// Crear y registrar el handler
const logHandler = new LogErrorHandler(mongoStorage);
kernel.errorHandler.registerHandler(logHandler);
```

## Notas Importantes

- Estos ejemplos son implementaciones de referencia y pueden necesitar ajustes para producción
- Cada implementación maneja las credenciales y configuración de manera diferente
- Se recomienda agregar manejo de errores adicional para casos de fallo de conexión
- Las implementaciones son extensibles y pueden ser personalizadas según necesidades específicas

## Ejemplos Adicionales

Si necesitas una implementación específica para otro servicio o base de datos, puedes usar estos ejemplos como base. La estructura modular del sistema permite agregar nuevas implementaciones fácilmente implementando las interfaces `LogStorage` y/o `MetricsStorage`.
