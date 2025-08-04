"""
MCP Integration System
=====================

Sistema de integración que conecta el adaptador MCP con el sistema MPC,
proporcionando una interfaz unificada para trabajar con recursos y
herramientas de LLMs y servicios de IA.
"""

import asyncio
import json
import uuid
from typing import Any, Dict, List, Optional, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from datetime import datetime

from .resource_manager import MCPResourceManager, MCPToolManager, ResourceType, ToolCategory
from ..adapters.mcp_adapter import MCPAdapter, MCPResource, MCPTool, MCPCapabilities, MCPTransportType
from ..adapters.mcp_client import MCPClient, MCPServerInfo

# Importación segura de adaptadores MPC - GRPCAdapter es opcional
# try:
#     from ...mpc.adapters import GRPCAdapter
#     GRPC_AVAILABLE = True
# except (ImportError, AttributeError):
#     GRPCAdapter = None
#     GRPC_AVAILABLE = False


class MCPIntegrationType(Enum):
    """Tipos de integración MCP"""
    SERVER = "server"
    CLIENT = "client"
    HYBRID = "hybrid"


@dataclass
class MCPConnection:
    """Información de conexión MCP"""
    id: str
    name: str
    type: MCPIntegrationType
    endpoint: str
    transport: MCPTransportType
    status: str
    connected_at: Optional[datetime] = None
    server_info: Optional[MCPServerInfo] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class MCPIntegrationSystem:
    """Sistema de integración MCP"""
    
    def __init__(self):
        # Gestores
        self.resource_manager = MCPResourceManager()
        self.tool_manager = MCPToolManager()
        
        # Adaptadores y clientes
        self._servers = {}  # MCPAdapter instances
        self._clients = {}  # MCPClient instances
        self._connections = {}  # MCPConnection instances
        
        # Estado
        self._running = False
        
        # Logging
        self.logger = logging.getLogger("mcp_integration")
        
        # Callbacks
        self._connection_handlers = {}
        self._resource_discovery_handlers = []
        self._tool_discovery_handlers = []
    
    async def start(self) -> None:
        """Inicia el sistema de integración MCP"""
        if self._running:
            return
        
        self.logger.info("Iniciando sistema de integración MCP")
        
        try:
            # Inicializar gestores
            await self._initialize_managers()
            
            # Registrar recursos y herramientas por defecto
            await self._register_default_capabilities()
            
            self._running = True
            self.logger.info("Sistema de integración MCP iniciado")
            
        except Exception as e:
            self.logger.error(f"Error iniciando sistema MCP: {e}")
            raise
    
    async def stop(self) -> None:
        """Detiene el sistema de integración MCP"""
        if not self._running:
            return
        
        self.logger.info("Deteniendo sistema de integración MCP")
        
        try:
            # Desconectar todos los clientes
            for client_id in list(self._clients.keys()):
                await self.disconnect_client(client_id)
            
            # Detener todos los servidores
            for server_id in list(self._servers.keys()):
                await self.stop_server(server_id)
            
            self._running = False
            self.logger.info("Sistema de integración MCP detenido")
            
        except Exception as e:
            self.logger.error(f"Error deteniendo sistema MCP: {e}")
            raise
    
    # === Gestión de Servidores ===
    
    async def create_server(self, 
                           server_id: str,
                           transport: MCPTransportType = MCPTransportType.HTTP,
                           host: str = "localhost",
                           port: int = 8080,
                           capabilities: Optional[MCPCapabilities] = None) -> MCPAdapter:
        """Crea y configura un servidor MCP"""
        if server_id in self._servers:
            raise ValueError(f"Servidor ya existe: {server_id}")
        
        self.logger.info(f"Creando servidor MCP: {server_id}")
        
        # Crear adaptador
        adapter = MCPAdapter(
            transport=transport,
            host=host,
            port=port,
            capabilities=capabilities
        )
        
        # Registrar recursos y herramientas del sistema
        await self._sync_capabilities_to_adapter(adapter)
        
        # Almacenar
        self._servers[server_id] = adapter
        
        # Crear conexión
        connection = MCPConnection(
            id=server_id,
            name=f"MCP Server {server_id}",
            type=MCPIntegrationType.SERVER,
            endpoint=f"{transport.value}://{host}:{port}",
            transport=transport,
            status="created"
        )
        self._connections[server_id] = connection
        
        return adapter
    
    async def start_server(self, server_id: str) -> None:
        """Inicia un servidor MCP"""
        if server_id not in self._servers:
            raise ValueError(f"Servidor no encontrado: {server_id}")
        
        adapter = self._servers[server_id]
        connection = self._connections[server_id]
        
        await adapter.start()
        
        connection.status = "running"
        connection.connected_at = datetime.now()
        
        self.logger.info(f"Servidor MCP iniciado: {server_id}")
    
    async def stop_server(self, server_id: str) -> None:
        """Detiene un servidor MCP"""
        if server_id not in self._servers:
            return
        
        adapter = self._servers[server_id]
        connection = self._connections[server_id]
        
        await adapter.stop()
        
        connection.status = "stopped"
        
        self.logger.info(f"Servidor MCP detenido: {server_id}")
    
    # === Gestión de Clientes ===
    
    async def create_client(self, 
                           client_id: str,
                           endpoint: str,
                           transport: MCPTransportType = MCPTransportType.HTTP) -> MCPClient:
        """Crea un cliente MCP"""
        if client_id in self._clients:
            raise ValueError(f"Cliente ya existe: {client_id}")
        
        self.logger.info(f"Creando cliente MCP: {client_id}")
        
        # Crear cliente
        client = MCPClient(
            transport=transport,
            endpoint=endpoint
        )
        
        # Almacenar
        self._clients[client_id] = client
        
        # Crear conexión
        connection = MCPConnection(
            id=client_id,
            name=f"MCP Client {client_id}",
            type=MCPIntegrationType.CLIENT,
            endpoint=endpoint,
            transport=transport,
            status="created"
        )
        self._connections[client_id] = connection
        
        return client
    
    async def connect_client(self, client_id: str) -> MCPServerInfo:
        """Conecta un cliente MCP"""
        if client_id not in self._clients:
            raise ValueError(f"Cliente no encontrado: {client_id}")
        
        client = self._clients[client_id]
        connection = self._connections[client_id]
        
        server_info = await client.connect()
        
        connection.status = "connected"
        connection.connected_at = datetime.now()
        connection.server_info = server_info
        
        # Descubrir capacidades del servidor
        await self._discover_server_capabilities(client_id, client)
        
        self.logger.info(f"Cliente MCP conectado: {client_id} -> {server_info.name}")
        
        return server_info
    
    async def disconnect_client(self, client_id: str) -> None:
        """Desconecta un cliente MCP"""
        if client_id not in self._clients:
            return
        
        client = self._clients[client_id]
        connection = self._connections[client_id]
        
        await client.disconnect()
        
        connection.status = "disconnected"
        
        self.logger.info(f"Cliente MCP desconectado: {client_id}")
    
    # === Gestión de Recursos ===
    
    def register_resource(self, 
                         uri: str,
                         name: str,
                         resource_type: str,
                         content: Any,
                         description: Optional[str] = None,
                         handler: Optional[Callable] = None,
                         server_ids: Optional[List[str]] = None) -> MCPResource:
        """Registra un recurso en el sistema"""
        
        resource = MCPResource(
            uri=uri,
            name=name,
            resource_type=resource_type,
            content=content,
            description=description
        )


        # Registrar en el gestor
        self.resource_manager.register_resource(resource, handler)
        
        # Sincronizar con servidores especificados
        if server_ids:
            for server_id in server_ids:
                if server_id in self._servers:
                    adapter = self._servers[server_id]
                    adapter.register_resource(resource, handler)
        else:
            # Sincronizar con todos los servidores
            for adapter in self._servers.values():
                adapter.register_resource(resource, handler)
        
        self.logger.info(f"Recurso registrado: {resource.uri}")
        
        # Retornar el recurso registrado como diccionario
        return asdict(resource)
    
    async def read_resource(self, 
                           uri: str, 
                           client_id: Optional[str] = None) -> Dict[str, Any]:
        """Lee un recurso (local o remoto)"""
        # Intentar leer localmente primero
        try:
            resource = await self.resource_manager.read_resource(uri)
            # Retornar solo el contenido si está disponible
            if hasattr(resource, 'content') and resource.content:
                return resource.content
            else:
                return asdict(resource)
        except ValueError:
            pass
        
        # Si no está local y hay cliente especificado, intentar remoto
        if client_id and client_id in self._clients:
            client = self._clients[client_id]
            if client.is_connected:
                return await client.read_resource(uri)
        
        # Intentar con todos los clientes conectados
        for client in self._clients.values():
            if client.is_connected:
                try:
                    return await client.read_resource(uri)
                except:
                    continue
        
        raise ValueError(f"Resource not found: {uri}")
    
    # === Gestión de Herramientas ===
    
    def register_tool(self, 
                     tool: MCPTool, 
                     handler: Callable,
                     category: ToolCategory = ToolCategory.GENERAL,
                     server_ids: Optional[List[str]] = None) -> None:
        """Registra una herramienta en el sistema"""
        # Registrar en el gestor
        self.tool_manager.register_tool(tool, handler, category)
        
        # Sincronizar con servidores especificados
        if server_ids:
            for server_id in server_ids:
                if server_id in self._servers:
                    adapter = self._servers[server_id]
                    adapter.register_tool(tool, handler)
        else:
            # Sincronizar con todos los servidores
            for adapter in self._servers.values():
                adapter.register_tool(tool, handler)
        
        self.logger.info(f"Herramienta registrada: {tool.name}")
    
    async def call_tool(self, 
                       name: str, 
                       arguments: Dict[str, Any],
                       client_id: Optional[str] = None) -> Dict[str, Any]:
        """Ejecuta una herramienta (local o remota)"""
        # Intentar ejecutar localmente primero
        try:
            result = await self.tool_manager.call_tool(name, arguments)
            return asdict(result)
        except ValueError:
            pass
        
        # Si no está local y hay cliente especificado, intentar remoto
        if client_id and client_id in self._clients:
            client = self._clients[client_id]
            if client.is_connected:
                return await client.call_tool(name, arguments)
        
        # Intentar con todos los clientes conectados
        for client in self._clients.values():
            if client.is_connected:
                try:
                    return await client.call_tool(name, arguments)
                except:
                    continue
        
        raise ValueError(f"Herramienta no encontrada: {name}")
    
    # === Información y Estado ===
    
    def list_connections(self) -> List[MCPConnection]:
        """Lista todas las conexiones MCP"""
        return list(self._connections.values())
    
    def get_connection(self, connection_id: str) -> Optional[MCPConnection]:
        """Obtiene información de una conexión"""
        return self._connections.get(connection_id)
    
    def list_resources(self, 
                      include_remote: bool = False,
                      client_id: Optional[str] = None) -> List[MCPResource]:
        """Lista recursos disponibles"""
        # Recursos locales
        resources = self.resource_manager.list_resources()
        
        # Recursos remotos si se solicita
        if include_remote:
            # TODO: Implementar descubrimiento de recursos remotos
            pass
        
        return resources
    
    def list_tools(self, 
                  include_remote: bool = False,
                  client_id: Optional[str] = None) -> List[MCPTool]:
        """Lista herramientas disponibles"""
        # Herramientas locales
        tools = self.tool_manager.list_tools()
        
        # Herramientas remotas si se solicita
        if include_remote:
            # TODO: Implementar descubrimiento de herramientas remotas
            pass
        
        return tools
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas del sistema"""
        return {
            'connections': {
                'total': len(self._connections),
                'servers': len(self._servers),
                'clients': len(self._clients),
                'active': len([c for c in self._connections.values() if c.status in ['running', 'connected']])
            },
            'resources': {
                'total': len(self.resource_manager._resources),
                'cached': len(self.resource_manager._resource_cache)
            },
            'tools': {
                'total': len(self.tool_manager._tools),
                'stats': self.tool_manager.get_tool_stats()
            },
            'running': self._running
        }
    
    # === Métodos privados ===
    
    async def _initialize_managers(self) -> None:
        """Inicializa los gestores"""
        # Los gestores no requieren inicialización especial
        pass
    
    async def _register_default_capabilities(self) -> None:
        """Registra recursos y herramientas por defecto"""
        # Recurso de información del sistema
        system_info_resource = MCPResource(
            uri="mcp://system/info",
            name="System Information",
            resource_type="INFO",
            content={"version": "1.0.0", "status": "running"},
            description="Información del sistema MCP",
            mime_type="application/json",
            metadata={'type': 'json', 'data': {'version': '1.0.0', 'status': 'running'}}
        )
        self.resource_manager.register_resource(system_info_resource)
        
        # Herramienta de ping
        ping_tool = MCPTool(
            name="ping",
            description="Verifica conectividad del sistema",
            input_schema={
                'type': 'object',
                'properties': {
                    'message': {'type': 'string', 'default': 'ping'}
                }
            }
        )
        
        async def ping_handler(tool, arguments):
            return {
                'response': f"pong: {arguments.get('message', 'ping')}",
                'timestamp': datetime.now().isoformat()
            }
        
        self.tool_manager.register_tool(ping_tool, ping_handler, ToolCategory.GENERAL)
    
    async def _sync_capabilities_to_adapter(self, adapter: MCPAdapter) -> None:
        """Sincroniza capacidades del sistema con un adaptador"""
        # Sincronizar recursos
        for resource in self.resource_manager.list_resources():
            handler = self.resource_manager._resource_handlers.get(resource.uri)
            adapter.register_resource(resource, handler)
        
        # Sincronizar herramientas
        for tool in self.tool_manager.list_tools():
            handler = self.tool_manager._tool_handlers.get(tool.name)
            adapter.register_tool(tool, handler)
    
    async def _discover_server_capabilities(self, client_id: str, client: MCPClient) -> None:
        """Descubre capacidades de un servidor remoto"""
        try:
            # Descubrir recursos
            resources = await client.list_resources()
            for handler in self._resource_discovery_handlers:
                await handler(client_id, resources)
            
            # Descubrir herramientas
            tools = await client.list_tools()
            for handler in self._tool_discovery_handlers:
                await handler(client_id, tools)
            
        except Exception as e:
            self.logger.error(f"Error descubriendo capacidades de {client_id}: {e}")
    
    # === Callbacks ===
    
    def register_resource_discovery_handler(self, handler: Callable) -> None:
        """Registra handler para descubrimiento de recursos"""
        self._resource_discovery_handlers.append(handler)
    
    def register_tool_discovery_handler(self, handler: Callable) -> None:
        """Registra handler para descubrimiento de herramientas"""
        self._tool_discovery_handlers.append(handler)