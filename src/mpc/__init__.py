"""
Multi-Protocol Communication (MPC) System
=========================================

Sistema de comunicación multi-protocolo que soporta:
- HTTP/HTTPS
- WebSocket
- gRPC
- MCP (Model Context Protocol)

Arquitectura basada en adaptadores con un router central unificado.
"""

__version__ = "1.0.0"
__author__ = "Lemur Engine Team"

from .core.interfaces import (
    ProtocolAdapter,
    MessageRouter,
    ConnectionManager,
    Message
)

from .core.gateway import UnifiedGateway
from .core.router import MPCRouter

__all__ = [
    "ProtocolAdapter",
    "MessageRouter", 
    "ConnectionManager",
    "Message",
    "UnifiedGateway",
    "MPCRouter"
]