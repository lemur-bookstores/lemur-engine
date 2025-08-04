"""Adaptadores de protocolo para el sistema MPC
===========================================

Contiene las implementaciones de todos los adaptadores de protocolo.
"""

from .http_adapter import HTTPAdapter
from .websocket_adapter import WebSocketAdapter

# Importaciones opcionales
try:
    from .grpc_adapter import GRPCAdapter, GRPCClient
    GRPC_AVAILABLE = True
except ImportError:
    GRPCAdapter = None
    GRPCClient = None
    GRPC_AVAILABLE = False

__all__ = [
    "HTTPAdapter",
    "WebSocketAdapter",
]

if GRPC_AVAILABLE:
    __all__.extend(["GRPCAdapter", "GRPCClient"])