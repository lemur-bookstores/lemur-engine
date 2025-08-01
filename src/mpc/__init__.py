"""Sistema MPC (Multi-Protocol Communication)
=========================================

Sistema unificado de comunicación multi-protocolo que soporta:
- HTTP/HTTPS (REST API)
- WebSocket (Comunicación bidireccional en tiempo real)
- gRPC (Comunicación de alto rendimiento)
- Monitoreo y Métricas (Prometheus, Health Checks, Rate Limiting)
- MCP (Model Context Protocol) - Próximamente

Versión: 4.0.0 (Fase 4 - Monitoring & Performance)
"""

__version__ = "4.0.0"
__author__ = "Lemur Engine Team"
__description__ = "Multi-Protocol Communication System with Advanced Monitoring"

# Core interfaces and classes
from .core.interfaces import (
    ProtocolAdapter,
    MessageRouter,
    ConnectionManager,
    Message,
    ProtocolType,
    MessageType,
    EventHandler
)

# Core implementations
from .core.router import MPCRouter
from .core.gateway import UnifiedGateway
from .core.connection_manager import MPCConnectionManager

# Protocol adapters
from .adapters.http_adapter import HTTPAdapter
from .adapters.websocket_adapter import WebSocketAdapter
from .adapters.grpc_adapter import GRPCAdapter

# Monitoring system (Fase 4)
from .monitoring.metrics import (
    MetricsCollector,
    HealthMonitor,
    PerformanceMonitor,
    MonitoringSystem,
    HealthCheck,
    HealthStatus,
    RateLimiter,
    RateLimitConfig,
    CircuitBreaker,
    CircuitBreakerConfig
)
from .monitoring.dashboard import DashboardServer, MetricsDashboard

__all__ = [
    # Core interfaces
    'ProtocolAdapter',
    'MessageRouter', 
    'ConnectionManager',
    'Message',
    'ProtocolType',
    'MessageType',
    'EventHandler',
    
    # Core implementations
    'MPCRouter',
    'UnifiedGateway',
    'MPCConnectionManager',
    
    # Protocol adapters
    'HTTPAdapter',
    'WebSocketAdapter',
    'GRPCAdapter',
    
    # Monitoring system (Fase 4)
    'MetricsCollector',
    'HealthMonitor',
    'PerformanceMonitor',
    'MonitoringSystem',
    'HealthCheck',
    'HealthStatus',
    'RateLimiter',
    'RateLimitConfig',
    'CircuitBreaker',
    'CircuitBreakerConfig',
    'DashboardServer',
    'MetricsDashboard',
    
    # Metadata
    '__version__',
    '__author__',
    '__description__'
]