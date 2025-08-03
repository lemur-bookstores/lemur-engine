# Ejemplos de Integración MCP

## 🔗 Integración con FastAPI

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
import asyncio
from src.mcp.core.integration_system import MCPIntegrationSystem

app = FastAPI(title="MCP FastAPI Integration")
mcp_system = None

@app.on_event("startup")
async def startup_event():
    global mcp_system
    mcp_system = MCPIntegrationSystem()
    await mcp_system.initialize()
    
    # Cargar plugins
    await mcp_system.load_plugin("src.mcp.plugins.filesystem_plugin")
    await mcp_system.load_plugin("examples.plugins.notification_plugin")
    await mcp_system.load_plugin("examples.plugins.task_manager_plugin")

@app.on_event("shutdown")
async def shutdown_event():
    if mcp_system:
        await mcp_system.shutdown()

@app.get("/")
async def root():
    return {"message": "MCP FastAPI Integration", "status": "running"}

@app.get("/tools")
async def list_tools():
    """Listar todas las herramientas disponibles"""
    try:
        tools = await mcp_system.list_tools()
        return {"tools": tools}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tools/{tool_name}")
async def execute_tool(tool_name: str, arguments: dict):
    """Ejecutar una herramienta específica"""
    try:
        result = await mcp_system.call_tool(tool_name, arguments)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notifications")
async def get_notifications():
    """Obtener notificaciones"""
    try:
        result = await mcp_system.call_tool("listar_notificaciones", {})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notifications")
async def create_notification(notification: dict):
    """Crear nueva notificación"""
    try:
        result = await mcp_system.call_tool("crear_notificacion", notification)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks")
async def get_tasks():
    """Obtener tareas"""
    try:
        result = await mcp_system.call_tool("listar_tareas", {})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tasks")
async def create_task(task: dict):
    """Crear nueva tarea"""
    try:
        result = await mcp_system.call_tool("crear_tarea", task)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 🌐 Integración con Django

```python
# views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import asyncio
from asgiref.sync import sync_to_async
from src.mcp.core.integration_system import MCPIntegrationSystem

# Instancia global del sistema MCP
mcp_system = None

async def get_mcp_system():
    global mcp_system
    if mcp_system is None:
        mcp_system = MCPIntegrationSystem()
        await mcp_system.initialize()
        await mcp_system.load_plugin("src.mcp.plugins.filesystem_plugin")
        await mcp_system.load_plugin("examples.plugins.notification_plugin")
    return mcp_system

@csrf_exempt
@require_http_methods(["GET"])
def list_tools(request):
    """Listar herramientas disponibles"""
    async def _list_tools():
        system = await get_mcp_system()
        return await system.list_tools()
    
    try:
        tools = asyncio.run(_list_tools())
        return JsonResponse({"tools": tools})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def execute_tool(request, tool_name):
    """Ejecutar herramienta"""
    async def _execute_tool():
        system = await get_mcp_system()
        data = json.loads(request.body)
        return await system.call_tool(tool_name, data.get("arguments", {}))
    
    try:
        result = asyncio.run(_execute_tool())
        return JsonResponse({"result": result})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('mcp/tools/', views.list_tools, name='list_tools'),
    path('mcp/tools/<str:tool_name>/', views.execute_tool, name='execute_tool'),
]
```

## 🔄 Integración con Celery (Tareas Asíncronas)

```python
# tasks.py
from celery import Celery
import asyncio
from src.mcp.core.integration_system import MCPIntegrationSystem

app = Celery('mcp_tasks')

@app.task
def execute_mcp_tool(tool_name, arguments):
    """Ejecutar herramienta MCP como tarea de Celery"""
    async def _execute():
        mcp_system = MCPIntegrationSystem()
        await mcp_system.initialize()
        await mcp_system.load_plugin("examples.plugins.task_manager_plugin")
        
        try:
            result = await mcp_system.call_tool(tool_name, arguments)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            await mcp_system.shutdown()
    
    return asyncio.run(_execute())

@app.task
def process_scheduled_notifications():
    """Procesar notificaciones programadas"""
    async def _process():
        mcp_system = MCPIntegrationSystem()
        await mcp_system.initialize()
        await mcp_system.load_plugin("examples.plugins.notification_plugin")
        
        try:
            result = await mcp_system.call_tool("procesar_programadas", {})
            return result
        finally:
            await mcp_system.shutdown()
    
    return asyncio.run(_process())

# Programar tareas periódicas
from celery.schedules import crontab

app.conf.beat_schedule = {
    'process-notifications': {
        'task': 'tasks.process_scheduled_notifications',
        'schedule': crontab(minute='*/5'),  # Cada 5 minutos
    },
}
```

## 🐍 Integración con Flask

```python
from flask import Flask, request, jsonify
import asyncio
from src.mcp.core.integration_system import MCPIntegrationSystem

app = Flask(__name__)
mcp_system = None

def get_event_loop():
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop

@app.before_first_request
def initialize_mcp():
    global mcp_system
    
    async def _init():
        global mcp_system
        mcp_system = MCPIntegrationSystem()
        await mcp_system.initialize()
        await mcp_system.load_plugin("src.mcp.plugins.filesystem_plugin")
        await mcp_system.load_plugin("examples.plugins.notification_plugin")
    
    loop = get_event_loop()
    loop.run_until_complete(_init())

@app.route('/mcp/tools', methods=['GET'])
def list_tools():
    async def _list_tools():
        return await mcp_system.list_tools()
    
    try:
        loop = get_event_loop()
        tools = loop.run_until_complete(_list_tools())
        return jsonify({"tools": tools})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/tools/<tool_name>', methods=['POST'])
def execute_tool(tool_name):
    async def _execute_tool():
        data = request.get_json() or {}
        arguments = data.get("arguments", {})
        return await mcp_system.call_tool(tool_name, arguments)
    
    try:
        loop = get_event_loop()
        result = loop.run_until_complete(_execute_tool())
        return jsonify({"result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/files/<path:file_path>', methods=['GET'])
def read_file(file_path):
    async def _read_file():
        return await mcp_system.call_tool("read_file", {"path": file_path})
    
    try:
        loop = get_event_loop()
        result = loop.run_until_complete(_read_file())
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

## 📱 Cliente JavaScript/TypeScript

```typescript
// mcp-client.ts
interface MCPTool {
    name: string;
    description: string;
    parameters: any;
}

interface MCPResult {
    success: boolean;
    result?: any;
    error?: string;
}

class MCPClient {
    private baseUrl: string;
    private ws: WebSocket | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async listTools(): Promise<MCPTool[]> {
        const response = await fetch(`${this.baseUrl}/mcp/tools`);
        const data = await response.json();
        return data.tools;
    }

    async executeTool(toolName: string, arguments: any): Promise<MCPResult> {
        const response = await fetch(`${this.baseUrl}/mcp/tools/${toolName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ arguments }),
        });
        
        return await response.json();
    }

    connectWebSocket(onMessage?: (data: any) => void): void {
        const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket conectado');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (onMessage) {
                onMessage(data);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket desconectado');
            // Reconectar automáticamente
            setTimeout(() => this.connectWebSocket(onMessage), 3000);
        };
    }

    // Métodos específicos para plugins
    async createNotification(title: string, message: string, type: string = 'info') {
        return this.executeTool('crear_notificacion', {
            titulo: title,
            mensaje: message,
            tipo: type
        });
    }

    async listNotifications(filters: any = {}) {
        return this.executeTool('listar_notificaciones', filters);
    }

    async createTask(title: string, description: string, priority: string = 'medium') {
        return this.executeTool('crear_tarea', {
            title,
            description,
            priority
        });
    }

    async listTasks(filters: any = {}) {
        return this.executeTool('listar_tareas', filters);
    }

    async readFile(path: string) {
        return this.executeTool('read_file', { path });
    }

    async writeFile(path: string, content: string) {
        return this.executeTool('write_file', { path, content });
    }
}

// Uso del cliente
const client = new MCPClient('http://localhost:8000');

// Ejemplo de uso
async function example() {
    // Listar herramientas disponibles
    const tools = await client.listTools();
    console.log('Herramientas disponibles:', tools);

    // Crear notificación
    const notificationResult = await client.createNotification(
        'Test',
        'Esta es una notificación de prueba',
        'info'
    );
    console.log('Notificación creada:', notificationResult);

    // Crear tarea
    const taskResult = await client.createTask(
        'Nueva Tarea',
        'Descripción de la tarea',
        'high'
    );
    console.log('Tarea creada:', taskResult);

    // Conectar WebSocket para eventos en tiempo real
    client.connectWebSocket((data) => {
        console.log('Evento recibido:', data);
    });
}
```

## 🔧 Configuración de Producción

```python
# production_config.py
import os
from src.mcp.core.integration_system import MCPIntegrationSystem

class ProductionMCPSystem:
    def __init__(self):
        self.mcp_system = None
        self.config = {
            'redis_url': os.getenv('REDIS_URL', 'redis://localhost:6379'),
            'database_url': os.getenv('DATABASE_URL'),
            'log_level': os.getenv('LOG_LEVEL', 'INFO'),
            'max_workers': int(os.getenv('MAX_WORKERS', '4')),
        }

    async def initialize(self):
        self.mcp_system = MCPIntegrationSystem()
        await self.mcp_system.initialize()
        
        # Cargar plugins de producción
        plugins = [
            "src.mcp.plugins.filesystem_plugin",
            "examples.plugins.notification_plugin",
            "examples.plugins.task_manager_plugin",
            "examples.plugins.data_analysis_plugin",
        ]
        
        for plugin in plugins:
            try:
                await self.mcp_system.load_plugin(plugin)
                print(f"Plugin cargado: {plugin}")
            except Exception as e:
                print(f"Error cargando plugin {plugin}: {e}")

    async def health_check(self):
        """Verificar estado del sistema"""
        try:
            tools = await self.mcp_system.list_tools()
            plugins = await self.mcp_system.list_plugins()
            
            return {
                "status": "healthy",
                "tools_count": len(tools),
                "plugins_count": len(plugins),
                "plugins": [p["name"] for p in plugins]
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

# Docker Compose para producción
"""
version: '3.8'
services:
  mcp-app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@db:5432/mcpdb
      - LOG_LEVEL=INFO
    depends_on:
      - redis
      - db
    volumes:
      - ./data:/app/data

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=mcpdb
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
"""
```

Estos ejemplos muestran cómo integrar el sistema MCP con diferentes frameworks y tecnologías, proporcionando una base sólida para implementaciones en producción. 🚀