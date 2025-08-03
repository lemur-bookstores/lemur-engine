"""
Ejemplo avanzado del sistema MPC con WebSocket
=============================================

Demuestra el uso del sistema MPC con adaptadores HTTP y WebSocket.
"""

import asyncio
import logging
import json
from datetime import datetime

from src.mpc.core.gateway import UnifiedGateway
from src.mpc.core.interfaces import Message, MessageType, ProtocolType
from src.mpc.adapters.http_adapter import HTTPAdapter
from src.mpc.adapters.websocket_adapter import WebSocketAdapter


# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MPCEventHandler:
    """Manejador de eventos personalizado para el sistema MPC"""
    
    def __init__(self):
        self.message_count = 0
        
    async def handle_message(self, message: Message) -> None:
        """Maneja mensajes recibidos"""
        self.message_count += 1
        logger.info(f"Mensaje recibido #{self.message_count}: {message.type.value} desde {message.protocol.value}")
        
        # Procesar según el tipo de mensaje
        if message.type == MessageType.REQUEST:
            await self._handle_request(message)
        elif message.type == MessageType.EVENT:
            await self._handle_event(message)
        elif message.type == MessageType.RESPONSE:
            await self._handle_response(message)
            
    async def _handle_request(self, message: Message) -> None:
        """Maneja solicitudes"""
        logger.info(f"Procesando solicitud: {message.payload}")
        
        # Simular procesamiento
        await asyncio.sleep(0.1)
        
    async def _handle_event(self, message: Message) -> None:
        """Maneja eventos"""
        logger.info(f"Procesando evento: {message.payload}")
        
    async def _handle_response(self, message: Message) -> None:
        """Maneja respuestas"""
        logger.info(f"Procesando respuesta: {message.payload}")


async def test_websocket_client():
    """Prueba cliente WebSocket"""
    import websockets
    
    try:
        # Conectar al servidor WebSocket
        uri = "ws://localhost:8081"
        async with websockets.connect(uri) as websocket:
            logger.info(f"Conectado a {uri}")
            
            # Enviar mensaje de prueba
            test_message = {
                "id": "test-001",
                "type": "request",
                "payload": {
                    "action": "ping",
                    "data": "Hello from WebSocket client!"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await websocket.send(json.dumps(test_message))
            logger.info("Mensaje enviado al servidor")
            
            # Recibir respuesta
            response = await websocket.recv()
            data = json.loads(response)
            logger.info(f"Respuesta recibida: {data}")
            
            # Enviar algunos mensajes más
            for i in range(3):
                message = {
                    "id": f"test-{i+2:03d}",
                    "type": "event",
                    "payload": {
                        "event": "user_action",
                        "data": f"Action {i+1}",
                        "sequence": i+1
                    },
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                await websocket.send(json.dumps(message))
                await asyncio.sleep(1)
                
            logger.info("Cliente WebSocket completado")
            
    except Exception as e:
        logger.error(f"Error en cliente WebSocket: {e}")


async def main():
    """Función principal del ejemplo"""
    logger.info("=== Iniciando ejemplo avanzado MPC con WebSocket ===")
    
    # Crear gateway unificado
    gateway = UnifiedGateway()
    
    # Crear manejador de eventos
    event_handler = MPCEventHandler()
    
    try:
        # Registrar manejador de eventos
        gateway.register_event_handler(event_handler.handle_message)
        
        # Crear y registrar adaptador HTTP
        http_adapter = HTTPAdapter(host="localhost", port=8080)
        await gateway.register_adapter(http_adapter)
        logger.info("Adaptador HTTP registrado")
        
        # Crear y registrar adaptador WebSocket
        websocket_adapter = WebSocketAdapter(host="localhost", port=8081)
        await gateway.register_adapter(websocket_adapter)
        logger.info("Adaptador WebSocket registrado")
        
        # Iniciar gateway
        await gateway.start()
        logger.info("Gateway MPC iniciado")
        
        # Esperar un momento para que los servidores se inicien
        await asyncio.sleep(2)
        
        # Enviar mensaje de prueba HTTP
        http_message = Message(
            id="http-test-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.HTTP,
            payload={
                "method": "GET",
                "path": "/api/test",
                "data": "Hello from HTTP!"
            },
            metadata={"source": "example_script"}
        )
        
        await gateway.send_message(http_message)
        logger.info("Mensaje HTTP enviado")
        
        # Enviar mensaje de broadcast WebSocket
        ws_broadcast_message = Message(
            id="ws-broadcast-001",
            type=MessageType.EVENT,
            protocol=ProtocolType.WEBSOCKET,
            payload={
                "event": "server_announcement",
                "message": "¡Servidor WebSocket activo!",
                "timestamp": datetime.utcnow().isoformat()
            },
            metadata={"broadcast": True}
        )
        
        await gateway.send_message(ws_broadcast_message)
        logger.info("Mensaje WebSocket broadcast enviado")
        
        # Crear tarea para cliente WebSocket de prueba
        client_task = asyncio.create_task(test_websocket_client())
        
        # Simular actividad del servidor
        logger.info("Simulando actividad del servidor...")
        
        for i in range(5):
            # Enviar evento periódico
            periodic_message = Message(
                id=f"periodic-{i+1:03d}",
                type=MessageType.EVENT,
                protocol=ProtocolType.WEBSOCKET,
                payload={
                    "event": "periodic_update",
                    "sequence": i+1,
                    "data": f"Update #{i+1}",
                    "timestamp": datetime.utcnow().isoformat()
                },
                metadata={"periodic": True}
            )
            
            await gateway.send_message(periodic_message)
            await asyncio.sleep(3)
            
        # Esperar a que termine el cliente
        await client_task
        
        # Mostrar estadísticas
        logger.info("\n=== Estadísticas del sistema ===")
        
        # Estadísticas HTTP
        http_stats = http_adapter.get_connection_stats()
        logger.info(f"HTTP: {http_stats}")
        
        # Estadísticas WebSocket
        ws_stats = websocket_adapter.get_connection_stats()
        logger.info(f"WebSocket: {ws_stats}")
        
        # Información de conexiones WebSocket
        ws_connections = websocket_adapter.get_connections_info()
        logger.info(f"Conexiones WebSocket activas: {len(ws_connections)}")
        
        # Estadísticas del gateway
        gateway_stats = gateway.get_stats()
        logger.info(f"Gateway: {gateway_stats}")
        
        logger.info(f"Total de mensajes procesados: {event_handler.message_count}")
        
        # Mantener servidor activo por un momento más
        logger.info("Manteniendo servidores activos por 10 segundos más...")
        await asyncio.sleep(10)
        
    except KeyboardInterrupt:
        logger.info("Interrupción del usuario detectada")
    except Exception as e:
        logger.error(f"Error en ejemplo: {e}")
        raise
    finally:
        # Limpiar recursos
        logger.info("Deteniendo sistema MPC...")
        await gateway.stop()
        logger.info("Sistema MPC detenido")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nEjemplo terminado por el usuario")
    except Exception as e:
        print(f"Error ejecutando ejemplo: {e}")
        raise