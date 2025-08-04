"""
Adaptador gRPC para el sistema MPC.
Proporciona comunicación de alto rendimiento con Protocol Buffers y streaming bidireccional.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, AsyncIterator, Set, Any
from concurrent.futures import ThreadPoolExecutor
import json
import uuid

try:
    import grpc
    from grpc import aio as grpc_aio
    # Importar los stubs generados (se generarán después)
    # from ..proto import mpc_service_pb2, mpc_service_pb2_grpc
except ImportError:
    grpc = None
    grpc_aio = None

from ..core.interfaces import ProtocolAdapter, Message
from ..core.router import MPCRouter


if grpc:
    class GRPCConnection:
        """Representa una conexión gRPC activa."""
        
        def __init__(self, connection_id: str, context: grpc_aio.ServicerContext):
            self.connection_id = connection_id
            self.context = context
            self.created_at = time.time()
            self.last_activity = time.time()
            self.messages_sent = 0
            self.messages_received = 0
            self.is_streaming = False
            self.stream_filters: Dict[str, Any] = {}
            
        def update_activity(self):
            """Actualiza el timestamp de última actividad."""
            self.last_activity = time.time()
            
        def is_active(self) -> bool:
            """Verifica si la conexión sigue activa."""
            return not self.context.cancelled()

    class MPCServicer:
        """Implementación del servicio gRPC MPC."""
        
        def __init__(self, adapter: 'GRPCAdapter'):
            self.adapter = adapter
            self.logger = logging.getLogger(__name__)
            
        async def SendMessage(self, request, context):
            """Maneja envío de mensajes unidireccionales."""
            try:
                # Convertir protobuf a Message interno
                message = self._protobuf_to_message(request)
                
                # Procesar mensaje a través del router
                if self.adapter.router:
                    await self.adapter.router.route_message(message)
                
                # Crear respuesta
                response = self._create_message_response(
                    success=True,
                    message="Message processed successfully",
                    request_id=request.id
                )
                
                return response
                
            except Exception as e:
                self.logger.error(f"Error processing message: {e}")
                return self._create_message_response(
                    success=False,
                    message=f"Error: {str(e)}",
                    request_id=request.id
                )
        
        async def StreamMessages(self, request, context):
            """Maneja streaming unidireccional del servidor."""
            connection_id = str(uuid.uuid4())
            connection = GRPCConnection(connection_id, context)
            connection.is_streaming = True
            connection.stream_filters = self._parse_stream_filters(request)
            
            self.adapter.connections[connection_id] = connection
            
            try:
                # Crear cola para mensajes de este stream
                message_queue = asyncio.Queue()
                self.adapter.stream_queues[connection_id] = message_queue
                
                self.logger.info(f"Started streaming for connection {connection_id}")
                
                # Enviar mensajes del stream
                while not context.cancelled():
                    try:
                        # Esperar mensaje con timeout
                        message_event = await asyncio.wait_for(
                            message_queue.get(), timeout=1.0
                        )
                        
                        # Aplicar filtros
                        if self._should_send_message(message_event, connection.stream_filters):
                            yield message_event
                            connection.messages_sent += 1
                            connection.update_activity()
                            
                    except asyncio.TimeoutError:
                        # Enviar heartbeat si no hay mensajes
                        if time.time() - connection.last_activity > 30:
                            heartbeat = self._create_heartbeat_event()
                            yield heartbeat
                            connection.update_activity()
                            
            except Exception as e:
                self.logger.error(f"Error in streaming: {e}")
            finally:
                # Limpiar conexión
                self.adapter.connections.pop(connection_id, None)
                self.adapter.stream_queues.pop(connection_id, None)
                self.logger.info(f"Closed streaming for connection {connection_id}")
        
        async def BidirectionalStream(self, request_iterator, context):
            """Maneja streaming bidireccional."""
            connection_id = str(uuid.uuid4())
            connection = GRPCConnection(connection_id, context)
            connection.is_streaming = True
            
            self.adapter.connections[connection_id] = connection
            
            try:
                # Crear cola para respuestas
                response_queue = asyncio.Queue()
                self.adapter.stream_queues[connection_id] = response_queue
                
                # Tarea para procesar mensajes entrantes
                async def process_incoming():
                    async for request in request_iterator:
                        try:
                            message = self._protobuf_to_message(request)
                            connection.messages_received += 1
                            connection.update_activity()
                            
                            # Procesar mensaje
                            if self.adapter.router:
                                await self.adapter.router.route_message(message)
                                
                            # Crear respuesta automática si es necesario
                            if request.type == 1:  # REQUEST type
                                response_event = self._create_response_event(request)
                                await response_queue.put(response_event)
                                
                        except Exception as e:
                            self.logger.error(f"Error processing incoming message: {e}")
                
                # Iniciar procesamiento de mensajes entrantes
                incoming_task = asyncio.create_task(process_incoming())
                
                # Enviar respuestas
                try:
                    while not context.cancelled():
                        try:
                            response_event = await asyncio.wait_for(
                                response_queue.get(), timeout=1.0
                            )
                            yield response_event
                            connection.messages_sent += 1
                            connection.update_activity()
                            
                        except asyncio.TimeoutError:
                            # Continuar el loop
                            pass
                            
                finally:
                    incoming_task.cancel()
                    try:
                        await incoming_task
                    except asyncio.CancelledError:
                        pass
                        
            except Exception as e:
                self.logger.error(f"Error in bidirectional streaming: {e}")
            finally:
                # Limpiar conexión
                self.adapter.connections.pop(connection_id, None)
                self.adapter.stream_queues.pop(connection_id, None)
                self.logger.info(f"Closed bidirectional stream for connection {connection_id}")
        
        async def GetStats(self, request, context):
            """Obtiene estadísticas del servidor."""
            try:
                stats = await self.adapter.get_detailed_stats()
                return self._create_stats_response(stats, request)
            except Exception as e:
                self.logger.error(f"Error getting stats: {e}")
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(f"Error getting stats: {str(e)}")
                return None
        
        async def HealthCheck(self, request, context):
            """Health check del servicio."""
            try:
                is_healthy = await self.adapter.is_healthy()
                status = 1 if is_healthy else 2  # SERVING or NOT_SERVING
                
                return self._create_health_response(
                    status=status,
                    message="Service is healthy" if is_healthy else "Service is unhealthy"
                )
            except Exception as e:
                self.logger.error(f"Error in health check: {e}")
                return self._create_health_response(
                    status=2,  # NOT_SERVING
                    message=f"Health check failed: {str(e)}"
                )
        
        def _protobuf_to_message(self, pb_message) -> Message:
            """Convierte mensaje protobuf a Message interno."""
            # Nota: Esta implementación asume que tenemos los pb2 generados
            # Por ahora, creamos una implementación mock
            return Message(
                id=getattr(pb_message, 'id', str(uuid.uuid4())),
                type=getattr(pb_message, 'type', 'request'),
                protocol='grpc',
                payload=getattr(pb_message, 'payload', '{}'),
                metadata=dict(getattr(pb_message, 'metadata', {})),
                timestamp=getattr(pb_message, 'timestamp', time.time()),
                source=getattr(pb_message, 'source', 'grpc_client'),
                destination=getattr(pb_message, 'destination', ''),
                correlation_id=getattr(pb_message, 'correlation_id', '')
            )
        
        def _create_message_response(self, success: bool, message: str, request_id: str):
            """Crea respuesta de mensaje (mock implementation)."""
            # Esta sería la implementación real con protobuf generado
            class MockResponse:
                def __init__(self):
                    self.success = success
                    self.message = message
                    self.request_id = request_id
                    self.timestamp = time.time()
                    self.metadata = {}
            
            return MockResponse()
        
        def _create_message_event(self, message: Message):
            """Crea evento de mensaje para streaming."""
            class MockEvent:
                def __init__(self):
                    self.id = message.id
                    self.type = 3  # EVENT type
                    self.protocol = 3  # GRPC protocol
                    self.payload = message.payload
                    self.metadata = message.metadata
                    self.timestamp = message.timestamp
                    self.source = message.source
                    self.correlation_id = message.correlation_id
            
            return MockEvent()
        
        def _create_heartbeat_event(self):
            """Crea evento de heartbeat."""
            class MockEvent:
                def __init__(self):
                    self.id = str(uuid.uuid4())
                    self.type = 3  # EVENT type
                    self.protocol = 3  # GRPC protocol
                    self.payload = json.dumps({"type": "heartbeat"})
                    self.metadata = {"heartbeat": "true"}
                    self.timestamp = time.time()
                    self.source = "grpc_server"
                    self.correlation_id = ""
            
            return MockEvent()
        
        def _create_response_event(self, request):
            """Crea evento de respuesta."""
            class MockEvent:
                def __init__(self):
                    self.id = str(uuid.uuid4())
                    self.type = 2  # RESPONSE type
                    self.protocol = 3  # GRPC protocol
                    self.payload = json.dumps({"response_to": request.id})
                    self.metadata = {"response": "true"}
                    self.timestamp = time.time()
                    self.source = "grpc_server"
                    self.correlation_id = request.correlation_id
            
            return MockEvent()
        
        def _parse_stream_filters(self, request) -> Dict[str, Any]:
            """Parsea filtros de streaming."""
            return {
                'message_types': getattr(request, 'message_types', []),
                'sources': getattr(request, 'sources', []),
                'filters': dict(getattr(request, 'filters', {})),
                'buffer_size': getattr(request, 'buffer_size', 100)
            }
        
        def _should_send_message(self, message_event, filters: Dict[str, Any]) -> bool:
            """Determina si un mensaje debe enviarse según los filtros."""
            # Aplicar filtros de tipo de mensaje
            if filters.get('message_types') and message_event.type not in filters['message_types']:
                return False
                
            # Aplicar filtros de fuente
            if filters.get('sources') and message_event.source not in filters['sources']:
                return False
                
            return True
        
        def _create_stats_response(self, stats: Dict[str, Any], request):
            """Crea respuesta de estadísticas."""
            # Mock implementation
            class MockStatsResponse:
                def __init__(self):
                    self.server_stats = type('ServerStats', (), stats.get('server', {}))()
                    self.protocol_stats = []
                    self.performance_stats = type('PerformanceStats', (), stats.get('performance', {}))()
                    self.error_stats = []
            
            return MockStatsResponse()
        
        def _create_health_response(self, status: int, message: str):
            """Crea respuesta de health check."""
            class MockHealthResponse:
                def __init__(self):
                    self.status = status
                    self.message = message
                    self.timestamp = time.time()
                    self.details = {}
            
            return MockHealthResponse()


    class GRPCAdapter(ProtocolAdapter):
        """Adaptador gRPC para comunicación de alto rendimiento."""
        
        def __init__(self, host: str = "localhost", port: int = 50051, 
                     max_workers: int = 10, max_connections: int = 1000):
            super().__init__()
            self.host = host
            self.port = port
            self.max_workers = max_workers
            self.max_connections = max_connections
            
            # Estado del servidor
            self.server: Optional[grpc_aio.Server] = None
            self.servicer: Optional[MPCServicer] = None
            self.is_running = False
            
            # Gestión de conexiones
            self.connections: Dict[str, GRPCConnection] = {}
            self.stream_queues: Dict[str, asyncio.Queue] = {}
            
            # Estadísticas
            self.start_time = time.time()
            self.total_messages = 0
            self.total_connections = 0
            
            # Router
            self.router: Optional[MPCRouter] = None
            
            # Configuración
            self.cleanup_interval = 60  # segundos
            self.connection_timeout = 300  # 5 minutos
            
            # Tareas de fondo
            self._cleanup_task: Optional[asyncio.Task] = None
            
            self.logger = logging.getLogger(__name__)
        
        async def start(self) -> bool:
            """Inicia el servidor gRPC."""
            if grpc is None or grpc_aio is None:
                self.logger.error("gRPC not available. Install with: pip install grpcio grpcio-tools")
                return False
            
            try:
                # Crear servidor
                self.server = grpc_aio.server(
                    ThreadPoolExecutor(max_workers=self.max_workers)
                )
                
                # Crear servicer
                self.servicer = MPCServicer(self)
                
                # Registrar servicio (esto requeriría los pb2 generados)
                # mpc_service_pb2_grpc.add_MPCServiceServicer_to_server(
                #     self.servicer, self.server
                # )
                
                # Por ahora, simulamos el registro
                self.logger.info("gRPC servicer registered (mock implementation)")
                
                # Configurar puerto
                listen_addr = f"{self.host}:{self.port}"
                self.server.add_insecure_port(listen_addr)
                
                # Iniciar servidor
                await self.server.start()
                self.is_running = True
                
                # Iniciar tareas de fondo
                self._cleanup_task = asyncio.create_task(self._cleanup_connections())
                
                self.logger.info(f"gRPC server started on {listen_addr}")
                return True
                
            except Exception as e:
                self.logger.error(f"Failed to start gRPC server: {e}")
                return False
        
        async def stop(self) -> bool:
            """Detiene el servidor gRPC."""
            try:
                self.is_running = False
                
                # Cancelar tareas de fondo
                if self._cleanup_task:
                    self._cleanup_task.cancel()
                    try:
                        await self._cleanup_task
                    except asyncio.CancelledError:
                        pass
                
                # Cerrar conexiones activas
                for connection in list(self.connections.values()):
                    if connection.is_active():
                        connection.context.cancel()
                
                # Detener servidor
                if self.server:
                    await self.server.stop(grace=5.0)
                    self.server = None
                
                self.connections.clear()
                self.stream_queues.clear()
                
                self.logger.info("gRPC server stopped")
                return True
                
            except Exception as e:
                self.logger.error(f"Error stopping gRPC server: {e}")
                return False
        
        async def send_message(self, message: Message, connection_id: Optional[str] = None) -> bool:
            """Envía mensaje a través de gRPC (para streaming)."""
            try:
                if not self.is_running:
                    return False
                
                # Crear evento de mensaje
                message_event = self.servicer._create_message_event(message) if self.servicer else None
                
                if connection_id and connection_id in self.stream_queues:
                    # Enviar a conexión específica
                    await self.stream_queues[connection_id].put(message_event)
                    self.total_messages += 1
                    return True
                else:
                    # Broadcast a todas las conexiones de streaming
                    sent_count = 0
                    for queue in self.stream_queues.values():
                        try:
                            await queue.put(message_event)
                            sent_count += 1
                        except Exception as e:
                            self.logger.warning(f"Failed to send to stream queue: {e}")
                    
                    self.total_messages += sent_count
                    return sent_count > 0
                    
            except Exception as e:
                self.logger.error(f"Error sending message via gRPC: {e}")
                return False
        
        async def broadcast_message(self, message: Message) -> int:
            """Envía mensaje a todas las conexiones activas."""
            if not self.is_running:
                return 0
            
            sent_count = 0
            for connection_id in list(self.stream_queues.keys()):
                if await self.send_message(message, connection_id):
                    sent_count += 1
            
            return sent_count
        
        def get_protocol_name(self) -> str:
            """Retorna el nombre del protocolo."""
            return "grpc"
        
        def get_connection_info(self) -> Dict[str, Any]:
            """Retorna información de conexión."""
            return {
                "protocol": "grpc",
                "host": self.host,
                "port": self.port,
                "is_running": self.is_running,
                "active_connections": len(self.connections),
                "streaming_connections": len(self.stream_queues),
                "total_connections": self.total_connections,
                "total_messages": self.total_messages,
                "uptime": time.time() - self.start_time if self.is_running else 0
            }
        
        async def get_detailed_stats(self) -> Dict[str, Any]:
            """Obtiene estadísticas detalladas."""
            active_connections = len(self.connections)
            streaming_connections = len(self.stream_queues)
            
            # Estadísticas de conexiones
            connection_stats = []
            for conn_id, conn in self.connections.items():
                connection_stats.append({
                    "id": conn_id,
                    "created_at": conn.created_at,
                    "last_activity": conn.last_activity,
                    "messages_sent": conn.messages_sent,
                    "messages_received": conn.messages_received,
                    "is_streaming": conn.is_streaming,
                    "is_active": conn.is_active()
                })
            
            return {
                "server": {
                    "protocol": "grpc",
                    "host": self.host,
                    "port": self.port,
                    "is_running": self.is_running,
                    "uptime": time.time() - self.start_time if self.is_running else 0,
                    "version": "3.0.0"
                },
                "connections": {
                    "active": active_connections,
                    "streaming": streaming_connections,
                    "total": self.total_connections,
                    "details": connection_stats
                },
                "performance": {
                    "total_messages": self.total_messages,
                    "messages_per_second": self._calculate_messages_per_second(),
                    "avg_connections": self._calculate_avg_connections()
                }
            }
        
        async def is_healthy(self) -> bool:
            """Verifica si el adaptador está saludable."""
            if not self.is_running or not self.server:
                return False
            
            # Verificar que el servidor esté respondiendo
            try:
                # Aquí podríamos hacer un health check interno
                return True
            except Exception:
                return False
        
        def set_router(self, router: MPCRouter):
            """Establece el router para el adaptador."""
            self.router = router
        
        async def _cleanup_connections(self):
            """Limpia conexiones inactivas periódicamente."""
            while self.is_running:
                try:
                    await asyncio.sleep(self.cleanup_interval)
                    
                    current_time = time.time()
                    inactive_connections = []
                    
                    for conn_id, connection in self.connections.items():
                        # Verificar timeout
                        if (current_time - connection.last_activity > self.connection_timeout or
                            not connection.is_active()):
                            inactive_connections.append(conn_id)
                    
                    # Limpiar conexiones inactivas
                    for conn_id in inactive_connections:
                        connection = self.connections.pop(conn_id, None)
                        self.stream_queues.pop(conn_id, None)
                        
                        if connection:
                            self.logger.info(f"Cleaned up inactive gRPC connection: {conn_id}")
                    
                    if inactive_connections:
                        self.logger.info(f"Cleaned up {len(inactive_connections)} inactive gRPC connections")
                        
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    self.logger.error(f"Error in connection cleanup: {e}")
        
        def _calculate_messages_per_second(self) -> float:
            """Calcula mensajes por segundo."""
            uptime = time.time() - self.start_time if self.is_running else 1
            return self.total_messages / uptime if uptime > 0 else 0
        
        def _calculate_avg_connections(self) -> float:
            """Calcula promedio de conexiones."""
            # Implementación simplificada
            return len(self.connections)


# Cliente gRPC para testing
class GRPCClient:
    """Cliente gRPC para testing y comunicación."""
    
    def __init__(self, host: str = "localhost", port: int = 50051):
        self.host = host
        self.port = port
        self.channel: Optional[grpc_aio.Channel] = None
        self.stub = None
        self.logger = logging.getLogger(__name__)
    
    async def connect(self) -> bool:
        """Conecta al servidor gRPC."""
        if grpc_aio is None:
            self.logger.error("gRPC not available")
            return False
        
        try:
            self.channel = grpc_aio.insecure_channel(f"{self.host}:{self.port}")
            # self.stub = mpc_service_pb2_grpc.MPCServiceStub(self.channel)
            self.logger.info(f"Connected to gRPC server at {self.host}:{self.port}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to gRPC server: {e}")
            return False
    
    async def disconnect(self):
        """Desconecta del servidor."""
        if self.channel:
            await self.channel.close()
            self.channel = None
            self.stub = None
    
    async def send_message(self, message: Message) -> bool:
        """Envía un mensaje al servidor."""
        if not self.stub:
            return False
        
        try:
            # Convertir Message a protobuf request
            # request = self._message_to_protobuf(message)
            # response = await self.stub.SendMessage(request)
            # return response.success
            
            # Mock implementation
            self.logger.info(f"Sent message: {message.id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error sending message: {e}")
            return False
    
    async def start_streaming(self, filters: Optional[Dict[str, Any]] = None):
        """Inicia streaming de mensajes."""
        if not self.stub:
            return
        
        try:
            # Crear request de streaming
            # stream_request = self._create_stream_request(filters)
            # async for message_event in self.stub.StreamMessages(stream_request):
            #     yield self._protobuf_to_message(message_event)
            
            # Mock implementation
            self.logger.info("Started streaming (mock)")
            
        except Exception as e:
            self.logger.error(f"Error in streaming: {e}")