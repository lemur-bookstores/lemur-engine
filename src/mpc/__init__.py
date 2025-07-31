"""Sistema MPC (Multi-Protocol Communication)
=========================================

Sistema unificado de comunicación multi-protocolo que soporta:
- HTTP/HTTPS (REST API)
- WebSocket (Comunicación bidireccional en tiempo real)
- gRPC (Comunicación de alto rendimiento)
- MCP (Model Context Protocol) - Próximamente

Versión: 3.0.0 (Fase 3 - gRPC Integration)
"""

__version__ = "3.0.0"
__author__ = "Lemur Engine Team"
__description__ = "Multi-Protocol Communication System"

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
    
    # Metadata
    '__version__',
    '__author__',
    '__description__'
]