"""
Sistema de Métricas y Monitoreo para MPC
========================================

Este módulo implementa un sistema completo de métricas y monitoreo
para el sistema MPC, incluyendo:

- Métricas Prometheus
- Health checks avanzados
- Rate limiting
- Circuit breakers
- Performance monitoring
"""

import time
import asyncio
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import logging
from collections import defaultdict, deque
import threading
from datetime import datetime, timedelta

try:
    from prometheus_client import Counter, Histogram, Gauge, Summary, start_http_server
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    # Mock classes for when prometheus is not available
    class Counter:
        def __init__(self, *args, **kwargs): pass
        def inc(self, *args, **kwargs): pass
        def labels(self, *args, **kwargs): return self
    
    class Histogram:
        def __init__(self, *args, **kwargs): pass
        def observe(self, *args, **kwargs): pass
        def labels(self, *args, **kwargs): return self
        def time(self): return MockTimer()
    
    class Gauge:
        def __init__(self, *args, **kwargs): pass
        def set(self, *args, **kwargs): pass
        def inc(self, *args, **kwargs): pass
        def dec(self, *args, **kwargs): pass
        def labels(self, *args, **kwargs): return self
    
    class Summary:
        def __init__(self, *args, **kwargs): pass
        def observe(self, *args, **kwargs): pass
        def labels(self, *args, **kwargs): return self
    
    class MockTimer:
        def __enter__(self): return self
        def __exit__(self, *args): pass
    
    def start_http_server(*args, **kwargs): pass


class HealthStatus(Enum):
    """Estados de salud del sistema"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class CircuitBreakerState(Enum):
    """Estados del circuit breaker"""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class MetricPoint:
    """Punto de métrica individual"""
    timestamp: float
    value: float
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class HealthCheck:
    """Definición de un health check"""
    name: str
    check_function: Callable[[], bool]
    timeout: float = 5.0
    critical: bool = True
    interval: float = 30.0
    last_check: Optional[datetime] = None
    last_status: HealthStatus = HealthStatus.UNKNOWN
    consecutive_failures: int = 0


@dataclass
class RateLimitConfig:
    """Configuración de rate limiting"""
    requests_per_second: float
    burst_size: int = 10
    window_size: float = 1.0


@dataclass
class CircuitBreakerConfig:
    """Configuración del circuit breaker"""
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    success_threshold: int = 3
    timeout: float = 30.0


class RateLimiter:
    """Implementación de rate limiter usando token bucket"""
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.tokens = config.burst_size
        self.last_update = time.time()
        self.lock = threading.Lock()
    
    def is_allowed(self) -> bool:
        """Verifica si la request está permitida"""
        with self.lock:
            now = time.time()
            elapsed = now - self.last_update
            
            # Añadir tokens basado en el tiempo transcurrido
            tokens_to_add = elapsed * self.config.requests_per_second
            self.tokens = min(self.config.burst_size, self.tokens + tokens_to_add)
            self.last_update = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False
    
    def get_wait_time(self) -> float:
        """Obtiene el tiempo de espera hasta el próximo token"""
        with self.lock:
            if self.tokens >= 1:
                return 0.0
            return (1 - self.tokens) / self.config.requests_per_second


class CircuitBreaker:
    """Implementación de circuit breaker pattern"""
    
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.lock = threading.Lock()
    
    def call(self, func: Callable, *args, **kwargs):
        """Ejecuta una función a través del circuit breaker"""
        if not self._is_call_allowed():
            raise CircuitBreakerOpenError("Circuit breaker is open")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    async def acall(self, func: Callable, *args, **kwargs):
        """Versión async del call"""
        if not self._is_call_allowed():
            raise CircuitBreakerOpenError("Circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _is_call_allowed(self) -> bool:
        """Verifica si la llamada está permitida"""
        with self.lock:
            if self.state == CircuitBreakerState.CLOSED:
                return True
            elif self.state == CircuitBreakerState.OPEN:
                if self._should_attempt_reset():
                    self.state = CircuitBreakerState.HALF_OPEN
                    return True
                return False
            else:  # HALF_OPEN
                return True
    
    def _should_attempt_reset(self) -> bool:
        """Verifica si debería intentar resetear el circuit breaker"""
        if self.last_failure_time is None:
            return False
        return time.time() - self.last_failure_time >= self.config.recovery_timeout
    
    def _on_success(self):
        """Maneja una llamada exitosa"""
        with self.lock:
            if self.state == CircuitBreakerState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.success_threshold:
                    self.state = CircuitBreakerState.CLOSED
                    self.failure_count = 0
                    self.success_count = 0
            elif self.state == CircuitBreakerState.CLOSED:
                self.failure_count = 0
    
    def _on_failure(self):
        """Maneja una llamada fallida"""
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.state == CircuitBreakerState.HALF_OPEN:
                self.state = CircuitBreakerState.OPEN
                self.success_count = 0
            elif (self.state == CircuitBreakerState.CLOSED and 
                  self.failure_count >= self.config.failure_threshold):
                self.state = CircuitBreakerState.OPEN


class CircuitBreakerOpenError(Exception):
    """Error cuando el circuit breaker está abierto"""
    pass


class MetricsCollector:
    """Colector de métricas del sistema MPC"""
    
    def __init__(self, enable_prometheus: bool = True):
        self.enable_prometheus = enable_prometheus and PROMETHEUS_AVAILABLE
        self.metrics_data: Dict[str, List[MetricPoint]] = defaultdict(list)
        self.lock = threading.Lock()
        
        # Métricas Prometheus
        if self.enable_prometheus:
            self._setup_prometheus_metrics()
    
    def _setup_prometheus_metrics(self):
        """Configura las métricas de Prometheus"""
        # Contadores
        self.request_total = Counter(
            'mpc_requests_total',
            'Total number of requests',
            ['protocol', 'method', 'status']
        )
        
        self.connection_total = Counter(
            'mpc_connections_total',
            'Total number of connections',
            ['protocol', 'type']
        )
        
        self.message_total = Counter(
            'mpc_messages_total',
            'Total number of messages',
            ['protocol', 'type', 'direction']
        )
        
        self.error_total = Counter(
            'mpc_errors_total',
            'Total number of errors',
            ['protocol', 'type', 'code']
        )
        
        # Histogramas
        self.request_duration = Histogram(
            'mpc_request_duration_seconds',
            'Request duration in seconds',
            ['protocol', 'method'],
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
        )
        
        self.message_size = Histogram(
            'mpc_message_size_bytes',
            'Message size in bytes',
            ['protocol', 'direction'],
            buckets=[64, 256, 1024, 4096, 16384, 65536, 262144, 1048576]
        )
        
        # Gauges
        self.active_connections = Gauge(
            'mpc_active_connections',
            'Number of active connections',
            ['protocol']
        )
        
        self.memory_usage = Gauge(
            'mpc_memory_usage_bytes',
            'Memory usage in bytes',
            ['component']
        )
        
        self.cpu_usage = Gauge(
            'mpc_cpu_usage_percent',
            'CPU usage percentage',
            ['component']
        )
        
        # Summary
        self.response_time = Summary(
            'mpc_response_time_seconds',
            'Response time in seconds',
            ['protocol', 'endpoint']
        )
    
    def record_request(self, protocol: str, method: str, status: str, duration: float):
        """Registra una request"""
        if self.enable_prometheus:
            self.request_total.labels(protocol=protocol, method=method, status=status).inc()
            self.request_duration.labels(protocol=protocol, method=method).observe(duration)
        
        self._store_metric('request_count', 1, {
            'protocol': protocol, 'method': method, 'status': status
        })
        self._store_metric('request_duration', duration, {
            'protocol': protocol, 'method': method
        })
    
    def record_connection(self, protocol: str, connection_type: str, active_count: int):
        """Registra información de conexión"""
        if self.enable_prometheus:
            self.connection_total.labels(protocol=protocol, type=connection_type).inc()
            self.active_connections.labels(protocol=protocol).set(active_count)
        
        self._store_metric('connection_count', 1, {
            'protocol': protocol, 'type': connection_type
        })
        self._store_metric('active_connections', active_count, {
            'protocol': protocol
        })
    
    def record_message(self, protocol: str, message_type: str, direction: str, size: int):
        """Registra un mensaje"""
        if self.enable_prometheus:
            self.message_total.labels(
                protocol=protocol, type=message_type, direction=direction
            ).inc()
            self.message_size.labels(protocol=protocol, direction=direction).observe(size)
        
        self._store_metric('message_count', 1, {
            'protocol': protocol, 'type': message_type, 'direction': direction
        })
        self._store_metric('message_size', size, {
            'protocol': protocol, 'direction': direction
        })
    
    def record_error(self, protocol: str, error_type: str, error_code: str):
        """Registra un error"""
        if self.enable_prometheus:
            self.error_total.labels(
                protocol=protocol, type=error_type, code=error_code
            ).inc()
        
        self._store_metric('error_count', 1, {
            'protocol': protocol, 'type': error_type, 'code': error_code
        })
    
    def record_resource_usage(self, component: str, memory_bytes: int, cpu_percent: float):
        """Registra uso de recursos"""
        if self.enable_prometheus:
            self.memory_usage.labels(component=component).set(memory_bytes)
            self.cpu_usage.labels(component=component).set(cpu_percent)
        
        self._store_metric('memory_usage', memory_bytes, {'component': component})
        self._store_metric('cpu_usage', cpu_percent, {'component': component})
    
    def _store_metric(self, name: str, value: float, labels: Dict[str, str]):
        """Almacena una métrica internamente"""
        with self.lock:
            metric_point = MetricPoint(
                timestamp=time.time(),
                value=value,
                labels=labels
            )
            self.metrics_data[name].append(metric_point)
            
            # Mantener solo los últimos 1000 puntos por métrica
            if len(self.metrics_data[name]) > 1000:
                self.metrics_data[name] = self.metrics_data[name][-1000:]
    
    def get_metrics(self, name: str, since: Optional[float] = None) -> List[MetricPoint]:
        """Obtiene métricas por nombre"""
        with self.lock:
            metrics = self.metrics_data.get(name, [])
            if since is not None:
                metrics = [m for m in metrics if m.timestamp >= since]
            return metrics.copy()
    
    def get_all_metrics(self) -> Dict[str, List[MetricPoint]]:
        """Obtiene todas las métricas"""
        with self.lock:
            return {name: metrics.copy() for name, metrics in self.metrics_data.items()}


class HealthMonitor:
    """Monitor de salud del sistema"""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.health_checks: Dict[str, HealthCheck] = {}
        self.overall_status = HealthStatus.UNKNOWN
        self.lock = threading.Lock()
        self.running = False
        self.check_task = None
    
    def register_health_check(self, health_check: HealthCheck):
        """Registra un health check"""
        with self.lock:
            self.health_checks[health_check.name] = health_check
    
    def unregister_health_check(self, name: str):
        """Desregistra un health check"""
        with self.lock:
            self.health_checks.pop(name, None)
    
    async def start_monitoring(self):
        """Inicia el monitoreo de salud"""
        self.running = True
        self.check_task = asyncio.create_task(self._monitoring_loop())
    
    async def stop_monitoring(self):
        """Detiene el monitoreo de salud"""
        self.running = False
        if self.check_task:
            self.check_task.cancel()
            try:
                await self.check_task
            except asyncio.CancelledError:
                pass
    
    async def _monitoring_loop(self):
        """Loop principal de monitoreo"""
        while self.running:
            try:
                await self._run_health_checks()
                await asyncio.sleep(10)  # Check every 10 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logging.error(f"Error in health monitoring loop: {e}")
                await asyncio.sleep(5)
    
    async def _run_health_checks(self):
        """Ejecuta todos los health checks"""
        now = datetime.now()
        checks_to_run = []
        
        with self.lock:
            for check in self.health_checks.values():
                if (check.last_check is None or 
                    (now - check.last_check).total_seconds() >= check.interval):
                    checks_to_run.append(check)
        
        # Ejecutar checks en paralelo
        if checks_to_run:
            tasks = [self._run_single_check(check) for check in checks_to_run]
            await asyncio.gather(*tasks, return_exceptions=True)
        
        self._update_overall_status()
    
    async def _run_single_check(self, check: HealthCheck):
        """Ejecuta un health check individual"""
        try:
            # Ejecutar el check con timeout
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, check.check_function
                ),
                timeout=check.timeout
            )
            
            with self.lock:
                check.last_check = datetime.now()
                if result:
                    check.last_status = HealthStatus.HEALTHY
                    check.consecutive_failures = 0
                else:
                    check.last_status = HealthStatus.UNHEALTHY
                    check.consecutive_failures += 1
                    
        except asyncio.TimeoutError:
            with self.lock:
                check.last_check = datetime.now()
                check.last_status = HealthStatus.UNHEALTHY
                check.consecutive_failures += 1
                
        except Exception as e:
            logging.error(f"Health check {check.name} failed: {e}")
            with self.lock:
                check.last_check = datetime.now()
                check.last_status = HealthStatus.UNHEALTHY
                check.consecutive_failures += 1
    
    def _update_overall_status(self):
        """Actualiza el estado general del sistema"""
        with self.lock:
            if not self.health_checks:
                self.overall_status = HealthStatus.UNKNOWN
                return
            
            critical_unhealthy = any(
                check.last_status == HealthStatus.UNHEALTHY and check.critical
                for check in self.health_checks.values()
            )
            
            if critical_unhealthy:
                self.overall_status = HealthStatus.UNHEALTHY
            elif any(check.last_status == HealthStatus.UNHEALTHY 
                    for check in self.health_checks.values()):
                self.overall_status = HealthStatus.DEGRADED
            elif all(check.last_status == HealthStatus.HEALTHY 
                    for check in self.health_checks.values()):
                self.overall_status = HealthStatus.HEALTHY
            else:
                self.overall_status = HealthStatus.UNKNOWN
    
    def get_health_status(self) -> Dict[str, Any]:
        """Obtiene el estado de salud completo"""
        with self.lock:
            return {
                'overall_status': self.overall_status.value,
                'checks': {
                    name: {
                        'status': check.last_status.value,
                        'last_check': check.last_check.isoformat() if check.last_check else None,
                        'consecutive_failures': check.consecutive_failures,
                        'critical': check.critical
                    }
                    for name, check in self.health_checks.items()
                }
            }


class PerformanceMonitor:
    """Monitor de rendimiento del sistema"""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.rate_limiters: Dict[str, RateLimiter] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.lock = threading.Lock()
    
    def create_rate_limiter(self, name: str, config: RateLimitConfig) -> RateLimiter:
        """Crea un rate limiter"""
        with self.lock:
            limiter = RateLimiter(config)
            self.rate_limiters[name] = limiter
            return limiter
    
    def create_circuit_breaker(self, name: str, config: CircuitBreakerConfig) -> CircuitBreaker:
        """Crea un circuit breaker"""
        with self.lock:
            breaker = CircuitBreaker(config)
            self.circuit_breakers[name] = breaker
            return breaker
    
    def get_rate_limiter(self, name: str) -> Optional[RateLimiter]:
        """Obtiene un rate limiter por nombre"""
        with self.lock:
            return self.rate_limiters.get(name)
    
    def get_circuit_breaker(self, name: str) -> Optional[CircuitBreaker]:
        """Obtiene un circuit breaker por nombre"""
        with self.lock:
            return self.circuit_breakers.get(name)
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de rendimiento"""
        with self.lock:
            return {
                'rate_limiters': {
                    name: {
                        'tokens': limiter.tokens,
                        'requests_per_second': limiter.config.requests_per_second,
                        'burst_size': limiter.config.burst_size
                    }
                    for name, limiter in self.rate_limiters.items()
                },
                'circuit_breakers': {
                    name: {
                        'state': breaker.state.value,
                        'failure_count': breaker.failure_count,
                        'success_count': breaker.success_count
                    }
                    for name, breaker in self.circuit_breakers.items()
                }
            }


class MonitoringSystem:
    """Sistema completo de monitoreo y métricas"""
    
    def __init__(self, prometheus_port: int = 8000, enable_prometheus: bool = True):
        self.prometheus_port = prometheus_port
        self.enable_prometheus = enable_prometheus
        
        self.metrics_collector = MetricsCollector(enable_prometheus)
        self.health_monitor = HealthMonitor(self.metrics_collector)
        self.performance_monitor = PerformanceMonitor(self.metrics_collector)
        
        self.prometheus_server_started = False
    
    async def start(self):
        """Inicia el sistema de monitoreo"""
        if self.enable_prometheus and PROMETHEUS_AVAILABLE and not self.prometheus_server_started:
            try:
                start_http_server(self.prometheus_port)
                self.prometheus_server_started = True
                logging.info(f"Prometheus metrics server started on port {self.prometheus_port}")
            except Exception as e:
                logging.warning(f"Failed to start Prometheus server: {e}")
        
        await self.health_monitor.start_monitoring()
        logging.info("Monitoring system started")
    
    async def stop(self):
        """Detiene el sistema de monitoreo"""
        await self.health_monitor.stop_monitoring()
        logging.info("Monitoring system stopped")
    
    def get_system_status(self) -> Dict[str, Any]:
        """Obtiene el estado completo del sistema"""
        return {
            'health': self.health_monitor.get_health_status(),
            'performance': self.performance_monitor.get_performance_stats(),
            'metrics_available': bool(self.metrics_collector.metrics_data),
            'prometheus_enabled': self.enable_prometheus and PROMETHEUS_AVAILABLE
        }