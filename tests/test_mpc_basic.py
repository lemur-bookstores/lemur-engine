"""
Tests básicos para el sistema MPC
================================

Tests unitarios para verificar el funcionamiento del sistema.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock

from src.mpc.core.interfaces import ProtocolType, MessageType, Message
from src.mpc.core.router import MPCRouter
from src.mpc.core.gateway import UnifiedGateway
from src.mpc.core.connection_manager import MPCConnectionManager
from src.mpc.adapters.http_adapter import HTTPAdapter


class TestMPCRouter:
    """Tests para el router MPC"""
    
    @pytest.fixture
    async def router(self):
        """Fixture del router"""
        router = MPCRouter()
        await router.start()
        yield router
        await router.stop()
        
    @pytest.mark.asyncio
    async def test_router_start_stop(self):
        """Test de inicio y parada del router"""
        router = MPCRouter()
        
        assert not router._running
        
        await router.start()
        assert router._running
        
        await router.stop()
        assert not router._running
        
    @pytest.mark.asyncio
    async def test_adapter_registration(self, router):
        """Test de registro de adaptadores"""
        # Mock adapter
        adapter = Mock()
        adapter.protocol_type = ProtocolType.HTTP
        adapter.start = AsyncMock()
        adapter.stop = AsyncMock()
        adapter.is_connected.return_value = True
        
        # Registrar adaptador
        router.register_adapter(adapter)
        
        assert ProtocolType.HTTP in router._adapters
        assert router._adapters[ProtocolType.HTTP] == adapter
        
        # Desregistrar adaptador
        router.unregister_adapter(ProtocolType.HTTP)
        assert ProtocolType.HTTP not in router._adapters


class TestMPCConnectionManager:
    """Tests para el gestor de conexiones"""
    
    @pytest.fixture
    async def connection_manager(self):
        """Fixture del gestor de conexiones"""
        manager = MPCConnectionManager()
        await manager.start()
        yield manager
        await manager.stop()
        
    @pytest.mark.asyncio
    async def test_connection_lifecycle(self, connection_manager):
        """Test del ciclo de vida de conexiones"""
        conn_id = "test_connection_1"
        protocol = ProtocolType.HTTP
        metadata = {"client": "test_client"}
        
        # Añadir conexión
        await connection_manager.add_connection(conn_id, protocol, metadata)
        
        # Verificar que existe
        connection = await connection_manager.get_connection(conn_id)
        assert connection is not None
        assert connection["id"] == conn_id
        assert connection["protocol"] == protocol
        
        # Listar conexiones
        connections = await connection_manager.list_connections()
        assert conn_id in connections
        
        # Remover conexión
        await connection_manager.remove_connection(conn_id)
        
        # Verificar que no existe
        connection = await connection_manager.get_connection(conn_id)
        assert connection is None
        
    @pytest.mark.asyncio
    async def test_protocol_filtering(self, connection_manager):
        """Test de filtrado por protocolo"""
        # Añadir conexiones de diferentes protocolos
        await connection_manager.add_connection("http_1", ProtocolType.HTTP, {})
        await connection_manager.add_connection("ws_1", ProtocolType.WEBSOCKET, {})
        
        # Filtrar por HTTP
        http_connections = await connection_manager.list_connections(ProtocolType.HTTP)
        assert len(http_connections) == 1
        assert "http_1" in http_connections
        
        # Filtrar por WebSocket
        ws_connections = await connection_manager.list_connections(ProtocolType.WEBSOCKET)
        assert len(ws_connections) == 1
        assert "ws_1" in ws_connections


class TestUnifiedGateway:
    """Tests para el gateway unificado"""
    
    @pytest.mark.asyncio
    async def test_gateway_lifecycle(self):
        """Test del ciclo de vida del gateway"""
        gateway = UnifiedGateway()
        
        assert not gateway.is_running()
        
        await gateway.start()
        assert gateway.is_running()
        
        await gateway.stop()
        assert not gateway.is_running()
        
    @pytest.mark.asyncio
    async def test_adapter_registration(self):
        """Test de registro de adaptadores en gateway"""
        gateway = UnifiedGateway()
        
        # Mock adapter
        adapter = Mock()
        adapter.protocol_type = ProtocolType.HTTP
        adapter.start = AsyncMock()
        adapter.stop = AsyncMock()
        
        # Registrar adaptador
        gateway.register_adapter(adapter)
        
        assert ProtocolType.HTTP in gateway._adapters
        assert gateway.get_adapter(ProtocolType.HTTP) == adapter
        
        # Verificar protocolos soportados
        protocols = gateway.get_supported_protocols()
        assert "http" in protocols


class TestMessage:
    """Tests para la clase Message"""
    
    def test_message_creation(self):
        """Test de creación de mensajes"""
        message = Message(
            id="test_msg_1",
            type=MessageType.REQUEST,
            protocol=ProtocolType.HTTP,
            payload={"test": "data"},
            metadata={"source": "test"},
            timestamp=1234567890.0
        )
        
        assert message.id == "test_msg_1"
        assert message.type == MessageType.REQUEST
        assert message.protocol == ProtocolType.HTTP
        assert message.payload == {"test": "data"}
        assert message.metadata == {"source": "test"}
        assert message.timestamp == 1234567890.0


class TestHTTPAdapter:
    """Tests para el adaptador HTTP"""
    
    @pytest.mark.asyncio
    async def test_adapter_lifecycle(self):
        """Test del ciclo de vida del adaptador HTTP"""
        adapter = HTTPAdapter(host="localhost", port=8081)
        
        assert not adapter.is_connected()
        assert adapter.protocol_type == ProtocolType.HTTP
        
        await adapter.start()
        assert adapter.is_connected()
        
        await adapter.stop()
        assert not adapter.is_connected()
        
    def test_server_info(self):
        """Test de información del servidor"""
        adapter = HTTPAdapter(host="localhost", port=8082)
        
        info = adapter.get_server_info()
        assert info["protocol"] == "http"
        assert info["host"] == "localhost"
        assert info["port"] == 8082
        assert info["url"] == "http://localhost:8082"


# Configuración de pytest
if __name__ == "__main__":
    pytest.main([__file__, "-v"])