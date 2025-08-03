"""
Utility Tools Plugin para MCP
=============================

Plugin que proporciona herramientas de utilidad general para el protocolo MCP.
"""

import json
import hashlib
import base64
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

from ..adapters.mcp_adapter import MCPResource, MCPTool


@dataclass
class UtilityToolsPlugin:
    """Plugin para herramientas de utilidad"""
    
    def __init__(self):
        self.name = "utility_tools"
        self.version = "1.0.0"
        self.description = "General utility tools plugin"
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
                name="generate_uuid",
                description="Genera un UUID único",
                input_schema={
                    "type": "object",
                    "properties": {
                        "version": {"type": "integer", "description": "Versión del UUID (1 o 4)", "default": 4}
                    }
                }
            ),
            MCPTool(
                name="hash_text",
                description="Genera un hash de un texto",
                input_schema={
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Texto a hashear"},
                        "algorithm": {"type": "string", "description": "Algoritmo de hash", "default": "sha256"}
                    },
                    "required": ["text"]
                }
            ),
            MCPTool(
                name="encode_base64",
                description="Codifica texto en base64",
                input_schema={
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Texto a codificar"}
                    },
                    "required": ["text"]
                }
            ),
            MCPTool(
                name="decode_base64",
                description="Decodifica texto desde base64",
                input_schema={
                    "type": "object",
                    "properties": {
                        "encoded_text": {"type": "string", "description": "Texto codificado en base64"}
                    },
                    "required": ["encoded_text"]
                }
            ),
            MCPTool(
                name="current_timestamp",
                description="Obtiene el timestamp actual",
                input_schema={
                    "type": "object",
                    "properties": {
                        "format": {"type": "string", "description": "Formato del timestamp", "default": "iso"}
                    }
                }
            )
        ]
    
    def get_resources(self) -> List[MCPResource]:
        """Retorna los recursos disponibles"""
        return []
    
    async def handle_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Maneja la llamada a una herramienta"""
        if tool_name == "generate_uuid":
            return await self._generate_uuid(arguments.get("version", 4))
        elif tool_name == "hash_text":
            return await self._hash_text(arguments["text"], arguments.get("algorithm", "sha256"))
        elif tool_name == "encode_base64":
            return await self._encode_base64(arguments["text"])
        elif tool_name == "decode_base64":
            return await self._decode_base64(arguments["encoded_text"])
        elif tool_name == "current_timestamp":
            return await self._current_timestamp(arguments.get("format", "iso"))
        else:
            raise ValueError(f"Herramienta no soportada: {tool_name}")
    
    async def _generate_uuid(self, version: int = 4) -> Dict[str, Any]:
        """Genera un UUID"""
        try:
            if version == 1:
                generated_uuid = str(uuid.uuid1())
            elif version == 4:
                generated_uuid = str(uuid.uuid4())
            else:
                return {"error": f"Versión de UUID no soportada: {version}", "success": False}
            
            return {"uuid": generated_uuid, "version": version, "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def _hash_text(self, text: str, algorithm: str = "sha256") -> Dict[str, Any]:
        """Genera un hash del texto"""
        try:
            if algorithm == "md5":
                hash_obj = hashlib.md5()
            elif algorithm == "sha1":
                hash_obj = hashlib.sha1()
            elif algorithm == "sha256":
                hash_obj = hashlib.sha256()
            elif algorithm == "sha512":
                hash_obj = hashlib.sha512()
            else:
                return {"error": f"Algoritmo no soportado: {algorithm}", "success": False}
            
            hash_obj.update(text.encode('utf-8'))
            hash_value = hash_obj.hexdigest()
            
            return {"hash": hash_value, "algorithm": algorithm, "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def _encode_base64(self, text: str) -> Dict[str, Any]:
        """Codifica texto en base64"""
        try:
            encoded = base64.b64encode(text.encode('utf-8')).decode('utf-8')
            return {"encoded": encoded, "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def _decode_base64(self, encoded_text: str) -> Dict[str, Any]:
        """Decodifica texto desde base64"""
        try:
            decoded = base64.b64decode(encoded_text.encode('utf-8')).decode('utf-8')
            return {"decoded": decoded, "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def _current_timestamp(self, format_type: str = "iso") -> Dict[str, Any]:
        """Obtiene el timestamp actual"""
        try:
            now = datetime.now()
            
            if format_type == "iso":
                timestamp = now.isoformat()
            elif format_type == "unix":
                timestamp = int(now.timestamp())
            elif format_type == "readable":
                timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
            else:
                return {"error": f"Formato no soportado: {format_type}", "success": False}
            
            return {"timestamp": timestamp, "format": format_type, "success": True}
        except Exception as e:
            return {"error": str(e), "success": False}