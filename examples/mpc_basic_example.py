"""
Ejemplo de uso del sistema MPC
=============================

Demuestra cómo usar el sistema Multi-Protocol Communication.
"""

import asyncio
import logging
from typing import Dict, Any

from mpc import UnifiedGateway, ProtocolType, MessageType
from mpc.adapters import HTTPAdapter


# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """Función principal de ejemplo"""
    
    # Crear gateway unificado
    gateway = UnifiedGateway()
    
    try:
        # Crear y registrar adaptador HTTP
        http_adapter = HTTPAdapter(host="localhost", port=8080)
        gateway.register_adapter(http_adapter)
        
        # Iniciar gateway
        await gateway.start()
        
        logger.info("Sistema MPC iniciado correctamente")
        
        # Obtener estado del sistema
        status = await gateway.get_status()
        logger.info(f"Estado del sistema: {status}")
        
        # Enviar mensaje de prueba
        message_id = await gateway.send_message(
            protocol=ProtocolType.HTTP,
            payload={
                "action": "test",
                "data": "Hello MPC System!"
            },
            message_type=MessageType.REQUEST,
            metadata={"source": "example_script"}
        )
        
        logger.info(f"Mensaje enviado con ID: {message_id}")
        
        # Broadcast de ejemplo
        broadcast_id = await gateway.broadcast_message(
            payload={
                "event": "system_started",
                "timestamp": asyncio.get_event_loop().time()
            },
            message_type=MessageType.EVENT
        )
        
        logger.info(f"Broadcast enviado con ID: {broadcast_id}")
        
        # Mantener el sistema corriendo por un tiempo
        logger.info("Sistema corriendo... (presiona Ctrl+C para detener)")
        await asyncio.sleep(60)
        
    except KeyboardInterrupt:
        logger.info("Deteniendo sistema...")
        
    finally:
        # Detener gateway
        await gateway.stop()
        logger.info("Sistema MPC detenido")


if __name__ == "__main__":
    asyncio.run(main())