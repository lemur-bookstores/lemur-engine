"""
Tests para el Sistema de Monitoreo MPC
=====================================

Tests completos para métricas, health checks, rate limiting,
circuit breakers y dashboard.
"""

import pytest
import asyncio
import time
import json
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from src.mpc.monitoring.metrics import (
    MetricsCollector,
    HealthMonitor,
    PerformanceMonitor,
    MonitoringSystem,
    HealthCheck,
    HealthStatus,
    RateLimiter,
    RateLimitConfig,
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerState,
    CircuitBreakerOpenError,
    MetricPoint
)
from src.mpc.monitoring.dashboard import DashboardServer, MetricsDashboard


class TestMetricsCollector:
    """Tests para MetricsCollector"""
    
    def test_init_without_prometheus(self):
        """Test inicialización sin Prometheus"""
        collector = MetricsCollector(enable_prometheus=False)
        assert not collector.enable_prometheus
        assert collector.metrics_data == {}
    
    @patch('src.mpc.monitoring.metrics.PROMETHEUS_AVAILABLE', True)
    def test_init_with_prometheus(self):
        """Test inicialización con Prometheus"""
        collector = MetricsCollector(enable_prometheus=True)
        assert collector.enable_prometheus
    
    def test_record_request(self):
        """Test registro de requests"""
        collector = MetricsCollector(enable_prometheus=False)
        
        collector.record_request("http", "GET", "success", 0.5)
        
        # Verificar métricas almacenadas
        request_metrics = collector.get_metrics("request_count")
        assert len(request_metrics) == 1
        assert request_metrics[0].value == 1
        assert request_metrics[0].labels == {
            'protocol': 'http', 'method': 'GET', 'status': 'success'
        }
        
        duration_metrics = collector.get_metrics("request_duration")
        assert len(duration_metrics) == 1
        assert duration_metrics[0].value == 0.5
    
    def test_record_connection(self):
        """Test registro de conexiones"""
        collector = MetricsCollector(enable_prometheus=False)
        
        collector.record_connection("websocket", "new", 5)
        
        metrics = collector.get_metrics("connection_count")
        assert len(metrics) == 1
        assert metrics[0].value == 1
        
        active_metrics = collector.get_metrics("active_connections")
        assert len(active_metrics) == 1
        assert active_metrics[0].value == 5
    
    def test_record_message(self):
        """Test registro de mensajes"""
        collector = MetricsCollector(enable_prometheus=False)
        
        collector.record_message("grpc", "request", "inbound", 1024)
        
        count_metrics = collector.get_metrics("message_count")
        assert len(count_metrics) == 1
        assert count_metrics[0].labels['direction'] == 'inbound'
        
        size_metrics = collector.get_metrics("message_size")
        assert len(size_metrics) == 1
        assert size_metrics[0].value == 1024
    
    def test_record_error(self):
        """Test registro de errores"""
        collector = MetricsCollector(enable_prometheus=False)
        
        collector.record_error("http", "timeout", "408")
        
        metrics = collector.get_metrics("error_count")
        assert len(metrics) == 1
        assert metrics[0].labels == {
            'protocol': 'http', 'type': 'timeout', 'code': '408'
        }
    
    def test_record_resource_usage(self):
        """Test registro de uso de recursos"""
        collector = MetricsCollector(enable_prometheus=False)
        
        collector.record_resource_usage("system", 1024*1024*100, 75.5)
        
        memory_metrics = collector.get_metrics("memory_usage")
        assert len(memory_metrics) == 1
        assert memory_metrics[0].value == 1024*1024*100
        
        cpu_metrics = collector.get_metrics("cpu_usage")
        assert len(cpu_metrics) == 1
        assert cpu_metrics[0].value == 75.5
    
    def test_get_metrics_with_time_filter(self):
        """Test obtener métricas con filtro de tiempo"""
        collector = MetricsCollector(enable_prometheus=False)
        
        # Registrar métricas en diferentes momentos
        now = time.time()
        collector._store_metric("test", 1, {})
        
        # Simular métrica más antigua
        old_metric = MetricPoint(now - 100, 2, {})
        collector.metrics_data["test"].insert(0, old_metric)
        
        # Obtener métricas desde hace 50 segundos
        recent_metrics = collector.get_metrics("test", since=now - 50)
        assert len(recent_metrics) == 1
        assert recent_metrics[0].value == 1
    
    def test_metrics_limit(self):
        """Test límite de métricas almacenadas"""
        collector = MetricsCollector(enable_prometheus=False)
        
        # Añadir más de 1000 métricas
        for i in range(1200):
            collector._store_metric("test", i, {})
        
        metrics = collector.get_metrics("test")
        assert len(metrics) == 1000  # Debe mantener solo las últimas 1000


class TestRateLimiter:
    """Tests para RateLimiter"""
    
    def test_init(self):
        """Test inicialización"""
        config = RateLimitConfig(requests_per_second=10.0, burst_size=5)
        limiter = RateLimiter(config)
        
        assert limiter.config == config
        assert limiter.tokens == 5  # burst_size inicial
    
    def test_allow_requests_within_burst(self):
        """Test permitir requests dentro del burst"""
        config = RateLimitConfig(requests_per_second=10.0, burst_size=3)
        limiter = RateLimiter(config)
        
        # Debe permitir hasta burst_size requests
        assert limiter.is_allowed() == True
        assert limiter.is_allowed() == True
        assert limiter.is_allowed() == True
        assert limiter.is_allowed() == False  # Excede burst
    
    def test_token_replenishment(self):
        """Test reposición de tokens"""
        config = RateLimitConfig(requests_per_second=10.0, burst_size=2)
        limiter = RateLimiter(config)
        
        # Consumir todos los tokens
        limiter.is_allowed()
        limiter.is_allowed()
        assert limiter.is_allowed() == False
        
        # Simular paso del tiempo
        limiter.last_update = time.time() - 0.2  # 0.2 segundos atrás
        
        # Debe permitir 2 nuevos tokens (10 req/s * 0.2s = 2 tokens)
        assert limiter.is_allowed() == True
        assert limiter.is_allowed() == True
        assert limiter.is_allowed() == False
    
    def test_get_wait_time(self):
        """Test cálculo de tiempo de espera"""
        config = RateLimitConfig(requests_per_second=10.0, burst_size=1)
        limiter = RateLimiter(config)
        
        # Consumir token
        limiter.is_allowed()
        
        # Debe calcular tiempo de espera
        wait_time = limiter.get_wait_time()
        assert wait_time > 0
        assert wait_time <= 0.1  # Máximo 1/10 segundo


class TestCircuitBreaker:
    """Tests para CircuitBreaker"""
    
    def test_init(self):
        """Test inicialización"""
        config = CircuitBreakerConfig(failure_threshold=3)
        breaker = CircuitBreaker(config)
        
        assert breaker.config == config
        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.failure_count == 0
    
    def test_successful_call(self):
        """Test llamada exitosa"""
        config = CircuitBreakerConfig(failure_threshold=3)
        breaker = CircuitBreaker(config)
        
        def success_func():
            return "success"
        
        result = breaker.call(success_func)
        assert result == "success"
        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.failure_count == 0
    
    def test_failed_call(self):
        """Test llamada fallida"""
        config = CircuitBreakerConfig(failure_threshold=2)
        breaker = CircuitBreaker(config)
        
        def fail_func():
            raise Exception("Test error")
        
        # Primera falla
        with pytest.raises(Exception):
            breaker.call(fail_func)
        assert breaker.failure_count == 1
        assert breaker.state == CircuitBreakerState.CLOSED
        
        # Segunda falla - debe abrir el circuit breaker
        with pytest.raises(Exception):
            breaker.call(fail_func)
        assert breaker.failure_count == 2
        assert breaker.state == CircuitBreakerState.OPEN
    
    def test_circuit_breaker_open(self):
        """Test circuit breaker abierto"""
        config = CircuitBreakerConfig(failure_threshold=1)
        breaker = CircuitBreaker(config)
        
        def fail_func():
            raise Exception("Test error")
        
        # Forzar apertura
        with pytest.raises(Exception):
            breaker.call(fail_func)
        
        # Debe rechazar llamadas
        with pytest.raises(CircuitBreakerOpenError):
            breaker.call(lambda: "success")
    
    def test_half_open_recovery(self):
        """Test recuperación en estado half-open"""
        config = CircuitBreakerConfig(
            failure_threshold=1,
            recovery_timeout=0.1,
            success_threshold=2
        )
        breaker = CircuitBreaker(config)
        
        # Forzar apertura
        with pytest.raises(Exception):
            breaker.call(lambda: (_ for _ in ()).throw(Exception("Test")))
        
        # Esperar tiempo de recuperación
        time.sleep(0.2)
        
        # Debe permitir llamadas en half-open
        result = breaker.call(lambda: "success1")
        assert result == "success1"
        assert breaker.state == CircuitBreakerState.HALF_OPEN
        
        # Segunda llamada exitosa debe cerrar el circuit
        result = breaker.call(lambda: "success2")
        assert result == "success2"
        assert breaker.state == CircuitBreakerState.CLOSED
    
    @pytest.mark.asyncio
    async def test_async_call(self):
        """Test llamada asíncrona"""
        config = CircuitBreakerConfig(failure_threshold=3)
        breaker = CircuitBreaker(config)
        
        async def async_success():
            return "async_success"
        
        result = await breaker.acall(async_success)
        assert result == "async_success"


class TestHealthCheck:
    """Tests para HealthCheck"""
    
    def test_health_check_creation(self):
        """Test creación de health check"""
        def check_func():
            return True
        
        check = HealthCheck(
            name="test_check",
            check_function=check_func,
            timeout=5.0,
            critical=True,
            interval=30.0
        )
        
        assert check.name == "test_check"
        assert check.check_function == check_func
        assert check.timeout == 5.0
        assert check.critical == True
        assert check.interval == 30.0
        assert check.last_status == HealthStatus.UNKNOWN


class TestHealthMonitor:
    """Tests para HealthMonitor"""
    
    def test_init(self):
        """Test inicialización"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        assert monitor.metrics_collector == metrics_collector
        assert monitor.health_checks == {}
        assert monitor.overall_status == HealthStatus.UNKNOWN
    
    def test_register_health_check(self):
        """Test registro de health check"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        check = HealthCheck("test", lambda: True)
        monitor.register_health_check(check)
        
        assert "test" in monitor.health_checks
        assert monitor.health_checks["test"] == check
    
    def test_unregister_health_check(self):
        """Test desregistro de health check"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        check = HealthCheck("test", lambda: True)
        monitor.register_health_check(check)
        monitor.unregister_health_check("test")
        
        assert "test" not in monitor.health_checks
    
    @pytest.mark.asyncio
    async def test_run_single_check_success(self):
        """Test ejecución exitosa de health check"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        check = HealthCheck("test", lambda: True, timeout=1.0)
        await monitor._run_single_check(check)
        
        assert check.last_status == HealthStatus.HEALTHY
        assert check.consecutive_failures == 0
        assert check.last_check is not None
    
    @pytest.mark.asyncio
    async def test_run_single_check_failure(self):
        """Test ejecución fallida de health check"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        check = HealthCheck("test", lambda: False, timeout=1.0)
        await monitor._run_single_check(check)
        
        assert check.last_status == HealthStatus.UNHEALTHY
        assert check.consecutive_failures == 1
    
    @pytest.mark.asyncio
    async def test_run_single_check_timeout(self):
        """Test timeout en health check"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        def slow_check():
            time.sleep(2)
            return True
        
        check = HealthCheck("test", slow_check, timeout=0.1)
        await monitor._run_single_check(check)
        
        assert check.last_status == HealthStatus.UNHEALTHY
        assert check.consecutive_failures == 1
    
    def test_update_overall_status(self):
        """Test actualización de estado general"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        # Sin checks
        monitor._update_overall_status()
        assert monitor.overall_status == HealthStatus.UNKNOWN
        
        # Con check crítico saludable
        check1 = HealthCheck("critical", lambda: True, critical=True)
        check1.last_status = HealthStatus.HEALTHY
        monitor.health_checks["critical"] = check1
        
        monitor._update_overall_status()
        assert monitor.overall_status == HealthStatus.HEALTHY
        
        # Con check crítico no saludable
        check1.last_status = HealthStatus.UNHEALTHY
        monitor._update_overall_status()
        assert monitor.overall_status == HealthStatus.UNHEALTHY
        
        # Con check no crítico no saludable
        check1.last_status = HealthStatus.HEALTHY
        check2 = HealthCheck("non_critical", lambda: True, critical=False)
        check2.last_status = HealthStatus.UNHEALTHY
        monitor.health_checks["non_critical"] = check2
        
        monitor._update_overall_status()
        assert monitor.overall_status == HealthStatus.DEGRADED
    
    def test_get_health_status(self):
        """Test obtener estado de salud"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = HealthMonitor(metrics_collector)
        
        check = HealthCheck("test", lambda: True)
        check.last_status = HealthStatus.HEALTHY
        check.last_check = datetime.now()
        check.consecutive_failures = 0
        monitor.health_checks["test"] = check
        monitor.overall_status = HealthStatus.HEALTHY
        
        status = monitor.get_health_status()
        
        assert status["overall_status"] == "healthy"
        assert "test" in status["checks"]
        assert status["checks"]["test"]["status"] == "healthy"
        assert status["checks"]["test"]["consecutive_failures"] == 0


class TestPerformanceMonitor:
    """Tests para PerformanceMonitor"""
    
    def test_init(self):
        """Test inicialización"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = PerformanceMonitor(metrics_collector)
        
        assert monitor.metrics_collector == metrics_collector
        assert monitor.rate_limiters == {}
        assert monitor.circuit_breakers == {}
    
    def test_create_rate_limiter(self):
        """Test creación de rate limiter"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = PerformanceMonitor(metrics_collector)
        
        config = RateLimitConfig(requests_per_second=10.0)
        limiter = monitor.create_rate_limiter("test", config)
        
        assert isinstance(limiter, RateLimiter)
        assert monitor.rate_limiters["test"] == limiter
    
    def test_create_circuit_breaker(self):
        """Test creación de circuit breaker"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = PerformanceMonitor(metrics_collector)
        
        config = CircuitBreakerConfig(failure_threshold=5)
        breaker = monitor.create_circuit_breaker("test", config)
        
        assert isinstance(breaker, CircuitBreaker)
        assert monitor.circuit_breakers["test"] == breaker
    
    def test_get_performance_stats(self):
        """Test obtener estadísticas de rendimiento"""
        metrics_collector = MetricsCollector(enable_prometheus=False)
        monitor = PerformanceMonitor(metrics_collector)
        
        # Crear rate limiter y circuit breaker
        rate_config = RateLimitConfig(requests_per_second=10.0, burst_size=5)
        monitor.create_rate_limiter("test_limiter", rate_config)
        
        circuit_config = CircuitBreakerConfig(failure_threshold=3)
        monitor.create_circuit_breaker("test_breaker", circuit_config)
        
        stats = monitor.get_performance_stats()
        
        assert "rate_limiters" in stats
        assert "circuit_breakers" in stats
        assert "test_limiter" in stats["rate_limiters"]
        assert "test_breaker" in stats["circuit_breakers"]


class TestMonitoringSystem:
    """Tests para MonitoringSystem"""
    
    def test_init(self):
        """Test inicialización"""
        system = MonitoringSystem(prometheus_port=9090, enable_prometheus=False)
        
        assert system.prometheus_port == 9090
        assert system.enable_prometheus == False
        assert isinstance(system.metrics_collector, MetricsCollector)
        assert isinstance(system.health_monitor, HealthMonitor)
        assert isinstance(system.performance_monitor, PerformanceMonitor)
    
    @pytest.mark.asyncio
    async def test_start_stop(self):
        """Test inicio y parada del sistema"""
        system = MonitoringSystem(enable_prometheus=False)
        
        await system.start()
        assert system.health_monitor.running == True
        
        await system.stop()
        assert system.health_monitor.running == False
    
    def test_get_system_status(self):
        """Test obtener estado del sistema"""
        system = MonitoringSystem(enable_prometheus=False)
        
        status = system.get_system_status()
        
        assert "health" in status
        assert "performance" in status
        assert "metrics_available" in status
        assert "prometheus_enabled" in status


class TestMetricsDashboard:
    """Tests para MetricsDashboard"""
    
    def test_init(self):
        """Test inicialización"""
        system = MonitoringSystem(enable_prometheus=False)
        dashboard = MetricsDashboard(system)
        
        assert dashboard.monitoring_system == system
    
    def test_generate_text_dashboard(self):
        """Test generación de dashboard de texto"""
        system = MonitoringSystem(enable_prometheus=False)
        dashboard = MetricsDashboard(system)
        
        # Añadir algunos datos de prueba
        check = HealthCheck("test", lambda: True)
        check.last_status = HealthStatus.HEALTHY
        system.health_monitor.health_checks["test"] = check
        system.health_monitor.overall_status = HealthStatus.HEALTHY
        
        text = dashboard.generate_text_dashboard()
        
        assert "MPC MONITORING DASHBOARD" in text
        assert "HEALTH STATUS" in text
        assert "PERFORMANCE" in text
        assert "SYSTEM INFO" in text
        assert "healthy" in text.lower()


@pytest.mark.asyncio
async def test_integration_monitoring_system():
    """Test de integración del sistema completo"""
    system = MonitoringSystem(enable_prometheus=False)
    
    # Configurar health check
    def test_check():
        return True
    
    check = HealthCheck("integration_test", test_check)
    system.health_monitor.register_health_check(check)
    
    # Configurar rate limiter
    rate_config = RateLimitConfig(requests_per_second=100.0)
    system.performance_monitor.create_rate_limiter("integration", rate_config)
    
    # Configurar circuit breaker
    circuit_config = CircuitBreakerConfig(failure_threshold=5)
    system.performance_monitor.create_circuit_breaker("integration", circuit_config)
    
    # Iniciar sistema
    await system.start()
    
    # Simular actividad
    system.metrics_collector.record_request("test", "GET", "success", 0.1)
    system.metrics_collector.record_connection("test", "new", 1)
    system.metrics_collector.record_message("test", "request", "inbound", 100)
    
    # Esperar un poco para que se ejecuten los health checks
    await asyncio.sleep(0.1)
    
    # Verificar estado
    status = system.get_system_status()
    assert status["metrics_available"] == True
    assert "integration_test" in status["health"]["checks"]
    
    # Detener sistema
    await system.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])