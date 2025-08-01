"""Sistema MPC (Multi-Protocol Communication)
=========================================

Sistema unificado de comunicación multi-protocolo que soporta:
- HTTP/HTTPS (REST API)
- WebSocket (Comunicación bidireccional en tiempo real)
- gRPC (Comunicación de alto rendimiento)
- Monitoreo y Métricas (Prometheus, Health Checks, Rate Limiting)
- MCP (Model Context Protocol) - Integración con LLMs y AI

Versión: 5.0.0 (Fase 5 - MCP: Model Context Protocol)
"""

__version__ = "5.0.0"
__author__ = "Lemur Engine Team"
__description__ = "Multi-Protocol Communication System with MCP and AI Integration"

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

# MCP system (Fase 5)
try:
    from ..mcp.adapters.mcp_adapter import MCPAdapter
    from ..mcp.adapters.mcp_client import MCPClient
    from ..mcp.core.integration import MCPIntegrationSystem
    from ..mcp.core.plugin_system import MCPPluginManager
    from ..mcp.core.resource_manager import MCPResourceManager, MCPToolManager
    from ..mcp.core.config import MCPConfig, DEFAULT_MCP_CONFIG
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False

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
    
    # MCP system (Fase 5) - conditional
    *(['MCPAdapter', 'MCPClient', 'MCPIntegrationSystem', 'MCPPluginManager', 
       'MCPResourceManager', 'MCPToolManager', 'MCPConfig', 'DEFAULT_MCP_CONFIG'] 
      if MCP_AVAILABLE else []),
    
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
    '__description__',
    'MCP_AVAILABLE'
]