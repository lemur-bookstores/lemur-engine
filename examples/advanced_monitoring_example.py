"""
Ejemplo Avanzado de Monitoreo MPC
=================================

Este ejemplo demuestra el sistema completo de monitoreo y métricas
para el sistema MPC, incluyendo:

- Métricas Prometheus
- Health checks
- Rate limiting
- Circuit breakers
- Dashboard web
- Alertas y notificaciones
"""

import asyncio
import logging
import time
import random
from datetime import datetime, timedelta
from typing import Dict, Any

from src.mpc.core.interfaces import Message, MessageType, ProtocolType
from src.mpc.adapters.http_adapter import HTTPAdapter
from src.mpc.adapters.websocket_adapter import WebSocketAdapter
from src.mpc.adapters.grpc_adapter import GRPCAdapter
from src.mpc.monitoring.metrics import (
    MonitoringSystem,
    HealthCheck,
    RateLimitConfig,
    CircuitBreakerConfig,
    HealthStatus
)
from src.mpc.monitoring.dashboard import DashboardServer, MetricsDashboard


# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AdvancedMonitoringExample:
    """Ejemplo avanzado del sistema de monitoreo"""
    
    def __init__(self):
        # Sistema de monitoreo
        self.monitoring_system = MonitoringSystem(
            prometheus_port=9090,
            enable_prometheus=True
        )
        
        # Adaptadores con monitoreo
        self.http_adapter = HTTPAdapter(
            host="localhost",
            port=8080,
            metrics_collector=self.monitoring_system.metrics_collector
        )
        
        self.websocket_adapter = WebSocketAdapter(
            host="localhost",
            port=8081,
            metrics_collector=self.monitoring_system.metrics_collector
        )
        
        self.grpc_adapter = GRPCAdapter(
            host="localhost",
            port=50051,
            metrics_collector=self.monitoring_system.metrics_collector
        )
        
        # Dashboard
        self.dashboard_server = DashboardServer(
            self.monitoring_system,
            port=8888
        )
        
        self.text_dashboard = MetricsDashboard(self.monitoring_system)
        
        # Estado del ejemplo
        self.running = False
        self.tasks = []
    
    async def setup_health_checks(self):
        """Configura los health checks del sistema"""
        
        # Health check para HTTP
        def check_http_health():
            return self.http_adapter.is_connected()
        
        http_check = HealthCheck(
            name="http_adapter",
            check_function=check_http_health,
            timeout=5.0,
            critical=True,
            interval=30.0
        )
        
        # Health check para WebSocket
        def check_websocket_health():
            return self.websocket_adapter.is_connected()
        
        websocket_check = HealthCheck(
            name="websocket_adapter",
            check_function=check_websocket_health,
            timeout=5.0,
            critical=True,
            interval=30.0
        )
        
        # Health check para gRPC
        def check_grpc_health():
            return self.grpc_adapter.is_connected()
        
        grpc_check = HealthCheck(
            name="grpc_adapter",
            check_function=check_grpc_health,
            timeout=5.0,
            critical=True,
            interval=30.0
        )
        
        # Health check de memoria
        def check_memory_usage():
            import psutil
            memory_percent = psutil.virtual_memory().percent
            return memory_percent < 90  # Falla si memoria > 90%
        
        memory_check = HealthCheck(
            name="memory_usage",
            check_function=check_memory_usage,
            timeout=3.0,
            critical=False,
            interval=60.0
        )
        
        # Health check de CPU
        def check_cpu_usage():
            import psutil
            cpu_percent = psutil.cpu_percent(interval=1)
            return cpu_percent < 95  # Falla si CPU > 95%
        
        cpu_check = HealthCheck(
            name="cpu_usage",
            check_function=check_cpu_usage,
            timeout=5.0,
            critical=False,
            interval=60.0
        )
        
        # Registrar health checks
        self.monitoring_system.health_monitor.register_health_check(http_check)
        self.monitoring_system.health_monitor.register_health_check(websocket_check)
        self.monitoring_system.health_monitor.register_health_check(grpc_check)
        self.monitoring_system.health_monitor.register_health_check(memory_check)
        self.monitoring_system.health_monitor.register_health_check(cpu_check)
        
        logger.info("Health checks configurados")
    
    def setup_rate_limiters(self):
        """Configura los rate limiters"""
        
        # Rate limiter para HTTP
        http_config = RateLimitConfig(
            requests_per_second=100.0,
            burst_size=20,
            window_size=1.0
        )
        self.monitoring_system.performance_monitor.create_rate_limiter(
            "http_requests", http_config
        )
        
        # Rate limiter para WebSocket
        ws_config = RateLimitConfig(
            requests_per_second=200.0,
            burst_size=50,
            window_size=1.0
        )
        self.monitoring_system.performance_monitor.create_rate_limiter(
            "websocket_messages", ws_config
        )
        
        # Rate limiter para gRPC
        grpc_config = RateLimitConfig(
            requests_per_second=500.0,
            burst_size=100,
            window_size=1.0
        )
        self.monitoring_system.performance_monitor.create_rate_limiter(
            "grpc_calls", grpc_config
        )
        
        logger.info("Rate limiters configurados")
    
    def setup_circuit_breakers(self):
        """Configura los circuit breakers"""
        
        # Circuit breaker para servicios externos
        external_config = CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout=60.0,
            success_threshold=3,
            timeout=30.0
        )
        self.monitoring_system.performance_monitor.create_circuit_breaker(
            "external_service", external_config
        )
        
        # Circuit breaker para base de datos
        db_config = CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=30.0,
            success_threshold=2,
            timeout=10.0
        )
        self.monitoring_system.performance_monitor.create_circuit_breaker(
            "database", db_config
        )
        
        logger.info("Circuit breakers configurados")
    
    async def start_all_services(self):
        """Inicia todos los servicios"""
        logger.info("Iniciando servicios...")
        
        # Iniciar sistema de monitoreo
        await self.monitoring_system.start()
        
        # Configurar monitoreo
        await self.setup_health_checks()
        self.setup_rate_limiters()
        self.setup_circuit_breakers()
        
        # Iniciar adaptadores
        await self.http_adapter.start()
        await self.websocket_adapter.start()
        await self.grpc_adapter.start()
        
        # Iniciar dashboard
        await self.dashboard_server.start()
        
        self.running = True
        logger.info("Todos los servicios iniciados")
        
        # Mostrar URLs
        print("\n" + "="*60)
        print("🚀 SISTEMA MPC CON MONITOREO INICIADO")
        print("="*60)
        print(f"📊 Dashboard Web: http://localhost:8888")
        print(f"📈 Métricas Prometheus: http://localhost:9090/metrics")
        print(f"🌐 HTTP Adapter: http://localhost:8080")
        print(f"🔌 WebSocket Adapter: ws://localhost:8081")
        print(f"⚡ gRPC Adapter: localhost:50051")
        print("="*60)
    
    async def stop_all_services(self):
        """Detiene todos los servicios"""
        logger.info("Deteniendo servicios...")
        
        self.running = False
        
        # Cancelar tareas
        for task in self.tasks:
            task.cancel()
        
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        
        # Detener servicios
        await self.dashboard_server.stop()
        await self.grpc_adapter.stop()
        await self.websocket_adapter.stop()
        await self.http_adapter.stop()
        await self.monitoring_system.stop()
        
        logger.info("Todos los servicios detenidos")
    
    async def simulate_traffic(self):
        """Simula tráfico en el sistema"""
        logger.info("Iniciando simulación de tráfico...")
        
        while self.running:
            try:
                # Simular diferentes tipos de requests
                await self._simulate_http_requests()
                await self._simulate_websocket_messages()
                await self._simulate_grpc_calls()
                
                # Simular errores ocasionales
                if random.random() < 0.1:  # 10% de probabilidad
                    await self._simulate_errors()
                
                # Esperar antes del siguiente ciclo
                await asyncio.sleep(random.uniform(0.5, 2.0))
                
            except Exception as e:
                logger.error(f"Error en simulación de tráfico: {e}")
                await asyncio.sleep(1.0)
    
    async def _simulate_http_requests(self):
        """Simula requests HTTP"""
        rate_limiter = self.monitoring_system.performance_monitor.get_rate_limiter("http_requests")
        
        if rate_limiter and rate_limiter.is_allowed():
            # Simular request HTTP exitoso
            start_time = time.time()
            
            # Simular procesamiento
            await asyncio.sleep(random.uniform(0.01, 0.1))
            
            duration = time.time() - start_time
            
            # Registrar métricas
            self.monitoring_system.metrics_collector.record_request(
                "http", "GET", "success", duration
            )
            self.monitoring_system.metrics_collector.record_message(
                "http", "request", "inbound", random.randint(100, 1000)
            )
    
    async def _simulate_websocket_messages(self):
        """Simula mensajes WebSocket"""
        rate_limiter = self.monitoring_system.performance_monitor.get_rate_limiter("websocket_messages")
        
        if rate_limiter and rate_limiter.is_allowed():
            # Simular mensaje WebSocket
            start_time = time.time()
            
            # Simular procesamiento
            await asyncio.sleep(random.uniform(0.005, 0.05))
            
            duration = time.time() - start_time
            
            # Registrar métricas
            self.monitoring_system.metrics_collector.record_request(
                "websocket", "message", "success", duration
            )
            self.monitoring_system.metrics_collector.record_message(
                "websocket", "message", "bidirectional", random.randint(50, 500)
            )
    
    async def _simulate_grpc_calls(self):
        """Simula llamadas gRPC"""
        rate_limiter = self.monitoring_system.performance_monitor.get_rate_limiter("grpc_calls")
        
        if rate_limiter and rate_limiter.is_allowed():
            # Simular llamada gRPC
            start_time = time.time()
            
            # Simular procesamiento
            await asyncio.sleep(random.uniform(0.002, 0.02))
            
            duration = time.time() - start_time
            
            # Registrar métricas
            self.monitoring_system.metrics_collector.record_request(
                "grpc", "SendMessage", "success", duration
            )
            self.monitoring_system.metrics_collector.record_message(
                "grpc", "rpc", "bidirectional", random.randint(200, 2000)
            )
    
    async def _simulate_errors(self):
        """Simula errores en el sistema"""
        error_types = [
            ("http", "timeout_error", "408"),
            ("websocket", "connection_error", "1006"),
            ("grpc", "unavailable_error", "14"),
            ("database", "connection_timeout", "timeout"),
            ("external_service", "service_unavailable", "503")
        ]
        
        protocol, error_type, error_code = random.choice(error_types)
        
        self.monitoring_system.metrics_collector.record_error(
            protocol, error_type, error_code
        )
        
        # Simular falla en circuit breaker
        if protocol in ["database", "external_service"]:
            circuit_breaker = self.monitoring_system.performance_monitor.get_circuit_breaker(protocol)
            if circuit_breaker:
                circuit_breaker._on_failure()
    
    async def monitor_resources(self):
        """Monitorea recursos del sistema"""
        logger.info("Iniciando monitoreo de recursos...")
        
        try:
            import psutil
        except ImportError:
            logger.warning("psutil no disponible, saltando monitoreo de recursos")
            return
        
        while self.running:
            try:
                # Obtener métricas de sistema
                memory = psutil.virtual_memory()
                cpu_percent = psutil.cpu_percent(interval=1)
                
                # Registrar métricas de recursos
                self.monitoring_system.metrics_collector.record_resource_usage(
                    "system", memory.used, cpu_percent
                )
                
                # Métricas específicas de MPC
                self.monitoring_system.metrics_collector.record_resource_usage(
                    "mpc_http", memory.used // 4, cpu_percent * 0.3
                )
                self.monitoring_system.metrics_collector.record_resource_usage(
                    "mpc_websocket", memory.used // 4, cpu_percent * 0.3
                )
                self.monitoring_system.metrics_collector.record_resource_usage(
                    "mpc_grpc", memory.used // 4, cpu_percent * 0.4
                )
                
                await asyncio.sleep(10)  # Cada 10 segundos
                
            except Exception as e:
                logger.error(f"Error monitoreando recursos: {e}")
                await asyncio.sleep(5)
    
    async def print_dashboard_periodically(self):
        """Imprime el dashboard en consola periódicamente"""
        while self.running:
            try:
                print("\n" + "="*80)
                self.text_dashboard.print_dashboard()
                print("="*80)
                
                await asyncio.sleep(30)  # Cada 30 segundos
                
            except Exception as e:
                logger.error(f"Error imprimiendo dashboard: {e}")
                await asyncio.sleep(10)
    
    async def run_example(self, duration: int = 300):
        """Ejecuta el ejemplo completo"""
        try:
            # Iniciar servicios
            await self.start_all_services()
            
            # Iniciar tareas de simulación
            self.tasks = [
                asyncio.create_task(self.simulate_traffic()),
                asyncio.create_task(self.monitor_resources()),
                asyncio.create_task(self.print_dashboard_periodically())
            ]
            
            logger.info(f"Ejecutando ejemplo por {duration} segundos...")
            
            # Ejecutar por el tiempo especificado
            await asyncio.sleep(duration)
            
        except KeyboardInterrupt:
            logger.info("Ejemplo interrumpido por el usuario")
        finally:
            await self.stop_all_services()


async def main():
    """Función principal del ejemplo"""
    print("🚀 Iniciando Ejemplo Avanzado de Monitoreo MPC")
    print("=" * 60)
    
    example = AdvancedMonitoringExample()
    
    try:
        # Ejecutar ejemplo por 5 minutos
        await example.run_example(duration=300)
    except Exception as e:
        logger.error(f"Error en ejemplo: {e}")
    
    print("\n✅ Ejemplo completado")


if __name__ == "__main__":
    asyncio.run(main())