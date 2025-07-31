"""
Tests para el adaptador WebSocket del sistema MPC
===============================================

Tests unitarios y de integración para WebSocketAdapter.
"""

import asyncio
import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from src.mpc.adapters.websocket_adapter import WebSocketAdapter, WebSocketConnection
from src.mpc.core.interfaces import Message, MessageType, ProtocolType


class TestWebSocketConnection:
    """Tests para la clase WebSocketConnection"""
    
    def test_connection_creation(self):
        """Test creación de conexión WebSocket"""
        mock_websocket = MagicMock()
        connection_id = "test-conn-001"
        
        connection = WebSocketConnection(mock_websocket, connection_id)
        
        assert connection.websocket == mock_websocket
        assert connection.connection_id == connection_id
        assert connection.is_active is True
        assert connection.message_count == 0
        assert isinstance(connection.created_at, datetime)
        assert isinstance(connection.last_activity, datetime)
        
    @pytest.mark.asyncio
    async def test_send_message_success(self):
        """Test envío exitoso de mensaje"""
        mock_websocket = AsyncMock()
        connection = WebSocketConnection(mock_websocket, "test-001")
        
        message = {"type": "test", "data": "hello"}
        await connection.send_message(message)
        
        mock_websocket.send.assert_called_once_with(json.dumps(message))
        assert connection.message_count == 1
        
    @pytest.mark.asyncio
    async def test_send_message_connection_closed(self):
        """Test envío cuando conexión está cerrada"""
        from websockets.exceptions import ConnectionClosed
        
        mock_websocket = AsyncMock()
        mock_websocket.send.side_effect = ConnectionClosed(None, None)
        
        connection = WebSocketConnection(mock_websocket, "test-001")
        
        with pytest.raises(ConnectionClosed):
            await connection.send_message({"test": "data"})
            
        assert connection.is_active is False
        
    @pytest.mark.asyncio
    async def test_close_connection(self):
        """Test cierre de conexión"""
        mock_websocket = AsyncMock()
        mock_websocket.closed = False
        
        connection = WebSocketConnection(mock_websocket, "test-001")
        await connection.close()
        
        mock_websocket.close.assert_called_once()
        assert connection.is_active is False


class TestWebSocketAdapter:
    """Tests para la clase WebSocketAdapter"""
    
    def test_adapter_creation(self):
        """Test creación del adaptador"""
        adapter = WebSocketAdapter(host="localhost", port=8081)
        
        assert adapter.host == "localhost"
        assert adapter.port == 8081
        assert adapter.protocol_type == ProtocolType.WEBSOCKET
        assert adapter._running is False
        assert len(adapter._connections) == 0
        
    def test_adapter_custom_config(self):
        """Test creación con configuración personalizada"""
        adapter = WebSocketAdapter(
            host="0.0.0.0",
            port=9000,
            max_connections=500,
            ping_interval=60,
            ping_timeout=20
        )
        
        assert adapter.host == "0.0.0.0"
        assert adapter.port == 9000
        assert adapter.max_connections == 500
        assert adapter.ping_interval == 60
        assert adapter.ping_timeout == 20
        
    @pytest.mark.asyncio
    async def test_start_stop_lifecycle(self):
        """Test ciclo de vida start/stop"""
        with patch('websockets.serve') as mock_serve:
            mock_server = AsyncMock()
            mock_serve.return_value = mock_server
            
            adapter = WebSocketAdapter()
            
            # Test start
            await adapter.start()
            assert adapter._running is True
            assert adapter._server == mock_server
            mock_serve.assert_called_once()
            
            # Test stop
            await adapter.stop()
            assert adapter._running is False
            mock_server.close.assert_called_once()
            mock_server.wait_closed.assert_called_once()
            
    @pytest.mark.asyncio
    async def test_start_already_running(self):
        """Test start cuando ya está corriendo"""
        adapter = WebSocketAdapter()
        adapter._running = True
        
        with patch('websockets.serve') as mock_serve:
            await adapter.start()
            mock_serve.assert_not_called()
            
    @pytest.mark.asyncio
    async def test_stop_not_running(self):
        """Test stop cuando no está corriendo"""
        adapter = WebSocketAdapter()
        
        # No debería lanzar excepción
        await adapter.stop()
        assert adapter._running is False
        
    @pytest.mark.asyncio
    async def test_send_message_not_running(self):
        """Test envío de mensaje cuando no está corriendo"""
        adapter = WebSocketAdapter()
        message = Message(
            id="test-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.WEBSOCKET,
            payload={"test": "data"}
        )
        
        with pytest.raises(RuntimeError, match="no está corriendo"):
            await adapter.send_message(message)
            
    @pytest.mark.asyncio
    async def test_send_message_broadcast(self):
        """Test envío de mensaje broadcast"""
        adapter = WebSocketAdapter()
        adapter._running = True
        
        # Mock conexiones
        mock_conn1 = AsyncMock()
        mock_conn2 = AsyncMock()
        adapter._connections = {
            "conn1": mock_conn1,
            "conn2": mock_conn2
        }
        
        message = Message(
            id="test-001",
            type=MessageType.EVENT,
            protocol=ProtocolType.WEBSOCKET,
            payload={"event": "test"}
        )
        
        with patch.object(adapter, '_broadcast_to_all_connections') as mock_broadcast:
            await adapter.send_message(message)
            mock_broadcast.assert_called_once()
            
    @pytest.mark.asyncio
    async def test_send_message_specific_destination(self):
        """Test envío a destino específico"""
        adapter = WebSocketAdapter()
        adapter._running = True
        
        message = Message(
            id="test-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.WEBSOCKET,
            payload={"test": "data"},
            destination="conn1"
        )
        
        with patch.object(adapter, '_send_to_specific_connection') as mock_send:
            await adapter.send_message(message)
            mock_send.assert_called_once_with("conn1", unittest.mock.ANY)
            
    @pytest.mark.asyncio
    async def test_receive_messages_generator(self):
        """Test generador de mensajes recibidos"""
        adapter = WebSocketAdapter()
        adapter._running = True
        
        # Crear mensaje de prueba
        test_message = Message(
            id="test-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.WEBSOCKET,
            payload={"test": "data"}
        )
        
        # Añadir mensaje a la cola
        await adapter._message_queue.put(test_message)
        
        # Detener después del primer mensaje
        async def stop_after_first():
            await asyncio.sleep(0.1)
            adapter._running = False
            
        stop_task = asyncio.create_task(stop_after_first())
        
        # Recibir mensajes
        messages = []
        async for message in adapter.receive_messages():
            messages.append(message)
            break
            
        await stop_task
        
        assert len(messages) == 1
        assert messages[0].id == "test-001"
        
    def test_is_connected(self):
        """Test verificación de conexión"""
        adapter = WebSocketAdapter()
        
        # No conectado inicialmente
        assert adapter.is_connected() is False
        
        # Simular conexión
        adapter._running = True
        adapter._server = MagicMock()
        assert adapter.is_connected() is True
        
        # Sin servidor
        adapter._server = None
        assert adapter.is_connected() is False
        
    @pytest.mark.asyncio
    async def test_connect_to_server(self):
        """Test conexión como cliente"""
        with patch('websockets.connect') as mock_connect:
            mock_websocket = AsyncMock()
            mock_connect.return_value = mock_websocket
            
            adapter = WebSocketAdapter()
            
            connection_id = await adapter.connect_to_server("ws://localhost:8080")
            
            assert connection_id in adapter._client_connections
            assert adapter._client_connections[connection_id] == mock_websocket
            mock_connect.assert_called_once_with(
                "ws://localhost:8080",
                ping_interval=30,
                ping_timeout=10
            )
            
    @pytest.mark.asyncio
    async def test_disconnect_from_server(self):
        """Test desconexión de servidor"""
        adapter = WebSocketAdapter()
        mock_websocket = AsyncMock()
        
        # Añadir conexión cliente
        adapter._client_connections["test-conn"] = mock_websocket
        
        await adapter.disconnect_from_server("test-conn")
        
        assert "test-conn" not in adapter._client_connections
        mock_websocket.close.assert_called_once()
        
    def test_get_connection_stats(self):
        """Test obtención de estadísticas"""
        adapter = WebSocketAdapter()
        adapter._running = True
        
        # Añadir conexiones mock
        mock_conn1 = MagicMock()
        mock_conn1.is_active = True
        mock_conn1.message_count = 5
        
        mock_conn2 = MagicMock()
        mock_conn2.is_active = False
        mock_conn2.message_count = 3
        
        adapter._connections = {"conn1": mock_conn1, "conn2": mock_conn2}
        adapter._client_connections = {"client1": MagicMock()}
        
        stats = adapter.get_connection_stats()
        
        assert stats["protocol"] == "websocket"
        assert stats["total_connections"] == 2
        assert stats["active_connections"] == 1
        assert stats["client_connections"] == 1
        assert stats["total_messages"] == 8
        assert stats["server_running"] is True
        assert stats["server_url"] == "ws://localhost:8081"
        
    def test_get_connections_info(self):
        """Test obtención de información de conexiones"""
        adapter = WebSocketAdapter()
        
        # Mock conexión
        mock_websocket = MagicMock()
        mock_websocket.remote_address = ("127.0.0.1", 12345)
        
        mock_conn = WebSocketConnection(mock_websocket, "test-conn")
        mock_conn.message_count = 10
        
        adapter._connections = {"test-conn": mock_conn}
        
        info = adapter.get_connections_info()
        
        assert "test-conn" in info
        conn_info = info["test-conn"]
        assert conn_info["connection_id"] == "test-conn"
        assert conn_info["message_count"] == 10
        assert conn_info["is_active"] is True
        assert "127.0.0.1" in conn_info["remote_address"]
        
    @pytest.mark.asyncio
    async def test_cleanup_inactive_connections(self):
        """Test limpieza de conexiones inactivas"""
        adapter = WebSocketAdapter()
        
        # Crear conexiones activas e inactivas
        active_conn = AsyncMock()
        active_conn.is_active = True
        
        inactive_conn = AsyncMock()
        inactive_conn.is_active = False
        
        adapter._connections = {
            "active": active_conn,
            "inactive": inactive_conn
        }
        
        cleaned = await adapter.cleanup_inactive_connections()
        
        assert cleaned == 1
        assert "active" in adapter._connections
        assert "inactive" not in adapter._connections
        inactive_conn.close.assert_called_once()


# Fixtures para tests de integración
@pytest.fixture
async def websocket_adapter():
    """Fixture para adaptador WebSocket"""
    adapter = WebSocketAdapter(host="localhost", port=8082)
    yield adapter
    if adapter._running:
        await adapter.stop()


@pytest.mark.asyncio
async def test_websocket_integration(websocket_adapter):
    """Test de integración básica"""
    # Iniciar adaptador
    await websocket_adapter.start()
    assert websocket_adapter.is_connected()
    
    # Verificar estadísticas iniciales
    stats = websocket_adapter.get_connection_stats()
    assert stats["total_connections"] == 0
    assert stats["server_running"] is True
    
    # Detener adaptador
    await websocket_adapter.stop()
    assert not websocket_adapter.is_connected()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])