"""
Router principal del sistema MPC
===============================

Implementa el router central que gestiona el enrutamiento de mensajes
entre diferentes protocolos y adaptadores.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Set
from uuid import uuid4

from .interfaces import (
    MessageRouter, 
    ProtocolAdapter, 
    Message, 
    ProtocolType, 
    MessageType,
    EventHandler
)


logger = logging.getLogger(__name__)


class MPCRouter(MessageRouter):
    """Router principal del sistema MPC"""
    
    def __init__(self):
        self._adapters: Dict[ProtocolType, ProtocolAdapter] = {}
        self._event_handlers: List[EventHandler] = []
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._router_task: Optional[asyncio.Task] = None
        
    async def start(self) -> None:
        """Inicia el router"""
        if self._running:
            return
            
        self._running = True
        self._router_task = asyncio.create_task(self._process_messages())
        logger.info("MPC Router iniciado")
        
    async def stop(self) -> None:
        """Detiene el router"""
        if not self._running:
            return
            
        self._running = False
        
        if self._router_task:
            self._router_task.cancel()
            try:
                await self._router_task
            except asyncio.CancelledError:
                pass
                
        # Detener todos los adaptadores
        for adapter in self._adapters.values():
            try:
                await adapter.stop()
            except Exception as e:
                logger.error(f"Error deteniendo adaptador {adapter.protocol_type}: {e}")
                
        logger.info("MPC Router detenido")
        
    def register_adapter(self, adapter: ProtocolAdapter) -> None:
        """Registra un adaptador de protocolo"""
        protocol_type = adapter.protocol_type
        
        if protocol_type in self._adapters:
            logger.warning(f"Adaptador para {protocol_type} ya registrado, reemplazando")
            
        self._adapters[protocol_type] = adapter
        logger.info(f"Adaptador {protocol_type} registrado")
        
        # Iniciar el adaptador si el router está corriendo
        if self._running:
            asyncio.create_task(self._start_adapter(adapter))
            
    def unregister_adapter(self, protocol_type: ProtocolType) -> None:
        """Desregistra un adaptador de protocolo"""
        if protocol_type in self._adapters:
            adapter = self._adapters.pop(protocol_type)
            asyncio.create_task(adapter.stop())
            logger.info(f"Adaptador {protocol_type} desregistrado")
            
    def register_event_handler(self, handler: EventHandler) -> None:
        """Registra un manejador de eventos"""
        self._event_handlers.append(handler)
        logger.info(f"Event handler {handler.__class__.__name__} registrado")
        
    async def route_message(self, message: Message) -> None:
        """Enruta un mensaje al destino apropiado"""
        await self._message_queue.put(message)
        
    async def _process_messages(self) -> None:
        """Procesa mensajes de la cola"""
        while self._running:
            try:
                # Esperar por un mensaje con timeout
                message = await asyncio.wait_for(
                    self._message_queue.get(), 
                    timeout=1.0
                )
                
                await self._handle_message(message)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error procesando mensaje: {e}")
                
    async def _handle_message(self, message: Message) -> None:
        """Maneja un mensaje específico"""
        try:
            # Si es un evento, enviarlo a los manejadores de eventos
            if message.type == MessageType.EVENT:
                await self._handle_event(message)
                return
                
            # Enrutar según el protocolo de destino
            if message.destination:
                await self._route_to_destination(message)
            else:
                # Broadcast a todos los adaptadores
                await self._broadcast_message(message)
                
        except Exception as e:
            logger.error(f"Error manejando mensaje {message.id}: {e}")
            
            # Crear mensaje de error
            error_message = Message(
                id=str(uuid4()),
                type=MessageType.ERROR,
                protocol=message.protocol,
                payload={"error": str(e), "original_message_id": message.id},
                metadata={"timestamp": asyncio.get_event_loop().time()},
                timestamp=asyncio.get_event_loop().time(),
                correlation_id=message.id
            )
            
            await self._send_error_message(error_message)
            
    async def _handle_event(self, event: Message) -> None:
        """Maneja eventos usando los event handlers registrados"""
        for handler in self._event_handlers:
            try:
                if handler.can_handle(event):
                    await handler.handle_event(event)
            except Exception as e:
                logger.error(f"Error en event handler {handler.__class__.__name__}: {e}")
                
    async def _route_to_destination(self, message: Message) -> None:
        """Enruta mensaje a un destino específico"""
        # Determinar protocolo de destino basado en el destino
        target_protocol = self._determine_target_protocol(message.destination)
        
        if target_protocol and target_protocol in self._adapters:
            adapter = self._adapters[target_protocol]
            if adapter.is_connected():
                await adapter.send_message(message)
            else:
                logger.warning(f"Adaptador {target_protocol} no está conectado")
        else:
            logger.warning(f"No se encontró adaptador para destino: {message.destination}")
            
    async def _broadcast_message(self, message: Message) -> None:
        """Envía mensaje a todos los adaptadores conectados"""
        tasks = []
        
        for adapter in self._adapters.values():
            if adapter.is_connected() and adapter.protocol_type != message.protocol:
                tasks.append(adapter.send_message(message))
                
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
    async def _send_error_message(self, error_message: Message) -> None:
        """Envía mensaje de error al protocolo origen"""
        if error_message.protocol in self._adapters:
            adapter = self._adapters[error_message.protocol]
            if adapter.is_connected():
                await adapter.send_message(error_message)
                
    def _determine_target_protocol(self, destination: str) -> Optional[ProtocolType]:
        """Determina el protocolo objetivo basado en el destino"""
        # Lógica simple basada en prefijos
        if destination.startswith("http://") or destination.startswith("https://"):
            return ProtocolType.HTTP
        elif destination.startswith("ws://") or destination.startswith("wss://"):
            return ProtocolType.WEBSOCKET
        elif destination.startswith("grpc://"):
            return ProtocolType.GRPC
        elif destination.startswith("mcp://"):
            return ProtocolType.MCP
        else:
            return None
            
    async def _start_adapter(self, adapter: ProtocolAdapter) -> None:
        """Inicia un adaptador y configura la recepción de mensajes"""
        try:
            await adapter.start()
            
            # Crear tarea para recibir mensajes del adaptador
            asyncio.create_task(self._receive_from_adapter(adapter))
            
        except Exception as e:
            logger.error(f"Error iniciando adaptador {adapter.protocol_type}: {e}")
            
    async def _receive_from_adapter(self, adapter: ProtocolAdapter) -> None:
        """Recibe mensajes de un adaptador específico"""
        try:
            async for message in adapter.receive_messages():
                await self.route_message(message)
        except Exception as e:
            logger.error(f"Error recibiendo mensajes de {adapter.protocol_type}: {e}")
            
    def get_adapter_status(self) -> Dict[str, Dict[str, any]]:
        """Obtiene el estado de todos los adaptadores"""
        status = {}
        
        for protocol_type, adapter in self._adapters.items():
            status[protocol_type.value] = {
                "connected": adapter.is_connected(),
                "protocol": protocol_type.value,
                "class": adapter.__class__.__name__
            }
            
        return status