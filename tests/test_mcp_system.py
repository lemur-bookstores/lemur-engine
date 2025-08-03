"""
Tests para el Sistema MCP
========================

Tests unitarios y de integración para el sistema MCP.
"""

import pytest
import pytest_asyncio
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

# Importaciones del sistema MCP
from src.mcp.adapters.mcp_adapter import (
    MCPAdapter, MCPTransportType, MCPMessageType,
    MCPResource, MCPTool, MCPCapabilities
)
from src.mcp.adapters.mcp_client import MCPClient
from src.mcp.core.integration import MCPIntegrationSystem, MCPIntegrationType
from src.mcp.core.plugin_system import MCPPluginManager, MCPPlugin
from src.mcp.core.resource_manager import MCPResourceManager, MCPToolManager
from src.mcp.core.config import MCPConfig, MCPServerConfig, MCPClientConfig
from src.mcp.plugins.filesystem_plugin import FileSystemPlugin
from src.mcp.plugins.utility_tools_plugin import UtilityToolsPlugin

# Importaciones del sistema MPC
from src.mpc.core.interfaces import Message, ProtocolType, MessageType
from src.mpc.core.connection_manager import MPCConnectionManager


class TestMCPAdapter:
    """Tests para MCPAdapter"""
    
    @pytest.fixture
    def mcp_adapter(self):
        return MCPAdapter()
    
    @pytest.mark.asyncio
    async def test_adapter_initialization(self, mcp_adapter):
        """Test inicialización del adaptador"""
        assert mcp_adapter.protocol_type == ProtocolType.MCP
        assert not mcp_adapter._running
        assert mcp_adapter.transport == MCPTransportType.HTTP
    
    @pytest.mark.asyncio
    async def test_adapter_start_stop(self, mcp_adapter):
        """Test inicio y parada del adaptador"""
        # Mock de los métodos de servidor
        mcp_adapter._start_http_server = AsyncMock()
        
        # Iniciar
        await mcp_adapter.start()
        assert mcp_adapter._running
        
        # Parar
        await mcp_adapter.stop()
        assert not mcp_adapter._running
    
    @pytest.mark.asyncio
    async def test_send_message(self, mcp_adapter):
        """Test envío de mensajes"""
        message = Message(
            id="test-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.MCP,
            source="client",
            destination="mcp://localhost:8080/test",
            payload={"action": "test"},
            metadata={"source": "test"},
            timestamp=1234567890.0
        )
        
        # Mock de los métodos necesarios
        mcp_adapter._start_http_server = AsyncMock()
        mcp_adapter._convert_to_mcp_message = AsyncMock(return_value={"test": "message"})
        mcp_adapter._send_http_message = AsyncMock()
        
        await mcp_adapter.start()
        await mcp_adapter.send_message(message)
        
        mcp_adapter._convert_to_mcp_message.assert_called_once()
        mcp_adapter._send_http_message.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_list_resources(self, mcp_adapter):
        """Test listado de recursos"""
        # Mock de los métodos de servidor
        mcp_adapter._start_http_server = AsyncMock()
        await mcp_adapter.start()
        
        # Agregar recursos de prueba
        test_resource = MCPResource(
            uri="file:///test.txt",
            name="Test Resource",
            description="A test resource",
            mime_type="text/plain"
        )
        mcp_adapter._resources["file:///test.txt"] = test_resource
        
        # Verificar que el recurso está registrado
        assert "file:///test.txt" in mcp_adapter._resources
        assert mcp_adapter._resources["file:///test.txt"].name == "Test Resource"


class TestMCPClient:
    """Tests para MCPClient"""
    
    @pytest.fixture
    def mcp_client(self):
        return MCPClient()
    
    @pytest.mark.asyncio
    async def test_client_initialization(self, mcp_client):
        """Test inicialización del cliente"""
        assert not mcp_client._connected
        assert mcp_client.transport == MCPTransportType.HTTP
    
    @pytest.mark.asyncio
    async def test_connect_disconnect(self, mcp_client):
        """Test conexión y desconexión"""
        # Mock de los métodos de conexión
        mcp_client._connect_http = AsyncMock()
        mcp_client._initialize = AsyncMock(return_value=Mock())
        
        server_info = await mcp_client.connect()
        assert mcp_client._connected
        assert server_info is not None
        
        await mcp_client.disconnect()
        assert not mcp_client._connected
    
    @pytest.mark.asyncio
    async def test_list_resources(self, mcp_client):
        """Test listado de recursos remotos"""
        # Mock de la conexión
        mcp_client._connected = True
        
        # Mock de la respuesta
        mock_response = {
            "result": {
                "resources": [
                    {
                        "uri": "file:///test.txt",
                        "name": "Test Resource",
                        "description": "A test resource",
                        "mime_type": "text/plain"
                    }
                ]
            }
        }
        
        mcp_client._send_request = AsyncMock(return_value=mock_response)
        
        resources = await mcp_client.list_resources()
        assert len(resources) == 1
        assert resources[0].uri == "file:///test.txt"


class TestMCPIntegrationSystem:
    """Tests para MCPIntegrationSystem"""
    
    @pytest.fixture
    def mcp_config(self):
        return MCPConfig()
    
    @pytest.fixture
    def integration_system(self):
        return MCPIntegrationSystem()
    
    @pytest.mark.asyncio
    async def test_system_initialization(self, integration_system):
        """Test inicialización del sistema"""
        assert not integration_system._running
        assert integration_system.resource_manager is not None
        assert integration_system.tool_manager is not None
    
    @pytest.mark.asyncio
    async def test_start_stop_system(self, integration_system):
        """Test inicio y parada del sistema"""
        # Mock de los métodos necesarios
        integration_system._start_server = AsyncMock()
        integration_system._start_client = AsyncMock()
        
        await integration_system.start()
        assert integration_system._running
        
        await integration_system.stop()
        assert not integration_system._running


class TestMCPPluginSystem:
    """Tests para el sistema de plugins MCP"""
    
    @pytest.fixture
    def plugin_manager(self):
        return MCPPluginManager()
    
    @pytest.mark.asyncio
    async def test_plugin_manager_initialization(self, plugin_manager):
        """Test inicialización del plugin manager"""
        assert len(plugin_manager._plugins) == 0
        assert not plugin_manager._initialized


class TestMCPResourceManager:
    """Tests para MCPResourceManager"""
    
    @pytest.fixture
    def resource_manager(self):
        return MCPResourceManager()
    
    @pytest.mark.asyncio
    async def test_register_resource(self, resource_manager):
        """Test registro de recursos"""
        resource = MCPResource(
            uri="file:///test.txt",
            name="Test Resource",
            description="A test resource",
            mime_type="text/plain"
        )
        
        resource_manager.register_resource(resource)
        
        resources = resource_manager.list_resources()
        assert len(resources) == 1
        assert resources[0].uri == "file:///test.txt"


class TestMCPToolManager:
    """Tests para MCPToolManager"""
    
    @pytest.fixture
    def tool_manager(self):
        return MCPToolManager()
    
    @pytest.mark.asyncio
    async def test_register_tool(self, tool_manager):
        """Test registro de herramientas"""
        tool = MCPTool(
            name="test_tool",
            description="A test tool",
            input_schema={
                "type": "object",
                "properties": {
                    "input": {"type": "string"}
                }
            }
        )
        
        def test_handler(tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
            return {"result": f"Processed: {arguments.get('input', '')}"}
        
        tool_manager.register_tool(tool, test_handler)
        
        tools = tool_manager.list_tools()
        assert len(tools) == 1
        assert tools[0].name == "test_tool"


class TestMCPPlugins:
    """Tests para plugins específicos de MCP"""
    
    @pytest.mark.asyncio
    async def test_filesystem_plugin_initialization(self):
        """Test inicialización del plugin de filesystem"""
        plugin = FileSystemPlugin()
        
        assert plugin.name == "filesystem"
        assert plugin.version == "1.0.0"
        assert plugin.description == "File system operations plugin"
    
    @pytest.mark.asyncio
    async def test_utility_tools_plugin_initialization(self):
        """Test inicialización del plugin de utility tools"""
        plugin = UtilityToolsPlugin()
        
        assert plugin.name == "utility_tools"
        assert plugin.version == "1.0.0"
        assert plugin.description == "General utility tools plugin"


class TestMCPConfig:
    """Tests para configuración MCP"""
    
    def test_default_config(self):
        """Test configuración por defecto"""
        config = MCPConfig()
        
        assert config.enable_mcp is True
        assert config.server.host == "localhost"
        assert config.server.port == 8080
        assert config.client.timeout == 30
    
    def test_config_from_dict(self):
        """Test creación de configuración desde diccionario"""
        config_dict = {
            "enable_mcp": True,
            "debug_mode": True,
            "server": {
                "host": "0.0.0.0",
                "port": 9090
            },
            "client": {
                "timeout": 60
            }
        }
        
        config = MCPConfig.from_dict(config_dict)
        
        assert config.enable_mcp is True
        assert config.debug_mode is True
        assert config.server.host == "0.0.0.0"
        assert config.server.port == 9090
        assert config.client.timeout == 60
    
    def test_config_to_dict(self):
        """Test conversión de configuración a diccionario"""
        config = MCPConfig()
        config_dict = config.to_dict()
        
        assert isinstance(config_dict, dict)
        assert "enable_mcp" in config_dict
        assert "server" in config_dict
        assert "client" in config_dict


# Fixtures globales para tests de integración
@pytest.fixture(scope="session")
def event_loop():
    """Fixture para el loop de eventos"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def mcp_test_system():
    """Fixture para sistema MCP de prueba"""
    system = MCPIntegrationSystem()
    await system.start()
    
    yield system
    
    await system.stop()


# Tests de integración
class TestMCPIntegration:
    """Tests de integración del sistema MCP"""
    
    @pytest.mark.asyncio
    async def test_full_mcp_workflow(self, mcp_test_system):
        """Test flujo completo MCP"""
        # Registrar un recurso
        resource = MCPResource(
            uri="file:///integration_test.txt",
            name="Integration Test Resource",
            description="Resource for integration testing",
            mime_type="text/plain"
        )
        
        mcp_test_system.register_resource(resource)
        
        # Listar recursos
        resources = mcp_test_system.list_resources()
        assert len(resources) >= 1
        
        # Registrar una herramienta
        tool = MCPTool(
            name="integration_test_tool",
            description="Tool for integration testing",
            input_schema={
                "type": "object",
                "properties": {
                    "message": {"type": "string"}
                }
            }
        )
        
        def test_tool_handler(tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
            return {"echo": arguments.get("message", "")}
        
        mcp_test_system.register_tool(tool, test_tool_handler)
        
        # Listar herramientas
        tools = mcp_test_system.list_tools()
        assert len(tools) >= 1
        
        # Llamar herramienta
        result = await mcp_test_system.call_tool(
            "integration_test_tool",
            {"message": "Hello Integration Test!"}
        )
        assert result["result"]["echo"] == "Hello Integration Test!"


if __name__ == "__main__":
    # Ejecutar tests
    pytest.main([__file__, "-v"])