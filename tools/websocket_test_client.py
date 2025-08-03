"""
Cliente WebSocket simple para pruebas
===================================

Cliente WebSocket independiente para probar el servidor MPC.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

import websockets
from websockets.client import WebSocketClientProtocol


# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MPCWebSocketClient:
    """Cliente WebSocket para el sistema MPC"""
    
    def __init__(self, uri: str = "ws://localhost:8081"):
        self.uri = uri
        self.websocket: Optional[WebSocketClientProtocol] = None
        self.running = False
        self.message_count = 0
        
    async def connect(self) -> None:
        """Conecta al servidor WebSocket"""
        try:
            self.websocket = await websockets.connect(self.uri)
            self.running = True
            logger.info(f"Conectado a {self.uri}")
            
        except Exception as e:
            logger.error(f"Error conectando a {self.uri}: {e}")
            raise
            
    async def disconnect(self) -> None:
        """Desconecta del servidor"""
        if self.websocket and not self.websocket.closed:
            await self.websocket.close()
            self.running = False
            logger.info("Desconectado del servidor")
            
    async def send_message(self, message_type: str, payload: dict, correlation_id: Optional[str] = None) -> None:
        """Envía un mensaje al servidor"""
        if not self.websocket or self.websocket.closed:
            raise RuntimeError("No conectado al servidor")
            
        message = {
            "id": f"client-msg-{self.message_count + 1:03d}",
            "type": message_type,
            "payload": payload,
            "metadata": {
                "client": "mpc_test_client",
                "timestamp": datetime.utcnow().isoformat()
            },
            "correlation_id": correlation_id
        }
        
        try:
            await self.websocket.send(json.dumps(message))
            self.message_count += 1
            logger.info(f"Mensaje enviado: {message['id']}")
            
        except Exception as e:
            logger.error(f"Error enviando mensaje: {e}")
            raise
            
    async def listen_for_messages(self) -> None:
        """Escucha mensajes del servidor"""
        if not self.websocket:
            raise RuntimeError("No conectado al servidor")
            
        try:
            async for raw_message in self.websocket:
                try:
                    message = json.loads(raw_message)
                    await self._handle_received_message(message)
                    
                except json.JSONDecodeError:
                    logger.warning(f"Mensaje JSON inválido recibido: {raw_message}")
                except Exception as e:
                    logger.error(f"Error procesando mensaje: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("Conexión cerrada por el servidor")
            self.running = False
        except Exception as e:
            logger.error(f"Error escuchando mensajes: {e}")
            self.running = False
            
    async def _handle_received_message(self, message: dict) -> None:
        """Maneja mensajes recibidos del servidor"""
        msg_type = message.get('type', 'unknown')
        msg_id = message.get('id', 'no-id')
        payload = message.get('payload', {})
        
        logger.info(f"Mensaje recibido: {msg_id} (tipo: {msg_type})")
        
        # Manejar tipos específicos de mensaje
        if msg_type == "connection_established":
            logger.info(f"Conexión establecida: {payload}")
        elif msg_type == "event":
            logger.info(f"Evento recibido: {payload}")
        elif msg_type == "response":
            logger.info(f"Respuesta recibida: {payload}")
        elif msg_type == "error":
            logger.error(f"Error del servidor: {payload}")
        else:
            logger.info(f"Mensaje desconocido: {payload}")
            
    async def send_ping(self) -> None:
        """Envía un ping al servidor"""
        await self.send_message("request", {
            "action": "ping",
            "timestamp": datetime.utcnow().isoformat()
        })
        
    async def send_test_data(self, data: str) -> None:
        """Envía datos de prueba"""
        await self.send_message("request", {
            "action": "test_data",
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    async def send_event(self, event_name: str, event_data: dict) -> None:
        """Envía un evento"""
        await self.send_message("event", {
            "event": event_name,
            "data": event_data,
            "timestamp": datetime.utcnow().isoformat()
        })


async def interactive_client():
    """Cliente interactivo para pruebas manuales"""
    client = MPCWebSocketClient()
    
    try:
        await client.connect()
        
        # Crear tarea para escuchar mensajes
        listen_task = asyncio.create_task(client.listen_for_messages())
        
        print("\n=== Cliente WebSocket MPC ===")
        print("Comandos disponibles:")
        print("  ping - Enviar ping al servidor")
        print("  test <mensaje> - Enviar datos de prueba")
        print("  event <nombre> <datos> - Enviar evento")
        print("  quit - Salir")
        print()
        
        while client.running:
            try:
                # Leer comando del usuario
                command = input("MPC> ").strip()
                
                if not command:
                    continue
                    
                parts = command.split(' ', 2)
                cmd = parts[0].lower()
                
                if cmd == "quit":
                    break
                elif cmd == "ping":
                    await client.send_ping()
                elif cmd == "test" and len(parts) > 1:
                    await client.send_test_data(' '.join(parts[1:]))
                elif cmd == "event" and len(parts) > 2:
                    event_name = parts[1]
                    event_data = {"message": ' '.join(parts[2:])}
                    await client.send_event(event_name, event_data)
                else:
                    print("Comando no reconocido")
                    
            except KeyboardInterrupt:
                break
            except EOFError:
                break
            except Exception as e:
                logger.error(f"Error en comando: {e}")
                
        # Cancelar tarea de escucha
        listen_task.cancel()
        try:
            await listen_task
        except asyncio.CancelledError:
            pass
            
    except Exception as e:
        logger.error(f"Error en cliente: {e}")
    finally:
        await client.disconnect()


async def automated_test():
    """Test automatizado del cliente"""
    client = MPCWebSocketClient()
    
    try:
        logger.info("=== Iniciando test automatizado ===")
        
        # Conectar
        await client.connect()
        
        # Crear tarea para escuchar mensajes
        listen_task = asyncio.create_task(client.listen_for_messages())
        
        # Esperar mensaje de bienvenida
        await asyncio.sleep(1)
        
        # Enviar ping
        await client.send_ping()
        await asyncio.sleep(1)
        
        # Enviar datos de prueba
        await client.send_test_data("Datos de prueba desde cliente automatizado")
        await asyncio.sleep(1)
        
        # Enviar eventos
        for i in range(3):
            await client.send_event(f"test_event_{i+1}", {
                "sequence": i+1,
                "message": f"Evento de prueba #{i+1}"
            })
            await asyncio.sleep(0.5)
            
        # Enviar solicitud con correlation_id
        await client.send_message("request", {
            "action": "get_stats",
            "timestamp": datetime.utcnow().isoformat()
        }, correlation_id="stats-request-001")
        
        # Esperar respuestas
        await asyncio.sleep(3)
        
        logger.info(f"Test completado. Mensajes enviados: {client.message_count}")
        
        # Cancelar tarea de escucha
        listen_task.cancel()
        try:
            await listen_task
        except asyncio.CancelledError:
            pass
            
    except Exception as e:
        logger.error(f"Error en test automatizado: {e}")
    finally:
        await client.disconnect()


async def stress_test(num_messages: int = 100, concurrent_clients: int = 5):
    """Test de estrés con múltiples clientes"""
    logger.info(f"=== Iniciando test de estrés: {concurrent_clients} clientes, {num_messages} mensajes cada uno ===")
    
    async def client_worker(client_id: int):
        """Worker para un cliente individual"""
        client = MPCWebSocketClient()
        
        try:
            await client.connect()
            
            # Crear tarea para escuchar
            listen_task = asyncio.create_task(client.listen_for_messages())
            
            # Enviar mensajes
            for i in range(num_messages):
                await client.send_message("event", {
                    "client_id": client_id,
                    "message_number": i+1,
                    "data": f"Mensaje {i+1} del cliente {client_id}"
                })
                
                # Pequeña pausa para no saturar
                await asyncio.sleep(0.01)
                
            logger.info(f"Cliente {client_id} completado: {num_messages} mensajes enviados")
            
            # Cancelar escucha
            listen_task.cancel()
            try:
                await listen_task
            except asyncio.CancelledError:
                pass
                
        except Exception as e:
            logger.error(f"Error en cliente {client_id}: {e}")
        finally:
            await client.disconnect()
            
    # Crear y ejecutar clientes concurrentes
    tasks = [
        asyncio.create_task(client_worker(i))
        for i in range(concurrent_clients)
    ]
    
    start_time = asyncio.get_event_loop().time()
    await asyncio.gather(*tasks)
    end_time = asyncio.get_event_loop().time()
    
    total_messages = num_messages * concurrent_clients
    duration = end_time - start_time
    
    logger.info(f"Test de estrés completado:")
    logger.info(f"  - Total mensajes: {total_messages}")
    logger.info(f"  - Duración: {duration:.2f} segundos")
    logger.info(f"  - Mensajes/segundo: {total_messages/duration:.2f}")


async def main():
    """Función principal"""
    import sys
    
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
        
        if mode == "interactive":
            await interactive_client()
        elif mode == "auto":
            await automated_test()
        elif mode == "stress":
            num_messages = int(sys.argv[2]) if len(sys.argv) > 2 else 100
            num_clients = int(sys.argv[3]) if len(sys.argv) > 3 else 5
            await stress_test(num_messages, num_clients)
        else:
            print("Modo no reconocido. Use: interactive, auto, o stress")
    else:
        print("Uso: python websocket_test_client.py <modo>")
        print("Modos disponibles:")
        print("  interactive - Cliente interactivo")
        print("  auto - Test automatizado")
        print("  stress [mensajes] [clientes] - Test de estrés")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nCliente terminado por el usuario")
    except Exception as e:
        print(f"Error: {e}")
        raise