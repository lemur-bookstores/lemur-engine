"""
MCP Client
==========

Cliente para conectarse a servidores MCP externos y consumir
recursos y herramientas de LLMs y otros servicios.
"""

import asyncio
import json
import uuid
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass
import logging
from datetime import datetime
import aiohttp
import websockets

from .mcp_adapter import MCPTransportType, MCPResource, MCPTool, MCPCapabilities


@dataclass
class MCPServerInfo:
    """Información del servidor MCP"""
    name: str
    version: str
    protocol_version: str
    capabilities: MCPCapabilities
    transport: MCPTransportType
    endpoint: str


class MCPClient:
    """Cliente MCP para conectarse a servidores externos"""
    
    def __init__(self, 
                 transport: MCPTransportType = MCPTransportType.HTTP,
                 endpoint: str = "http://localhost:8080/mcp",
                 timeout: float = 30.0):
        self.transport = transport
        self.endpoint = endpoint
        self.timeout = timeout
        
        # Estado
        self._connected = False
        self._session = None
        self._websocket = None
        self._server_info = None
        self._request_id = 0
        self._pending_requests = {}
        
        # Logging
        self.logger = logging.getLogger("mcp_client")
        
        # Callbacks
        self._notification_handlers = {}
    
    async def connect(self) -> MCPServerInfo:
        """Conecta al servidor MCP"""
        if self._connected:
            return self._server_info
        
        self.logger.info(f"Conectando a servidor MCP: {self.endpoint}")
        
        try:
            if self.transport == MCPTransportType.HTTP:
                await self._connect_http()
            elif self.transport == MCPTransportType.WEBSOCKET:
                await self._connect_websocket()
            elif self.transport == MCPTransportType.STDIO:
                await self._connect_stdio()
            
            # Inicializar conexión
            self._server_info = await self._initialize()
            self._connected = True
            
            self.logger.info(f"Conectado a {self._server_info.name} v{self._server_info.version}")
            return self._server_info
            
        except Exception as e:
            self.logger.error(f"Error conectando a servidor MCP: {e}")
            raise
    
    async def disconnect(self) -> None:
        """Desconecta del servidor MCP"""
        if not self._connected:
            return
        
        self.logger.info("Desconectando de servidor MCP")
        
        try:
            if self._websocket:
                await self._websocket.close()
            if self._session:
                await self._session.close()
            
            self._connected = False
            self._server_info = None
            
        except Exception as e:
            self.logger.error(f"Error desconectando: {e}")
    
    async def list_resources(self) -> List[MCPResource]:
        """Lista recursos disponibles en el servidor"""
        if not self._connected:
            raise RuntimeError("Cliente no conectado")
        
        response = await self._send_request("resources/list", {})
        resources_data = response.get("result", {}).get("resources", [])
        
        return [
            MCPResource(
                uri=r["uri"],
                name=r["name"],
                description=r["description"],
                mime_type=r.get("mime_type", "text/plain"),
                metadata=r.get("metadata", {})
            )
            for r in resources_data
        ]
    
    async def read_resource(self, uri: str) -> Dict[str, Any]:
        """Lee el contenido de un recurso"""
        if not self._connected:
            raise RuntimeError("Cliente no conectado")
        
        response = await self._send_request("resources/read", {"uri": uri})
        contents = response.get("result", {}).get("contents", [])
        
        if not contents:
            raise ValueError(f"Recurso no encontrado: {uri}")
        
        return contents[0]
    
    async def list_tools(self) -> List[MCPTool]:
        """Lista herramientas disponibles en el servidor"""
        if not self._connected:
            raise RuntimeError("Cliente no conectado")
        
        response = await self._send_request("tools/list", {})
        tools_data = response.get("result", {}).get("tools", [])
        
        return [
            MCPTool(
                name=t["name"],
                description=t["description"],
                input_schema=t["input_schema"],
                metadata=t.get("metadata", {})
            )
            for t in tools_data
        ]
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta una herramienta en el servidor"""
        if not self._connected:
            raise RuntimeError("Cliente no conectado")
        
        response = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        
        content = response.get("result", {}).get("content", [])
        
        if not content:
            raise ValueError(f"Error ejecutando herramienta: {name}")
        
        return content[0]
    
    def register_notification_handler(self, method: str, handler: Callable) -> None:
        """Registra un manejador para notificaciones"""
        self._notification_handlers[method] = handler
    
    async def send_notification(self, method: str, params: Dict[str, Any]) -> None:
        """Envía una notificación al servidor"""
        if not self._connected:
            raise RuntimeError("Cliente no conectado")
        
        message = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        
        await self._send_message(message)
    
    # === Métodos privados ===
    
    async def _connect_http(self) -> None:
        """Conecta usando HTTP"""
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        )
    
    async def _connect_websocket(self) -> None:
        """Conecta usando WebSocket"""
        ws_endpoint = self.endpoint.replace("http://", "ws://").replace("https://", "wss://")
        self._websocket = await websockets.connect(ws_endpoint)
        
        # Iniciar tarea para recibir mensajes
        asyncio.create_task(self._websocket_message_loop())
    
    async def _connect_stdio(self) -> None:
        """Conecta usando STDIO"""
        # Para STDIO, no hay conexión explícita
        pass
    
    async def _initialize(self) -> MCPServerInfo:
        """Inicializa la conexión MCP"""
        response = await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "resources": True,
                "tools": True
            },
            "clientInfo": {
                "name": "MPC-MCP-Client",
                "version": "1.0.0"
            }
        })
        
        result = response.get("result", {})
        server_info = result.get("serverInfo", {})
        capabilities_data = result.get("capabilities", {})
        
        capabilities = MCPCapabilities(
            resources=capabilities_data.get("resources", False),
            tools=capabilities_data.get("tools", False),
            prompts=capabilities_data.get("prompts", False),
            logging=capabilities_data.get("logging", False),
            experimental=capabilities_data.get("experimental", {})
        )
        
        return MCPServerInfo(
            name=server_info.get("name", "Unknown"),
            version=server_info.get("version", "Unknown"),
            protocol_version=result.get("protocolVersion", "Unknown"),
            capabilities=capabilities,
            transport=self.transport,
            endpoint=self.endpoint
        )
    
    async def _send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Envía una request y espera respuesta"""
        request_id = self._get_next_request_id()
        
        message = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        }
        
        # Crear future para la respuesta
        response_future = asyncio.Future()
        self._pending_requests[request_id] = response_future
        
        try:
            await self._send_message(message)
            
            # Esperar respuesta
            response = await asyncio.wait_for(response_future, timeout=self.timeout)
            
            if "error" in response:
                error = response["error"]
                raise RuntimeError(f"Error MCP {error.get('code', -1)}: {error.get('message', 'Unknown error')}")
            
            return response
            
        finally:
            # Limpiar request pendiente
            if request_id in self._pending_requests:
                del self._pending_requests[request_id]
    
    async def _send_message(self, message: Dict[str, Any]) -> None:
        """Envía un mensaje según el transporte"""
        if self.transport == MCPTransportType.HTTP:
            await self._send_http_message(message)
        elif self.transport == MCPTransportType.WEBSOCKET:
            await self._send_websocket_message(message)
        elif self.transport == MCPTransportType.STDIO:
            await self._send_stdio_message(message)
    
    async def _send_http_message(self, message: Dict[str, Any]) -> None:
        """Envía mensaje HTTP"""
        async with self._session.post(self.endpoint, json=message) as response:
            if response.status == 200:
                response_data = await response.json()
                await self._handle_response(response_data)
            else:
                raise RuntimeError(f"HTTP Error {response.status}: {await response.text()}")
    
    async def _send_websocket_message(self, message: Dict[str, Any]) -> None:
        """Envía mensaje WebSocket"""
        await self._websocket.send(json.dumps(message))
    
    async def _send_stdio_message(self, message: Dict[str, Any]) -> None:
        """Envía mensaje STDIO"""
        import sys
        print(json.dumps(message), file=sys.stdout, flush=True)
    
    async def _websocket_message_loop(self) -> None:
        """Loop para recibir mensajes WebSocket"""
        try:
            async for message in self._websocket:
                data = json.loads(message)
                await self._handle_response(data)
        except Exception as e:
            self.logger.error(f"Error en loop de mensajes WebSocket: {e}")
    
    async def _handle_response(self, data: Dict[str, Any]) -> None:
        """Maneja respuesta del servidor"""
        if "id" in data:
            # Es una respuesta a una request
            request_id = data["id"]
            if request_id in self._pending_requests:
                future = self._pending_requests[request_id]
                if not future.done():
                    future.set_result(data)
        else:
            # Es una notificación
            method = data.get("method")
            if method and method in self._notification_handlers:
                handler = self._notification_handlers[method]
                try:
                    await handler(data.get("params", {}))
                except Exception as e:
                    self.logger.error(f"Error en handler de notificación {method}: {e}")
    
    def _get_next_request_id(self) -> str:
        """Obtiene el siguiente ID de request"""
        self._request_id += 1
        return str(self._request_id)
    
    @property
    def is_connected(self) -> bool:
        """Verifica si está conectado"""
        return self._connected
    
    @property
    def server_info(self) -> Optional[MCPServerInfo]:
        """Información del servidor conectado"""
        return self._server_info