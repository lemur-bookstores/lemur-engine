# MPC Fase 4: Sistema de Monitoreo y Rendimiento

## Resumen Ejecutivo

La **Fase 4** del proyecto MPC implementa un sistema completo de monitoreo, métricas y optimización de rendimiento. Esta fase añade capacidades avanzadas de observabilidad, rate limiting, circuit breakers y un dashboard web para visualizar el estado del sistema en tiempo real.

## Objetivos de la Fase 4

### Objetivos Principales
1. **Sistema de Métricas**: Implementar recolección de métricas con soporte para Prometheus
2. **Health Checks**: Sistema de verificación de salud de componentes
3. **Rate Limiting**: Control de tasa de requests para prevenir sobrecarga
4. **Circuit Breakers**: Patrón de circuit breaker para manejo de fallos
5. **Dashboard Web**: Interfaz web para visualización de métricas y estado
6. **Optimización de Rendimiento**: Mejoras en el rendimiento de los adaptadores existentes

### Objetivos Secundarios
- Integración transparente con adaptadores existentes
- Soporte para métricas personalizadas
- Alertas y notificaciones
- Exportación de métricas a sistemas externos

## Arquitectura del Sistema de Monitoreo

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    MonitoringSystem                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ MetricsCollector│  │  HealthMonitor  │  │ Performance  │ │
│  │                 │  │                 │  │   Monitor    │ │
│  │ - Prometheus    │  │ - Health Checks │  │ - Rate Limit │ │
│  │ - Custom        │  │ - Status Track  │  │ - Circuit    │ │
│  │ - Storage       │  │ - Alerts        │  │   Breakers   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DashboardServer                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Web UI        │  │   WebSocket     │  │   REST API   │ │
│  │                 │  │   Real-time     │  │   Metrics    │ │
│  │ - Charts        │  │   Updates       │  │   Export     │ │
│  │ - Status        │  │ - Live Data     │  │ - JSON       │ │
│  │ - Alerts        │  │ - Notifications │  │ - Prometheus │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Integración con Adaptadores

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTPAdapter   │    │ WebSocketAdapter│    │   GRPCAdapter   │
│                 │    │                 │    │                 │
│ + metrics       │    │ + metrics       │    │ + metrics       │
│ + health_check  │    │ + health_check  │    │ + health_check  │
│ + rate_limiter  │    │ + rate_limiter  │    │ + rate_limiter  │
│ + circuit_break │    │ + circuit_break │    │ + circuit_break │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │  MonitoringSystem   │
                    │                     │
                    │ - Unified Metrics   │
                    │ - Cross-Protocol    │
                    │ - Global Health     │
                    └─────────────────────┘
```

## Implementación Técnica

### 1. MetricsCollector

**Archivo**: `src/mpc/monitoring/metrics.py`

**Funcionalidades**:
- Recolección de métricas de requests, conexiones, mensajes y errores
- Soporte para Prometheus (opcional)
- Almacenamiento local con límites de memoria
- Filtrado temporal de métricas
- Métricas de recursos del sistema (CPU, memoria)

**Métricas Principales**:
```python
# Requests
request_count: Counter por protocolo, método y status
request_duration: Histogram de duración de requests

# Conexiones
connection_count: Counter de conexiones por protocolo
active_connections: Gauge de conexiones activas

# Mensajes
message_count: Counter de mensajes por protocolo y dirección
message_size: Histogram de tamaño de mensajes

# Errores
error_count: Counter de errores por protocolo y tipo

# Recursos
memory_usage: Gauge de uso de memoria
cpu_usage: Gauge de uso de CPU
```

### 2. HealthMonitor

**Funcionalidades**:
- Registro de health checks personalizados
- Ejecución periódica de verificaciones
- Estados: HEALTHY, UNHEALTHY, DEGRADED, UNKNOWN
- Checks críticos vs no críticos
- Timeout y manejo de errores

**Estados de Salud**:
```python
class HealthStatus(Enum):
    HEALTHY = "healthy"      # Todo funcionando correctamente
    UNHEALTHY = "unhealthy"  # Fallo crítico detectado
    DEGRADED = "degraded"    # Funcionamiento parcial
    UNKNOWN = "unknown"      # Estado no determinado
```

### 3. PerformanceMonitor

**Funcionalidades**:
- Rate Limiting con algoritmo token bucket
- Circuit Breakers con estados CLOSED/OPEN/HALF_OPEN
- Configuración flexible por servicio
- Métricas de rendimiento automáticas

**Rate Limiting**:
```python
class RateLimitConfig:
    requests_per_second: float = 100.0
    burst_size: int = 10
    
# Uso
limiter = RateLimiter(config)
if limiter.is_allowed():
    # Procesar request
else:
    # Rechazar con 429 Too Many Requests
```

**Circuit Breaker**:
```python
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    success_threshold: int = 3
    
# Uso
breaker = CircuitBreaker(config)
result = breaker.call(risky_function)
```

### 4. DashboardServer

**Archivo**: `src/mpc/monitoring/dashboard.py`

**Funcionalidades**:
- Servidor web con aiohttp
- Dashboard HTML con JavaScript
- WebSocket para actualizaciones en tiempo real
- API REST para exportar métricas
- Visualización de gráficos y estado

**Endpoints**:
```
GET  /                    # Dashboard principal
GET  /api/metrics         # Métricas en JSON
GET  /api/health          # Estado de salud
GET  /api/performance     # Estadísticas de rendimiento
GET  /prometheus          # Métricas formato Prometheus
WS   /ws                  # WebSocket para updates
```

## Integración con Adaptadores Existentes

### HTTPAdapter

**Modificaciones realizadas**:
```python
class HTTPAdapter:
    def __init__(self, ..., metrics_collector=None):
        self.metrics_collector = metrics_collector
        self._active_connections = 0
    
    async def send_message(self, message):
        start_time = time.time()
        try:
            # ... lógica existente ...
            duration = time.time() - start_time
            self.metrics_collector.record_request(
                "http", "POST", "success", duration
            )
        except Exception as e:
            self.metrics_collector.record_error("http", "send_error", str(e))
```

### WebSocketAdapter y GRPCAdapter

**Integración similar**:
- Métricas de conexiones activas
- Duración de operaciones
- Conteo de mensajes enviados/recibidos
- Registro de errores y timeouts

## Ejemplos de Uso

### 1. Configuración Básica

```python
from src.mpc.monitoring import MonitoringSystem
from src.mpc.adapters import HTTPAdapter

# Crear sistema de monitoreo
monitoring = MonitoringSystem(
    prometheus_port=9090,
    enable_prometheus=True
)

# Crear adaptador con monitoreo
http_adapter = HTTPAdapter(
    host="localhost",
    port=8080,
    metrics_collector=monitoring.metrics_collector
)

# Iniciar servicios
await monitoring.start()
await http_adapter.start()
```

### 2. Health Checks Personalizados

```python
def check_database():
    """Verificar conexión a base de datos"""
    try:
        # Lógica de verificación
        return True
    except:
        return False

def check_external_api():
    """Verificar API externa"""
    # Implementación específica
    return response.status_code == 200

# Registrar health checks
monitoring.health_monitor.register_health_check(
    HealthCheck("database", check_database, critical=True)
)
monitoring.health_monitor.register_health_check(
    HealthCheck("external_api", check_external_api, critical=False)
)
```

### 3. Rate Limiting

```python
# Configurar rate limiter para API pública
public_config = RateLimitConfig(
    requests_per_second=10.0,
    burst_size=5
)
public_limiter = monitoring.performance_monitor.create_rate_limiter(
    "public_api", public_config
)

# Usar en handler
async def handle_public_request(request):
    if not public_limiter.is_allowed():
        return web.Response(status=429, text="Rate limit exceeded")
    
    # Procesar request normal
    return await process_request(request)
```

### 4. Circuit Breaker

```python
# Configurar circuit breaker para servicio externo
external_config = CircuitBreakerConfig(
    failure_threshold=3,
    recovery_timeout=30.0
)
external_breaker = monitoring.performance_monitor.create_circuit_breaker(
    "external_service", external_config
)

# Usar en llamadas externas
async def call_external_service():
    try:
        return await external_breaker.acall(actual_external_call)
    except CircuitBreakerOpenError:
        return {"error": "Service temporarily unavailable"}
```

## Dashboard Web

### Características

1. **Vista General**:
   - Estado de salud global
   - Métricas principales en tiempo real
   - Alertas activas

2. **Métricas Detalladas**:
   - Gráficos de requests por protocolo
   - Latencia y throughput
   - Distribución de errores

3. **Health Checks**:
   - Estado de cada componente
   - Historial de fallos
   - Tiempo de última verificación

4. **Performance**:
   - Estado de rate limiters
   - Circuit breakers activos
   - Uso de recursos del sistema

### Acceso al Dashboard

```bash
# Iniciar sistema con dashboard
python examples/advanced_monitoring_example.py

# Acceder al dashboard
http://localhost:8081/

# Métricas Prometheus
http://localhost:9090/metrics
```

## Testing

### Tests Implementados

**Archivo**: `tests/test_monitoring.py`

**Cobertura**:
- Tests unitarios para cada componente
- Tests de integración del sistema completo
- Mocking de dependencias externas (Prometheus, psutil)
- Tests de concurrencia y rendimiento
- Validación de métricas y estados

**Ejecutar Tests**:
```bash
# Tests completos
pytest tests/test_monitoring.py -v

# Tests específicos
pytest tests/test_monitoring.py::TestMetricsCollector -v
pytest tests/test_monitoring.py::TestRateLimiter -v
pytest tests/test_monitoring.py::TestCircuitBreaker -v
```

## Configuración y Deployment

### Variables de Entorno

```bash
# Monitoreo
MPC_MONITORING_ENABLED=true
MPC_PROMETHEUS_PORT=9090
MPC_DASHBOARD_PORT=8081

# Rate Limiting
MPC_DEFAULT_RATE_LIMIT=100
MPC_BURST_SIZE=10

# Circuit Breaker
MPC_FAILURE_THRESHOLD=5
MPC_RECOVERY_TIMEOUT=60
```

### Docker Configuration

```dockerfile
# Exponer puertos de monitoreo
EXPOSE 8081 9090

# Variables de entorno
ENV MPC_MONITORING_ENABLED=true
ENV MPC_PROMETHEUS_PORT=9090
ENV MPC_DASHBOARD_PORT=8081
```

## Métricas y Alertas

### Métricas Clave para Alertas

1. **Disponibilidad**:
   - `health_status != "healthy"`
   - `active_connections > threshold`

2. **Rendimiento**:
   - `request_duration > SLA_threshold`
   - `error_rate > 5%`

3. **Recursos**:
   - `memory_usage > 80%`
   - `cpu_usage > 90%`

### Integración con Sistemas Externos

```python
# Prometheus AlertManager
- alert: HighErrorRate
  expr: rate(mpc_error_count[5m]) > 0.05
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "High error rate detected"

# Grafana Dashboard
- Panel: Request Rate
  Query: rate(mpc_request_count[1m])
  
- Panel: Response Time
  Query: histogram_quantile(0.95, mpc_request_duration)
```

## Roadmap y Mejoras Futuras

### Fase 4.1 - Mejoras Inmediatas
- [ ] Alertas por email/Slack
- [ ] Métricas de negocio personalizadas
- [ ] Exportadores adicionales (InfluxDB, DataDog)

### Fase 4.2 - Características Avanzadas
- [ ] Distributed tracing con OpenTelemetry
- [ ] Análisis de tendencias con ML
- [ ] Auto-scaling basado en métricas

### Fase 4.3 - Optimizaciones
- [ ] Compresión de métricas históricas
- [ ] Sampling inteligente
- [ ] Métricas agregadas por región/datacenter

## Conclusión

La **Fase 4** establece una base sólida para la observabilidad y el rendimiento del sistema MPC. Con la implementación de métricas, health checks, rate limiting y circuit breakers, el sistema ahora puede:

1. **Monitorear** su estado en tiempo real
2. **Prevenir** sobrecargas y fallos en cascada
3. **Detectar** problemas antes de que afecten a los usuarios
4. **Optimizar** el rendimiento basado en datos reales
5. **Escalar** de manera informada y controlada

El sistema está preparado para entornos de producción con alta disponibilidad y puede integrarse fácilmente con herramientas estándar de la industria como Prometheus, Grafana y sistemas de alertas.

**Estado**: ✅ **FASE 4 COMPLETADA**

**Próximo**: Fase 5 - Integración con MCP (Model Context Protocol)