"""
Ejemplo avanzado: Aplicación web con MCP
Este ejemplo demuestra cómo integrar el sistema MCP en una aplicación web real
usando aiohttp, con múltiples plugins y una interfaz REST completa.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List
from aiohttp import web, WSMsgType
from aiohttp.web_ws import WebSocketResponse
import aiohttp_cors

# Importar sistema MCP
from src.mcp.core.integration_system import MCPIntegrationSystem
from src.mcp.core.resource_manager import MCPPluginManager, MCPToolManager

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MCPWebApplication:
    """Aplicación web que integra el sistema MCP"""
    
    def __init__(self):
        self.app = web.Application()
        self.mcp_system = None
        self.websocket_connections: List[WebSocketResponse] = []
        self.setup_routes()
        self.setup_cors()
    
    def setup_cors(self):
        """Configura CORS para permitir requests desde frontend"""
        cors = aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Agregar CORS a todas las rutas
        for route in list(self.app.router.routes()):
            cors.add(route)
    
    def setup_routes(self):
        """Configura las rutas de la aplicación"""
        # Rutas estáticas
        self.app.router.add_get('/', self.index)
        self.app.router.add_get('/health', self.health_check)
        
        # API MCP
        self.app.router.add_get('/api/mcp/status', self.mcp_status)
        self.app.router.add_get('/api/mcp/plugins', self.list_plugins)
        self.app.router.add_get('/api/mcp/tools', self.list_tools)
        self.app.router.add_post('/api/mcp/tools/{tool_name}/execute', self.execute_tool)
        
        # Gestión de plugins
        self.app.router.add_post('/api/mcp/plugins/load', self.load_plugin)
        self.app.router.add_post('/api/mcp/plugins/{plugin_name}/unload', self.unload_plugin)
        self.app.router.add_get('/api/mcp/plugins/{plugin_name}/info', self.plugin_info)
        
        # WebSocket para eventos en tiempo real
        self.app.router.add_get('/ws', self.websocket_handler)
        
        # Rutas específicas para demos
        self.app.router.add_get('/api/demo/filesystem', self.demo_filesystem)
        self.app.router.add_get('/api/demo/notifications', self.demo_notifications)
        self.app.router.add_get('/api/demo/tasks', self.demo_tasks)
        self.app.router.add_get('/api/demo/analytics', self.demo_analytics)
    
    async def initialize_mcp(self):
        """Inicializa el sistema MCP"""
        try:
            self.mcp_system = MCPIntegrationSystem()
            
            # Cargar plugins básicos
            plugins_to_load = [
                "src.mcp.plugins.filesystem_plugin",
                "src.mcp.plugins.utility_tools_plugin",
                "examples.plugins.notification_plugin",
                "examples.plugins.task_manager_plugin",
                "examples.plugins.data_analysis_plugin"
            ]
            
            for plugin_module in plugins_to_load:
                try:
                    await self.mcp_system.load_plugin(plugin_module)
                    logger.info(f"Plugin cargado: {plugin_module}")
                except Exception as e:
                    logger.warning(f"No se pudo cargar plugin {plugin_module}: {e}")
            
            logger.info("Sistema MCP inicializado correctamente")
            await self.broadcast_event("mcp_initialized", {"status": "ready"})
            
        except Exception as e:
            logger.error(f"Error inicializando MCP: {e}")
            raise
    
    async def index(self, request):
        """Página principal con interfaz web"""
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>MCP Web Application</title>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                .tool-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
                .tool-card { padding: 15px; border: 1px solid #ccc; border-radius: 5px; background: #f9f9f9; }
                .btn { padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
                .btn:hover { background: #0056b3; }
                .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
                .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .log { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; }
                input, textarea, select { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
                .demo-section { background: #e7f3ff; border-left: 4px solid #007bff; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 MCP Web Application</h1>
                    <p>Sistema de Comunicación de Protocolos Múltiples - Interfaz Web</p>
                    <div id="connection-status" class="status">Conectando...</div>
                </div>
                
                <div class="section">
                    <h2>📊 Estado del Sistema</h2>
                    <button class="btn" onclick="checkStatus()">Verificar Estado</button>
                    <button class="btn" onclick="loadPlugins()">Cargar Plugins</button>
                    <button class="btn" onclick="loadTools()">Cargar Herramientas</button>
                    <div id="system-info"></div>
                </div>
                
                <div class="section demo-section">
                    <h2>🎮 Demos Interactivos</h2>
                    <div class="tool-grid">
                        <div class="tool-card">
                            <h3>📁 Sistema de Archivos</h3>
                            <p>Gestión de archivos y directorios</p>
                            <button class="btn" onclick="runDemo('filesystem')">Ejecutar Demo</button>
                        </div>
                        <div class="tool-card">
                            <h3>🔔 Notificaciones</h3>
                            <p>Sistema de notificaciones en tiempo real</p>
                            <button class="btn" onclick="runDemo('notifications')">Ejecutar Demo</button>
                        </div>
                        <div class="tool-card">
                            <h3>📋 Gestión de Tareas</h3>
                            <p>Sistema completo de tareas</p>
                            <button class="btn" onclick="runDemo('tasks')">Ejecutar Demo</button>
                        </div>
                        <div class="tool-card">
                            <h3>📈 Análisis de Datos</h3>
                            <p>Procesamiento y estadísticas</p>
                            <button class="btn" onclick="runDemo('analytics')">Ejecutar Demo</button>
                        </div>
                    </div>
                </div>
                
                <div class="section">
                    <h2>🛠️ Ejecutor de Herramientas</h2>
                    <div>
                        <select id="tool-select">
                            <option value="">Seleccionar herramienta...</option>
                        </select>
                        <textarea id="tool-params" placeholder='{"param1": "value1", "param2": "value2"}'></textarea>
                        <button class="btn" onclick="executeTool()">Ejecutar Herramienta</button>
                    </div>
                    <div id="tool-result"></div>
                </div>
                
                <div class="section">
                    <h2>📝 Log de Eventos</h2>
                    <button class="btn" onclick="clearLog()">Limpiar Log</button>
                    <div id="event-log" class="log"></div>
                </div>
            </div>
            
            <script>
                let ws = null;
                let tools = [];
                
                // Conectar WebSocket
                function connectWebSocket() {
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const wsUrl = protocol + '//' + window.location.host + '/ws';
                    
                    ws = new WebSocket(wsUrl);
                    
                    ws.onopen = function() {
                        updateConnectionStatus('Conectado', 'success');
                        log('WebSocket conectado');
                    };
                    
                    ws.onmessage = function(event) {
                        const data = JSON.parse(event.data);
                        log('Evento recibido: ' + JSON.stringify(data, null, 2));
                    };
                    
                    ws.onclose = function() {
                        updateConnectionStatus('Desconectado', 'error');
                        log('WebSocket desconectado');
                        // Reconectar después de 3 segundos
                        setTimeout(connectWebSocket, 3000);
                    };
                    
                    ws.onerror = function(error) {
                        updateConnectionStatus('Error de conexión', 'error');
                        log('Error WebSocket: ' + error);
                    };
                }
                
                function updateConnectionStatus(message, type) {
                    const statusEl = document.getElementById('connection-status');
                    statusEl.textContent = message;
                    statusEl.className = 'status ' + type;
                }
                
                function log(message) {
                    const logEl = document.getElementById('event-log');
                    const timestamp = new Date().toLocaleTimeString();
                    logEl.innerHTML += '[' + timestamp + '] ' + message + '\\n';
                    logEl.scrollTop = logEl.scrollHeight;
                }
                
                function clearLog() {
                    document.getElementById('event-log').innerHTML = '';
                }
                
                async function apiCall(url, options = {}) {
                    try {
                        const response = await fetch(url, {
                            headers: {
                                'Content-Type': 'application/json',
                                ...options.headers
                            },
                            ...options
                        });
                        return await response.json();
                    } catch (error: any) {
                        log('Error API: ' + error.message);
                        return { success: false, error: error.message };
                    }
                }
                
                async function checkStatus() {
                    const result = await apiCall('/api/mcp/status');
                    document.getElementById('system-info').innerHTML = 
                        '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
                }
                
                async function loadPlugins() {
                    const result = await apiCall('/api/mcp/plugins');
                    log('Plugins cargados: ' + result.plugins?.length || 0);
                }
                
                async function loadTools() {
                    const result = await apiCall('/api/mcp/tools');
                    tools = result.tools || [];
                    
                    const select = document.getElementById('tool-select');
                    select.innerHTML = '<option value="">Seleccionar herramienta...</option>';
                    
                    tools.forEach(tool => {
                        const option = document.createElement('option');
                        option.value = tool.name;
                        option.textContent = tool.name + ' - ' + tool.description;
                        select.appendChild(option);
                    });
                    
                    log('Herramientas cargadas: ' + tools.length);
                }
                
                async function executeTool() {
                    const toolName = document.getElementById('tool-select').value;
                    const paramsText = document.getElementById('tool-params').value;
                    
                    if (!toolName) {
                        alert('Seleccione una herramienta');
                        return;
                    }
                    
                    let params = {};
                    if (paramsText.trim()) {
                        try {
                            params = JSON.parse(paramsText);
                        } catch (e) {
                            alert('Parámetros JSON inválidos');
                            return;
                        }
                    }
                    
                    const result = await apiCall('/api/mcp/tools/' + toolName + '/execute', {
                        method: 'POST',
                        body: JSON.stringify(params)
                    });
                    
                    document.getElementById('tool-result').innerHTML = 
                        '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
                }
                
                async function runDemo(type) {
                    const result = await apiCall('/api/demo/' + type);
                    log('Demo ' + type + ' ejecutado');
                    
                    // Mostrar resultado en modal o sección específica
                    alert('Demo ejecutado. Ver log para detalles.');
                }
                
                // Inicializar aplicación
                window.onload = function() {
                    connectWebSocket();
                    checkStatus();
                    loadPlugins();
                    loadTools();
                };
            </script>
        </body>
        </html>
        """
        return web.Response(text=html_content, content_type='text/html')
    
    async def health_check(self, request):
        """Endpoint de verificación de salud"""
        return web.json_response({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "mcp_status": "ready" if self.mcp_system else "not_initialized"
        })
    
    async def mcp_status(self, request):
        """Estado del sistema MCP"""
        if not self.mcp_system:
            return web.json_response({
                "success": False,
                "error": "Sistema MCP no inicializado"
            })
        
        try:
            plugins = await self.mcp_system.list_plugins()
            tools = await self.mcp_system.list_tools()
            
            return web.json_response({
                "success": True,
                "status": "ready",
                "plugins_count": len(plugins),
                "tools_count": len(tools),
                "websocket_connections": len(self.websocket_connections)
            })
        
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            })
    
    async def list_plugins(self, request):
        """Lista plugins disponibles"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        try:
            plugins = await self.mcp_system.list_plugins()
            return web.json_response({
                "success": True,
                "plugins": plugins
            })
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def list_tools(self, request):
        """Lista herramientas disponibles"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        try:
            tools = await self.mcp_system.list_tools()
            return web.json_response({
                "success": True,
                "tools": tools
            })
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def execute_tool(self, request):
        """Ejecuta una herramienta específica"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        tool_name = request.match_info['tool_name']
        
        try:
            # Obtener parámetros del body
            if request.content_type == 'application/json':
                params = await request.json()
            else:
                params = {}
            
            # Ejecutar herramienta
            result = await self.mcp_system.call_tool(tool_name, params)
            
            # Broadcast del evento
            await self.broadcast_event("tool_executed", {
                "tool_name": tool_name,
                "params": params,
                "result": result
            })
            
            return web.json_response(result)
        
        except Exception as e:
            error_result = {"success": False, "error": str(e)}
            return web.json_response(error_result)
    
    async def load_plugin(self, request):
        """Carga un plugin dinámicamente"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        try:
            data = await request.json()
            plugin_module = data.get("module")
            
            if not plugin_module:
                return web.json_response({
                    "success": False,
                    "error": "Módulo de plugin requerido"
                })
            
            result = await self.mcp_system.load_plugin(plugin_module)
            
            await self.broadcast_event("plugin_loaded", {
                "module": plugin_module,
                "result": result
            })
            
            return web.json_response(result)
        
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def unload_plugin(self, request):
        """Descarga un plugin"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        plugin_name = request.match_info['plugin_name']
        
        try:
            result = await self.mcp_system.unload_plugin(plugin_name)
            
            await self.broadcast_event("plugin_unloaded", {
                "plugin_name": plugin_name,
                "result": result
            })
            
            return web.json_response(result)
        
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def plugin_info(self, request):
        """Información detallada de un plugin"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        plugin_name = request.match_info['plugin_name']
        
        try:
            # Obtener información del plugin
            plugins = await self.mcp_system.list_plugins()
            plugin_info = next((p for p in plugins if p["name"] == plugin_name), None)
            
            if not plugin_info:
                return web.json_response({
                    "success": False,
                    "error": "Plugin no encontrado"
                })
            
            # Obtener herramientas del plugin
            tools = await self.mcp_system.list_tools()
            plugin_tools = [t for t in tools if t.get("plugin") == plugin_name]
            
            return web.json_response({
                "success": True,
                "plugin": plugin_info,
                "tools": plugin_tools
            })
        
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def websocket_handler(self, request):
        """Manejador de WebSocket para eventos en tiempo real"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        self.websocket_connections.append(ws)
        logger.info(f"Nueva conexión WebSocket. Total: {len(self.websocket_connections)}")
        
        try:
            # Enviar mensaje de bienvenida
            await ws.send_str(json.dumps({
                "type": "welcome",
                "message": "Conectado al sistema MCP",
                "timestamp": datetime.now().isoformat()
            }))
            
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        # Procesar mensajes del cliente si es necesario
                        logger.info(f"Mensaje WebSocket recibido: {data}")
                    except json.JSONDecodeError:
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Formato JSON inválido"
                        }))
                elif msg.type == WSMsgType.ERROR:
                    logger.error(f"Error WebSocket: {ws.exception()}")
        
        except Exception as e:
            logger.error(f"Error en WebSocket: {e}")
        
        finally:
            if ws in self.websocket_connections:
                self.websocket_connections.remove(ws)
            logger.info(f"Conexión WebSocket cerrada. Total: {len(self.websocket_connections)}")
        
        return ws
    
    async def broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Envía un evento a todas las conexiones WebSocket"""
        if not self.websocket_connections:
            return
        
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        # Enviar a todas las conexiones activas
        disconnected = []
        for ws in self.websocket_connections:
            try:
                await ws.send_str(json.dumps(message))
            except Exception as e:
                logger.warning(f"Error enviando mensaje WebSocket: {e}")
                disconnected.append(ws)
        
        # Remover conexiones desconectadas
        for ws in disconnected:
            if ws in self.websocket_connections:
                self.websocket_connections.remove(ws)
    
    # Métodos de demo
    async def demo_filesystem(self, request):
        """Demo del sistema de archivos"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        try:
            # Ejecutar varias operaciones de filesystem
            results = []
            
            # Listar directorio actual
            result1 = await self.mcp_system.call_tool("list_directory", {"path": "."})
            results.append({"operation": "list_directory", "result": result1})
            
            # Crear archivo de prueba
            result2 = await self.mcp_system.call_tool("write_file", {
                "path": "demo_file.txt",
                "content": "Este es un archivo de demo creado desde la web app"
            })
            results.append({"operation": "write_file", "result": result2})
            
            # Leer archivo
            result3 = await self.mcp_system.call_tool("read_file", {"path": "demo_file.txt"})
            results.append({"operation": "read_file", "result": result3})
            
            await self.broadcast_event("demo_completed", {
                "demo_type": "filesystem",
                "results": results
            })
            
            return web.json_response({
                "success": True,
                "demo": "filesystem",
                "operations": results
            })
        
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def demo_notifications(self, request):
        """Demo del sistema de notificaciones"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        try:
            results = []
            
            # Crear notificación
            result1 = await self.mcp_system.call_tool("crear_notificacion", {
                "titulo": "Demo Web App",
                "mensaje": "Esta es una notificación de prueba desde la aplicación web",
                "tipo": "info"
            })
            results.append({"operation": "crear_notificacion", "result": result1})
            
            # Listar notificaciones
            result2 = await self.mcp_system.call_tool("listar_notificaciones", {})
            results.append({"operation": "listar_notificaciones", "result": result2})
            
            # Obtener estadísticas
            result3 = await self.mcp_system.call_tool("obtener_estadisticas", {})
            results.append({"operation": "obtener_estadisticas", "result": result3})
            
            await self.broadcast_event("demo_completed", {
                "demo_type": "notifications",
                "results": results
            })
            
            return web.json_response({
                "success": True,
                "demo": "notifications",
                "operations": results
            })
        
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def demo_tasks(self, request):
        """Demo del sistema de tareas"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        try:
            results = []
            
            # Crear tarea principal
            result1 = await self.mcp_system.call_tool("crear_tarea", {
                "title": "Proyecto Demo Web",
                "description": "Tarea principal del proyecto de demostración",
                "priority": "high"
            })
            results.append({"operation": "crear_tarea", "result": result1})
            
            # Crear subtarea
            if result1.get("success") and result1.get("task_id"):
                result2 = await self.mcp_system.call_tool("agregar_subtarea", {
                    "parent_task_id": result1["task_id"],
                    "title": "Implementar interfaz web",
                    "description": "Crear la interfaz web para el sistema MCP"
                })
                results.append({"operation": "agregar_subtarea", "result": result2})
            
            # Listar tareas
            result3 = await self.mcp_system.call_tool("listar_tareas", {})
            results.append({"operation": "listar_tareas", "result": result3})
            
            # Obtener estadísticas
            result4 = await self.mcp_system.call_tool("obtener_estadisticas", {})
            results.append({"operation": "obtener_estadisticas", "result": result4})
            
            await self.broadcast_event("demo_completed", {
                "demo_type": "tasks",
                "results": results
            })
            
            return web.json_response({
                "success": True,
                "demo": "tasks",
                "operations": results
            })
        
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    async def demo_analytics(self, request):
        """Demo del sistema de análisis de datos"""
        if not self.mcp_system:
            return web.json_response({"success": False, "error": "MCP no inicializado"})
        
        try:
            results = []
            
            # Generar dataset de ejemplo
            result1 = await self.mcp_system.call_tool("generar_dataset_ejemplo", {
                "type": "sales",
                "size": 50
            })
            results.append({"operation": "generar_dataset_ejemplo", "result": result1})
            
            if result1.get("success") and result1.get("dataset_name"):
                dataset_name = result1["dataset_name"]
                
                # Análisis estadístico
                result2 = await self.mcp_system.call_tool("analisis_estadistico", {
                    "dataset_name": dataset_name,
                    "column": "sales"
                })
                results.append({"operation": "analisis_estadistico", "result": result2})
                
                # Agrupar datos
                result3 = await self.mcp_system.call_tool("agrupar_datos", {
                    "dataset_name": dataset_name,
                    "group_by": "region",
                    "metric_column": "sales",
                    "operation": "sum"
                })
                results.append({"operation": "agrupar_datos", "result": result3})
                
                # Detectar anomalías
                result4 = await self.mcp_system.call_tool("detectar_anomalias", {
                    "dataset_name": dataset_name,
                    "column": "sales"
                })
                results.append({"operation": "detectar_anomalias", "result": result4})
                
                # Generar reporte
                result5 = await self.mcp_system.call_tool("generar_reporte", {
                    "dataset_name": dataset_name
                })
                results.append({"operation": "generar_reporte", "result": result5})
            
            await self.broadcast_event("demo_completed", {
                "demo_type": "analytics",
                "results": results
            })
            
            return web.json_response({
                "success": True,
                "demo": "analytics",
                "operations": results
            })
        
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

async def create_app():
    """Crea y configura la aplicación"""
    app_instance = MCPWebApplication()
    
    # Inicializar MCP
    await app_instance.initialize_mcp()
    
    return app_instance.app

async def main():
    """Función principal para ejecutar la aplicación"""
    # Crear aplicación
    app = await create_app()
    
    # Configurar y ejecutar servidor
    runner = web.AppRunner(app)
    await runner.setup()
    
    site = web.TCPSite(runner, 'localhost', 8080)
    await site.start()
    
    print("🌐 Aplicación web MCP iniciada en http://localhost:8080")
    print("📊 Interfaz web disponible para interactuar con el sistema MCP")
    print("🔌 WebSocket habilitado para eventos en tiempo real")
    print("⚡ Presiona Ctrl+C para detener el servidor")
    
    try:
        # Mantener el servidor ejecutándose
        await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo servidor...")
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())