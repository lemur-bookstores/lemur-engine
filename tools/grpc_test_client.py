#!/usr/bin/env python3
"""
Cliente gRPC standalone para testing del sistema MPC.
Proporciona herramientas para probar el servidor gRPC de forma interactiva.
"""

import asyncio
import logging
import json
import time
import argparse
import sys
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class TestResult:
    """Resultado de una prueba."""
    test_name: str
    success: bool
    duration_ms: float
    message: str
    details: Optional[Dict[str, Any]] = None


class MPCGRPCTestClient:
    """Cliente de prueba para el servidor gRPC MPC."""
    
    def __init__(self, host: str = "localhost", port: int = 50051):
        self.host = host
        self.port = port
        self.client = None
        self.connected = False
        self.test_results: List[TestResult] = []
        
    async def connect(self) -> bool:
        """Conecta al servidor gRPC."""
        try:
            # Importar cliente gRPC
            from src.mpc.adapters.grpc_adapter import GRPCClient
            
            self.client = GRPCClient(self.host, self.port)
            self.connected = await self.client.connect()
            
            if self.connected:
                logger.info(f"✅ Conectado al servidor gRPC en {self.host}:{self.port}")
            else:
                logger.error(f"❌ No se pudo conectar al servidor gRPC")
                
            return self.connected
            
        except ImportError as e:
            logger.error(f"❌ Error importando cliente gRPC: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Error conectando: {e}")
            return False
    
    async def disconnect(self):
        """Desconecta del servidor."""
        if self.client and self.connected:
            await self.client.disconnect()
            self.connected = False
            logger.info("🔌 Desconectado del servidor gRPC")
    
    async def test_basic_message(self) -> TestResult:
        """Prueba envío básico de mensaje."""
        test_name = "basic_message"
        start_time = time.time()
        
        try:
            if not self.connected:
                return TestResult(
                    test_name=test_name,
                    success=False,
                    duration_ms=0,
                    message="No conectado al servidor"
                )
            
            # Crear mensaje de prueba
            from src.mpc.core.interfaces import Message
            
            message = Message(
                type="request",
                protocol="grpc",
                payload=json.dumps({
                    "type": "test_message",
                    "test_id": "basic_001",
                    "timestamp": time.time(),
                    "data": "Hello from gRPC test client!"
                }),
                source="grpc_test_client",
                destination="mpc_server"
            )
            
            # Enviar mensaje
            success = await self.client.send_message(message)
            duration_ms = (time.time() - start_time) * 1000
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                message="Mensaje enviado exitosamente" if success else "Error enviando mensaje",
                details={"message_id": message.id, "payload_size": len(message.payload)}
            )
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            result = TestResult(
                test_name=test_name,
                success=False,
                duration_ms=duration_ms,
                message=f"Error: {str(e)}"
            )
            self.test_results.append(result)
            return result
    
    async def test_performance(self, message_count: int = 100) -> TestResult:
        """Prueba de rendimiento enviando múltiples mensajes."""
        test_name = f"performance_{message_count}_messages"
        start_time = time.time()
        
        try:
            if not self.connected:
                return TestResult(
                    test_name=test_name,
                    success=False,
                    duration_ms=0,
                    message="No conectado al servidor"
                )
            
            from src.mpc.core.interfaces import Message
            
            successful_sends = 0
            failed_sends = 0
            
            # Enviar mensajes en lotes
            batch_size = 10
            for batch_start in range(0, message_count, batch_size):
                batch_end = min(batch_start + batch_size, message_count)
                tasks = []
                
                for i in range(batch_start, batch_end):
                    message = Message(
                        type="request",
                        protocol="grpc",
                        payload=json.dumps({
                            "type": "performance_test",
                            "test_id": f"perf_{i:04d}",
                            "sequence": i,
                            "timestamp": time.time(),
                            "data": f"Performance test message {i}"
                        }),
                        source="grpc_test_client",
                        destination="mpc_server"
                    )
                    
                    task = self.client.send_message(message)
                    tasks.append(task)
                
                # Esperar lote
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in results:
                    if result is True:
                        successful_sends += 1
                    else:
                        failed_sends += 1
                
                # Pequeña pausa entre lotes
                await asyncio.sleep(0.01)
            
            duration_ms = (time.time() - start_time) * 1000
            throughput = successful_sends / (duration_ms / 1000) if duration_ms > 0 else 0
            
            result = TestResult(
                test_name=test_name,
                success=successful_sends > 0,
                duration_ms=duration_ms,
                message=f"Enviados {successful_sends}/{message_count} mensajes",
                details={
                    "successful_sends": successful_sends,
                    "failed_sends": failed_sends,
                    "throughput_msg_per_sec": throughput,
                    "avg_latency_ms": duration_ms / message_count if message_count > 0 else 0
                }
            )
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            result = TestResult(
                test_name=test_name,
                success=False,
                duration_ms=duration_ms,
                message=f"Error: {str(e)}"
            )
            self.test_results.append(result)
            return result
    
    async def test_streaming(self, duration_seconds: int = 10) -> TestResult:
        """Prueba de streaming (simulado)."""
        test_name = f"streaming_{duration_seconds}s"
        start_time = time.time()
        
        try:
            if not self.connected:
                return TestResult(
                    test_name=test_name,
                    success=False,
                    duration_ms=0,
                    message="No conectado al servidor"
                )
            
            # Simular streaming enviando mensajes periódicos
            messages_sent = 0
            end_time = start_time + duration_seconds
            
            while time.time() < end_time:
                from src.mpc.core.interfaces import Message
                
                message = Message(
                    type="event",
                    protocol="grpc",
                    payload=json.dumps({
                        "type": "streaming_test",
                        "stream_id": "test_stream_001",
                        "sequence": messages_sent,
                        "timestamp": time.time(),
                        "data": f"Streaming message {messages_sent}"
                    }),
                    source="grpc_test_client",
                    destination="mpc_server"
                )
                
                success = await self.client.send_message(message)
                if success:
                    messages_sent += 1
                
                await asyncio.sleep(0.1)  # 10 mensajes por segundo
            
            duration_ms = (time.time() - start_time) * 1000
            
            result = TestResult(
                test_name=test_name,
                success=messages_sent > 0,
                duration_ms=duration_ms,
                message=f"Streaming completado: {messages_sent} mensajes",
                details={
                    "messages_sent": messages_sent,
                    "duration_seconds": duration_seconds,
                    "messages_per_second": messages_sent / duration_seconds
                }
            )
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            result = TestResult(
                test_name=test_name,
                success=False,
                duration_ms=duration_ms,
                message=f"Error: {str(e)}"
            )
            self.test_results.append(result)
            return result
    
    async def test_health_check(self) -> TestResult:
        """Prueba health check."""
        test_name = "health_check"
        start_time = time.time()
        
        try:
            if not self.connected:
                return TestResult(
                    test_name=test_name,
                    success=False,
                    duration_ms=0,
                    message="No conectado al servidor"
                )
            
            from src.mpc.core.interfaces import Message
            
            message = Message(
                type="request",
                protocol="grpc",
                payload=json.dumps({
                    "type": "health_check",
                    "client_id": "grpc_test_client",
                    "timestamp": time.time()
                }),
                source="grpc_test_client",
                destination="mpc_server"
            )
            
            success = await self.client.send_message(message)
            duration_ms = (time.time() - start_time) * 1000
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                message="Health check completado" if success else "Health check falló"
            )
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            result = TestResult(
                test_name=test_name,
                success=False,
                duration_ms=duration_ms,
                message=f"Error: {str(e)}"
            )
            self.test_results.append(result)
            return result
    
    def print_results(self):
        """Imprime resultados de las pruebas."""
        if not self.test_results:
            logger.info("📊 No hay resultados de pruebas")
            return
        
        logger.info("\n📊 RESULTADOS DE PRUEBAS gRPC")
        logger.info("=" * 50)
        
        total_tests = len(self.test_results)
        successful_tests = sum(1 for r in self.test_results if r.success)
        
        for result in self.test_results:
            status = "✅" if result.success else "❌"
            logger.info(f"{status} {result.test_name}: {result.message}")
            logger.info(f"   Duración: {result.duration_ms:.2f}ms")
            
            if result.details:
                for key, value in result.details.items():
                    logger.info(f"   {key}: {value}")
            logger.info("")
        
        logger.info(f"📈 RESUMEN: {successful_tests}/{total_tests} pruebas exitosas")
        
        if successful_tests > 0:
            avg_duration = sum(r.duration_ms for r in self.test_results if r.success) / successful_tests
            logger.info(f"⏱️  Duración promedio: {avg_duration:.2f}ms")


async def interactive_mode(client: MPCGRPCTestClient):
    """Modo interactivo para testing."""
    logger.info("\n🎮 MODO INTERACTIVO gRPC")
    logger.info("Comandos disponibles:")
    logger.info("  1 - Prueba básica de mensaje")
    logger.info("  2 - Prueba de rendimiento (100 mensajes)")
    logger.info("  3 - Prueba de streaming (10 segundos)")
    logger.info("  4 - Health check")
    logger.info("  5 - Ejecutar todas las pruebas")
    logger.info("  r - Mostrar resultados")
    logger.info("  q - Salir")
    
    while True:
        try:
            command = input("\n> ").strip().lower()
            
            if command == 'q':
                break
            elif command == '1':
                logger.info("🧪 Ejecutando prueba básica...")
                result = await client.test_basic_message()
                status = "✅" if result.success else "❌"
                logger.info(f"{status} {result.message} ({result.duration_ms:.2f}ms)")
                
            elif command == '2':
                logger.info("🚀 Ejecutando prueba de rendimiento...")
                result = await client.test_performance(100)
                status = "✅" if result.success else "❌"
                logger.info(f"{status} {result.message} ({result.duration_ms:.2f}ms)")
                if result.details:
                    logger.info(f"   Throughput: {result.details.get('throughput_msg_per_sec', 0):.2f} msg/s")
                
            elif command == '3':
                logger.info("🌊 Ejecutando prueba de streaming...")
                result = await client.test_streaming(10)
                status = "✅" if result.success else "❌"
                logger.info(f"{status} {result.message} ({result.duration_ms:.2f}ms)")
                
            elif command == '4':
                logger.info("💓 Ejecutando health check...")
                result = await client.test_health_check()
                status = "✅" if result.success else "❌"
                logger.info(f"{status} {result.message} ({result.duration_ms:.2f}ms)")
                
            elif command == '5':
                logger.info("🔄 Ejecutando todas las pruebas...")
                await run_all_tests(client)
                
            elif command == 'r':
                client.print_results()
                
            else:
                logger.info("❓ Comando no reconocido")
                
        except KeyboardInterrupt:
            logger.info("\n⏹️  Interrumpido por usuario")
            break
        except Exception as e:
            logger.error(f"❌ Error: {e}")


async def run_all_tests(client: MPCGRPCTestClient):
    """Ejecuta todas las pruebas automáticamente."""
    logger.info("🔄 Ejecutando suite completa de pruebas...")
    
    tests = [
        ("Prueba básica", client.test_basic_message()),
        ("Health check", client.test_health_check()),
        ("Rendimiento (50 mensajes)", client.test_performance(50)),
        ("Streaming (5 segundos)", client.test_streaming(5))
    ]
    
    for test_name, test_coro in tests:
        logger.info(f"🧪 Ejecutando: {test_name}")
        result = await test_coro
        status = "✅" if result.success else "❌"
        logger.info(f"{status} {test_name}: {result.message}")
        await asyncio.sleep(1)  # Pausa entre pruebas
    
    logger.info("✅ Suite de pruebas completada")


async def stress_test(client: MPCGRPCTestClient, duration_minutes: int = 5):
    """Ejecuta prueba de estrés."""
    logger.info(f"💪 Iniciando prueba de estrés por {duration_minutes} minutos...")
    
    start_time = time.time()
    end_time = start_time + (duration_minutes * 60)
    
    total_messages = 0
    successful_messages = 0
    failed_messages = 0
    
    try:
        while time.time() < end_time:
            # Ejecutar prueba de rendimiento en lotes
            result = await client.test_performance(20)
            
            if result.success and result.details:
                successful_messages += result.details.get('successful_sends', 0)
                failed_messages += result.details.get('failed_sends', 0)
            
            total_messages += 20
            
            # Mostrar progreso cada minuto
            elapsed = time.time() - start_time
            if int(elapsed) % 60 == 0 and elapsed > 0:
                logger.info(f"⏱️  Progreso: {elapsed/60:.1f} min, {successful_messages} mensajes exitosos")
            
            await asyncio.sleep(1)  # Pausa entre lotes
            
    except KeyboardInterrupt:
        logger.info("⏹️  Prueba de estrés interrumpida")
    
    total_duration = time.time() - start_time
    avg_throughput = successful_messages / total_duration if total_duration > 0 else 0
    
    logger.info(f"\n💪 RESULTADOS PRUEBA DE ESTRÉS:")
    logger.info(f"   Duración: {total_duration/60:.1f} minutos")
    logger.info(f"   Mensajes totales: {total_messages}")
    logger.info(f"   Mensajes exitosos: {successful_messages}")
    logger.info(f"   Mensajes fallidos: {failed_messages}")
    logger.info(f"   Tasa de éxito: {(successful_messages/total_messages*100):.1f}%")
    logger.info(f"   Throughput promedio: {avg_throughput:.2f} msg/s")


async def main():
    """Función principal."""
    parser = argparse.ArgumentParser(description="Cliente de prueba gRPC para sistema MPC")
    parser.add_argument("--host", default="localhost", help="Host del servidor gRPC")
    parser.add_argument("--port", type=int, default=50051, help="Puerto del servidor gRPC")
    parser.add_argument("--mode", choices=["interactive", "auto", "stress"], default="interactive",
                       help="Modo de operación")
    parser.add_argument("--stress-duration", type=int, default=5,
                       help="Duración de prueba de estrés en minutos")
    
    args = parser.parse_args()
    
    logger.info(f"🚀 Iniciando cliente de prueba gRPC MPC")
    logger.info(f"🎯 Servidor: {args.host}:{args.port}")
    
    client = MPCGRPCTestClient(args.host, args.port)
    
    try:
        # Conectar al servidor
        if not await client.connect():
            logger.error("❌ No se pudo conectar al servidor. ¿Está ejecutándose?")
            return 1
        
        # Ejecutar según el modo
        if args.mode == "interactive":
            await interactive_mode(client)
        elif args.mode == "auto":
            await run_all_tests(client)
        elif args.mode == "stress":
            await stress_test(client, args.stress_duration)
        
        # Mostrar resultados finales
        client.print_results()
        
    except KeyboardInterrupt:
        logger.info("\n👋 Detenido por usuario")
    except Exception as e:
        logger.error(f"💥 Error fatal: {e}")
        return 1
    finally:
        await client.disconnect()
    
    return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("👋 ¡Hasta luego!")
        sys.exit(0)