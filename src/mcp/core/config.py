"""
Configuración del Sistema MCP
============================

Configuración centralizada para el sistema MCP.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from enum import Enum

from ..adapters.mcp_adapter import MCPTransportType


class MCPLogLevel(Enum):
    """Niveles de logging para MCP"""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class MCPServerConfig:
    """Configuración del servidor MCP"""
    host: str = "localhost"
    port: int = 8080
    transport: MCPTransportType = MCPTransportType.HTTP
    max_connections: int = 100
    timeout: int = 30
    enable_cors: bool = True
    cors_origins: List[str] = None
    
    def __post_init__(self):
        if self.cors_origins is None:
            self.cors_origins = ["*"]


@dataclass
class MCPClientConfig:
    """Configuración del cliente MCP"""
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: float = 1.0
    max_retry_delay: float = 60.0
    connection_pool_size: int = 10


@dataclass
class MCPPluginConfig:
    """Configuración de plugins MCP"""
    plugin_paths: List[str] = None
    auto_load: bool = False
    plugin_timeout: int = 30
    max_plugins: int = 50
    
    def __post_init__(self):
        if self.plugin_paths is None:
            self.plugin_paths = ["./plugins", "./src/mcp/plugins"]


@dataclass
class MCPResourceConfig:
    """Configuración de recursos MCP"""
    cache_enabled: bool = True
    cache_size: int = 1000
    cache_ttl: int = 3600  # 1 hora
    max_resource_size: int = 10 * 1024 * 1024  # 10MB
    allowed_schemes: List[str] = None
    
    def __post_init__(self):
        if self.allowed_schemes is None:
            self.allowed_schemes = ["file", "http", "https", "mcp"]


@dataclass
class MCPToolConfig:
    """Configuración de herramientas MCP"""
    execution_timeout: int = 60
    max_concurrent_executions: int = 10
    enable_statistics: bool = True
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # segundos


@dataclass
class MCPSecurityConfig:
    """Configuración de seguridad MCP"""
    enable_authentication: bool = False
    api_key: Optional[str] = None
    allowed_hosts: List[str] = None
    enable_rate_limiting: bool = True
    max_requests_per_minute: int = 1000
    enable_request_logging: bool = True
    
    def __post_init__(self):
        if self.allowed_hosts is None:
            self.allowed_hosts = ["localhost", "127.0.0.1"]


@dataclass
class MCPMonitoringConfig:
    """Configuración de monitoreo MCP"""
    enable_metrics: bool = True
    metrics_port: int = 9090
    enable_health_checks: bool = True
    health_check_interval: int = 30
    enable_prometheus: bool = True
    log_level: MCPLogLevel = MCPLogLevel.INFO


@dataclass
class MCPConfig:
    """Configuración principal del sistema MCP"""
    server: MCPServerConfig = None
    client: MCPClientConfig = None
    plugins: MCPPluginConfig = None
    resources: MCPResourceConfig = None
    tools: MCPToolConfig = None
    security: MCPSecurityConfig = None
    monitoring: MCPMonitoringConfig = None
    
    # Configuración general
    enable_mcp: bool = True
    debug_mode: bool = False
    log_level: MCPLogLevel = MCPLogLevel.INFO
    
    def __post_init__(self):
        if self.server is None:
            self.server = MCPServerConfig()
        if self.client is None:
            self.client = MCPClientConfig()
        if self.plugins is None:
            self.plugins = MCPPluginConfig()
        if self.resources is None:
            self.resources = MCPResourceConfig()
        if self.tools is None:
            self.tools = MCPToolConfig()
        if self.security is None:
            self.security = MCPSecurityConfig()
        if self.monitoring is None:
            self.monitoring = MCPMonitoringConfig()
    
    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'MCPConfig':
        """Crea configuración desde diccionario"""
        config = cls()
        
        # Configuración del servidor
        if 'server' in config_dict:
            server_config = config_dict['server']
            config.server = MCPServerConfig(**server_config)
        
        # Configuración del cliente
        if 'client' in config_dict:
            client_config = config_dict['client']
            config.client = MCPClientConfig(**client_config)
        
        # Configuración de plugins
        if 'plugins' in config_dict:
            plugins_config = config_dict['plugins']
            config.plugins = MCPPluginConfig(**plugins_config)
        
        # Configuración de recursos
        if 'resources' in config_dict:
            resources_config = config_dict['resources']
            config.resources = MCPResourceConfig(**resources_config)
        
        # Configuración de herramientas
        if 'tools' in config_dict:
            tools_config = config_dict['tools']
            config.tools = MCPToolConfig(**tools_config)
        
        # Configuración de seguridad
        if 'security' in config_dict:
            security_config = config_dict['security']
            config.security = MCPSecurityConfig(**security_config)
        
        # Configuración de monitoreo
        if 'monitoring' in config_dict:
            monitoring_config = config_dict['monitoring']
            config.monitoring = MCPMonitoringConfig(**monitoring_config)
        
        # Configuración general
        config.enable_mcp = config_dict.get('enable_mcp', True)
        config.debug_mode = config_dict.get('debug_mode', False)
        
        log_level_str = config_dict.get('log_level', 'info')
        config.log_level = MCPLogLevel(log_level_str.lower())
        
        return config
    
    def to_dict(self) -> Dict[str, Any]:
        """Convierte configuración a diccionario"""
        return {
            'enable_mcp': self.enable_mcp,
            'debug_mode': self.debug_mode,
            'log_level': self.log_level.value,
            'server': {
                'host': self.server.host,
                'port': self.server.port,
                'transport': self.server.transport.value,
                'max_connections': self.server.max_connections,
                'timeout': self.server.timeout,
                'enable_cors': self.server.enable_cors,
                'cors_origins': self.server.cors_origins
            },
            'client': {
                'timeout': self.client.timeout,
                'retry_attempts': self.client.retry_attempts,
                'retry_delay': self.client.retry_delay,
                'max_retry_delay': self.client.max_retry_delay,
                'connection_pool_size': self.client.connection_pool_size
            },
            'plugins': {
                'plugin_paths': self.plugins.plugin_paths,
                'auto_load': self.plugins.auto_load,
                'plugin_timeout': self.plugins.plugin_timeout,
                'max_plugins': self.plugins.max_plugins
            },
            'resources': {
                'cache_enabled': self.resources.cache_enabled,
                'cache_size': self.resources.cache_size,
                'cache_ttl': self.resources.cache_ttl,
                'max_resource_size': self.resources.max_resource_size,
                'allowed_schemes': self.resources.allowed_schemes
            },
            'tools': {
                'execution_timeout': self.tools.execution_timeout,
                'max_concurrent_executions': self.tools.max_concurrent_executions,
                'enable_statistics': self.tools.enable_statistics,
                'rate_limit_enabled': self.tools.rate_limit_enabled,
                'rate_limit_requests': self.tools.rate_limit_requests,
                'rate_limit_window': self.tools.rate_limit_window
            },
            'security': {
                'enable_authentication': self.security.enable_authentication,
                'api_key': self.security.api_key,
                'allowed_hosts': self.security.allowed_hosts,
                'enable_rate_limiting': self.security.enable_rate_limiting,
                'max_requests_per_minute': self.security.max_requests_per_minute,
                'enable_request_logging': self.security.enable_request_logging
            },
            'monitoring': {
                'enable_metrics': self.monitoring.enable_metrics,
                'metrics_port': self.monitoring.metrics_port,
                'enable_health_checks': self.monitoring.enable_health_checks,
                'health_check_interval': self.monitoring.health_check_interval,
                'enable_prometheus': self.monitoring.enable_prometheus,
                'log_level': self.monitoring.log_level.value
            }
        }


# Configuración por defecto
DEFAULT_MCP_CONFIG = MCPConfig()


def load_mcp_config(config_path: Optional[str] = None) -> MCPConfig:
    """Carga configuración MCP desde archivo"""
    if config_path:
        try:
            import json
            with open(config_path, 'r') as f:
                config_dict = json.load(f)
            return MCPConfig.from_dict(config_dict)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error cargando configuración MCP desde {config_path}: {e}")
    
    return DEFAULT_MCP_CONFIG


def save_mcp_config(config: MCPConfig, config_path: str) -> None:
    """Guarda configuración MCP a archivo"""
    import json
    with open(config_path, 'w') as f:
        json.dump(config.to_dict(), f, indent=2)