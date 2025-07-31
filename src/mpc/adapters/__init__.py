"""
Adaptadores de protocolo para el sistema MPC
===========================================

Contiene las implementaciones de todos los adaptadores de protocolo.
"""

from .http_adapter import HTTPAdapter
from .websocket_adapter import WebSocketAdapter

__all__ = [
    "HTTPAdapter",
    "WebSocketAdapter"
]