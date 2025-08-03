"""
MCP (Model Context Protocol) Adapter
===================================

Implementa el adaptador para el Model Context Protocol, permitiendo
la integración con LLMs y sistemas de IA para compartir contexto,
recursos y herramientas.

Características:
- Cliente y servidor MCP
- Gestión de recursos y herramientas
- Integración con LLMs
- Transporte múltiple (stdio, HTTP, WebSocket)
"""

import asyncio
import json
import uuid
from typing import Any, Dict, List, Optional, AsyncGenerator, Union
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from datetime import datetime
from aiohttp import web

from ...mpc.core.interfaces import ProtocolAdapter, ProtocolType, Message, MessageType


class MCPTransportType(Enum):
    """Tipos de transporte MCP"""
    STDIO = "stdio"
    HTTP = "http"
    WEBSOCKET = "websocket"


class MCPMessageType(Enum):
    """Tipos de mensaje MCP"""
    INITIALIZE = "initialize"
    INITIALIZED = "initialized"
    LIST_RESOURCES = "resources/list"
    READ_RESOURCE = "resources/read"
    LIST_TOOLS = "tools/list"
    CALL_TOOL = "tools/call"
    NOTIFICATION = "notification"
    ERROR = "error"


@dataclass
class MCPResource:
    """Recurso MCP"""
    uri: str
    name: str
    description: str
    mime_type: str = "text/plain"
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class MCPTool:
    """Herramienta MCP"""
    name: str
    description: str
    input_schema: Dict[str, Any]
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class MCPCapabilities:
    """Capacidades del servidor/cliente MCP"""
    resources: bool = True
    tools: bool = True
    prompts: bool = False
    logging: bool = True
    experimental: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.experimental is None:
            self.experimental = {}


class MCPAdapter(ProtocolAdapter):
    """Adaptador para Model Context Protocol"""
    
    def __init__(self, 
                 transport: MCPTransportType = MCPTransportType.HTTP,
                 host: str = "localhost",
                 port: int = 8080,
                 capabilities: Optional[MCPCapabilities] = None):
        self.transport = transport
        self.host = host
        self.port = port
        self.capabilities = capabilities or MCPCapabilities()
        
        # Estado interno
        self._running = False
        self._server = None
        self._client_sessions = {}
        self._resources = {}
        self._tools = {}
        self._message_queue = asyncio.Queue()
        
        # Logging
        self.logger = logging.getLogger(f"mcp_adapter_{transport.value}")
        
        # Callbacks
        self._resource_handlers = {}
        self._tool_handlers = {}
        
    @property
    def protocol_type(self) -> ProtocolType:
        """Retorna el tipo de protocolo MCP"""
        return ProtocolType.MCP
    
    async def start(self) -> None:
        """Inicia el adaptador MCP"""
        if self._running:
            return
            
        self.logger.info(f"Iniciando MCP Adapter con transporte {self.transport.value}")
        
        try:
            if self.transport == MCPTransportType.HTTP:
                await self._start_http_server()
            elif self.transport == MCPTransportType.WEBSOCKET:
                await self._start_websocket_server()
            elif self.transport == MCPTransportType.STDIO:
                await self._start_stdio_server()
            
            self._running = True
            self.logger.info(f"MCP Adapter iniciado en {self.host}:{self.port}")
            
        except Exception as e:
            self.logger.error(f"Error iniciando MCP Adapter: {e}")
            raise
    
    async def stop(self) -> None:
        """Detiene el adaptador MCP"""
        if not self._running:
            return
            
        self.logger.info("Deteniendo MCP Adapter")
        
        try:
            # Cerrar sesiones de cliente
            for session_id in list(self._client_sessions.keys()):
                await self._close_session(session_id)
            
            # Detener servidor
            if self._server:
                if hasattr(self._server, 'close'):
                    self._server.close()
                    if hasattr(self._server, 'wait_closed'):
                        await self._server.wait_closed()
            
            self._running = False
            self.logger.info("MCP Adapter detenido")
            
        except Exception as e:
            self.logger.error(f"Error deteniendo MCP Adapter: {e}")
            raise
    
    async def send_message(self, message: Message) -> None:
        """Envía un mensaje MCP"""
        if not self._running:
            raise RuntimeError("MCP Adapter no está ejecutándose")
        
        try:
            # Convertir mensaje unificado a formato MCP
            mcp_message = await self._convert_to_mcp_message(message)
            
            # Enviar según el transporte
            if self.transport == MCPTransportType.HTTP:
                await self._send_http_message(mcp_message, message.destination)
            elif self.transport == MCPTransportType.WEBSOCKET:
                await self._send_websocket_message(mcp_message, message.destination)
            elif self.transport == MCPTransportType.STDIO:
                await self._send_stdio_message(mcp_message)
            
            self.logger.debug(f"Mensaje MCP enviado: {message.id}")
            
        except Exception as e:
            self.logger.error(f"Error enviando mensaje MCP: {e}")
            raise
    
    async def receive_messages(self) -> AsyncGenerator[Message, None]:
        """Generador que recibe mensajes MCP"""
        while self._running:
            try:
                # Esperar mensaje de la cola
                mcp_message = await asyncio.wait_for(
                    self._message_queue.get(), 
                    timeout=1.0
                )
                
                # Convertir a mensaje unificado
                unified_message = await self._convert_from_mcp_message(mcp_message)
                yield unified_message
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                self.logger.error(f"Error recibiendo mensaje MCP: {e}")
                continue
    
    def is_connected(self) -> bool:
        """Verifica si el adaptador está conectado"""
        return self._running and len(self._client_sessions) > 0
    
    # === Gestión de Recursos ===
    
    def register_resource(self, resource: MCPResource, handler=None) -> None:
        """Registra un recurso MCP"""
        self._resources[resource.uri] = resource
        if handler:
            self._resource_handlers[resource.uri] = handler
        
        self.logger.info(f"Recurso registrado: {resource.uri}")
    
    def unregister_resource(self, uri: str) -> None:
        """Desregistra un recurso MCP"""
        if uri in self._resources:
            del self._resources[uri]
        if uri in self._resource_handlers:
            del self._resource_handlers[uri]
        
        self.logger.info(f"Recurso desregistrado: {uri}")
    
    async def read_resource(self, uri: str) -> Dict[str, Any]:
        """Lee el contenido de un recurso"""
        if uri not in self._resources:
            raise ValueError(f"Recurso no encontrado: {uri}")
        
        resource = self._resources[uri]
        
        # Si hay un handler personalizado, usarlo
        if uri in self._resource_handlers:
            handler = self._resource_handlers[uri]
            return await handler(resource)
        
        # Handler por defecto
        return {
            "uri": resource.uri,
            "name": resource.name,
            "description": resource.description,
            "mime_type": resource.mime_type,
            "content": f"Contenido del recurso {resource.name}",
            "metadata": resource.metadata
        }
    
    # === Gestión de Herramientas ===
    
    def register_tool(self, tool: MCPTool, handler=None) -> None:
        """Registra una herramienta MCP"""
        self._tools[tool.name] = tool
        if handler:
            self._tool_handlers[tool.name] = handler
        
        self.logger.info(f"Herramienta registrada: {tool.name}")
    
    def unregister_tool(self, name: str) -> None:
        """Desregistra una herramienta MCP"""
        if name in self._tools:
            del self._tools[name]
        if name in self._tool_handlers:
            del self._tool_handlers[name]
        
        self.logger.info(f"Herramienta desregistrada: {name}")
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta una herramienta MCP"""
        if name not in self._tools:
            raise ValueError(f"Herramienta no encontrada: {name}")
        
        tool = self._tools[name]
        
        # Si hay un handler personalizado, usarlo
        if name in self._tool_handlers:
            handler = self._tool_handlers[name]
            return await handler(tool, arguments)
        
        # Handler por defecto
        return {
            "tool": name,
            "result": f"Resultado de ejecutar {name} con argumentos {arguments}",
            "metadata": tool.metadata
        }
    
    # === Métodos privados de transporte ===
    
    async def _start_http_server(self) -> None:
        """Inicia servidor HTTP para MCP"""
        from aiohttp import web, web_runner
        
        app = web.Application()
        app.router.add_post('/mcp', self._handle_http_request)
        app.router.add_get('/mcp/capabilities', self._handle_capabilities_request)
        
        runner = web_runner.AppRunner(app)
        await runner.setup()
        
        site = web_runner.TCPSite(runner, self.host, self.port)
        await site.start()
        
        self._server = runner
    
    async def _start_websocket_server(self) -> None:
        """Inicia servidor WebSocket para MCP"""
        import websockets
        
        async def handle_websocket(websocket, path):
            session_id = str(uuid.uuid4())
            self._client_sessions[session_id] = {
                'websocket': websocket,
                'initialized': False
            }
            
            try:
                async for message in websocket:
                    await self._handle_websocket_message(session_id, message)
            finally:
                await self._close_session(session_id)
        
        self._server = await websockets.serve(
            handle_websocket, 
            self.host, 
            self.port
        )
    
    async def _start_stdio_server(self) -> None:
        """Inicia servidor STDIO para MCP"""
        # Para STDIO, leemos de stdin y escribimos a stdout
        import sys
        
        async def read_stdin():
            while self._running:
                try:
                    line = await asyncio.get_event_loop().run_in_executor(
                        None, sys.stdin.readline
                    )
                    if line:
                        await self._handle_stdio_message(line.strip())
                except Exception as e:
                    self.logger.error(f"Error leyendo stdin: {e}")
        
        # Iniciar tarea de lectura
        asyncio.create_task(read_stdin())
    
    async def _handle_http_request(self, request) -> web.Response:
        """Maneja requests HTTP MCP"""
        try:
            data = await request.json()
            response = await self._process_mcp_message(data)
            return web.json_response(response)
        except Exception as e:
            self.logger.error(f"Error procesando request HTTP: {e}")
            return web.json_response(
                {"error": {"code": -1, "message": str(e)}}, 
                status=500
            )
    
    async def _handle_capabilities_request(self, request) -> web.Response:
        """Maneja request de capacidades"""
        return web.json_response({
            "capabilities": asdict(self.capabilities),
            "resources": list(self._resources.keys()),
            "tools": list(self._tools.keys())
        })
    
    async def _handle_websocket_message(self, session_id: str, message: str) -> None:
        """Maneja mensaje WebSocket MCP"""
        try:
            data = json.loads(message)
            response = await self._process_mcp_message(data, session_id)
            
            session = self._client_sessions[session_id]
            await session['websocket'].send(json.dumps(response))
            
        except Exception as e:
            self.logger.error(f"Error procesando mensaje WebSocket: {e}")
    
    async def _handle_stdio_message(self, message: str) -> None:
        """Maneja mensaje STDIO MCP"""
        try:
            data = json.loads(message)
            response = await self._process_mcp_message(data)
            
            import sys
            print(json.dumps(response), file=sys.stdout, flush=True)
            
        except Exception as e:
            self.logger.error(f"Error procesando mensaje STDIO: {e}")
    
    async def _process_mcp_message(self, data: Dict[str, Any], session_id: str = None) -> Dict[str, Any]:
        """Procesa un mensaje MCP y retorna la respuesta"""
        method = data.get("method")
        params = data.get("params", {})
        message_id = data.get("id")
        
        try:
            if method == "initialize":
                return await self._handle_initialize(params, session_id, message_id)
            elif method == "resources/list":
                return await self._handle_list_resources(message_id)
            elif method == "resources/read":
                return await self._handle_read_resource(params, message_id)
            elif method == "tools/list":
                return await self._handle_list_tools(message_id)
            elif method == "tools/call":
                return await self._handle_call_tool(params, message_id)
            else:
                return {
                    "id": message_id,
                    "error": {
                        "code": -32601,
                        "message": f"Método no encontrado: {method}"
                    }
                }
        except Exception as e:
            return {
                "id": message_id,
                "error": {
                    "code": -1,
                    "message": str(e)
                }
            }
    
    async def _handle_initialize(self, params: Dict[str, Any], session_id: str, message_id: str) -> Dict[str, Any]:
        """Maneja inicialización MCP"""
        if session_id and session_id in self._client_sessions:
            self._client_sessions[session_id]['initialized'] = True
        
        return {
            "id": message_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": asdict(self.capabilities),
                "serverInfo": {
                    "name": "MPC-MCP-Server",
                    "version": "1.0.0"
                }
            }
        }
    
    async def _handle_list_resources(self, message_id: str) -> Dict[str, Any]:
        """Maneja listado de recursos"""
        resources = [asdict(resource) for resource in self._resources.values()]
        
        return {
            "id": message_id,
            "result": {
                "resources": resources
            }
        }
    
    async def _handle_read_resource(self, params: Dict[str, Any], message_id: str) -> Dict[str, Any]:
        """Maneja lectura de recurso"""
        uri = params.get("uri")
        if not uri:
            raise ValueError("URI requerido para leer recurso")
        
        content = await self.read_resource(uri)
        
        return {
            "id": message_id,
            "result": {
                "contents": [content]
            }
        }
    
    async def _handle_list_tools(self, message_id: str) -> Dict[str, Any]:
        """Maneja listado de herramientas"""
        tools = [asdict(tool) for tool in self._tools.values()]
        
        return {
            "id": message_id,
            "result": {
                "tools": tools
            }
        }
    
    async def _handle_call_tool(self, params: Dict[str, Any], message_id: str) -> Dict[str, Any]:
        """Maneja llamada a herramienta"""
        name = params.get("name")
        arguments = params.get("arguments", {})
        
        if not name:
            raise ValueError("Nombre de herramienta requerido")
        
        result = await self.call_tool(name, arguments)
        
        return {
            "id": message_id,
            "result": {
                "content": [result]
            }
        }
    
    async def _convert_to_mcp_message(self, message: Message) -> Dict[str, Any]:
        """Convierte mensaje unificado a formato MCP"""
        return {
            "jsonrpc": "2.0",
            "id": message.id,
            "method": message.payload.get("method", "notification"),
            "params": message.payload.get("params", {})
        }
    
    async def _convert_from_mcp_message(self, mcp_message: Dict[str, Any]) -> Message:
        """Convierte mensaje MCP a formato unificado"""
        return Message(
            id=mcp_message.get("id", str(uuid.uuid4())),
            type=MessageType.REQUEST,
            protocol=ProtocolType.MCP,
            payload=mcp_message,
            metadata={
                "method": mcp_message.get("method"),
                "timestamp": datetime.now().isoformat()
            },
            timestamp=datetime.now().timestamp()
        )
    
    async def _close_session(self, session_id: str) -> None:
        """Cierra una sesión de cliente"""
        if session_id in self._client_sessions:
            session = self._client_sessions[session_id]
            if 'websocket' in session:
                await session['websocket'].close()
            del self._client_sessions[session_id]
    
    async def _send_http_message(self, message: Dict[str, Any], destination: str) -> None:
        """Envía mensaje HTTP MCP"""
        # Implementar cliente HTTP para envío
        pass
    
    async def _send_websocket_message(self, message: Dict[str, Any], destination: str) -> None:
        """Envía mensaje WebSocket MCP"""
        # Implementar envío WebSocket
        pass
    
    async def _send_stdio_message(self, message: Dict[str, Any]) -> None:
        """Envía mensaje STDIO MCP"""
        import sys
        print(json.dumps(message), file=sys.stdout, flush=True)