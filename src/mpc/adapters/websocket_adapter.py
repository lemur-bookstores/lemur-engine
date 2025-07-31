"""
Adaptador WebSocket para el sistema MPC
=====================================

Implementa el adaptador de protocolo WebSocket para comunicación bidireccional en tiempo real.
"""

import asyncio
import logging
import json
from typing import Dict, Any, Optional, AsyncGenerator, Set
from uuid import uuid4
from datetime import datetime
from weakref import WeakSet

import websockets
from websockets.server import WebSocketServerProtocol
from websockets.client import WebSocketClientProtocol
from websockets.exceptions import ConnectionClosed, WebSocketException

from ..core.interfaces import (
    ProtocolAdapter, 
    Message, 
    ProtocolType, 
    MessageType
)


logger = logging.getLogger(__name__)


class WebSocketConnection:
    """Representa una conexión WebSocket individual"""
    
    def __init__(self, websocket: WebSocketServerProtocol, connection_id: str):
        self.websocket = websocket
        self.connection_id = connection_id
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.message_count = 0
        self.is_active = True
        
    async def send_message(self, message: Dict[str, Any]) -> None:
        """Envía un mensaje a través de la conexión WebSocket"""
        try:
            await self.websocket.send(json.dumps(message))
            self.last_activity = datetime.utcnow()
            self.message_count += 1
        except ConnectionClosed:
            self.is_active = False
            raise
        except Exception as e:
            logger.error(f"Error enviando mensaje WebSocket: {e}")
            self.is_active = False
            raise
            
    async def close(self) -> None:
        """Cierra la conexión WebSocket"""
        try:
            if not self.websocket.closed:
                await self.websocket.close()
        except Exception as e:
            logger.error(f"Error cerrando conexión WebSocket: {e}")
        finally:
            self.is_active = False


class WebSocketAdapter(ProtocolAdapter):
    """Adaptador WebSocket para el sistema MPC"""
    
    def __init__(
        self, 
        host: str = "localhost", 
        port: int = 8081,
        max_connections: int = 1000,
        ping_interval: int = 30,
        ping_timeout: int = 10
    ):
        self.host = host
        self.port = port
        self.max_connections = max_connections
        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        
        self._server = None
        self._connections: Dict[str, WebSocketConnection] = {}
        self._client_connections: Dict[str, WebSocketClientProtocol] = {}
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._connection_handlers: Set[asyncio.Task] = set()
        
    @property
    def protocol_type(self) -> ProtocolType:
        """Retorna el tipo de protocolo WebSocket"""
        return ProtocolType.WEBSOCKET
        
    async def start(self) -> None:
        """Inicia el servidor WebSocket"""
        if self._running:
            return
            
        try:
            # Iniciar servidor WebSocket
            self._server = await websockets.serve(
                self._handle_client_connection,
                self.host,
                self.port,
                ping_interval=self.ping_interval,
                ping_timeout=self.ping_timeout,
                max_size=1024 * 1024,  # 1MB max message size
                max_queue=100
            )
            
            self._running = True
            logger.info(f"Servidor WebSocket iniciado en ws://{self.host}:{self.port}")
            
        except Exception as e:
            logger.error(f"Error iniciando servidor WebSocket: {e}")
            await self.stop()
            raise
            
    async def stop(self) -> None:
        """Detiene el servidor WebSocket"""
        if not self._running:
            return
            
        self._running = False
        
        try:
            # Cerrar todas las conexiones de cliente
            for connection in self._connections.values():
                await connection.close()
            self._connections.clear()
            
            # Cerrar conexiones cliente
            for client in self._client_connections.values():
                await client.close()
            self._client_connections.clear()
            
            # Cancelar handlers de conexión
            for task in self._connection_handlers:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            self._connection_handlers.clear()
            
            # Cerrar servidor
            if self._server:
                self._server.close()
                await self._server.wait_closed()
                
            logger.info("Servidor WebSocket detenido")
            
        except Exception as e:
            logger.error(f"Error deteniendo servidor WebSocket: {e}")
            
    async def send_message(self, message: Message) -> None:
        """Envía un mensaje WebSocket"""
        if not self._running:
            raise RuntimeError("Adaptador WebSocket no está corriendo")
            
        try:
            # Preparar payload WebSocket
            ws_message = {
                "id": message.id,
                "type": message.type.value,
                "protocol": message.protocol.value,
                "payload": message.payload,
                "metadata": message.metadata,
                "timestamp": message.timestamp,
                "correlation_id": message.correlation_id
            }
            
            # Si hay un destino específico, enviar solo a esa conexión
            if message.destination:
                await self._send_to_specific_connection(message.destination, ws_message)
            else:
                # Broadcast a todas las conexiones activas
                await self._broadcast_to_all_connections(ws_message)
                
        except Exception as e:
            logger.error(f"Error enviando mensaje WebSocket: {e}")
            raise
            
    async def receive_messages(self) -> AsyncGenerator[Message, None]:
        """Generador que recibe mensajes WebSocket"""
        while self._running:
            try:
                # Esperar por mensajes con timeout
                message = await asyncio.wait_for(
                    self._message_queue.get(),
                    timeout=1.0
                )
                yield message
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error recibiendo mensaje WebSocket: {e}")
                break
                
    def is_connected(self) -> bool:
        """Verifica si el adaptador está conectado"""
        return self._running and self._server is not None
        
    async def connect_to_server(self, uri: str, connection_id: Optional[str] = None) -> str:
        """Conecta como cliente a un servidor WebSocket externo"""
        if not connection_id:
            connection_id = str(uuid4())
            
        try:
            websocket = await websockets.connect(
                uri,
                ping_interval=self.ping_interval,
                ping_timeout=self.ping_timeout
            )
            
            self._client_connections[connection_id] = websocket
            
            # Crear tarea para manejar mensajes del servidor
            task = asyncio.create_task(
                self._handle_server_messages(websocket, connection_id)
            )
            self._connection_handlers.add(task)
            
            logger.info(f"Conectado como cliente WebSocket a {uri}")
            return connection_id
            
        except Exception as e:
            logger.error(f"Error conectando a servidor WebSocket {uri}: {e}")
            raise
            
    async def disconnect_from_server(self, connection_id: str) -> None:
        """Desconecta de un servidor WebSocket"""
        if connection_id in self._client_connections:
            websocket = self._client_connections.pop(connection_id)
            await websocket.close()
            logger.info(f"Desconectado del servidor WebSocket {connection_id}")
            
    async def _handle_client_connection(self, websocket: WebSocketServerProtocol, path: str) -> None:
        """Maneja una nueva conexión de cliente"""
        connection_id = str(uuid4())
        connection = WebSocketConnection(websocket, connection_id)
        
        # Verificar límite de conexiones
        if len(self._connections) >= self.max_connections:
            await websocket.close(code=1013, reason="Server overloaded")
            return
            
        self._connections[connection_id] = connection
        
        try:
            logger.info(f"Nueva conexión WebSocket: {connection_id} desde {websocket.remote_address}")
            
            # Enviar mensaje de bienvenida
            welcome_message = {
                "type": "connection_established",
                "connection_id": connection_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await connection.send_message(welcome_message)
            
            # Manejar mensajes de la conexión
            async for raw_message in websocket:
                try:
                    # Parsear mensaje JSON
                    data = json.loads(raw_message)
                    
                    # Crear mensaje MPC
                    message = Message(
                        id=data.get('id', str(uuid4())),
                        type=MessageType(data.get('type', 'request')),
                        protocol=ProtocolType.WEBSOCKET,
                        payload=data.get('payload', {}),
                        metadata=data.get('metadata', {}),
                        timestamp=data.get('timestamp', asyncio.get_event_loop().time()),
                        source=f"ws://{websocket.remote_address[0]}:{websocket.remote_address[1]}",
                        correlation_id=data.get('correlation_id')
                    )
                    
                    # Añadir a la cola de mensajes
                    await self._message_queue.put(message)
                    connection.last_activity = datetime.utcnow()
                    connection.message_count += 1
                    
                except json.JSONDecodeError:
                    logger.warning(f"Mensaje JSON inválido de {connection_id}")
                except Exception as e:
                    logger.error(f"Error procesando mensaje de {connection_id}: {e}")
                    
        except ConnectionClosed:
            logger.info(f"Conexión WebSocket cerrada: {connection_id}")
        except Exception as e:
            logger.error(f"Error en conexión WebSocket {connection_id}: {e}")
        finally:
            # Limpiar conexión
            if connection_id in self._connections:
                del self._connections[connection_id]
            await connection.close()
            
    async def _handle_server_messages(self, websocket: WebSocketClientProtocol, connection_id: str) -> None:
        """Maneja mensajes de un servidor WebSocket"""
        try:
            async for raw_message in websocket:
                try:
                    data = json.loads(raw_message)
                    
                    # Crear mensaje MPC
                    message = Message(
                        id=data.get('id', str(uuid4())),
                        type=MessageType(data.get('type', 'event')),
                        protocol=ProtocolType.WEBSOCKET,
                        payload=data.get('payload', {}),
                        metadata=data.get('metadata', {}),
                        timestamp=data.get('timestamp', asyncio.get_event_loop().time()),
                        source=f"ws_client_{connection_id}",
                        correlation_id=data.get('correlation_id')
                    )
                    
                    await self._message_queue.put(message)
                    
                except json.JSONDecodeError:
                    logger.warning(f"Mensaje JSON inválido del servidor {connection_id}")
                except Exception as e:
                    logger.error(f"Error procesando mensaje del servidor {connection_id}: {e}")
                    
        except ConnectionClosed:
            logger.info(f"Conexión cliente WebSocket cerrada: {connection_id}")
        except Exception as e:
            logger.error(f"Error en conexión cliente WebSocket {connection_id}: {e}")
            
    async def _send_to_specific_connection(self, destination: str, message: Dict[str, Any]) -> None:
        """Envía mensaje a una conexión específica"""
        if destination in self._connections:
            connection = self._connections[destination]
            if connection.is_active:
                try:
                    await connection.send_message(message)
                except Exception as e:
                    logger.error(f"Error enviando a conexión {destination}: {e}")
                    # Marcar conexión como inactiva
                    connection.is_active = False
            else:
                logger.warning(f"Conexión {destination} no está activa")
        else:
            logger.warning(f"Conexión {destination} no encontrada")
            
    async def _broadcast_to_all_connections(self, message: Dict[str, Any]) -> None:
        """Envía mensaje a todas las conexiones activas"""
        if not self._connections:
            return
            
        # Crear tareas para envío paralelo
        tasks = []
        inactive_connections = []
        
        for connection_id, connection in self._connections.items():
            if connection.is_active:
                tasks.append(self._safe_send_to_connection(connection, message))
            else:
                inactive_connections.append(connection_id)
                
        # Limpiar conexiones inactivas
        for conn_id in inactive_connections:
            del self._connections[conn_id]
            
        # Enviar mensajes en paralelo
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Log errores
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error en broadcast: {result}")
                    
    async def _safe_send_to_connection(self, connection: WebSocketConnection, message: Dict[str, Any]) -> None:
        """Envía mensaje de forma segura a una conexión"""
        try:
            await connection.send_message(message)
        except Exception as e:
            logger.error(f"Error enviando a conexión {connection.connection_id}: {e}")
            connection.is_active = False
            
    def get_connection_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de conexiones"""
        active_connections = sum(1 for conn in self._connections.values() if conn.is_active)
        total_messages = sum(conn.message_count for conn in self._connections.values())
        
        return {
            "protocol": "websocket",
            "total_connections": len(self._connections),
            "active_connections": active_connections,
            "client_connections": len(self._client_connections),
            "total_messages": total_messages,
            "server_running": self._running,
            "server_url": f"ws://{self.host}:{self.port}"
        }
        
    def get_connections_info(self) -> Dict[str, Dict[str, Any]]:
        """Obtiene información detallada de todas las conexiones"""
        connections_info = {}
        
        for conn_id, connection in self._connections.items():
            connections_info[conn_id] = {
                "connection_id": conn_id,
                "created_at": connection.created_at.isoformat(),
                "last_activity": connection.last_activity.isoformat(),
                "message_count": connection.message_count,
                "is_active": connection.is_active,
                "remote_address": str(connection.websocket.remote_address) if hasattr(connection.websocket, 'remote_address') else "unknown"
            }
            
        return connections_info
        
    async def cleanup_inactive_connections(self) -> int:
        """Limpia conexiones inactivas"""
        inactive_connections = []
        
        for conn_id, connection in self._connections.items():
            if not connection.is_active:
                inactive_connections.append(conn_id)
                
        for conn_id in inactive_connections:
            connection = self._connections.pop(conn_id)
            await connection.close()
            
        if inactive_connections:
            logger.info(f"Limpiadas {len(inactive_connections)} conexiones WebSocket inactivas")
            
        return len(inactive_connections)