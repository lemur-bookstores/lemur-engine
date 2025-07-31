"""
Gateway unificado del sistema MPC
================================

Proporciona una interfaz unificada para acceder a todos los protocolos
de comunicación soportados.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from uuid import uuid4

from .interfaces import (
    ProtocolAdapter,
    ConnectionManager, 
    Message,
    ProtocolType,
    MessageType
)
from .router import MPCRouter
from .connection_manager import MPCConnectionManager


logger = logging.getLogger(__name__)


class UnifiedGateway:
    """Gateway unificado para todos los protocolos MPC"""
    
    def __init__(self):
        self.router = MPCRouter()
        self.connection_manager = MPCConnectionManager()
        self._adapters: Dict[ProtocolType, ProtocolAdapter] = {}
        self._running = False
        
    async def start(self) -> None:
        """Inicia el gateway unificado"""
        if self._running:
            return
            
        try:
            # Iniciar componentes principales
            await self.router.start()
            await self.connection_manager.start()
            
            # Iniciar todos los adaptadores registrados
            for adapter in self._adapters.values():
                await self._start_adapter(adapter)
                
            self._running = True
            logger.info("Gateway unificado MPC iniciado")
            
        except Exception as e:
            logger.error(f"Error iniciando gateway: {e}")
            await self.stop()
            raise
            
    async def stop(self) -> None:
        """Detiene el gateway unificado"""
        if not self._running:
            return
            
        self._running = False
        
        try:
            # Detener adaptadores
            for adapter in self._adapters.values():
                try:
                    await adapter.stop()
                except Exception as e:
                    logger.error(f"Error deteniendo adaptador {adapter.protocol_type}: {e}")
                    
            # Detener componentes principales
            await self.router.stop()
            await self.connection_manager.stop()
            
            logger.info("Gateway unificado MPC detenido")
            
        except Exception as e:
            logger.error(f"Error deteniendo gateway: {e}")
            
    def register_adapter(self, adapter: ProtocolAdapter) -> None:
        """Registra un adaptador de protocolo"""
        protocol_type = adapter.protocol_type
        self._adapters[protocol_type] = adapter
        self.router.register_adapter(adapter)
        
        logger.info(f"Adaptador {protocol_type} registrado en gateway")
        
        # Si el gateway está corriendo, iniciar el adaptador
        if self._running:
            asyncio.create_task(self._start_adapter(adapter))
            
    def unregister_adapter(self, protocol_type: ProtocolType) -> None:
        """Desregistra un adaptador de protocolo"""
        if protocol_type in self._adapters:
            self._adapters.pop(protocol_type)
            self.router.unregister_adapter(protocol_type)
            logger.info(f"Adaptador {protocol_type} desregistrado del gateway")
            
    async def send_message(
        self, 
        protocol: ProtocolType,
        payload: Dict[str, Any],
        destination: Optional[str] = None,
        message_type: MessageType = MessageType.REQUEST,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Envía un mensaje a través del protocolo especificado"""
        
        message_id = str(uuid4())
        
        message = Message(
            id=message_id,
            type=message_type,
            protocol=protocol,
            payload=payload,
            metadata=metadata or {},
            timestamp=asyncio.get_event_loop().time(),
            destination=destination
        )
        
        await self.router.route_message(message)
        return message_id
        
    async def broadcast_message(
        self,
        payload: Dict[str, Any],
        exclude_protocols: Optional[List[ProtocolType]] = None,
        message_type: MessageType = MessageType.EVENT,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Envía un mensaje a todos los protocolos activos"""
        
        message_id = str(uuid4())
        exclude_protocols = exclude_protocols or []
        
        for protocol_type in self._adapters.keys():
            if protocol_type not in exclude_protocols:
                message = Message(
                    id=f"{message_id}_{protocol_type.value}",
                    type=message_type,
                    protocol=protocol_type,
                    payload=payload,
                    metadata=metadata or {},
                    timestamp=asyncio.get_event_loop().time(),
                    correlation_id=message_id
                )
                
                await self.router.route_message(message)
                
        return message_id
        
    async def get_status(self) -> Dict[str, Any]:
        """Obtiene el estado completo del gateway"""
        return {
            "running": self._running,
            "adapters": self.router.get_adapter_status(),
            "connections": await self.connection_manager.list_connections(),
            "router_status": {
                "running": self.router._running,
                "registered_adapters": len(self._adapters),
                "event_handlers": len(self.router._event_handlers)
            }
        }
        
    async def get_connections(self, protocol: Optional[ProtocolType] = None) -> Dict[str, Dict[str, Any]]:
        """Obtiene todas las conexiones activas"""
        return await self.connection_manager.list_connections(protocol)
        
    async def close_connection(self, connection_id: str) -> bool:
        """Cierra una conexión específica"""
        try:
            await self.connection_manager.remove_connection(connection_id)
            return True
        except Exception as e:
            logger.error(f"Error cerrando conexión {connection_id}: {e}")
            return False
            
    def get_supported_protocols(self) -> List[str]:
        """Obtiene la lista de protocolos soportados"""
        return [protocol.value for protocol in self._adapters.keys()]
        
    async def _start_adapter(self, adapter: ProtocolAdapter) -> None:
        """Inicia un adaptador específico"""
        try:
            await adapter.start()
            logger.info(f"Adaptador {adapter.protocol_type} iniciado")
        except Exception as e:
            logger.error(f"Error iniciando adaptador {adapter.protocol_type}: {e}")
            
    def is_running(self) -> bool:
        """Verifica si el gateway está corriendo"""
        return self._running
        
    def get_adapter(self, protocol: ProtocolType) -> Optional[ProtocolAdapter]:
        """Obtiene un adaptador específico"""
        return self._adapters.get(protocol)