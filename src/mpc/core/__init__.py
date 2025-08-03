"""
Módulo core del sistema MPC
==========================

Contiene las implementaciones principales del sistema.
"""

from .interfaces import (
    ProtocolAdapter,
    MessageRouter,
    ConnectionManager,
    Message,
    ProtocolType,
    MessageType,
    EventHandler
)

from .router import MPCRouter
from .gateway import UnifiedGateway
from .connection_manager import MPCConnectionManager

__all__ = [
    "ProtocolAdapter",
    "MessageRouter", 
    "ConnectionManager",
    "Message",
    "ProtocolType",
    "MessageType",
    "EventHandler",
    "MPCRouter",
    "UnifiedGateway",
    "MPCConnectionManager"
]