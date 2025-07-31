"""Sistema MPC (Multi-Protocol Communication)
=========================================

Sistema unificado de comunicación multi-protocolo que soporta:
- HTTP/HTTPS (REST API)
- WebSocket (Comunicación bidireccional en tiempo real)
- gRPC (Comunicación de alto rendimiento) - Próximamente
- MCP (Model Context Protocol) - Próximamente

Versión: 2.0.0 (Fase 2 - WebSocket Integration)
"""

__version__ = "2.0.0"
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
    
    # Metadata
    '__version__',
    '__author__',
    '__description__'
]