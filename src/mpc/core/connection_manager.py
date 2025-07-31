"""
Gestor de conexiones del sistema MPC
===================================

Gestiona todas las conexiones activas de todos los protocolos.
"""

import asyncio
import logging
from typing import Dict, Optional, Any
from datetime import datetime

from .interfaces import ConnectionManager, ProtocolType


logger = logging.getLogger(__name__)


class MPCConnectionManager(ConnectionManager):
    """Gestor de conexiones para el sistema MPC"""
    
    def __init__(self):
        self._connections: Dict[str, Dict[str, Any]] = {}
        self._protocol_connections: Dict[ProtocolType, set] = {
            protocol: set() for protocol in ProtocolType
        }
        self._running = False
        self._cleanup_task: Optional[asyncio.Task] = None
        
    async def start(self) -> None:
        """Inicia el gestor de conexiones"""
        if self._running:
            return
            
        self._running = True
        
        # Iniciar tarea de limpieza periódica
        self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
        
        logger.info("Connection Manager iniciado")
        
    async def stop(self) -> None:
        """Detiene el gestor de conexiones"""
        if not self._running:
            return
            
        self._running = False
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
                
        # Limpiar todas las conexiones
        self._connections.clear()
        for protocol_set in self._protocol_connections.values():
            protocol_set.clear()
            
        logger.info("Connection Manager detenido")
        
    async def add_connection(
        self, 
        connection_id: str, 
        protocol: ProtocolType, 
        metadata: Dict[str, Any]
    ) -> None:
        """Añade una nueva conexión"""
        
        connection_info = {
            "id": connection_id,
            "protocol": protocol,
            "metadata": metadata,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
            "status": "active",
            "message_count": 0
        }
        
        self._connections[connection_id] = connection_info
        self._protocol_connections[protocol].add(connection_id)
        
        logger.info(f"Conexión {connection_id} añadida para protocolo {protocol.value}")
        
    async def remove_connection(self, connection_id: str) -> None:
        """Remueve una conexión"""
        
        if connection_id in self._connections:
            connection_info = self._connections.pop(connection_id)
            protocol = connection_info["protocol"]
            
            if connection_id in self._protocol_connections[protocol]:
                self._protocol_connections[protocol].remove(connection_id)
                
            logger.info(f"Conexión {connection_id} removida")
        else:
            logger.warning(f"Intento de remover conexión inexistente: {connection_id}")
            
    async def get_connection(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene información de una conexión"""
        return self._connections.get(connection_id)
        
    async def list_connections(
        self, 
        protocol: Optional[ProtocolType] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Lista todas las conexiones activas"""
        
        if protocol is None:
            return self._connections.copy()
        else:
            filtered_connections = {}
            for conn_id in self._protocol_connections[protocol]:
                if conn_id in self._connections:
                    filtered_connections[conn_id] = self._connections[conn_id]
            return filtered_connections
            
    async def update_activity(self, connection_id: str) -> None:
        """Actualiza la última actividad de una conexión"""
        
        if connection_id in self._connections:
            self._connections[connection_id]["last_activity"] = datetime.utcnow().isoformat()
            self._connections[connection_id]["message_count"] += 1
            
    async def set_connection_status(self, connection_id: str, status: str) -> None:
        """Establece el estado de una conexión"""
        
        if connection_id in self._connections:
            self._connections[connection_id]["status"] = status
            logger.info(f"Estado de conexión {connection_id} cambiado a: {status}")
            
    async def get_protocol_stats(self) -> Dict[str, Dict[str, Any]]:
        """Obtiene estadísticas por protocolo"""
        
        stats = {}
        
        for protocol in ProtocolType:
            protocol_connections = self._protocol_connections[protocol]
            active_connections = [
                conn_id for conn_id in protocol_connections 
                if conn_id in self._connections and 
                self._connections[conn_id]["status"] == "active"
            ]
            
            total_messages = sum(
                self._connections[conn_id]["message_count"] 
                for conn_id in protocol_connections 
                if conn_id in self._connections
            )
            
            stats[protocol.value] = {
                "total_connections": len(protocol_connections),
                "active_connections": len(active_connections),
                "total_messages": total_messages,
                "connection_ids": list(protocol_connections)
            }
            
        return stats
        
    async def cleanup_inactive_connections(self, max_inactive_minutes: int = 30) -> int:
        """Limpia conexiones inactivas"""
        
        current_time = datetime.utcnow()
        inactive_connections = []
        
        for conn_id, conn_info in self._connections.items():
            last_activity = datetime.fromisoformat(conn_info["last_activity"])
            inactive_minutes = (current_time - last_activity).total_seconds() / 60
            
            if inactive_minutes > max_inactive_minutes:
                inactive_connections.append(conn_id)
                
        # Remover conexiones inactivas
        for conn_id in inactive_connections:
            await self.remove_connection(conn_id)
            
        if inactive_connections:
            logger.info(f"Limpiadas {len(inactive_connections)} conexiones inactivas")
            
        return len(inactive_connections)
        
    async def _periodic_cleanup(self) -> None:
        """Tarea de limpieza periódica"""
        
        while self._running:
            try:
                await asyncio.sleep(300)  # Cada 5 minutos
                await self.cleanup_inactive_connections()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error en limpieza periódica: {e}")
                
    def get_total_connections(self) -> int:
        """Obtiene el número total de conexiones"""
        return len(self._connections)
        
    def is_running(self) -> bool:
        """Verifica si el gestor está corriendo"""
        return self._running