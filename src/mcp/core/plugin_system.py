"""
MCP Plugin System
================

Sistema de plugins para MCP que permite extender las capacidades
del sistema con recursos y herramientas personalizadas.
"""

import asyncio
import json
import importlib
import inspect
from typing import Any, Dict, List, Optional, Callable, Type, Union
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
import logging
from abc import ABC, abstractmethod

from .resource_manager import MCPResourceManager, MCPToolManager, ResourceType, ToolCategory
from ..adapters.mcp_adapter import MCPResource, MCPTool, MCPCapabilities


class MCPPluginType(Enum):
    """Tipos de plugins MCP"""
    RESOURCE_PROVIDER = "resource_provider"
    TOOL_PROVIDER = "tool_provider"
    INTEGRATION = "integration"
    MIDDLEWARE = "middleware"


@dataclass
class MCPPluginInfo:
    """Información de un plugin MCP"""
    name: str
    version: str
    description: str
    author: str
    plugin_type: MCPPluginType
    dependencies: List[str] = None
    capabilities: List[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.capabilities is None:
            self.capabilities = []
        if self.metadata is None:
            self.metadata = {}


class MCPPlugin(ABC):
    """Clase base para plugins MCP"""
    
    def __init__(self):
        self.info: Optional[MCPPluginInfo] = None
        self.logger = logging.getLogger(f"mcp_plugin.{self.__class__.__name__}")
        self._initialized = False
    
    @abstractmethod
    async def initialize(self, context: Dict[str, Any]) -> None:
        """Inicializa el plugin"""
        pass
    
    @abstractmethod
    async def shutdown(self) -> None:
        """Cierra el plugin"""
        pass
    
    @abstractmethod
    def get_plugin_info(self) -> MCPPluginInfo:
        """Retorna información del plugin"""
        pass
    
    def is_initialized(self) -> bool:
        """Verifica si el plugin está inicializado"""
        return self._initialized


class MCPResourcePlugin(MCPPlugin):
    """Plugin base para proveedores de recursos"""
    
    @abstractmethod
    async def provide_resources(self) -> List[MCPResource]:
        """Proporciona recursos del plugin"""
        pass
    
    @abstractmethod
    async def handle_resource_request(self, uri: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Maneja solicitudes de recursos"""
        pass


class MCPToolPlugin(MCPPlugin):
    """Plugin base para proveedores de herramientas"""
    
    @abstractmethod
    async def provide_tools(self) -> List[MCPTool]:
        """Proporciona herramientas del plugin"""
        pass
    
    @abstractmethod
    async def handle_tool_call(self, tool_name: str, arguments: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Maneja llamadas a herramientas"""
        pass


class MCPIntegrationPlugin(MCPPlugin):
    """Plugin base para integraciones"""
    
    @abstractmethod
    async def setup_integration(self, integration_system) -> None:
        """Configura la integración"""
        pass


class MCPMiddlewarePlugin(MCPPlugin):
    """Plugin base para middleware"""
    
    @abstractmethod
    async def process_request(self, request: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa una solicitud"""
        pass
    
    @abstractmethod
    async def process_response(self, response: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa una respuesta"""
        pass


class MCPPluginManager:
    """Gestor de plugins MCP"""
    
    def __init__(self):
        self._plugins: Dict[str, MCPPlugin] = {}
        self._plugin_info: Dict[str, MCPPluginInfo] = {}
        self._plugin_paths: List[Path] = []
        self._resource_manager: Optional[MCPResourceManager] = None
        self._tool_manager: Optional[MCPToolManager] = None
        
        # Estado
        self._initialized = False
        
        # Logging
        self.logger = logging.getLogger("mcp_plugin_manager")
        
        # Callbacks
        self._plugin_loaded_callbacks = []
        self._plugin_unloaded_callbacks = []
    
    def set_managers(self, resource_manager: MCPResourceManager, tool_manager: MCPToolManager):
        """Configura los gestores de recursos y herramientas"""
        self._resource_manager = resource_manager
        self._tool_manager = tool_manager
    
    def add_plugin_path(self, path: Union[str, Path]) -> None:
        """Agrega una ruta de búsqueda de plugins"""
        plugin_path = Path(path)
        if plugin_path.exists() and plugin_path.is_dir():
            self._plugin_paths.append(plugin_path)
            self.logger.info(f"Ruta de plugins agregada: {plugin_path}")
        else:
            self.logger.warning(f"Ruta de plugins no válida: {plugin_path}")
    
    async def initialize(self) -> None:
        """Inicializa el gestor de plugins"""
        if self._initialized:
            return
        
        self.logger.info("Inicializando gestor de plugins MCP")
        
        # Descubrir plugins
        await self._discover_plugins()
        
        # Cargar plugins
        await self._load_discovered_plugins()
        
        self._initialized = True
        self.logger.info("Gestor de plugins MCP inicializado")
    
    async def shutdown(self) -> None:
        """Cierra el gestor de plugins"""
        if not self._initialized:
            return
        
        self.logger.info("Cerrando gestor de plugins MCP")
        
        # Descargar todos los plugins
        for plugin_name in list(self._plugins.keys()):
            await self.unload_plugin(plugin_name)
        
        self._initialized = False
        self.logger.info("Gestor de plugins MCP cerrado")
    
    async def load_plugin(self, plugin_class: Type[MCPPlugin], plugin_name: Optional[str] = None) -> str:
        """Carga un plugin desde una clase"""
        if plugin_name is None:
            plugin_name = plugin_class.__name__
        
        if plugin_name in self._plugins:
            raise ValueError(f"Plugin ya cargado: {plugin_name}")
        
        self.logger.info(f"Cargando plugin: {plugin_name}")
        
        try:
            # Crear instancia
            plugin = plugin_class()
            
            # Obtener información
            plugin_info = plugin.get_plugin_info()
            
            # Verificar dependencias
            await self._check_dependencies(plugin_info)
            
            # Inicializar plugin
            context = {
                'resource_manager': self._resource_manager,
                'tool_manager': self._tool_manager,
                'plugin_manager': self
            }
            await plugin.initialize(context)
            plugin._initialized = True
            
            # Registrar plugin
            self._plugins[plugin_name] = plugin
            self._plugin_info[plugin_name] = plugin_info
            
            # Registrar capacidades
            await self._register_plugin_capabilities(plugin_name, plugin)
            
            # Notificar callbacks
            for callback in self._plugin_loaded_callbacks:
                await callback(plugin_name, plugin_info)
            
            self.logger.info(f"Plugin cargado exitosamente: {plugin_name}")
            return plugin_name
            
        except Exception as e:
            self.logger.error(f"Error cargando plugin {plugin_name}: {e}")
            raise
    
    async def unload_plugin(self, plugin_name: str) -> None:
        """Descarga un plugin"""
        if plugin_name not in self._plugins:
            return
        
        self.logger.info(f"Descargando plugin: {plugin_name}")
        
        try:
            plugin = self._plugins[plugin_name]
            plugin_info = self._plugin_info[plugin_name]
            
            # Desregistrar capacidades
            await self._unregister_plugin_capabilities(plugin_name, plugin)
            
            # Cerrar plugin
            await plugin.shutdown()
            plugin._initialized = False
            
            # Remover de registros
            del self._plugins[plugin_name]
            del self._plugin_info[plugin_name]
            
            # Notificar callbacks
            for callback in self._plugin_unloaded_callbacks:
                await callback(plugin_name, plugin_info)
            
            self.logger.info(f"Plugin descargado: {plugin_name}")
            
        except Exception as e:
            self.logger.error(f"Error descargando plugin {plugin_name}: {e}")
            raise
    
    def get_plugin(self, plugin_name: str) -> Optional[MCPPlugin]:
        """Obtiene una instancia de plugin"""
        return self._plugins.get(plugin_name)
    
    def list_plugins(self) -> List[MCPPluginInfo]:
        """Lista todos los plugins cargados"""
        return list(self._plugin_info.values())
    
    def get_plugins_by_type(self, plugin_type: MCPPluginType) -> List[str]:
        """Obtiene plugins por tipo"""
        return [
            name for name, info in self._plugin_info.items()
            if info.plugin_type == plugin_type
        ]
    
    async def call_resource_plugins(self, uri: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Llama a plugins de recursos para manejar una URI"""
        resource_plugins = self.get_plugins_by_type(MCPPluginType.RESOURCE_PROVIDER)
        
        for plugin_name in resource_plugins:
            plugin = self._plugins[plugin_name]
            if isinstance(plugin, MCPResourcePlugin):
                try:
                    result = await plugin.handle_resource_request(uri, context)
                    if result:
                        return result
                except Exception as e:
                    self.logger.error(f"Error en plugin de recursos {plugin_name}: {e}")
        
        return None
    
    async def call_tool_plugins(self, tool_name: str, arguments: Dict[str, Any], context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Llama a plugins de herramientas para ejecutar una herramienta"""
        tool_plugins = self.get_plugins_by_type(MCPPluginType.TOOL_PROVIDER)
        
        for plugin_name in tool_plugins:
            plugin = self._plugins[plugin_name]
            if isinstance(plugin, MCPToolPlugin):
                try:
                    result = await plugin.handle_tool_call(tool_name, arguments, context)
                    if result:
                        return result
                except Exception as e:
                    self.logger.error(f"Error en plugin de herramientas {plugin_name}: {e}")
        
        return None
    
    async def process_middleware(self, request: Dict[str, Any], context: Dict[str, Any], is_response: bool = False) -> Dict[str, Any]:
        """Procesa middleware"""
        middleware_plugins = self.get_plugins_by_type(MCPPluginType.MIDDLEWARE)
        
        data = request
        for plugin_name in middleware_plugins:
            plugin = self._plugins[plugin_name]
            if isinstance(plugin, MCPMiddlewarePlugin):
                try:
                    if is_response:
                        data = await plugin.process_response(data, context)
                    else:
                        data = await plugin.process_request(data, context)
                except Exception as e:
                    self.logger.error(f"Error en middleware {plugin_name}: {e}")
        
        return data
    
    # === Métodos privados ===
    
    async def _discover_plugins(self) -> None:
        """Descubre plugins en las rutas configuradas"""
        self.logger.info("Descubriendo plugins...")
        
        for plugin_path in self._plugin_paths:
            await self._scan_plugin_directory(plugin_path)
    
    async def _scan_plugin_directory(self, directory: Path) -> None:
        """Escanea un directorio en busca de plugins"""
        try:
            for item in directory.iterdir():
                if item.is_file() and item.suffix == '.py' and not item.name.startswith('_'):
                    await self._try_load_plugin_file(item)
                elif item.is_dir() and not item.name.startswith('_'):
                    # Buscar __init__.py o plugin.py
                    init_file = item / '__init__.py'
                    plugin_file = item / 'plugin.py'
                    
                    if plugin_file.exists():
                        await self._try_load_plugin_file(plugin_file)
                    elif init_file.exists():
                        await self._try_load_plugin_file(init_file)
        except Exception as e:
            self.logger.error(f"Error escaneando directorio {directory}: {e}")
    
    async def _try_load_plugin_file(self, file_path: Path) -> None:
        """Intenta cargar un archivo de plugin"""
        try:
            # Importar módulo dinámicamente
            spec = importlib.util.spec_from_file_location(file_path.stem, file_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Buscar clases de plugin
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, MCPPlugin) and 
                    obj != MCPPlugin and 
                    not inspect.isabstract(obj)):
                    
                    self.logger.info(f"Plugin encontrado: {name} en {file_path}")
                    # Aquí podrías auto-cargar o registrar para carga posterior
                    
        except Exception as e:
            self.logger.debug(f"No se pudo cargar como plugin: {file_path} - {e}")
    
    async def _load_discovered_plugins(self) -> None:
        """Carga plugins descubiertos"""
        # Por ahora, los plugins se cargan manualmente
        # En el futuro se podría implementar carga automática
        pass
    
    async def _check_dependencies(self, plugin_info: MCPPluginInfo) -> None:
        """Verifica dependencias de un plugin"""
        for dependency in plugin_info.dependencies:
            if dependency not in self._plugins:
                raise ValueError(f"Dependencia no encontrada: {dependency}")
    
    async def _register_plugin_capabilities(self, plugin_name: str, plugin: MCPPlugin) -> None:
        """Registra las capacidades de un plugin"""
        try:
            # Registrar recursos
            if isinstance(plugin, MCPResourcePlugin):
                resources = await plugin.provide_resources()
                for resource in resources:
                    if self._resource_manager:
                        handler = lambda uri, ctx: plugin.handle_resource_request(uri, ctx)
                        self._resource_manager.register_resource(resource, handler)
            
            # Registrar herramientas
            if isinstance(plugin, MCPToolPlugin):
                tools = await plugin.provide_tools()
                for tool in tools:
                    if self._tool_manager:
                        handler = lambda name, args, ctx: plugin.handle_tool_call(name, args, ctx)
                        self._tool_manager.register_tool(tool, handler, ToolCategory.PLUGIN)
            
        except Exception as e:
            self.logger.error(f"Error registrando capacidades del plugin {plugin_name}: {e}")
    
    async def _unregister_plugin_capabilities(self, plugin_name: str, plugin: MCPPlugin) -> None:
        """Desregistra las capacidades de un plugin"""
        try:
            # Desregistrar recursos
            if isinstance(plugin, MCPResourcePlugin) and self._resource_manager:
                resources = await plugin.provide_resources()
                for resource in resources:
                    # TODO: Implementar desregistro de recursos
                    pass
            
            # Desregistrar herramientas
            if isinstance(plugin, MCPToolPlugin) and self._tool_manager:
                tools = await plugin.provide_tools()
                for tool in tools:
                    # TODO: Implementar desregistro de herramientas
                    pass
            
        except Exception as e:
            self.logger.error(f"Error desregistrando capacidades del plugin {plugin_name}: {e}")
    
    # === Callbacks ===
    
    def register_plugin_loaded_callback(self, callback: Callable) -> None:
        """Registra callback para cuando se carga un plugin"""
        self._plugin_loaded_callbacks.append(callback)
    
    def register_plugin_unloaded_callback(self, callback: Callable) -> None:
        """Registra callback para cuando se descarga un plugin"""
        self._plugin_unloaded_callbacks.append(callback)