"""
Adaptador HTTP para el sistema MPC
=================================

Implementa el adaptador de protocolo HTTP/HTTPS.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, AsyncGenerator
from uuid import uuid4
import json
from datetime import datetime

from aiohttp import web, ClientSession, WSMsgType
from aiohttp.web import Request, Response, Application

from ..core.interfaces import (
    ProtocolAdapter, 
    Message, 
    ProtocolType, 
    MessageType
)


logger = logging.getLogger(__name__)


class HTTPAdapter(ProtocolAdapter):
    """Adaptador HTTP para el sistema MPC"""
    
    def __init__(
        self, 
        host: str = "localhost", 
        port: int = 8080,
        routes_config: Optional[Dict[str, Any]] = None
    ):
        self.host = host
        self.port = port
        self.routes_config = routes_config or {}
        
        self._app: Optional[Application] = None
        self._runner: Optional[web.AppRunner] = None
        self._site: Optional[web.TCPSite] = None
        self._client_session: Optional[ClientSession] = None
        
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        
    @property
    def protocol_type(self) -> ProtocolType:
        """Retorna el tipo de protocolo HTTP"""
        return ProtocolType.HTTP
        
    async def start(self) -> None:
        """Inicia el servidor HTTP"""
        if self._running:
            return
            
        try:
            # Crear aplicación web
            self._app = web.Application()
            self._setup_routes()
            
            # Crear cliente HTTP
            self._client_session = ClientSession()
            
            # Iniciar servidor
            self._runner = web.AppRunner(self._app)
            await self._runner.setup()
            
            self._site = web.TCPSite(self._runner, self.host, self.port)
            await self._site.start()
            
            self._running = True
            logger.info(f"Servidor HTTP iniciado en http://{self.host}:{self.port}")
            
        except Exception as e:
            logger.error(f"Error iniciando servidor HTTP: {e}")
            await self.stop()
            raise
            
    async def stop(self) -> None:
        """Detiene el servidor HTTP"""
        if not self._running:
            return
            
        self._running = False
        
        try:
            if self._client_session:
                await self._client_session.close()
                
            if self._site:
                await self._site.stop()
                
            if self._runner:
                await self._runner.cleanup()
                
            logger.info("Servidor HTTP detenido")
            
        except Exception as e:
            logger.error(f"Error deteniendo servidor HTTP: {e}")
            
    async def send_message(self, message: Message) -> None:
        """Envía un mensaje HTTP"""
        if not self._running or not self._client_session:
            raise RuntimeError("Adaptador HTTP no está corriendo")
            
        try:
            # Determinar URL de destino
            url = message.destination or f"http://{self.host}:{self.port}/api/message"
            
            # Preparar payload
            payload = {
                "id": message.id,
                "type": message.type.value,
                "protocol": message.protocol.value,
                "payload": message.payload,
                "metadata": message.metadata,
                "timestamp": message.timestamp,
                "correlation_id": message.correlation_id
            }
            
            # Enviar request HTTP
            async with self._client_session.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status >= 400:
                    logger.warning(f"HTTP request failed: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error enviando mensaje HTTP: {e}")
            raise
            
    async def receive_messages(self) -> AsyncGenerator[Message, None]:
        """Generador que recibe mensajes HTTP"""
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
                logger.error(f"Error recibiendo mensaje HTTP: {e}")
                break
                
    def is_connected(self) -> bool:
        """Verifica si el adaptador está conectado"""
        return self._running and self._site is not None
        
    def _setup_routes(self) -> None:
        """Configura las rutas HTTP"""
        
        # Ruta principal para recibir mensajes
        self._app.router.add_post('/api/message', self._handle_message)
        
        # Ruta de estado
        self._app.router.add_get('/api/status', self._handle_status)
        
        # Ruta de salud
        self._app.router.add_get('/health', self._handle_health)
        
        # Rutas personalizadas del config
        for route_path, route_config in self.routes_config.items():
            method = route_config.get('method', 'GET').upper()
            handler = getattr(self, route_config.get('handler', '_default_handler'))
            
            if method == 'GET':
                self._app.router.add_get(route_path, handler)
            elif method == 'POST':
                self._app.router.add_post(route_path, handler)
            elif method == 'PUT':
                self._app.router.add_put(route_path, handler)
            elif method == 'DELETE':
                self._app.router.add_delete(route_path, handler)
                
    async def _handle_message(self, request: Request) -> Response:
        """Maneja mensajes HTTP entrantes"""
        try:
            data = await request.json()
            
            # Crear mensaje MPC
            message = Message(
                id=data.get('id', str(uuid4())),
                type=MessageType(data.get('type', 'request')),
                protocol=ProtocolType.HTTP,
                payload=data.get('payload', {}),
                metadata=data.get('metadata', {}),
                timestamp=data.get('timestamp', asyncio.get_event_loop().time()),
                source=f"http://{request.remote}",
                correlation_id=data.get('correlation_id')
            )
            
            # Añadir a la cola de mensajes
            await self._message_queue.put(message)
            
            return web.json_response({
                "status": "success",
                "message_id": message.id,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error procesando mensaje HTTP: {e}")
            return web.json_response({
                "status": "error",
                "error": str(e)
            }, status=400)
            
    async def _handle_status(self, request: Request) -> Response:
        """Maneja requests de estado"""
        return web.json_response({
            "protocol": "http",
            "status": "running" if self._running else "stopped",
            "host": self.host,
            "port": self.port,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    async def _handle_health(self, request: Request) -> Response:
        """Maneja health checks"""
        return web.json_response({
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        })
        
    async def _default_handler(self, request: Request) -> Response:
        """Handler por defecto para rutas personalizadas"""
        return web.json_response({
            "message": "Default HTTP handler",
            "path": request.path,
            "method": request.method,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    def get_server_info(self) -> Dict[str, Any]:
        """Obtiene información del servidor"""
        return {
            "protocol": "http",
            "host": self.host,
            "port": self.port,
            "running": self._running,
            "url": f"http://{self.host}:{self.port}"
        }