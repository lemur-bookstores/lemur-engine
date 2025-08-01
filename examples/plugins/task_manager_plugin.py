"""
Plugin de ejemplo: Sistema de Tareas (Task Management)
Este plugin demuestra un sistema completo de gestión de tareas con persistencia
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import asyncio

from src.mcp.core.resource_manager import MCPTool, MCPPlugin

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TaskPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

@dataclass
class Task:
    id: str
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    created_at: datetime
    updated_at: datetime
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    progress: int = 0  # 0-100
    parent_task_id: Optional[str] = None
    subtasks: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "priority": self.priority.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "assigned_to": self.assigned_to,
            "tags": self.tags,
            "progress": self.progress,
            "parent_task_id": self.parent_task_id,
            "subtasks": self.subtasks
        }

@dataclass
class TaskManagerPlugin(MCPPlugin):
    """Plugin para gestión completa de tareas"""
    
    name: str = "task_manager"
    version: str = "1.0.0"
    description: str = "Sistema completo de gestión de tareas con jerarquías y seguimiento"
    author: str = "MCP Task Team"
    
    def __post_init__(self):
        self.tasks: Dict[str, Task] = {}
        self.task_file = "tasks_data.json"
        self.auto_save = True
    
    def get_tools(self) -> List[MCPTool]:
        return [
            MCPTool(
                name="crear_tarea",
                description="Crea una nueva tarea",
                parameters={
                    "title": {
                        "type": "string",
                        "description": "Título de la tarea",
                        "required": True
                    },
                    "description": {
                        "type": "string",
                        "description": "Descripción detallada",
                        "required": False,
                        "default": ""
                    },
                    "priority": {
                        "type": "string",
                        "description": "Prioridad (low, medium, high, urgent)",
                        "required": False,
                        "default": "medium"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Fecha límite (YYYY-MM-DD HH:MM)",
                        "required": False
                    },
                    "assigned_to": {
                        "type": "string",
                        "description": "Persona asignada",
                        "required": False
                    },
                    "tags": {
                        "type": "array",
                        "description": "Lista de etiquetas",
                        "required": False,
                        "default": []
                    },
                    "parent_task_id": {
                        "type": "string",
                        "description": "ID de tarea padre (para subtareas)",
                        "required": False
                    }
                },
                handler=self.crear_tarea
            ),
            MCPTool(
                name="listar_tareas",
                description="Lista tareas con filtros opcionales",
                parameters={
                    "status": {
                        "type": "string",
                        "description": "Filtrar por estado",
                        "required": False
                    },
                    "priority": {
                        "type": "string",
                        "description": "Filtrar por prioridad",
                        "required": False
                    },
                    "assigned_to": {
                        "type": "string",
                        "description": "Filtrar por asignado",
                        "required": False
                    },
                    "tag": {
                        "type": "string",
                        "description": "Filtrar por etiqueta",
                        "required": False
                    },
                    "overdue": {
                        "type": "boolean",
                        "description": "Solo tareas vencidas",
                        "required": False
                    }
                },
                handler=self.listar_tareas
            ),
            MCPTool(
                name="obtener_tarea",
                description="Obtiene detalles de una tarea específica",
                parameters={
                    "task_id": {
                        "type": "string",
                        "description": "ID de la tarea",
                        "required": True
                    }
                },
                handler=self.obtener_tarea
            ),
            MCPTool(
                name="actualizar_tarea",
                description="Actualiza una tarea existente",
                parameters={
                    "task_id": {
                        "type": "string",
                        "description": "ID de la tarea",
                        "required": True
                    },
                    "title": {
                        "type": "string",
                        "description": "Nuevo título",
                        "required": False
                    },
                    "description": {
                        "type": "string",
                        "description": "Nueva descripción",
                        "required": False
                    },
                    "status": {
                        "type": "string",
                        "description": "Nuevo estado",
                        "required": False
                    },
                    "priority": {
                        "type": "string",
                        "description": "Nueva prioridad",
                        "required": False
                    },
                    "progress": {
                        "type": "number",
                        "description": "Progreso (0-100)",
                        "required": False
                    },
                    "assigned_to": {
                        "type": "string",
                        "description": "Nueva asignación",
                        "required": False
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Nueva fecha límite",
                        "required": False
                    }
                },
                handler=self.actualizar_tarea
            ),
            MCPTool(
                name="eliminar_tarea",
                description="Elimina una tarea",
                parameters={
                    "task_id": {
                        "type": "string",
                        "description": "ID de la tarea",
                        "required": True
                    },
                    "force": {
                        "type": "boolean",
                        "description": "Forzar eliminación (incluye subtareas)",
                        "required": False,
                        "default": False
                    }
                },
                handler=self.eliminar_tarea
            ),
            MCPTool(
                name="agregar_subtarea",
                description="Agrega una subtarea a una tarea existente",
                parameters={
                    "parent_task_id": {
                        "type": "string",
                        "description": "ID de la tarea padre",
                        "required": True
                    },
                    "title": {
                        "type": "string",
                        "description": "Título de la subtarea",
                        "required": True
                    },
                    "description": {
                        "type": "string",
                        "description": "Descripción de la subtarea",
                        "required": False,
                        "default": ""
                    }
                },
                handler=self.agregar_subtarea
            ),
            MCPTool(
                name="obtener_estadisticas",
                description="Obtiene estadísticas del sistema de tareas",
                parameters={
                    "period": {
                        "type": "string",
                        "description": "Período (day, week, month, all)",
                        "required": False,
                        "default": "all"
                    }
                },
                handler=self.obtener_estadisticas
            ),
            MCPTool(
                name="buscar_tareas",
                description="Busca tareas por texto",
                parameters={
                    "query": {
                        "type": "string",
                        "description": "Texto a buscar",
                        "required": True
                    },
                    "search_in": {
                        "type": "array",
                        "description": "Campos donde buscar (title, description, tags)",
                        "required": False,
                        "default": ["title", "description"]
                    }
                },
                handler=self.buscar_tareas
            ),
            MCPTool(
                name="exportar_tareas",
                description="Exporta tareas en formato JSON",
                parameters={
                    "format": {
                        "type": "string",
                        "description": "Formato de exportación (json, csv)",
                        "required": False,
                        "default": "json"
                    },
                    "filter_status": {
                        "type": "string",
                        "description": "Filtrar por estado",
                        "required": False
                    }
                },
                handler=self.exportar_tareas
            ),
            MCPTool(
                name="importar_tareas",
                description="Importa tareas desde datos JSON",
                parameters={
                    "data": {
                        "type": "array",
                        "description": "Array de tareas a importar",
                        "required": True
                    },
                    "overwrite": {
                        "type": "boolean",
                        "description": "Sobrescribir tareas existentes",
                        "required": False,
                        "default": False
                    }
                },
                handler=self.importar_tareas
            )
        ]
    
    async def crear_tarea(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Crea una nueva tarea"""
        try:
            task_id = str(uuid.uuid4())
            now = datetime.now()
            
            # Validar prioridad
            priority_str = arguments.get("priority", "medium")
            try:
                priority = TaskPriority(priority_str)
            except ValueError:
                return {
                    "success": False,
                    "error": f"Prioridad inválida: {priority_str}"
                }
            
            # Procesar fecha límite
            due_date = None
            if arguments.get("due_date"):
                try:
                    due_date = datetime.fromisoformat(arguments["due_date"])
                except ValueError:
                    return {
                        "success": False,
                        "error": "Formato de fecha inválido. Use YYYY-MM-DD HH:MM"
                    }
            
            # Validar tarea padre
            parent_task_id = arguments.get("parent_task_id")
            if parent_task_id and parent_task_id not in self.tasks:
                return {
                    "success": False,
                    "error": "Tarea padre no encontrada"
                }
            
            task = Task(
                id=task_id,
                title=arguments["title"],
                description=arguments.get("description", ""),
                status=TaskStatus.PENDING,
                priority=priority,
                created_at=now,
                updated_at=now,
                due_date=due_date,
                assigned_to=arguments.get("assigned_to"),
                tags=arguments.get("tags", []),
                parent_task_id=parent_task_id
            )
            
            self.tasks[task_id] = task
            
            # Actualizar tarea padre si existe
            if parent_task_id:
                parent_task = self.tasks[parent_task_id]
                parent_task.subtasks.append(task_id)
                parent_task.updated_at = now
            
            if self.auto_save:
                await self._save_tasks()
            
            return {
                "success": True,
                "task_id": task_id,
                "message": "Tarea creada exitosamente",
                "task": task.to_dict()
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Error creando tarea: {str(e)}"
            }
    
    async def listar_tareas(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Lista tareas con filtros"""
        try:
            filtered_tasks = []
            now = datetime.now()
            
            for task in self.tasks.values():
                # Aplicar filtros
                if arguments.get("status") and task.status.value != arguments["status"]:
                    continue
                
                if arguments.get("priority") and task.priority.value != arguments["priority"]:
                    continue
                
                if arguments.get("assigned_to") and task.assigned_to != arguments["assigned_to"]:
                    continue
                
                if arguments.get("tag") and arguments["tag"] not in task.tags:
                    continue
                
                if arguments.get("overdue"):
                    if not task.due_date or task.due_date > now:
                        continue
                
                filtered_tasks.append(task.to_dict())
            
            # Ordenar por prioridad y fecha de creación
            priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
            filtered_tasks.sort(
                key=lambda x: (priority_order.get(x["priority"], 4), x["created_at"])
            )
            
            return {
                "success": True,
                "total_tasks": len(self.tasks),
                "filtered_count": len(filtered_tasks),
                "tasks": filtered_tasks
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Error listando tareas: {str(e)}"
            }
    
    async def obtener_tarea(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Obtiene detalles de una tarea"""
        task_id = arguments.get("task_id")
        
        if task_id not in self.tasks:
            return {
                "success": False,
                "error": "Tarea no encontrada"
            }
        
        task = self.tasks[task_id]
        task_dict = task.to_dict()
        
        # Agregar información adicional
        if task.subtasks:
            subtasks_info = []
            for subtask_id in task.subtasks:
                if subtask_id in self.tasks:
                    subtask = self.tasks[subtask_id]
                    subtasks_info.append({
                        "id": subtask.id,
                        "title": subtask.title,
                        "status": subtask.status.value,
                        "progress": subtask.progress
                    })
            task_dict["subtasks_info"] = subtasks_info
        
        if task.parent_task_id and task.parent_task_id in self.tasks:
            parent = self.tasks[task.parent_task_id]
            task_dict["parent_task_info"] = {
                "id": parent.id,
                "title": parent.title,
                "status": parent.status.value
            }
        
        return {
            "success": True,
            "task": task_dict
        }
    
    async def actualizar_tarea(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Actualiza una tarea existente"""
        task_id = arguments.get("task_id")
        
        if task_id not in self.tasks:
            return {
                "success": False,
                "error": "Tarea no encontrada"
            }
        
        task = self.tasks[task_id]
        changes = []
        
        try:
            # Actualizar campos
            if "title" in arguments:
                task.title = arguments["title"]
                changes.append("título")
            
            if "description" in arguments:
                task.description = arguments["description"]
                changes.append("descripción")
            
            if "status" in arguments:
                try:
                    new_status = TaskStatus(arguments["status"])
                    task.status = new_status
                    changes.append("estado")
                    
                    # Auto-actualizar progreso
                    if new_status == TaskStatus.COMPLETED:
                        task.progress = 100
                    elif new_status == TaskStatus.PENDING:
                        task.progress = 0
                except ValueError:
                    return {
                        "success": False,
                        "error": f"Estado inválido: {arguments['status']}"
                    }
            
            if "priority" in arguments:
                try:
                    task.priority = TaskPriority(arguments["priority"])
                    changes.append("prioridad")
                except ValueError:
                    return {
                        "success": False,
                        "error": f"Prioridad inválida: {arguments['priority']}"
                    }
            
            if "progress" in arguments:
                progress = arguments["progress"]
                if 0 <= progress <= 100:
                    task.progress = progress
                    changes.append("progreso")
                    
                    # Auto-actualizar estado
                    if progress == 100 and task.status != TaskStatus.COMPLETED:
                        task.status = TaskStatus.COMPLETED
                    elif progress > 0 and task.status == TaskStatus.PENDING:
                        task.status = TaskStatus.IN_PROGRESS
                else:
                    return {
                        "success": False,
                        "error": "El progreso debe estar entre 0 y 100"
                    }
            
            if "assigned_to" in arguments:
                task.assigned_to = arguments["assigned_to"]
                changes.append("asignación")
            
            if "due_date" in arguments:
                if arguments["due_date"]:
                    try:
                        task.due_date = datetime.fromisoformat(arguments["due_date"])
                        changes.append("fecha límite")
                    except ValueError:
                        return {
                            "success": False,
                            "error": "Formato de fecha inválido"
                        }
                else:
                    task.due_date = None
                    changes.append("fecha límite (removida)")
            
            task.updated_at = datetime.now()
            
            if self.auto_save:
                await self._save_tasks()
            
            return {
                "success": True,
                "message": f"Tarea actualizada: {', '.join(changes)}",
                "task": task.to_dict()
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Error actualizando tarea: {str(e)}"
            }
    
    async def eliminar_tarea(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Elimina una tarea"""
        task_id = arguments.get("task_id")
        force = arguments.get("force", False)
        
        if task_id not in self.tasks:
            return {
                "success": False,
                "error": "Tarea no encontrada"
            }
        
        task = self.tasks[task_id]
        
        # Verificar subtareas
        if task.subtasks and not force:
            return {
                "success": False,
                "error": "La tarea tiene subtareas. Use force=true para eliminar todo"
            }
        
        deleted_count = 1
        
        # Eliminar subtareas si force=true
        if force and task.subtasks:
            for subtask_id in task.subtasks.copy():
                if subtask_id in self.tasks:
                    del self.tasks[subtask_id]
                    deleted_count += 1
        
        # Remover de tarea padre
        if task.parent_task_id and task.parent_task_id in self.tasks:
            parent = self.tasks[task.parent_task_id]
            if task_id in parent.subtasks:
                parent.subtasks.remove(task_id)
                parent.updated_at = datetime.now()
        
        # Eliminar tarea principal
        del self.tasks[task_id]
        
        if self.auto_save:
            await self._save_tasks()
        
        return {
            "success": True,
            "message": f"Eliminadas {deleted_count} tarea(s)",
            "deleted_count": deleted_count
        }
    
    async def agregar_subtarea(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Agrega una subtarea"""
        parent_task_id = arguments.get("parent_task_id")
        
        if parent_task_id not in self.tasks:
            return {
                "success": False,
                "error": "Tarea padre no encontrada"
            }
        
        # Crear subtarea usando crear_tarea
        subtask_args = {
            "title": arguments["title"],
            "description": arguments.get("description", ""),
            "parent_task_id": parent_task_id
        }
        
        return await self.crear_tarea(tool, subtask_args)
    
    async def obtener_estadisticas(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Obtiene estadísticas del sistema"""
        period = arguments.get("period", "all")
        now = datetime.now()
        
        # Filtrar por período
        filtered_tasks = []
        if period == "day":
            cutoff = now - timedelta(days=1)
        elif period == "week":
            cutoff = now - timedelta(weeks=1)
        elif period == "month":
            cutoff = now - timedelta(days=30)
        else:
            cutoff = None
        
        for task in self.tasks.values():
            if cutoff is None or task.created_at >= cutoff:
                filtered_tasks.append(task)
        
        # Calcular estadísticas
        total = len(filtered_tasks)
        if total == 0:
            return {
                "success": True,
                "period": period,
                "message": "No hay tareas en el período especificado"
            }
        
        by_status = {}
        by_priority = {}
        overdue_count = 0
        completed_count = 0
        avg_progress = 0
        
        for task in filtered_tasks:
            # Por estado
            status = task.status.value
            by_status[status] = by_status.get(status, 0) + 1
            
            # Por prioridad
            priority = task.priority.value
            by_priority[priority] = by_priority.get(priority, 0) + 1
            
            # Vencidas
            if task.due_date and task.due_date < now and task.status != TaskStatus.COMPLETED:
                overdue_count += 1
            
            # Completadas
            if task.status == TaskStatus.COMPLETED:
                completed_count += 1
            
            # Progreso promedio
            avg_progress += task.progress
        
        avg_progress = avg_progress / total if total > 0 else 0
        completion_rate = (completed_count / total * 100) if total > 0 else 0
        
        return {
            "success": True,
            "period": period,
            "statistics": {
                "total_tasks": total,
                "by_status": by_status,
                "by_priority": by_priority,
                "overdue_tasks": overdue_count,
                "completion_rate": round(completion_rate, 2),
                "average_progress": round(avg_progress, 2),
                "productivity_score": round((completion_rate + avg_progress) / 2, 2)
            }
        }
    
    async def buscar_tareas(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Busca tareas por texto"""
        query = arguments.get("query", "").lower()
        search_in = arguments.get("search_in", ["title", "description"])
        
        if not query:
            return {
                "success": False,
                "error": "Query de búsqueda requerido"
            }
        
        results = []
        
        for task in self.tasks.values():
            match = False
            
            if "title" in search_in and query in task.title.lower():
                match = True
            
            if "description" in search_in and query in task.description.lower():
                match = True
            
            if "tags" in search_in:
                for tag in task.tags:
                    if query in tag.lower():
                        match = True
                        break
            
            if match:
                results.append(task.to_dict())
        
        return {
            "success": True,
            "query": query,
            "search_fields": search_in,
            "results_count": len(results),
            "results": results
        }
    
    async def exportar_tareas(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Exporta tareas"""
        format_type = arguments.get("format", "json")
        filter_status = arguments.get("filter_status")
        
        # Filtrar tareas
        tasks_to_export = []
        for task in self.tasks.values():
            if filter_status and task.status.value != filter_status:
                continue
            tasks_to_export.append(task.to_dict())
        
        if format_type == "json":
            export_data = {
                "exported_at": datetime.now().isoformat(),
                "total_tasks": len(tasks_to_export),
                "tasks": tasks_to_export
            }
            
            return {
                "success": True,
                "format": "json",
                "data": export_data
            }
        
        elif format_type == "csv":
            # Convertir a formato CSV simple
            csv_lines = ["id,title,status,priority,progress,created_at,due_date,assigned_to"]
            
            for task in tasks_to_export:
                line = f"{task['id']},{task['title']},{task['status']},{task['priority']},{task['progress']},{task['created_at']},{task['due_date'] or ''},{task['assigned_to'] or ''}"
                csv_lines.append(line)
            
            return {
                "success": True,
                "format": "csv",
                "data": "\n".join(csv_lines)
            }
        
        else:
            return {
                "success": False,
                "error": f"Formato no soportado: {format_type}"
            }
    
    async def importar_tareas(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Importa tareas desde datos"""
        data = arguments.get("data", [])
        overwrite = arguments.get("overwrite", False)
        
        if not isinstance(data, list):
            return {
                "success": False,
                "error": "Los datos deben ser un array de tareas"
            }
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for task_data in data:
            try:
                task_id = task_data.get("id", str(uuid.uuid4()))
                
                # Verificar si existe
                if task_id in self.tasks and not overwrite:
                    skipped_count += 1
                    continue
                
                # Crear tarea
                task = Task(
                    id=task_id,
                    title=task_data.get("title", "Tarea importada"),
                    description=task_data.get("description", ""),
                    status=TaskStatus(task_data.get("status", "pending")),
                    priority=TaskPriority(task_data.get("priority", "medium")),
                    created_at=datetime.fromisoformat(task_data.get("created_at", datetime.now().isoformat())),
                    updated_at=datetime.now(),
                    due_date=datetime.fromisoformat(task_data["due_date"]) if task_data.get("due_date") else None,
                    assigned_to=task_data.get("assigned_to"),
                    tags=task_data.get("tags", []),
                    progress=task_data.get("progress", 0),
                    parent_task_id=task_data.get("parent_task_id"),
                    subtasks=task_data.get("subtasks", [])
                )
                
                self.tasks[task_id] = task
                imported_count += 1
            
            except Exception as e:
                errors.append(f"Error importando tarea {task_data.get('id', 'unknown')}: {str(e)}")
        
        if self.auto_save:
            await self._save_tasks()
        
        return {
            "success": True,
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": errors
        }
    
    async def _save_tasks(self):
        """Guarda tareas en archivo"""
        try:
            tasks_data = {
                "saved_at": datetime.now().isoformat(),
                "tasks": {task_id: task.to_dict() for task_id, task in self.tasks.items()}
            }
            
            with open(self.task_file, 'w', encoding='utf-8') as f:
                json.dump(tasks_data, f, indent=2, ensure_ascii=False)
        
        except Exception as e:
            print(f"Error guardando tareas: {e}")
    
    async def _load_tasks(self):
        """Carga tareas desde archivo"""
        try:
            with open(self.task_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for task_id, task_data in data.get("tasks", {}).items():
                task = Task(
                    id=task_data["id"],
                    title=task_data["title"],
                    description=task_data["description"],
                    status=TaskStatus(task_data["status"]),
                    priority=TaskPriority(task_data["priority"]),
                    created_at=datetime.fromisoformat(task_data["created_at"]),
                    updated_at=datetime.fromisoformat(task_data["updated_at"]),
                    due_date=datetime.fromisoformat(task_data["due_date"]) if task_data.get("due_date") else None,
                    assigned_to=task_data.get("assigned_to"),
                    tags=task_data.get("tags", []),
                    progress=task_data.get("progress", 0),
                    parent_task_id=task_data.get("parent_task_id"),
                    subtasks=task_data.get("subtasks", [])
                )
                self.tasks[task_id] = task
        
        except FileNotFoundError:
            pass  # Archivo no existe, empezar con tareas vacías
        except Exception as e:
            print(f"Error cargando tareas: {e}")
    
    async def initialize(self) -> bool:
        """Inicializa el plugin"""
        print(f"📋 Inicializando {self.name} v{self.version}")
        await self._load_tasks()
        return True
    
    async def shutdown(self) -> bool:
        """Cierra el plugin"""
        print(f"📋 Cerrando {self.name}")
        if self.auto_save:
            await self._save_tasks()
        return True

def create_plugin() -> MCPPlugin:
    """Función requerida para crear instancia del plugin"""
    return TaskManagerPlugin()