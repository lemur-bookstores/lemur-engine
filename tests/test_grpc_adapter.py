"""
Pruebas unitarias para el adaptador gRPC del sistema MPC.
"""

import pytest
import asyncio
import time
import json
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

from src.mpc.adapters.grpc_adapter import GRPCAdapter, GRPCClient, GRPCConnection, MPCServicer
from src.mpc.core.interfaces import Message
from src.mpc.core.router import MPCRouter


class TestGRPCConnection:
    """Pruebas para la clase GRPCConnection."""
    
    def test_connection_creation(self):
        """Prueba la creación de una conexión gRPC."""
        mock_context = Mock()
        mock_context.cancelled.return_value = False
        
        connection = GRPCConnection("test_conn_001", mock_context)
        
        assert connection.connection_id == "test_conn_001"
        assert connection.context == mock_context
        assert connection.messages_sent == 0
        assert connection.messages_received == 0
        assert not connection.is_streaming
        assert connection.is_active()
        assert isinstance(connection.created_at, float)
        assert isinstance(connection.last_activity, float)
    
    def test_update_activity(self):
        """Prueba la actualización de actividad."""
        mock_context = Mock()
        connection = GRPCConnection("test_conn_001", mock_context)
        
        original_activity = connection.last_activity
        time.sleep(0.01)  # Pequeña pausa
        connection.update_activity()
        
        assert connection.last_activity > original_activity
    
    def test_is_active_cancelled_context(self):
        """Prueba is_active con contexto cancelado."""
        mock_context = Mock()
        mock_context.cancelled.return_value = True
        
        connection = GRPCConnection("test_conn_001", mock_context)
        
        assert not connection.is_active()


class TestMPCServicer:
    """Pruebas para la clase MPCServicer."""
    
    @pytest.fixture
    def mock_adapter(self):
        """Fixture para adaptador mock."""
        adapter = Mock(spec=GRPCAdapter)
        adapter.router = Mock(spec=MPCRouter)
        adapter.router.route_message = AsyncMock()
        adapter.connections = {}
        adapter.stream_queues = {}
        return adapter
    
    @pytest.fixture
    def servicer(self, mock_adapter):
        """Fixture para servicer."""
        return MPCServicer(mock_adapter)
    
    @pytest.mark.asyncio
    async def test_send_message_success(self, servicer, mock_adapter):
        """Prueba envío exitoso de mensaje."""
        # Mock request
        mock_request = Mock()
        mock_request.id = "test_msg_001"
        mock_request.type = 1
        mock_request.protocol = 3
        mock_request.payload = '{"test": "data"}'
        mock_request.metadata = {}
        mock_request.timestamp = time.time()
        mock_request.source = "test_client"
        mock_request.destination = "test_server"
        mock_request.correlation_id = "test_corr_001"
        
        mock_context = Mock()
        
        # Ejecutar
        response = await servicer.SendMessage(mock_request, mock_context)
        
        # Verificar
        assert response.success
        assert response.message == "Message processed successfully"
        assert response.request_id == "test_msg_001"
        mock_adapter.router.route_message.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_send_message_error(self, servicer, mock_adapter):
        """Prueba manejo de errores en envío de mensaje."""
        # Configurar error en router
        mock_adapter.router.route_message.side_effect = Exception("Router error")
        
        mock_request = Mock()
        mock_request.id = "test_msg_002"
        mock_context = Mock()
        
        # Ejecutar
        response = await servicer.SendMessage(mock_request, mock_context)
        
        # Verificar
        assert not response.success
        assert "Error: Router error" in response.message
        assert response.request_id == "test_msg_002"
    
    @pytest.mark.asyncio
    async def test_stream_messages(self, servicer, mock_adapter):
        """Prueba streaming de mensajes."""
        mock_request = Mock()
        mock_request.message_types = []
        mock_request.sources = []
        mock_request.filters = {}
        mock_request.buffer_size = 100
        
        mock_context = Mock()
        mock_context.cancelled.side_effect = [False, False, True]  # Cancelar después de 2 iteraciones
        
        # Crear generador mock
        async def mock_stream():
            count = 0
            async for event in servicer.StreamMessages(mock_request, mock_context):
                count += 1
                if count >= 2:  # Limitar iteraciones
                    break
                yield event
        
        # Ejecutar
        events = []
        async for event in mock_stream():
            events.append(event)
        
        # Verificar que se creó la conexión
        assert len(mock_adapter.connections) <= 1  # Puede estar limpia por el finally
    
    @pytest.mark.asyncio
    async def test_get_stats(self, servicer, mock_adapter):
        """Prueba obtención de estadísticas."""
        # Mock stats
        mock_stats = {
            'server': {'uptime': 100, 'total_messages': 50},
            'performance': {'messages_per_second': 0.5}
        }
        mock_adapter.get_detailed_stats = AsyncMock(return_value=mock_stats)
        
        mock_request = Mock()
        mock_context = Mock()
        
        # Ejecutar
        response = await servicer.GetStats(mock_request, mock_context)
        
        # Verificar
        assert response is not None
        mock_adapter.get_detailed_stats.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_health_check_healthy(self, servicer, mock_adapter):
        """Prueba health check con servicio saludable."""
        mock_adapter.is_healthy = AsyncMock(return_value=True)
        
        mock_request = Mock()
        mock_context = Mock()
        
        # Ejecutar
        response = await servicer.HealthCheck(mock_request, mock_context)
        
        # Verificar
        assert response.status == 1  # SERVING
        assert "healthy" in response.message.lower()
    
    @pytest.mark.asyncio
    async def test_health_check_unhealthy(self, servicer, mock_adapter):
        """Prueba health check con servicio no saludable."""
        mock_adapter.is_healthy = AsyncMock(return_value=False)
        
        mock_request = Mock()
        mock_context = Mock()
        
        # Ejecutar
        response = await servicer.HealthCheck(mock_request, mock_context)
        
        # Verificar
        assert response.status == 2  # NOT_SERVING
        assert "unhealthy" in response.message.lower()
    
    def test_protobuf_to_message(self, servicer):
        """Prueba conversión de protobuf a Message."""
        mock_pb_message = Mock()
        mock_pb_message.id = "test_msg_003"
        mock_pb_message.type = 1
        mock_pb_message.protocol = 3
        mock_pb_message.payload = '{"test": "data"}'
        mock_pb_message.metadata = {"key": "value"}
        mock_pb_message.timestamp = time.time()
        mock_pb_message.source = "test_source"
        mock_pb_message.destination = "test_dest"
        mock_pb_message.correlation_id = "test_corr"
        
        # Ejecutar
        message = servicer._protobuf_to_message(mock_pb_message)
        
        # Verificar
        assert isinstance(message, Message)
        assert message.id == "test_msg_003"
        assert message.protocol == "grpc"
        assert message.payload == '{"test": "data"}'
        assert message.metadata == {"key": "value"}


class TestGRPCAdapter:
    """Pruebas para la clase GRPCAdapter."""
    
    @pytest.fixture
    def adapter(self):
        """Fixture para adaptador gRPC."""
        return GRPCAdapter(host="localhost", port=50051)
    
    def test_adapter_initialization(self, adapter):
        """Prueba la inicialización del adaptador."""
        assert adapter.host == "localhost"
        assert adapter.port == 50051
        assert adapter.max_workers == 10
        assert adapter.max_connections == 1000
        assert not adapter.is_running
        assert adapter.server is None
        assert adapter.servicer is None
        assert len(adapter.connections) == 0
        assert len(adapter.stream_queues) == 0
    
    def test_get_protocol_name(self, adapter):
        """Prueba obtención del nombre del protocolo."""
        assert adapter.get_protocol_name() == "grpc"
    
    def test_get_connection_info(self, adapter):
        """Prueba obtención de información de conexión."""
        info = adapter.get_connection_info()
        
        assert info["protocol"] == "grpc"
        assert info["host"] == "localhost"
        assert info["port"] == 50051
        assert not info["is_running"]
        assert info["active_connections"] == 0
        assert info["streaming_connections"] == 0
        assert info["total_connections"] == 0
        assert info["total_messages"] == 0
        assert info["uptime"] == 0
    
    @pytest.mark.asyncio
    async def test_start_without_grpc(self, adapter):
        """Prueba inicio sin gRPC disponible."""
        with patch('src.mpc.adapters.grpc_adapter.grpc', None):
            result = await adapter.start()
            assert not result
            assert not adapter.is_running
    
    @pytest.mark.asyncio
    async def test_start_with_grpc_mock(self, adapter):
        """Prueba inicio con gRPC mock."""
        with patch('src.mpc.adapters.grpc_adapter.grpc_aio') as mock_grpc_aio:
            # Mock server
            mock_server = AsyncMock()
            mock_grpc_aio.server.return_value = mock_server
            
            # Ejecutar
            result = await adapter.start()
            
            # Verificar
            assert result
            assert adapter.is_running
            assert adapter.server == mock_server
            assert adapter.servicer is not None
            mock_server.add_insecure_port.assert_called_once_with("localhost:50051")
            mock_server.start.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_stop(self, adapter):
        """Prueba detención del adaptador."""
        # Simular adaptador iniciado
        adapter.is_running = True
        adapter.server = AsyncMock()
        adapter._cleanup_task = AsyncMock()
        
        # Agregar conexión mock
        mock_context = Mock()
        mock_context.cancel = Mock()
        connection = GRPCConnection("test_conn", mock_context)
        connection.is_active = Mock(return_value=True)
        adapter.connections["test_conn"] = connection
        
        # Ejecutar
        result = await adapter.stop()
        
        # Verificar
        assert result
        assert not adapter.is_running
        adapter.server.stop.assert_called_once_with(grace=5.0)
        mock_context.cancel.assert_called_once()
        assert len(adapter.connections) == 0
        assert len(adapter.stream_queues) == 0
    
    @pytest.mark.asyncio
    async def test_send_message_not_running(self, adapter):
        """Prueba envío de mensaje con adaptador no iniciado."""
        message = Message(
            type="test",
            protocol="grpc",
            payload="test payload"
        )
        
        result = await adapter.send_message(message)
        assert not result
    
    @pytest.mark.asyncio
    async def test_send_message_to_specific_connection(self, adapter):
        """Prueba envío de mensaje a conexión específica."""
        adapter.is_running = True
        adapter.servicer = Mock()
        adapter.servicer._create_message_event = Mock(return_value="mock_event")
        
        # Crear cola mock
        mock_queue = AsyncMock()
        adapter.stream_queues["test_conn"] = mock_queue
        
        message = Message(
            type="test",
            protocol="grpc",
            payload="test payload"
        )
        
        # Ejecutar
        result = await adapter.send_message(message, "test_conn")
        
        # Verificar
        assert result
        mock_queue.put.assert_called_once_with("mock_event")
        assert adapter.total_messages == 1
    
    @pytest.mark.asyncio
    async def test_broadcast_message(self, adapter):
        """Prueba broadcast de mensaje."""
        adapter.is_running = True
        adapter.servicer = Mock()
        adapter.servicer._create_message_event = Mock(return_value="mock_event")
        
        # Crear múltiples colas
        mock_queue1 = AsyncMock()
        mock_queue2 = AsyncMock()
        adapter.stream_queues["conn1"] = mock_queue1
        adapter.stream_queues["conn2"] = mock_queue2
        
        message = Message(
            type="test",
            protocol="grpc",
            payload="test payload"
        )
        
        # Ejecutar
        result = await adapter.broadcast_message(message)
        
        # Verificar
        assert result == 2
        mock_queue1.put.assert_called_once_with("mock_event")
        mock_queue2.put.assert_called_once_with("mock_event")
    
    @pytest.mark.asyncio
    async def test_get_detailed_stats(self, adapter):
        """Prueba obtención de estadísticas detalladas."""
        # Agregar conexión mock
        mock_context = Mock()
        connection = GRPCConnection("test_conn", mock_context)
        connection.messages_sent = 5
        connection.messages_received = 3
        adapter.connections["test_conn"] = connection
        
        # Ejecutar
        stats = await adapter.get_detailed_stats()
        
        # Verificar
        assert stats["server"]["protocol"] == "grpc"
        assert stats["server"]["host"] == "localhost"
        assert stats["server"]["port"] == 50051
        assert stats["connections"]["active"] == 1
        assert stats["connections"]["total"] == 0
        assert len(stats["connections"]["details"]) == 1
        assert stats["connections"]["details"][0]["id"] == "test_conn"
        assert stats["connections"]["details"][0]["messages_sent"] == 5
        assert stats["connections"]["details"][0]["messages_received"] == 3
    
    @pytest.mark.asyncio
    async def test_is_healthy_not_running(self, adapter):
        """Prueba health check con adaptador no iniciado."""
        result = await adapter.is_healthy()
        assert not result
    
    @pytest.mark.asyncio
    async def test_is_healthy_running(self, adapter):
        """Prueba health check con adaptador iniciado."""
        adapter.is_running = True
        adapter.server = Mock()
        
        result = await adapter.is_healthy()
        assert result
    
    def test_set_router(self, adapter):
        """Prueba establecimiento del router."""
        mock_router = Mock(spec=MPCRouter)
        adapter.set_router(mock_router)
        assert adapter.router == mock_router
    
    def test_calculate_messages_per_second(self, adapter):
        """Prueba cálculo de mensajes por segundo."""
        adapter.total_messages = 100
        adapter.start_time = time.time() - 10  # 10 segundos atrás
        adapter.is_running = True
        
        mps = adapter._calculate_messages_per_second()
        assert 9 <= mps <= 11  # Aproximadamente 10 msg/s
    
    def test_calculate_avg_connections(self, adapter):
        """Prueba cálculo de promedio de conexiones."""
        # Agregar conexiones mock
        for i in range(3):
            mock_context = Mock()
            connection = GRPCConnection(f"conn_{i}", mock_context)
            adapter.connections[f"conn_{i}"] = connection
        
        avg = adapter._calculate_avg_connections()
        assert avg == 3


class TestGRPCClient:
    """Pruebas para la clase GRPCClient."""
    
    @pytest.fixture
    def client(self):
        """Fixture para cliente gRPC."""
        return GRPCClient(host="localhost", port=50051)
    
    def test_client_initialization(self, client):
        """Prueba la inicialización del cliente."""
        assert client.host == "localhost"
        assert client.port == 50051
        assert client.channel is None
        assert client.stub is None
    
    @pytest.mark.asyncio
    async def test_connect_without_grpc(self, client):
        """Prueba conexión sin gRPC disponible."""
        with patch('src.mpc.adapters.grpc_adapter.grpc_aio', None):
            result = await client.connect()
            assert not result
    
    @pytest.mark.asyncio
    async def test_connect_with_grpc_mock(self, client):
        """Prueba conexión con gRPC mock."""
        with patch('src.mpc.adapters.grpc_adapter.grpc_aio') as mock_grpc_aio:
            mock_channel = AsyncMock()
            mock_grpc_aio.insecure_channel.return_value = mock_channel
            
            # Ejecutar
            result = await client.connect()
            
            # Verificar
            assert result
            assert client.channel == mock_channel
            mock_grpc_aio.insecure_channel.assert_called_once_with("localhost:50051")
    
    @pytest.mark.asyncio
    async def test_disconnect(self, client):
        """Prueba desconexión del cliente."""
        # Simular cliente conectado
        client.channel = AsyncMock()
        client.stub = Mock()
        
        # Ejecutar
        await client.disconnect()
        
        # Verificar
        client.channel.close.assert_called_once()
        assert client.channel is None
        assert client.stub is None
    
    @pytest.mark.asyncio
    async def test_send_message_without_stub(self, client):
        """Prueba envío de mensaje sin stub."""
        message = Message(
            type="test",
            protocol="grpc",
            payload="test payload"
        )
        
        result = await client.send_message(message)
        assert not result
    
    @pytest.mark.asyncio
    async def test_send_message_with_stub_mock(self, client):
        """Prueba envío de mensaje con stub mock."""
        client.stub = Mock()
        
        message = Message(
            type="test",
            protocol="grpc",
            payload="test payload"
        )
        
        # Ejecutar (implementación mock)
        result = await client.send_message(message)
        
        # Verificar (implementación mock siempre retorna True)
        assert result


@pytest.mark.asyncio
async def test_integration_adapter_lifecycle():
    """Prueba de integración del ciclo de vida del adaptador."""
    adapter = GRPCAdapter(host="localhost", port=50052)  # Puerto diferente
    
    # Verificar estado inicial
    assert not adapter.is_running
    assert adapter.get_protocol_name() == "grpc"
    
    # Simular inicio exitoso
    with patch('src.mpc.adapters.grpc_adapter.grpc_aio') as mock_grpc_aio:
        mock_server = AsyncMock()
        mock_grpc_aio.server.return_value = mock_server
        
        # Iniciar
        result = await adapter.start()
        assert result
        assert adapter.is_running
        
        # Verificar información de conexión
        info = adapter.get_connection_info()
        assert info["is_running"]
        assert info["port"] == 50052
        
        # Detener
        result = await adapter.stop()
        assert result
        assert not adapter.is_running


@pytest.mark.asyncio
async def test_integration_message_flow():
    """Prueba de integración del flujo de mensajes."""
    adapter = GRPCAdapter()
    adapter.is_running = True
    adapter.servicer = MPCServicer(adapter)
    
    # Crear mensaje de prueba
    message = Message(
        id="integration_test_001",
        type="request",
        protocol="grpc",
        payload=json.dumps({"test": "integration"}),
        source="test_client",
        destination="test_server"
    )
    
    # Simular cola de streaming
    mock_queue = AsyncMock()
    adapter.stream_queues["test_connection"] = mock_queue
    
    # Enviar mensaje
    result = await adapter.send_message(message, "test_connection")
    
    # Verificar
    assert result
    assert adapter.total_messages == 1
    mock_queue.put.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])