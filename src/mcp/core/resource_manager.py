"""
MCP Resource Manager
===================

Gestiona recursos y herramientas MCP, incluyendo registro,
descubrimiento y ejecución de capacidades.
"""

import asyncio
import json
import uuid
from typing import Any, Dict, List, Optional, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from datetime import datetime
from pathlib import Path

from ..adapters.mcp_adapter import MCPResource, MCPTool


class ResourceType(Enum):
    """Tipos de recurso MCP"""
    TEXT = "text"
    JSON = "json"
    BINARY = "binary"
    FILE = "file"
    URL = "url"
    DATABASE = "database"
    API = "api"


class ToolCategory(Enum):
    """Categorías de herramientas MCP"""
    GENERAL = "general"
    FILE_SYSTEM = "file_system"
    DATABASE = "database"
    API = "api"
    AI = "ai"
    ANALYSIS = "analysis"
    TRANSFORMATION = "transformation"


@dataclass
class ResourceContent:
    """Contenido de un recurso MCP"""
    uri: str
    content: Union[str, bytes, Dict[str, Any]]
    mime_type: str
    encoding: str = "utf-8"
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class ToolResult:
    """Resultado de ejecutar una herramienta MCP"""
    tool_name: str
    success: bool
    result: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class MCPResourceManager:
    """Gestor de recursos MCP"""
    
    def __init__(self):
        self._resources = {}
        self._resource_handlers = {}
        self._resource_cache = {}
        self.logger = logging.getLogger("mcp_resource_manager")
    
    def register_resource(self, 
                         resource: MCPResource, 
                         handler: Optional[Callable] = None,
                         cache_ttl: Optional[int] = None) -> None:
        """Registra un recurso MCP"""
        self._resources[resource.uri] = {
            'resource': resource,
            'handler': handler,
            'cache_ttl': cache_ttl,
            'registered_at': datetime.now()
        }
        
        if handler:
            self._resource_handlers[resource.uri] = handler
        
        self.logger.info(f"Recurso registrado: {resource.uri}")
    
    def unregister_resource(self, uri: str) -> None:
        """Desregistra un recurso"""
        if uri in self._resources:
            del self._resources[uri]
        if uri in self._resource_handlers:
            del self._resource_handlers[uri]
        if uri in self._resource_cache:
            del self._resource_cache[uri]
        
        self.logger.info(f"Recurso desregistrado: {uri}")
    
    def list_resources(self, 
                      resource_type: Optional[ResourceType] = None,
                      pattern: Optional[str] = None) -> List[MCPResource]:
        """Lista recursos registrados"""
        resources = []
        
        for entry in self._resources.values():
            resource = entry['resource']
            
            # Filtrar por tipo si se especifica
            if resource_type and resource.metadata.get('type') != resource_type.value:
                continue
            
            # Filtrar por patrón si se especifica
            if pattern and pattern.lower() not in resource.name.lower():
                continue
            
            resources.append(resource)
        
        return resources
    
    async def read_resource(self, uri: str, use_cache: bool = True) -> ResourceContent:
        """Lee el contenido de un recurso"""
        if uri not in self._resources:
            raise ValueError(f"Recurso no encontrado: {uri}")
        
        # Verificar cache
        if use_cache and uri in self._resource_cache:
            cache_entry = self._resource_cache[uri]
            if not self._is_cache_expired(cache_entry):
                return cache_entry['content']
        
        entry = self._resources[uri]
        resource = entry['resource']
        handler = entry['handler']
        
        try:
            if handler:
                # Usar handler personalizado
                content_data = await handler(resource)
            else:
                # Handler por defecto
                content_data = await self._default_resource_handler(resource)
            
            # Crear contenido
            content = ResourceContent(
                uri=uri,
                content=content_data.get('content', ''),
                mime_type=content_data.get('mime_type', resource.mime_type),
                encoding=content_data.get('encoding', 'utf-8'),
                metadata=content_data.get('metadata', {})
            )
            
            # Cachear si es necesario
            if use_cache and entry['cache_ttl']:
                self._resource_cache[uri] = {
                    'content': content,
                    'cached_at': datetime.now(),
                    'ttl': entry['cache_ttl']
                }
            
            return content
            
        except Exception as e:
            self.logger.error(f"Error leyendo recurso {uri}: {e}")
            raise
    
    async def _default_resource_handler(self, resource: MCPResource) -> Dict[str, Any]:
        """Handler por defecto para recursos"""
        resource_type = resource.metadata.get('type', 'text')
        
        if resource_type == ResourceType.FILE.value:
            return await self._read_file_resource(resource)
        elif resource_type == ResourceType.URL.value:
            return await self._read_url_resource(resource)
        elif resource_type == ResourceType.JSON.value:
            return await self._read_json_resource(resource)
        else:
            return {
                'content': f"Contenido del recurso {resource.name}",
                'mime_type': resource.mime_type,
                'metadata': resource.metadata
            }
    
    async def _read_file_resource(self, resource: MCPResource) -> Dict[str, Any]:
        """Lee un recurso de archivo"""
        file_path = resource.metadata.get('file_path')
        if not file_path:
            raise ValueError(f"file_path requerido para recurso de archivo: {resource.uri}")
        
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {file_path}")
        
        if resource.mime_type.startswith('text/') or resource.mime_type == 'application/json':
            content = path.read_text(encoding='utf-8')
        else:
            content = path.read_bytes()
        
        return {
            'content': content,
            'mime_type': resource.mime_type,
            'metadata': {
                **resource.metadata,
                'file_size': path.stat().st_size,
                'last_modified': datetime.fromtimestamp(path.stat().st_mtime).isoformat()
            }
        }
    
    async def _read_url_resource(self, resource: MCPResource) -> Dict[str, Any]:
        """Lee un recurso de URL"""
        import aiohttp
        
        url = resource.metadata.get('url')
        if not url:
            raise ValueError(f"url requerida para recurso de URL: {resource.uri}")
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    if resource.mime_type.startswith('text/') or resource.mime_type == 'application/json':
                        content = await response.text()
                    else:
                        content = await response.read()
                    
                    return {
                        'content': content,
                        'mime_type': response.content_type or resource.mime_type,
                        'metadata': {
                            **resource.metadata,
                            'status_code': response.status,
                            'headers': dict(response.headers)
                        }
                    }
                else:
                    raise RuntimeError(f"Error HTTP {response.status} al leer URL: {url}")
    
    async def _read_json_resource(self, resource: MCPResource) -> Dict[str, Any]:
        """Lee un recurso JSON"""
        data = resource.metadata.get('data', {})
        
        return {
            'content': json.dumps(data, indent=2),
            'mime_type': 'application/json',
            'metadata': resource.metadata
        }
    
    def _is_cache_expired(self, cache_entry: Dict[str, Any]) -> bool:
        """Verifica si una entrada de cache ha expirado"""
        cached_at = cache_entry['cached_at']
        ttl = cache_entry['ttl']
        
        elapsed = (datetime.now() - cached_at).total_seconds()
        return elapsed > ttl
    
    def clear_cache(self, uri: Optional[str] = None) -> None:
        """Limpia el cache de recursos"""
        if uri:
            if uri in self._resource_cache:
                del self._resource_cache[uri]
        else:
            self._resource_cache.clear()
        
        self.logger.info(f"Cache limpiado: {uri or 'todos'}")


class MCPToolManager:
    """Gestor de herramientas MCP"""
    
    def __init__(self):
        self._tools = {}
        self._tool_handlers = {}
        self._execution_stats = {}
        self.logger = logging.getLogger("mcp_tool_manager")
    
    def register_tool(self, 
                     tool: MCPTool, 
                     handler: Callable,
                     category: ToolCategory = ToolCategory.GENERAL) -> None:
        """Registra una herramienta MCP"""
        self._tools[tool.name] = {
            'tool': tool,
            'handler': handler,
            'category': category,
            'registered_at': datetime.now()
        }
        
        self._tool_handlers[tool.name] = handler
        self._execution_stats[tool.name] = {
            'total_calls': 0,
            'successful_calls': 0,
            'failed_calls': 0,
            'total_execution_time': 0.0,
            'average_execution_time': 0.0
        }
        
        self.logger.info(f"Herramienta registrada: {tool.name} ({category.value})")
    
    def unregister_tool(self, name: str) -> None:
        """Desregistra una herramienta"""
        if name in self._tools:
            del self._tools[name]
        if name in self._tool_handlers:
            del self._tool_handlers[name]
        if name in self._execution_stats:
            del self._execution_stats[name]
        
        self.logger.info(f"Herramienta desregistrada: {name}")
    
    def list_tools(self, 
                  category: Optional[ToolCategory] = None,
                  pattern: Optional[str] = None) -> List[MCPTool]:
        """Lista herramientas registradas"""
        tools = []
        
        for entry in self._tools.values():
            tool = entry['tool']
            tool_category = entry['category']
            
            # Filtrar por categoría si se especifica
            if category and tool_category != category:
                continue
            
            # Filtrar por patrón si se especifica
            if pattern and pattern.lower() not in tool.name.lower():
                continue
            
            tools.append(tool)
        
        return tools
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> ToolResult:
        """Ejecuta una herramienta"""
        if name not in self._tools:
            raise ValueError(f"Herramienta no encontrada: {name}")
        
        entry = self._tools[name]
        tool = entry['tool']
        handler = entry['handler']
        
        start_time = datetime.now()
        
        try:
            # Validar argumentos según el schema
            self._validate_arguments(tool, arguments)
            
            # Ejecutar herramienta
            result = await handler(tool, arguments)
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Actualizar estadísticas
            self._update_stats(name, True, execution_time)
            
            return ToolResult(
                tool_name=name,
                success=True,
                result=result,
                execution_time=execution_time,
                metadata={
                    'arguments': arguments,
                    'executed_at': start_time.isoformat()
                }
            )
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Actualizar estadísticas
            self._update_stats(name, False, execution_time)
            
            self.logger.error(f"Error ejecutando herramienta {name}: {e}")
            
            return ToolResult(
                tool_name=name,
                success=False,
                result=None,
                error=str(e),
                execution_time=execution_time,
                metadata={
                    'arguments': arguments,
                    'executed_at': start_time.isoformat()
                }
            )
    
    def _validate_arguments(self, tool: MCPTool, arguments: Dict[str, Any]) -> None:
        """Valida argumentos según el schema de la herramienta"""
        schema = tool.input_schema
        required = schema.get('required', [])
        properties = schema.get('properties', {})
        
        # Verificar argumentos requeridos
        for field in required:
            if field not in arguments:
                raise ValueError(f"Argumento requerido faltante: {field}")
        
        # Validar tipos básicos
        for field, value in arguments.items():
            if field in properties:
                field_type = properties[field].get('type')
                if field_type == 'string' and not isinstance(value, str):
                    raise ValueError(f"Argumento {field} debe ser string")
                elif field_type == 'number' and not isinstance(value, (int, float)):
                    raise ValueError(f"Argumento {field} debe ser number")
                elif field_type == 'boolean' and not isinstance(value, bool):
                    raise ValueError(f"Argumento {field} debe ser boolean")
                elif field_type == 'array' and not isinstance(value, list):
                    raise ValueError(f"Argumento {field} debe ser array")
                elif field_type == 'object' and not isinstance(value, dict):
                    raise ValueError(f"Argumento {field} debe ser object")
    
    def _update_stats(self, tool_name: str, success: bool, execution_time: float) -> None:
        """Actualiza estadísticas de ejecución"""
        stats = self._execution_stats[tool_name]
        
        stats['total_calls'] += 1
        if success:
            stats['successful_calls'] += 1
        else:
            stats['failed_calls'] += 1
        
        stats['total_execution_time'] += execution_time
        stats['average_execution_time'] = stats['total_execution_time'] / stats['total_calls']
    
    def get_tool_stats(self, name: Optional[str] = None) -> Dict[str, Any]:
        """Obtiene estadísticas de herramientas"""
        if name:
            if name not in self._execution_stats:
                raise ValueError(f"Herramienta no encontrada: {name}")
            return {name: self._execution_stats[name]}
        else:
            return self._execution_stats.copy()
    
    def get_tool_info(self, name: str) -> Dict[str, Any]:
        """Obtiene información completa de una herramienta"""
        if name not in self._tools:
            raise ValueError(f"Herramienta no encontrada: {name}")
        
        entry = self._tools[name]
        stats = self._execution_stats[name]
        
        return {
            'tool': asdict(entry['tool']),
            'category': entry['category'].value,
            'registered_at': entry['registered_at'].isoformat(),
            'stats': stats
        }