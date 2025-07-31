"""
Interfaces principales del sistema MPC
=====================================

Define las interfaces base que deben implementar todos los adaptadores
de protocolo y componentes del sistema.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Union, AsyncGenerator
from dataclasses import dataclass
from enum import Enum
import asyncio


class ProtocolType(Enum):
    """Tipos de protocolo soportados"""
    HTTP = "http"
    WEBSOCKET = "websocket"
    GRPC = "grpc"
    MCP = "mcp"


class MessageType(Enum):
    """Tipos de mensaje"""
    REQUEST = "request"
    RESPONSE = "response"
    EVENT = "event"
    ERROR = "error"


@dataclass
class Message:
    """Mensaje unificado para todos los protocolos"""
    id: str
    type: MessageType
    protocol: ProtocolType
    payload: Dict[str, Any]
    metadata: Dict[str, Any]
    timestamp: float
    source: Optional[str] = None
    destination: Optional[str] = None
    correlation_id: Optional[str] = None


class ProtocolAdapter(ABC):
    """Interface base para todos los adaptadores de protocolo"""
    
    @property
    @abstractmethod
    def protocol_type(self) -> ProtocolType:
        """Retorna el tipo de protocolo que maneja este adaptador"""
        pass
    
    @abstractmethod
    async def start(self) -> None:
        """Inicia el adaptador de protocolo"""
        pass
    
    @abstractmethod
    async def stop(self) -> None:
        """Detiene el adaptador de protocolo"""
        pass
    
    @abstractmethod
    async def send_message(self, message: Message) -> None:
        """Envía un mensaje a través del protocolo"""
        pass
    
    @abstractmethod
    async def receive_messages(self) -> AsyncGenerator[Message, None]:
        """Generador que recibe mensajes del protocolo"""
        pass
    
    @abstractmethod
    def is_connected(self) -> bool:
        """Verifica si el adaptador está conectado"""
        pass


class MessageRouter(ABC):
    """Interface para el router de mensajes"""
    
    @abstractmethod
    async def route_message(self, message: Message) -> None:
        """Enruta un mensaje al destino apropiado"""
        pass
    
    @abstractmethod
    def register_adapter(self, adapter: ProtocolAdapter) -> None:
        """Registra un adaptador de protocolo"""
        pass
    
    @abstractmethod
    def unregister_adapter(self, protocol_type: ProtocolType) -> None:
        """Desregistra un adaptador de protocolo"""
        pass


class ConnectionManager(ABC):
    """Interface para gestión de conexiones"""
    
    @abstractmethod
    async def add_connection(self, connection_id: str, protocol: ProtocolType, metadata: Dict[str, Any]) -> None:
        """Añade una nueva conexión"""
        pass
    
    @abstractmethod
    async def remove_connection(self, connection_id: str) -> None:
        """Remueve una conexión"""
        pass
    
    @abstractmethod
    async def get_connection(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene información de una conexión"""
        pass
    
    @abstractmethod
    async def list_connections(self, protocol: Optional[ProtocolType] = None) -> Dict[str, Dict[str, Any]]:
        """Lista todas las conexiones activas"""
        pass


class EventHandler(ABC):
    """Interface para manejadores de eventos"""
    
    @abstractmethod
    async def handle_event(self, event: Message) -> None:
        """Maneja un evento específico"""
        pass
    
    @abstractmethod
    def can_handle(self, event: Message) -> bool:
        """Determina si puede manejar un evento específico"""
        pass