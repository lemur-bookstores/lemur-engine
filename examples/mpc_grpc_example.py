"""
Ejemplo avanzado del sistema MPC con adaptador gRPC.
Demuestra comunicación de alto rendimiento con Protocol Buffers y streaming bidireccional.
"""

import asyncio
import logging
import json
import time
from typing import Dict, Any

from src.mpc.core.router import MPCRouter
from src.mpc.core.gateway import UnifiedGateway
from src.mpc.core.connection_manager import MPCConnectionManager
from src.mpc.core.interfaces import Message
from src.mpc.adapters import HTTPAdapter, WebSocketAdapter, GRPCAdapter, GRPCClient


# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AdvancedMPCEventHandler:
    """Manejador avanzado de eventos MPC con soporte para gRPC."""
    
    def __init__(self):
        self.message_count = 0
        self.protocol_stats = {
            'http': {'sent': 0, 'received': 0},
            'websocket': {'sent': 0, 'received': 0},
            'grpc': {'sent': 0, 'received': 0}
        }
        
    async def handle_message(self, message: Message) -> bool:
        """Maneja mensajes entrantes de cualquier protocolo."""
        self.message_count += 1
        protocol = message.protocol.lower()
        
        if protocol in self.protocol_stats:
            self.protocol_stats[protocol]['received'] += 1
        
        logger.info(f"📨 Mensaje recibido [{protocol.upper()}]: {message.id}")
        logger.info(f"   Tipo: {message.type}")
        logger.info(f"   Fuente: {message.source}")
        logger.info(f"   Payload: {message.payload[:100]}...")
        
        # Procesar según el tipo de mensaje
        try:
            payload_data = json.loads(message.payload)
            message_type = payload_data.get('type', 'unknown')
            
            if message_type == 'performance_test':
                await self._handle_performance_test(message, payload_data)
            elif message_type == 'streaming_test':
                await self._handle_streaming_test(message, payload_data)
            elif message_type == 'broadcast_test':
                await self._handle_broadcast_test(message, payload_data)
            elif message_type == 'health_check':
                await self._handle_health_check(message, payload_data)
            else:
                await self._handle_generic_message(message, payload_data)
                
        except json.JSONDecodeError:
            logger.warning(f"Payload no es JSON válido: {message.payload}")
        except Exception as e:
            logger.error(f"Error procesando mensaje: {e}")
        
        return True
    
    async def _handle_performance_test(self, message: Message, data: Dict[str, Any]):
        """Maneja pruebas de rendimiento."""
        test_id = data.get('test_id', 'unknown')
        start_time = data.get('start_time', time.time())
        
        # Calcular latencia
        latency = (time.time() - start_time) * 1000  # ms
        
        logger.info(f"🚀 Prueba de rendimiento {test_id}: {latency:.2f}ms latencia")
        
        # Responder con estadísticas
        response_payload = {
            'type': 'performance_response',
            'test_id': test_id,
            'latency_ms': latency,
            'protocol': message.protocol,
            'timestamp': time.time()
        }
        
        # Crear mensaje de respuesta
        response = Message(
            type='response',
            protocol=message.protocol,
            payload=json.dumps(response_payload),
            source='mpc_server',
            destination=message.source,
            correlation_id=message.correlation_id
        )
        
        # Enviar respuesta (esto sería manejado por el gateway)
        logger.info(f"📤 Enviando respuesta de rendimiento para {test_id}")
    
    async def _handle_streaming_test(self, message: Message, data: Dict[str, Any]):
        """Maneja pruebas de streaming."""
        stream_id = data.get('stream_id', 'unknown')
        sequence = data.get('sequence', 0)
        
        logger.info(f"🌊 Mensaje de streaming {stream_id}, secuencia: {sequence}")
        
        # Simular procesamiento de streaming
        await asyncio.sleep(0.01)  # Simular trabajo
    
    async def _handle_broadcast_test(self, message: Message, data: Dict[str, Any]):
        """Maneja pruebas de broadcast."""
        broadcast_id = data.get('broadcast_id', 'unknown')
        
        logger.info(f"📡 Mensaje de broadcast {broadcast_id}")
        
        # Crear mensaje de confirmación
        confirmation_payload = {
            'type': 'broadcast_confirmation',
            'broadcast_id': broadcast_id,
            'received_at': time.time(),
            'protocol': message.protocol
        }
        
        logger.info(f"✅ Confirmación de broadcast {broadcast_id}")
    
    async def _handle_health_check(self, message: Message, data: Dict[str, Any]):
        """Maneja health checks."""
        logger.info(f"💓 Health check desde {message.source}")
        
        # Responder con estado del sistema
        health_payload = {
            'type': 'health_response',
            'status': 'healthy',
            'timestamp': time.time(),
            'stats': self.get_stats()
        }
        
        logger.info("💚 Sistema saludable")
    
    async def _handle_generic_message(self, message: Message, data: Dict[str, Any]):
        """Maneja mensajes genéricos."""
        logger.info(f"📋 Mensaje genérico procesado")
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas del manejador."""
        return {
            'total_messages': self.message_count,
            'protocol_stats': self.protocol_stats,
            'uptime': time.time()
        }


async def test_grpc_client(host: str = "localhost", port: int = 50051):
    """Prueba el cliente gRPC."""
    logger.info("🔌 Iniciando cliente gRPC de prueba...")
    
    client = GRPCClient(host, port)
    
    try:
        # Conectar
        if not await client.connect():
            logger.error("❌ No se pudo conectar al servidor gRPC")
            return
        
        logger.info("✅ Cliente gRPC conectado")
        
        # Enviar mensajes de prueba
        test_messages = [
            {
                'type': 'performance_test',
                'test_id': 'grpc_perf_001',
                'start_time': time.time(),
                'data': 'Performance test data'
            },
            {
                'type': 'streaming_test',
                'stream_id': 'grpc_stream_001',
                'sequence': 1,
                'data': 'Streaming test data'
            },
            {
                'type': 'health_check',
                'client_id': 'grpc_test_client'
            }
        ]
        
        for i, test_data in enumerate(test_messages):
            message = Message(
                type='request',
                protocol='grpc',
                payload=json.dumps(test_data),
                source='grpc_test_client',
                destination='mpc_server'
            )
            
            logger.info(f"📤 Enviando mensaje de prueba {i+1}/3...")
            success = await client.send_message(message)
            
            if success:
                logger.info(f"✅ Mensaje {i+1} enviado exitosamente")
            else:
                logger.error(f"❌ Error enviando mensaje {i+1}")
            
            await asyncio.sleep(1)
        
        # Probar streaming
        logger.info("🌊 Iniciando prueba de streaming...")
        
        # Simular streaming (implementación mock)
        async def mock_streaming():
            for i in range(5):
                logger.info(f"📨 Mensaje de streaming recibido: {i+1}/5")
                await asyncio.sleep(0.5)
        
        await mock_streaming()
        
    except Exception as e:
        logger.error(f"❌ Error en cliente gRPC: {e}")
    finally:
        await client.disconnect()
        logger.info("🔌 Cliente gRPC desconectado")


async def run_performance_tests(gateway: UnifiedGateway):
    """Ejecuta pruebas de rendimiento en todos los protocolos."""
    logger.info("🚀 Iniciando pruebas de rendimiento...")
    
    # Obtener adaptadores
    http_adapter = None
    websocket_adapter = None
    grpc_adapter = None
    
    for adapter in gateway.adapters:
        if adapter.get_protocol_name() == 'http':
            http_adapter = adapter
        elif adapter.get_protocol_name() == 'websocket':
            websocket_adapter = adapter
        elif adapter.get_protocol_name() == 'grpc':
            grpc_adapter = adapter
    
    # Pruebas de latencia
    protocols_to_test = []
    if http_adapter:
        protocols_to_test.append(('HTTP', http_adapter))
    if websocket_adapter:
        protocols_to_test.append(('WebSocket', websocket_adapter))
    if grpc_adapter:
        protocols_to_test.append(('gRPC', grpc_adapter))
    
    for protocol_name, adapter in protocols_to_test:
        logger.info(f"📊 Probando latencia de {protocol_name}...")
        
        start_time = time.time()
        
        # Crear mensaje de prueba
        test_message = Message(
            type='request',
            protocol=protocol_name.lower(),
            payload=json.dumps({
                'type': 'performance_test',
                'test_id': f'{protocol_name.lower()}_latency_test',
                'start_time': start_time,
                'data': 'x' * 1000  # 1KB de datos
            }),
            source='performance_tester',
            destination='mpc_server'
        )
        
        # Enviar mensaje
        success = await adapter.send_message(test_message)
        end_time = time.time()
        
        latency = (end_time - start_time) * 1000  # ms
        
        if success:
            logger.info(f"✅ {protocol_name} latencia: {latency:.2f}ms")
        else:
            logger.error(f"❌ Error en prueba de {protocol_name}")
        
        await asyncio.sleep(0.5)
    
    # Pruebas de throughput
    logger.info("📈 Iniciando pruebas de throughput...")
    
    for protocol_name, adapter in protocols_to_test:
        logger.info(f"📊 Probando throughput de {protocol_name}...")
        
        message_count = 100
        start_time = time.time()
        
        # Enviar múltiples mensajes
        tasks = []
        for i in range(message_count):
            test_message = Message(
                type='request',
                protocol=protocol_name.lower(),
                payload=json.dumps({
                    'type': 'throughput_test',
                    'test_id': f'{protocol_name.lower()}_throughput_test',
                    'sequence': i,
                    'data': 'x' * 100  # 100 bytes
                }),
                source='throughput_tester',
                destination='mpc_server'
            )
            
            task = adapter.send_message(test_message)
            tasks.append(task)
        
        # Esperar a que todos los mensajes se envíen
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
        
        # Calcular estadísticas
        successful_sends = sum(1 for r in results if r is True)
        total_time = end_time - start_time
        throughput = successful_sends / total_time if total_time > 0 else 0
        
        logger.info(f"✅ {protocol_name} throughput: {throughput:.2f} msg/s ({successful_sends}/{message_count} exitosos)")
        
        await asyncio.sleep(1)


async def main():
    """Función principal del ejemplo avanzado."""
    logger.info("🚀 Iniciando ejemplo avanzado MPC con gRPC...")
    
    # Crear componentes del sistema
    router = MPCRouter()
    connection_manager = MPCConnectionManager()
    gateway = UnifiedGateway(router, connection_manager)
    
    # Crear manejador de eventos
    event_handler = AdvancedMPCEventHandler()
    
    # Configurar router con manejador
    router.add_message_handler(event_handler.handle_message)
    
    # Crear adaptadores
    http_adapter = HTTPAdapter(host="localhost", port=8080)
    websocket_adapter = WebSocketAdapter(host="localhost", port=8081)
    grpc_adapter = GRPCAdapter(host="localhost", port=50051)
    
    # Registrar adaptadores
    await gateway.register_adapter(http_adapter)
    await gateway.register_adapter(websocket_adapter)
    await gateway.register_adapter(grpc_adapter)
    
    try:
        # Iniciar gateway
        logger.info("🌐 Iniciando UnifiedGateway...")
        if not await gateway.start():
            logger.error("❌ Error iniciando gateway")
            return
        
        logger.info("✅ Sistema MPC iniciado exitosamente")
        logger.info("📋 Protocolos disponibles:")
        logger.info("   🌐 HTTP: http://localhost:8080")
        logger.info("   🔌 WebSocket: ws://localhost:8081")
        logger.info("   ⚡ gRPC: localhost:50051")
        
        # Esperar a que los servidores se inicien completamente
        await asyncio.sleep(2)
        
        # Mostrar estadísticas iniciales
        logger.info("\n📊 Estadísticas iniciales:")
        for adapter in gateway.adapters:
            info = adapter.get_connection_info()
            protocol = info['protocol'].upper()
            status = "🟢 ACTIVO" if info.get('is_running', False) else "🔴 INACTIVO"
            logger.info(f"   {protocol}: {status}")
        
        # Ejecutar pruebas de rendimiento
        await run_performance_tests(gateway)
        
        # Probar cliente gRPC
        await test_grpc_client()
        
        # Enviar mensajes de prueba periódicos
        logger.info("🔄 Iniciando envío de mensajes periódicos...")
        
        for i in range(5):
            # Mensaje HTTP
            http_message = Message(
                type='request',
                protocol='http',
                payload=json.dumps({
                    'type': 'periodic_test',
                    'iteration': i,
                    'protocol': 'http',
                    'timestamp': time.time()
                }),
                source='periodic_sender',
                destination='mpc_server'
            )
            
            # Mensaje WebSocket
            ws_message = Message(
                type='event',
                protocol='websocket',
                payload=json.dumps({
                    'type': 'periodic_test',
                    'iteration': i,
                    'protocol': 'websocket',
                    'timestamp': time.time()
                }),
                source='periodic_sender',
                destination='all'
            )
            
            # Mensaje gRPC
            grpc_message = Message(
                type='request',
                protocol='grpc',
                payload=json.dumps({
                    'type': 'periodic_test',
                    'iteration': i,
                    'protocol': 'grpc',
                    'timestamp': time.time()
                }),
                source='periodic_sender',
                destination='mpc_server'
            )
            
            # Enviar mensajes
            await router.route_message(http_message)
            await router.route_message(ws_message)
            await router.route_message(grpc_message)
            
            logger.info(f"📤 Enviados mensajes periódicos {i+1}/5")
            await asyncio.sleep(3)
        
        # Mostrar estadísticas finales
        logger.info("\n📊 Estadísticas finales:")
        
        # Estadísticas del manejador
        handler_stats = event_handler.get_stats()
        logger.info(f"📨 Total mensajes procesados: {handler_stats['total_messages']}")
        
        for protocol, stats in handler_stats['protocol_stats'].items():
            logger.info(f"   {protocol.upper()}: {stats['received']} recibidos")
        
        # Estadísticas de adaptadores
        for adapter in gateway.adapters:
            info = adapter.get_connection_info()
            protocol = info['protocol'].upper()
            logger.info(f"🔌 {protocol}:")
            logger.info(f"   Conexiones activas: {info.get('active_connections', 0)}")
            logger.info(f"   Total mensajes: {info.get('total_messages', 0)}")
            logger.info(f"   Uptime: {info.get('uptime', 0):.1f}s")
        
        # Mantener el servidor corriendo
        logger.info("\n⏳ Manteniendo servidor activo por 30 segundos más...")
        logger.info("   Puedes probar los endpoints manualmente:")
        logger.info("   - HTTP: curl http://localhost:8080/health")
        logger.info("   - WebSocket: wscat -c ws://localhost:8081")
        logger.info("   - gRPC: usar cliente gRPC personalizado")
        
        await asyncio.sleep(30)
        
    except KeyboardInterrupt:
        logger.info("\n⏹️  Deteniendo servidor...")
    except Exception as e:
        logger.error(f"❌ Error en el servidor: {e}")
    finally:
        # Detener gateway
        logger.info("🛑 Deteniendo UnifiedGateway...")
        await gateway.stop()
        logger.info("✅ Sistema MPC detenido")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 ¡Hasta luego!")
    except Exception as e:
        logger.error(f"💥 Error fatal: {e}")
        raise