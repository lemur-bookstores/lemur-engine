"""
MCP Plugins
===========

Plugins para el sistema MCP que proporcionan funcionalidades específicas
como operaciones de sistema de archivos, herramientas de utilidad, etc.
"""

from .filesystem_plugin import FileSystemPlugin
from .utility_tools_plugin import UtilityToolsPlugin

__all__ = [
    'FileSystemPlugin',
    'UtilityToolsPlugin'
]