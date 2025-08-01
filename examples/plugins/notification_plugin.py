"""
Plugin de ejemplo: Sistema de Notificaciones
Este plugin demuestra cómo crear un sistema de notificaciones usando MCP
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum

from src.mcp.core.resource_manager import MCPTool, MCPPlugin

class NotificationPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

@dataclass
class Notification:
    id: str
    title: str
    message: str
    priority: NotificationPriority
    created_at: datetime
    scheduled_for: datetime = None
    read: bool = False
    tags: List[str] = field(default_factory=list)

@dataclass
class NotificationPlugin(MCPPlugin):
    """Plugin de sistema de notificaciones"""
    
    name: str = "notification_system"
    version: str = "1.0.0"
    description: str = "Sistema de gestión de notificaciones con programación y filtrado"
    author: str = "MCP Team"
    
    def __post_init__(self):
        self.notifications: Dict[str, Notification] = {}
        self.notification_counter = 0
        self.subscribers = set()
    
    def get_tools(self) -> List[MCPTool]:
        return [
            MCPTool(
                name="crear_notificacion",
                description="Crea una nueva notificación",
                parameters={
                    "title": {
                        "type": "string",
                        "description": "Título de la notificación",
                        "required": True
                    },
                    "message": {
                        "type": "string",
                        "description": "Mensaje de la notificación",
                        "required": True
                    },
                    "priority": {
                        "type": "string",
                        "description": "Prioridad (low, medium, high, urgent)",
                        "required": False,
                        "default": "medium"
                    },
                    "scheduled_for": {
                        "type": "string",
                        "description": "Fecha/hora programada (ISO format)",
                        "required": False
                    },
                    "tags": {
                        "type": "array",
                        "description": "Etiquetas para categorizar",
                        "required": False
                    }
                },
                handler=self.crear_notificacion
            ),
            MCPTool(
                name="listar_notificaciones",
                description="Lista notificaciones con filtros opcionales",
                parameters={
                    "priority": {
                        "type": "string",
                        "description": "Filtrar por prioridad",
                        "required": False
                    },
                    "read": {
                        "type": "boolean",
                        "description": "Filtrar por estado de lectura",
                        "required": False
                    },
                    "tag": {
                        "type": "string",
                        "description": "Filtrar por etiqueta",
                        "required": False
                    },
                    "limit": {
                        "type": "number",
                        "description": "Número máximo de resultados",
                        "required": False,
                        "default": 10
                    }
                },
                handler=self.listar_notificaciones
            ),
            MCPTool(
                name="marcar_como_leida",
                description="Marca una notificación como leída",
                parameters={
                    "notification_id": {
                        "type": "string",
                        "description": "ID de la notificación",
                        "required": True
                    }
                },
                handler=self.marcar_como_leida
            ),
            MCPTool(
                name="eliminar_notificacion",
                description="Elimina una notificación",
                parameters={
                    "notification_id": {
                        "type": "string",
                        "description": "ID de la notificación",
                        "required": True
                    }
                },
                handler=self.eliminar_notificacion
            ),
            MCPTool(
                name="obtener_estadisticas",
                description="Obtiene estadísticas del sistema de notificaciones",
                parameters={},
                handler=self.obtener_estadisticas
            ),
            MCPTool(
                name="procesar_notificaciones_programadas",
                description="Procesa notificaciones programadas que deben enviarse",
                parameters={},
                handler=self.procesar_notificaciones_programadas
            ),
            MCPTool(
                name="suscribirse_notificaciones",
                description="Suscribe un cliente a notificaciones en tiempo real",
                parameters={
                    "client_id": {
                        "type": "string",
                        "description": "ID del cliente",
                        "required": True
                    }
                },
                handler=self.suscribirse_notificaciones
            )
        ]
    
    def _generate_id(self) -> str:
        """Genera un ID único para la notificación"""
        self.notification_counter += 1
        return f"notif_{self.notification_counter}_{int(datetime.now().timestamp())}"
    
    async def crear_notificacion(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Crea una nueva notificación"""
        title = arguments.get("title")
        message = arguments.get("message")
        priority_str = arguments.get("priority", "medium")
        scheduled_for_str = arguments.get("scheduled_for")
        tags = arguments.get("tags", [])
        
        try:
            priority = NotificationPriority(priority_str)
        except ValueError:
            return {
                "success": False,
                "error": f"Prioridad inválida. Opciones: {[p.value for p in NotificationPriority]}"
            }
        
        scheduled_for = None
        if scheduled_for_str:
            try:
                scheduled_for = datetime.fromisoformat(scheduled_for_str.replace('Z', '+00:00'))
            except ValueError:
                return {
                    "success": False,
                    "error": "Formato de fecha inválido. Use formato ISO (YYYY-MM-DDTHH:MM:SS)"
                }
        
        notification_id = self._generate_id()
        notification = Notification(
            id=notification_id,
            title=title,
            message=message,
            priority=priority,
            created_at=datetime.now(),
            scheduled_for=scheduled_for,
            tags=tags
        )
        
        self.notifications[notification_id] = notification
        
        # Notificar a suscriptores si es inmediata
        if not scheduled_for:
            await self._notify_subscribers(notification)
        
        return {
            "success": True,
            "notification_id": notification_id,
            "message": "Notificación creada exitosamente",
            "scheduled": scheduled_for is not None
        }
    
    async def listar_notificaciones(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Lista notificaciones con filtros"""
        priority_filter = arguments.get("priority")
        read_filter = arguments.get("read")
        tag_filter = arguments.get("tag")
        limit = arguments.get("limit", 10)
        
        filtered_notifications = []
        
        for notification in self.notifications.values():
            # Aplicar filtros
            if priority_filter and notification.priority.value != priority_filter:
                continue
            if read_filter is not None and notification.read != read_filter:
                continue
            if tag_filter and tag_filter not in notification.tags:
                continue
            
            filtered_notifications.append({
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "priority": notification.priority.value,
                "created_at": notification.created_at.isoformat(),
                "scheduled_for": notification.scheduled_for.isoformat() if notification.scheduled_for else None,
                "read": notification.read,
                "tags": notification.tags
            })
        
        # Ordenar por prioridad y fecha
        priority_order = {p.value: i for i, p in enumerate(NotificationPriority)}
        filtered_notifications.sort(
            key=lambda x: (priority_order.get(x["priority"], 999), x["created_at"]),
            reverse=True
        )
        
        return {
            "success": True,
            "notifications": filtered_notifications[:limit],
            "total_found": len(filtered_notifications),
            "showing": min(limit, len(filtered_notifications))
        }
    
    async def marcar_como_leida(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Marca una notificación como leída"""
        notification_id = arguments.get("notification_id")
        
        if notification_id not in self.notifications:
            return {
                "success": False,
                "error": "Notificación no encontrada"
            }
        
        self.notifications[notification_id].read = True
        
        return {
            "success": True,
            "message": f"Notificación {notification_id} marcada como leída"
        }
    
    async def eliminar_notificacion(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Elimina una notificación"""
        notification_id = arguments.get("notification_id")
        
        if notification_id not in self.notifications:
            return {
                "success": False,
                "error": "Notificación no encontrada"
            }
        
        del self.notifications[notification_id]
        
        return {
            "success": True,
            "message": f"Notificación {notification_id} eliminada"
        }
    
    async def obtener_estadisticas(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Obtiene estadísticas del sistema"""
        total = len(self.notifications)
        read = sum(1 for n in self.notifications.values() if n.read)
        unread = total - read
        
        by_priority = {}
        for priority in NotificationPriority:
            by_priority[priority.value] = sum(
                1 for n in self.notifications.values() 
                if n.priority == priority
            )
        
        scheduled = sum(
            1 for n in self.notifications.values() 
            if n.scheduled_for and n.scheduled_for > datetime.now()
        )
        
        return {
            "success": True,
            "statistics": {
                "total_notifications": total,
                "read": read,
                "unread": unread,
                "by_priority": by_priority,
                "scheduled_pending": scheduled,
                "subscribers": len(self.subscribers)
            }
        }
    
    async def procesar_notificaciones_programadas(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa notificaciones programadas que deben enviarse"""
        now = datetime.now()
        processed = []
        
        for notification in self.notifications.values():
            if (notification.scheduled_for and 
                notification.scheduled_for <= now and 
                not notification.read):
                
                await self._notify_subscribers(notification)
                processed.append(notification.id)
        
        return {
            "success": True,
            "processed_notifications": processed,
            "count": len(processed)
        }
    
    async def suscribirse_notificaciones(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Suscribe un cliente a notificaciones"""
        client_id = arguments.get("client_id")
        
        self.subscribers.add(client_id)
        
        return {
            "success": True,
            "message": f"Cliente {client_id} suscrito a notificaciones",
            "total_subscribers": len(self.subscribers)
        }
    
    async def _notify_subscribers(self, notification: Notification):
        """Notifica a todos los suscriptores (simulado)"""
        if self.subscribers:
            print(f"📢 Notificando a {len(self.subscribers)} suscriptores:")
            print(f"   [{notification.priority.value.upper()}] {notification.title}")
            print(f"   {notification.message}")
    
    async def initialize(self) -> bool:
        """Inicializa el plugin"""
        print(f"🔔 Inicializando {self.name} v{self.version}")
        
        # Crear algunas notificaciones de ejemplo
        await self.crear_notificacion(None, {
            "title": "Bienvenido al Sistema MCP",
            "message": "El sistema de notificaciones está activo",
            "priority": "medium",
            "tags": ["sistema", "bienvenida"]
        })
        
        return True
    
    async def shutdown(self) -> bool:
        """Cierra el plugin"""
        print(f"🔔 Cerrando {self.name}")
        self.subscribers.clear()
        return True

def create_plugin() -> MCPPlugin:
    """Función requerida para crear instancia del plugin"""
    return NotificationPlugin()