"""
FileSystem Plugin para MCP
==========================

Plugin que proporciona operaciones de sistema de archivos para el protocolo MCP.
"""

import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

from ..adapters.mcp_adapter import MCPResource, MCPTool


@dataclass
class FileSystemPlugin:
    """Plugin para operaciones de sistema de archivos"""
    
    def __init__(self):
        self.name = "filesystem"
        self.version = "1.0.0"
        self.description = "File system operations plugin"
        self._initialized = False
    
    async def initialize(self) -> None:
        """Inicializa el plugin"""
        self._initialized = True
    
    async def shutdown(self) -> None:
        """Cierra el plugin"""
        self._initialized = False
    
    @property
    def initialized(self) -> bool:
        """Retorna si el plugin está inicializado"""
        return self._initialized
    
    def get_tools(self) -> List[MCPTool]:
        """Retorna las herramientas disponibles"""
        return [
            MCPTool(
                name="read_file",
                description="Lee el contenido de un archivo",
                input_schema={
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Ruta del archivo a leer"}
                    },
                    "required": ["file_path"]
                }
            ),
            MCPTool(
                name="write_file",
                description="Escribe contenido a un archivo",
                input_schema={
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Ruta del archivo"},
                        "content": {"type": "string", "description": "Contenido a escribir"}
                    },
                    "required": ["file_path", "content"]
                }
            ),
            MCPTool(
                name="list_directory",
                description="Lista el contenido de un directorio",
                input_schema={
                    "type": "object",
                    "properties": {
                        "directory_path": {"type": "string", "description": "Ruta del directorio"}
                    },
                    "required": ["directory_path"]
                }
            )
        ]
    
    def get_resources(self) -> List[MCPResource]:
        """Retorna los recursos disponibles"""
        return []
    
    async def handle_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Maneja la llamada a una herramienta"""
        if tool_name == "read_file":
            return await self._read_file(arguments["file_path"])
        elif tool_name == "write_file":
            return await self._write_file(arguments["file_path"], arguments["content"])
        elif tool_name == "list_directory":
            return await self._list_directory(arguments["directory_path"])
        else:
            raise ValueError(f"Herramienta no soportada: {tool_name}")
    
    async def _read_file(self, file_path: str) -> Dict[str, Any]:
        """Lee un archivo"""
        try:
            path = Path(file_path)
            if not path.exists():
                return {"error": f"Archivo no encontrado: {file_path}"}
            
            content = path.read_text(encoding='utf-8')
            return {"content": content, "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def _write_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Escribe a un archivo"""
        try:
            path = Path(file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
            return {"message": f"Archivo escrito: {file_path}", "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def _list_directory(self, directory_path: str) -> Dict[str, Any]:
        """Lista un directorio"""
        try:
            path = Path(directory_path)
            if not path.exists():
                return {"error": f"Directorio no encontrado: {directory_path}"}
            
            items = []
            for item in path.iterdir():
                items.append({
                    "name": item.name,
                    "type": "directory" if item.is_dir() else "file",
                    "size": item.stat().st_size if item.is_file() else None
                })
            
            return {"items": items, "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}