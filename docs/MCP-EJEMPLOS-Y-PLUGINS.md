# Ejemplos de Uso y Desarrollo de Plugins MCP

Este documento proporciona ejemplos prácticos de uso del sistema MCP (Model Context Protocol) y guías completas para desarrollar nuevos plugins.

## 📁 Estructura de Archivos

```
examples/
├── mcp_complete_example.py      # Ejemplo completo del sistema
├── mcp_basic_example.py         # Ejemplo básico
├── mcp_demo_application.py      # Aplicación de demostración
├── mcp_web_application.py       # Aplicación web completa con interfaz
├── plugins/
│   ├── notification_plugin.py  # Plugin de notificaciones
│   ├── data_analysis_plugin.py # Plugin de análisis de datos
│   └── task_manager_plugin.py  # Plugin de gestión de tareas
└── README.md                    # Documentación de ejemplos
```

## Tabla de Contenidos

1. [Ejemplos de Uso del Sistema MCP](#ejemplos-de-uso-del-sistema-mcp)
2. [Desarrollo de Plugins MCP](#desarrollo-de-plugins-mcp)
3. [Ejemplos de Plugins Avanzados](#ejemplos-de-plugins-avanzados)
4. [Mejores Prácticas](#mejores-prácticas)
5. [Troubleshooting](#troubleshooting)

---

## Ejemplos de Uso del Sistema MCP

### 1. Uso Básico del Sistema MCP

#### Inicialización Simple

```python
import asyncio
from src.mcp.core.integration import MCPIntegrationSystem

async def ejemplo_basico():
    # Crear instancia del sistema MCP
    mcp_system = MCPIntegrationSystem()
    
    # Inicializar el sistema
    await mcp_system.initialize()
    
    # Verificar estado del sistema
    status = await mcp_system.get_system_status()
    print(f"Sistema MCP inicializado: {status}")
    
    # Listar herramientas disponibles
    tools = await mcp_system.list_tools()
    print(f"Herramientas disponibles: {[tool.name for tool in tools]}")
    
    # Cerrar el sistema
    await mcp_system.shutdown()

# Ejecutar ejemplo
asyncio.run(ejemplo_basico())
```

#### Uso de Herramientas

```python
async def ejemplo_uso_herramientas():
    mcp_system = MCPIntegrationSystem()
    await mcp_system.initialize()
    
    try:
        # Usar herramienta de eco
        result = await mcp_system.call_tool("echo", {"message": "Hola MCP!"})
        print(f"Resultado: {result}")
        
        # Usar herramienta de timestamp
        timestamp_result = await mcp_system.call_tool("timestamp", {})
        print(f"Timestamp: {timestamp_result}")
        
        # Usar herramienta de UUID
        uuid_result = await mcp_system.call_tool("uuid", {})
        print(f"UUID generado: {uuid_result}")
        
    except Exception as e:
        print(f"Error al usar herramientas: {e}")
    
    finally:
        await mcp_system.shutdown()

asyncio.run(ejemplo_uso_herramientas())
```

### 2. Integración con Aplicaciones Web

#### Servidor Web con MCP

```python
from aiohttp import web, web_request
import json

class MCPWebServer:
    def __init__(self):
        self.mcp_system = MCPIntegrationSystem()
        self.app = web.Application()
        self.setup_routes()
    
    def setup_routes(self):
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/tools', self.list_tools)
        self.app.router.add_post('/tools/{tool_name}', self.execute_tool)
        self.app.router.add_get('/status', self.system_status)
    
    async def health_check(self, request: web_request.Request):
        return web.json_response({"status": "healthy"})
    
    async def list_tools(self, request: web_request.Request):
        tools = await self.mcp_system.list_tools()
        tools_data = [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters
            }
            for tool in tools
        ]
        return web.json_response({"tools": tools_data})
    
    async def execute_tool(self, request: web_request.Request):
        tool_name = request.match_info['tool_name']
        
        try:
            data = await request.json()
            arguments = data.get('arguments', {})
            
            result = await self.mcp_system.call_tool(tool_name, arguments)
            return web.json_response({"success": True, "result": result})
            
        except Exception as e:
            return web.json_response(
                {"success": False, "error": str(e)}, 
                status=400
            )
    
    async def system_status(self, request: web_request.Request):
        status = await self.mcp_system.get_system_status()
        return web.json_response(status)
    
    async def start_server(self, host='localhost', port=8080):
        await self.mcp_system.initialize()
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, host, port)
        await site.start()
        print(f"Servidor MCP iniciado en http://{host}:{port}")

# Uso del servidor
async def main():
    server = MCPWebServer()
    await server.start_server()
    
    # Mantener el servidor corriendo
    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        print("Cerrando servidor...")

asyncio.run(main())
```

### 3. Aplicación Web Completa

El archivo <mcfile name="mcp_web_application.py" path="examples/mcp_web_application.py"></mcfile> demuestra una integración completa del sistema MCP en una aplicación web usando `aiohttp`:

**Características principales:**
- Interfaz web moderna con HTML/CSS/JavaScript
- API REST completa para interactuar con MCP
- WebSocket para eventos en tiempo real
- Demos interactivos de todos los plugins
- Gestión dinámica de plugins
- Ejecutor de herramientas en tiempo real

**Cómo ejecutar:**
```python
# Ejecutar la aplicación web
python examples/mcp_web_application.py

# Abrir navegador en http://localhost:8080
```

**Endpoints disponibles:**
- `GET /` - Interfaz web principal
- `GET /api/mcp/status` - Estado del sistema
- `GET /api/mcp/plugins` - Lista de plugins
- `GET /api/mcp/tools` - Lista de herramientas
- `POST /api/mcp/tools/{tool_name}/execute` - Ejecutar herramienta
- `GET /ws` - WebSocket para eventos en tiempo real

### 4. Cliente MCP para Consumir Servicios

```python
import aiohttp
import asyncio

class MCPClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def get_available_tools(self):
        async with self.session.get(f"{self.base_url}/tools") as response:
            data = await response.json()
            return data.get('tools', [])
    
    async def execute_tool(self, tool_name: str, arguments: dict):
        payload = {"arguments": arguments}
        async with self.session.post(
            f"{self.base_url}/tools/{tool_name}",
            json=payload
        ) as response:
            return await response.json()
    
    async def get_system_status(self):
        async with self.session.get(f"{self.base_url}/status") as response:
            return await response.json()

# Ejemplo de uso del cliente
async def ejemplo_cliente():
    async with MCPClient("http://localhost:8080") as client:
        # Obtener herramientas disponibles
        tools = await client.get_available_tools()
        print("Herramientas disponibles:")
        for tool in tools:
            print(f"- {tool['name']}: {tool['description']}")
        
        # Ejecutar herramienta
        result = await client.execute_tool("echo", {"message": "Hola desde cliente!"})
        print(f"Resultado: {result}")
        
        # Verificar estado del sistema
        status = await client.get_system_status()
        print(f"Estado del sistema: {status}")

asyncio.run(ejemplo_cliente())
```

---

## 🔌 Plugins de Ejemplo Desarrollados

### 1. Plugin de Notificaciones
<mcfile name="notification_plugin.py" path="examples/plugins/notification_plugin.py"></mcfile>

**Funcionalidades:**
- Crear, listar y gestionar notificaciones
- Diferentes tipos de notificaciones (info, warning, error, success)
- Sistema de suscripciones para clientes
- Procesamiento de notificaciones programadas
- Estadísticas y métricas del sistema

**Herramientas disponibles:**
- `crear_notificacion` - Crear nueva notificación
- `listar_notificaciones` - Listar notificaciones con filtros
- `marcar_como_leida` - Marcar notificación como leída
- `eliminar_notificacion` - Eliminar notificación
- `obtener_estadisticas` - Estadísticas del sistema
- `procesar_programadas` - Procesar notificaciones programadas
- `suscribir_cliente` - Suscribir cliente a notificaciones

### 2. Plugin de Análisis de Datos
<mcfile name="data_analysis_plugin.py" path="examples/plugins/data_analysis_plugin.py"></mcfile>

**Funcionalidades:**
- Carga y gestión de datasets
- Análisis estadístico completo
- Filtrado y agrupación de datos
- Detección de anomalías
- Generación de reportes automáticos
- Datasets de ejemplo para pruebas

**Herramientas disponibles:**
- `cargar_dataset` - Cargar datos desde JSON
- `generar_dataset_ejemplo` - Crear datasets de prueba
- `analisis_estadistico` - Estadísticas descriptivas
- `filtrar_datos` - Filtrar datos con criterios
- `agrupar_datos` - Agrupar y agregar datos
- `detectar_anomalias` - Detectar valores atípicos
- `generar_reporte` - Reporte completo del dataset
- `buscar_datos` - Búsqueda en datasets

### 3. Plugin de Gestión de Tareas
<mcfile name="task_manager_plugin.py" path="examples/plugins/task_manager_plugin.py"></mcfile>

**Funcionalidades:**
- Sistema completo de gestión de tareas
- Jerarquías de tareas (tareas padre/hijo)
- Estados y prioridades configurables
- Seguimiento de progreso
- Persistencia en archivos JSON
- Estadísticas y reportes
- Búsqueda y filtrado avanzado

**Herramientas disponibles:**
- `crear_tarea` - Crear nueva tarea
- `listar_tareas` - Listar con filtros
- `obtener_tarea` - Detalles de tarea específica
- `actualizar_tarea` - Modificar tarea existente
- `eliminar_tarea` - Eliminar tarea
- `agregar_subtarea` - Crear subtarea
- `obtener_estadisticas` - Estadísticas del sistema
- `buscar_tareas` - Búsqueda por texto
- `exportar_tareas` - Exportar en JSON/CSV
- `importar_tareas` - Importar desde datos

## 🛠️ Desarrollo de Plugins MCP

### 1. Estructura Básica de un Plugin

#### Plantilla de Plugin

```python
from typing import Dict, Any, List
from dataclasses import dataclass
from src.mcp.core.resource_manager import MCPTool, MCPPlugin

@dataclass
class MiPlugin(MCPPlugin):
    """Plugin de ejemplo que demuestra la estructura básica"""
    
    name: str = "mi_plugin"
    version: str = "1.0.0"
    description: str = "Plugin de ejemplo para demostrar funcionalidades"
    author: str = "Tu Nombre"
    
    def get_tools(self) -> List[MCPTool]:
        """Retorna la lista de herramientas proporcionadas por este plugin"""
        return [
            MCPTool(
                name="saludo",
                description="Genera un saludo personalizado",
                parameters={
                    "nombre": {
                        "type": "string",
                        "description": "Nombre de la persona a saludar",
                        "required": True
                    },
                    "idioma": {
                        "type": "string",
                        "description": "Idioma del saludo (es, en, fr)",
                        "required": False,
                        "default": "es"
                    }
                },
                handler=self.generar_saludo
            ),
            MCPTool(
                name="calcular",
                description="Realiza operaciones matemáticas básicas",
                parameters={
                    "operacion": {
                        "type": "string",
                        "description": "Operación a realizar (suma, resta, multiplicacion, division)",
                        "required": True
                    },
                    "a": {
                        "type": "number",
                        "description": "Primer número",
                        "required": True
                    },
                    "b": {
                        "type": "number",
                        "description": "Segundo número",
                        "required": True
                    }
                },
                handler=self.calcular
            )
        ]
    
    async def generar_saludo(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para la herramienta de saludo"""
        nombre = arguments.get("nombre", "Usuario")
        idioma = arguments.get("idioma", "es")
        
        saludos = {
            "es": f"¡Hola {nombre}! ¿Cómo estás?",
            "en": f"Hello {nombre}! How are you?",
            "fr": f"Bonjour {nombre}! Comment allez-vous?"
        }
        
        saludo = saludos.get(idioma, saludos["es"])
        
        return {
            "saludo": saludo,
            "idioma_usado": idioma,
            "nombre": nombre
        }
    
    async def calcular(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para la herramienta de cálculo"""
        operacion = arguments.get("operacion", "").lower()
        a = float(arguments.get("a", 0))
        b = float(arguments.get("b", 0))
        
        operaciones = {
            "suma": lambda x, y: x + y,
            "resta": lambda x, y: x - y,
            "multiplicacion": lambda x, y: x * y,
            "division": lambda x, y: x / y if y != 0 else None
        }
        
        if operacion not in operaciones:
            raise ValueError(f"Operación '{operacion}' no soportada")
        
        if operacion == "division" and b == 0:
            raise ValueError("División por cero no permitida")
        
        resultado = operaciones[operacion](a, b)
        
        return {
            "operacion": operacion,
            "operandos": {"a": a, "b": b},
            "resultado": resultado
        }
    
    async def initialize(self) -> bool:
        """Inicialización del plugin"""
        print(f"Inicializando plugin: {self.name} v{self.version}")
        return True
    
    async def shutdown(self) -> bool:
        """Limpieza del plugin"""
        print(f"Cerrando plugin: {self.name}")
        return True

# Función para crear instancia del plugin
def create_plugin() -> MCPPlugin:
    return MiPlugin()
```

### 2. Plugin con Estado y Configuración

```python
import json
import os
from typing import Optional
from datetime import datetime

@dataclass
class PluginConEstado(MCPPlugin):
    """Plugin que mantiene estado y configuración"""
    
    name: str = "plugin_con_estado"
    version: str = "1.0.0"
    description: str = "Plugin que demuestra manejo de estado y configuración"
    
    def __post_init__(self):
        self.config_file = "plugin_config.json"
        self.state = {
            "contador": 0,
            "ultimo_acceso": None,
            "configuracion": {}
        }
        self.load_config()
    
    def load_config(self):
        """Carga configuración desde archivo"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    self.state["configuracion"] = json.load(f)
            except Exception as e:
                print(f"Error cargando configuración: {e}")
    
    def save_config(self):
        """Guarda configuración a archivo"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.state["configuracion"], f, indent=2)
        except Exception as e:
            print(f"Error guardando configuración: {e}")
    
    def get_tools(self) -> List[MCPTool]:
        return [
            MCPTool(
                name="incrementar_contador",
                description="Incrementa un contador interno",
                parameters={},
                handler=self.incrementar_contador
            ),
            MCPTool(
                name="obtener_estado",
                description="Obtiene el estado actual del plugin",
                parameters={},
                handler=self.obtener_estado
            ),
            MCPTool(
                name="configurar",
                description="Configura parámetros del plugin",
                parameters={
                    "clave": {
                        "type": "string",
                        "description": "Clave de configuración",
                        "required": True
                    },
                    "valor": {
                        "type": "string",
                        "description": "Valor de configuración",
                        "required": True
                    }
                },
                handler=self.configurar
            )
        ]
    
    async def incrementar_contador(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        self.state["contador"] += 1
        self.state["ultimo_acceso"] = datetime.now().isoformat()
        
        return {
            "contador": self.state["contador"],
            "ultimo_acceso": self.state["ultimo_acceso"]
        }
    
    async def obtener_estado(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "estado_completo": self.state,
            "plugin_info": {
                "name": self.name,
                "version": self.version,
                "description": self.description
            }
        }
    
    async def configurar(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        clave = arguments.get("clave")
        valor = arguments.get("valor")
        
        self.state["configuracion"][clave] = valor
        self.save_config()
        
        return {
            "mensaje": f"Configuración '{clave}' establecida",
            "configuracion_actual": self.state["configuracion"]
        }

def create_plugin() -> MCPPlugin:
    return PluginConEstado()
```

### 3. Plugin con Dependencias Externas

```python
import aiohttp
import asyncio
from typing import Optional

@dataclass
class PluginHTTP(MCPPlugin):
    """Plugin que realiza peticiones HTTP"""
    
    name: str = "http_plugin"
    version: str = "1.0.0"
    description: str = "Plugin para realizar peticiones HTTP"
    
    def __post_init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def initialize(self) -> bool:
        """Inicializa la sesión HTTP"""
        self.session = aiohttp.ClientSession()
        return True
    
    async def shutdown(self) -> bool:
        """Cierra la sesión HTTP"""
        if self.session:
            await self.session.close()
        return True
    
    def get_tools(self) -> List[MCPTool]:
        return [
            MCPTool(
                name="http_get",
                description="Realiza una petición GET HTTP",
                parameters={
                    "url": {
                        "type": "string",
                        "description": "URL para la petición",
                        "required": True
                    },
                    "headers": {
                        "type": "object",
                        "description": "Headers adicionales",
                        "required": False
                    }
                },
                handler=self.http_get
            ),
            MCPTool(
                name="http_post",
                description="Realiza una petición POST HTTP",
                parameters={
                    "url": {
                        "type": "string",
                        "description": "URL para la petición",
                        "required": True
                    },
                    "data": {
                        "type": "object",
                        "description": "Datos a enviar",
                        "required": False
                    },
                    "headers": {
                        "type": "object",
                        "description": "Headers adicionales",
                        "required": False
                    }
                },
                handler=self.http_post
            )
        ]
    
    async def http_get(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if not self.session:
            raise RuntimeError("Plugin no inicializado")
        
        url = arguments.get("url")
        headers = arguments.get("headers", {})
        
        try:
            async with self.session.get(url, headers=headers) as response:
                content = await response.text()
                return {
                    "status_code": response.status,
                    "headers": dict(response.headers),
                    "content": content,
                    "url": str(response.url)
                }
        except Exception as e:
            raise RuntimeError(f"Error en petición GET: {str(e)}")
    
    async def http_post(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if not self.session:
            raise RuntimeError("Plugin no inicializado")
        
        url = arguments.get("url")
        data = arguments.get("data", {})
        headers = arguments.get("headers", {})
        
        try:
            async with self.session.post(url, json=data, headers=headers) as response:
                content = await response.text()
                return {
                    "status_code": response.status,
                    "headers": dict(response.headers),
                    "content": content,
                    "url": str(response.url)
                }
        except Exception as e:
            raise RuntimeError(f"Error en petición POST: {str(e)}")

def create_plugin() -> MCPPlugin:
    return PluginHTTP()
```

---

## Ejemplos de Plugins Avanzados

### 1. Plugin de Base de Datos

```python
import sqlite3
import aiosqlite
from typing import List, Dict, Any

@dataclass
class DatabasePlugin(MCPPlugin):
    """Plugin para operaciones de base de datos SQLite"""
    
    name: str = "database_plugin"
    version: str = "1.0.0"
    description: str = "Plugin para operaciones con base de datos SQLite"
    
    def __post_init__(self):
        self.db_path = "plugin_database.db"
        self.connection = None
    
    async def initialize(self) -> bool:
        """Inicializa la conexión a la base de datos"""
        try:
            self.connection = await aiosqlite.connect(self.db_path)
            await self.create_tables()
            return True
        except Exception as e:
            print(f"Error inicializando base de datos: {e}")
            return False
    
    async def shutdown(self) -> bool:
        """Cierra la conexión a la base de datos"""
        if self.connection:
            await self.connection.close()
        return True
    
    async def create_tables(self):
        """Crea las tablas necesarias"""
        await self.connection.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        await self.connection.commit()
    
    def get_tools(self) -> List[MCPTool]:
        return [
            MCPTool(
                name="crear_usuario",
                description="Crea un nuevo usuario en la base de datos",
                parameters={
                    "nombre": {
                        "type": "string",
                        "description": "Nombre del usuario",
                        "required": True
                    },
                    "email": {
                        "type": "string",
                        "description": "Email del usuario",
                        "required": True
                    }
                },
                handler=self.crear_usuario
            ),
            MCPTool(
                name="obtener_usuarios",
                description="Obtiene lista de usuarios",
                parameters={
                    "limite": {
                        "type": "number",
                        "description": "Número máximo de usuarios a retornar",
                        "required": False,
                        "default": 10
                    }
                },
                handler=self.obtener_usuarios
            ),
            MCPTool(
                name="buscar_usuario",
                description="Busca un usuario por email",
                parameters={
                    "email": {
                        "type": "string",
                        "description": "Email del usuario a buscar",
                        "required": True
                    }
                },
                handler=self.buscar_usuario
            )
        ]
    
    async def crear_usuario(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        nombre = arguments.get("nombre")
        email = arguments.get("email")
        
        try:
            cursor = await self.connection.execute(
                "INSERT INTO usuarios (nombre, email) VALUES (?, ?)",
                (nombre, email)
            )
            await self.connection.commit()
            
            return {
                "success": True,
                "usuario_id": cursor.lastrowid,
                "mensaje": f"Usuario '{nombre}' creado exitosamente"
            }
        except sqlite3.IntegrityError:
            return {
                "success": False,
                "error": f"El email '{email}' ya existe"
            }
    
    async def obtener_usuarios(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        limite = arguments.get("limite", 10)
        
        cursor = await self.connection.execute(
            "SELECT id, nombre, email, fecha_creacion FROM usuarios LIMIT ?",
            (limite,)
        )
        usuarios = await cursor.fetchall()
        
        return {
            "usuarios": [
                {
                    "id": row[0],
                    "nombre": row[1],
                    "email": row[2],
                    "fecha_creacion": row[3]
                }
                for row in usuarios
            ],
            "total": len(usuarios)
        }
    
    async def buscar_usuario(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        email = arguments.get("email")
        
        cursor = await self.connection.execute(
            "SELECT id, nombre, email, fecha_creacion FROM usuarios WHERE email = ?",
            (email,)
        )
        usuario = await cursor.fetchone()
        
        if usuario:
            return {
                "encontrado": True,
                "usuario": {
                    "id": usuario[0],
                    "nombre": usuario[1],
                    "email": usuario[2],
                    "fecha_creacion": usuario[3]
                }
            }
        else:
            return {
                "encontrado": False,
                "mensaje": f"Usuario con email '{email}' no encontrado"
            }

def create_plugin() -> MCPPlugin:
    return DatabasePlugin()
```

### 2. Plugin de Procesamiento de Archivos

```python
import os
import json
import csv
from pathlib import Path
from typing import List, Dict, Any

@dataclass
class FileProcessingPlugin(MCPPlugin):
    """Plugin para procesamiento de archivos"""
    
    name: str = "file_processing_plugin"
    version: str = "1.0.0"
    description: str = "Plugin para operaciones de procesamiento de archivos"
    
    def __post_init__(self):
        self.allowed_extensions = {'.txt', '.json', '.csv', '.md'}
        self.max_file_size = 10 * 1024 * 1024  # 10MB
    
    def get_tools(self) -> List[MCPTool]:
        return [
            MCPTool(
                name="leer_archivo",
                description="Lee el contenido de un archivo",
                parameters={
                    "ruta": {
                        "type": "string",
                        "description": "Ruta del archivo a leer",
                        "required": True
                    },
                    "encoding": {
                        "type": "string",
                        "description": "Codificación del archivo",
                        "required": False,
                        "default": "utf-8"
                    }
                },
                handler=self.leer_archivo
            ),
            MCPTool(
                name="escribir_archivo",
                description="Escribe contenido a un archivo",
                parameters={
                    "ruta": {
                        "type": "string",
                        "description": "Ruta del archivo a escribir",
                        "required": True
                    },
                    "contenido": {
                        "type": "string",
                        "description": "Contenido a escribir",
                        "required": True
                    },
                    "encoding": {
                        "type": "string",
                        "description": "Codificación del archivo",
                        "required": False,
                        "default": "utf-8"
                    }
                },
                handler=self.escribir_archivo
            ),
            MCPTool(
                name="procesar_csv",
                description="Procesa un archivo CSV y retorna estadísticas",
                parameters={
                    "ruta": {
                        "type": "string",
                        "description": "Ruta del archivo CSV",
                        "required": True
                    },
                    "delimitador": {
                        "type": "string",
                        "description": "Delimitador del CSV",
                        "required": False,
                        "default": ","
                    }
                },
                handler=self.procesar_csv
            ),
            MCPTool(
                name="listar_directorio",
                description="Lista el contenido de un directorio",
                parameters={
                    "ruta": {
                        "type": "string",
                        "description": "Ruta del directorio",
                        "required": True
                    },
                    "recursivo": {
                        "type": "boolean",
                        "description": "Buscar recursivamente",
                        "required": False,
                        "default": False
                    }
                },
                handler=self.listar_directorio
            )
        ]
    
    def _validar_archivo(self, ruta: str) -> tuple[bool, str]:
        """Valida si un archivo es seguro para procesar"""
        path = Path(ruta)
        
        if not path.exists():
            return False, "El archivo no existe"
        
        if path.suffix.lower() not in self.allowed_extensions:
            return False, f"Extensión no permitida. Permitidas: {self.allowed_extensions}"
        
        if path.stat().st_size > self.max_file_size:
            return False, f"Archivo demasiado grande (máximo {self.max_file_size} bytes)"
        
        return True, ""
    
    async def leer_archivo(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        ruta = arguments.get("ruta")
        encoding = arguments.get("encoding", "utf-8")
        
        valido, error = self._validar_archivo(ruta)
        if not valido:
            return {"success": False, "error": error}
        
        try:
            with open(ruta, 'r', encoding=encoding) as f:
                contenido = f.read()
            
            return {
                "success": True,
                "contenido": contenido,
                "tamaño": len(contenido),
                "lineas": contenido.count('\n') + 1
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def escribir_archivo(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        ruta = arguments.get("ruta")
        contenido = arguments.get("contenido")
        encoding = arguments.get("encoding", "utf-8")
        
        try:
            # Crear directorio si no existe
            Path(ruta).parent.mkdir(parents=True, exist_ok=True)
            
            with open(ruta, 'w', encoding=encoding) as f:
                f.write(contenido)
            
            return {
                "success": True,
                "mensaje": f"Archivo '{ruta}' escrito exitosamente",
                "tamaño": len(contenido)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def procesar_csv(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        ruta = arguments.get("ruta")
        delimitador = arguments.get("delimitador", ",")
        
        valido, error = self._validar_archivo(ruta)
        if not valido:
            return {"success": False, "error": error}
        
        try:
            with open(ruta, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter=delimitador)
                filas = list(reader)
            
            if not filas:
                return {"success": False, "error": "El archivo CSV está vacío"}
            
            columnas = list(filas[0].keys())
            estadisticas = {
                "total_filas": len(filas),
                "total_columnas": len(columnas),
                "columnas": columnas,
                "muestra_datos": filas[:5]  # Primeras 5 filas
            }
            
            return {
                "success": True,
                "estadisticas": estadisticas
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def listar_directorio(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        ruta = arguments.get("ruta")
        recursivo = arguments.get("recursivo", False)
        
        try:
            path = Path(ruta)
            if not path.exists():
                return {"success": False, "error": "El directorio no existe"}
            
            if not path.is_dir():
                return {"success": False, "error": "La ruta no es un directorio"}
            
            archivos = []
            directorios = []
            
            if recursivo:
                for item in path.rglob("*"):
                    if item.is_file():
                        archivos.append(str(item.relative_to(path)))
                    elif item.is_dir():
                        directorios.append(str(item.relative_to(path)))
            else:
                for item in path.iterdir():
                    if item.is_file():
                        archivos.append(item.name)
                    elif item.is_dir():
                        directorios.append(item.name)
            
            return {
                "success": True,
                "archivos": sorted(archivos),
                "directorios": sorted(directorios),
                "total_archivos": len(archivos),
                "total_directorios": len(directorios)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

def create_plugin() -> MCPPlugin:
    return FileProcessingPlugin()
```

---

## Mejores Prácticas

### 1. Seguridad

- **Validación de Entrada**: Siempre valida los parámetros de entrada
- **Sanitización**: Limpia y valida datos antes de procesarlos
- **Límites de Recursos**: Establece límites para evitar abuso
- **Manejo de Errores**: Nunca expongas información sensible en errores

```python
def validar_parametros(self, arguments: Dict[str, Any], schema: Dict[str, Any]) -> tuple[bool, str]:
    """Valida parámetros contra un esquema"""
    for param, config in schema.items():
        if config.get("required", False) and param not in arguments:
            return False, f"Parámetro requerido '{param}' faltante"
        
        if param in arguments:
            valor = arguments[param]
            tipo_esperado = config.get("type")
            
            if tipo_esperado == "string" and not isinstance(valor, str):
                return False, f"Parámetro '{param}' debe ser string"
            elif tipo_esperado == "number" and not isinstance(valor, (int, float)):
                return False, f"Parámetro '{param}' debe ser número"
    
    return True, ""
```

### 2. Rendimiento

- **Operaciones Asíncronas**: Usa async/await para operaciones I/O
- **Pooling de Conexiones**: Reutiliza conexiones cuando sea posible
- **Caché**: Implementa caché para operaciones costosas
- **Límites de Tiempo**: Establece timeouts para operaciones

```python
import asyncio
from functools import lru_cache

class PluginOptimizado(MCPPlugin):
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 300  # 5 minutos
    
    @lru_cache(maxsize=128)
    def operacion_costosa_sync(self, parametro: str) -> str:
        """Operación costosa con caché"""
        # Simulación de operación costosa
        return f"Resultado para {parametro}"
    
    async def operacion_con_timeout(self, operacion, timeout=30):
        """Ejecuta operación con timeout"""
        try:
            return await asyncio.wait_for(operacion, timeout=timeout)
        except asyncio.TimeoutError:
            raise RuntimeError(f"Operación excedió timeout de {timeout}s")
```

### 3. Logging y Monitoreo

```python
import logging
from datetime import datetime

class PluginConLogging(MCPPlugin):
    def __init__(self):
        self.logger = logging.getLogger(f"mcp.plugin.{self.name}")
        self.metrics = {
            "llamadas_totales": 0,
            "errores": 0,
            "tiempo_promedio": 0
        }
    
    async def ejecutar_con_metricas(self, handler, tool, arguments):
        """Wrapper que agrega métricas y logging"""
        inicio = datetime.now()
        self.metrics["llamadas_totales"] += 1
        
        try:
            self.logger.info(f"Ejecutando {tool.name} con argumentos: {arguments}")
            resultado = await handler(tool, arguments)
            
            tiempo_ejecucion = (datetime.now() - inicio).total_seconds()
            self.metrics["tiempo_promedio"] = (
                (self.metrics["tiempo_promedio"] * (self.metrics["llamadas_totales"] - 1) + tiempo_ejecucion) 
                / self.metrics["llamadas_totales"]
            )
            
            self.logger.info(f"Herramienta {tool.name} ejecutada exitosamente en {tiempo_ejecucion:.2f}s")
            return resultado
            
        except Exception as e:
            self.metrics["errores"] += 1
            self.logger.error(f"Error ejecutando {tool.name}: {str(e)}")
            raise
```

### 4. Testing

```python
import pytest
import asyncio

class TestMiPlugin:
    @pytest.fixture
    async def plugin(self):
        plugin = MiPlugin()
        await plugin.initialize()
        yield plugin
        await plugin.shutdown()
    
    @pytest.mark.asyncio
    async def test_saludo_basico(self, plugin):
        tool = plugin.get_tools()[0]  # herramienta saludo
        resultado = await plugin.generar_saludo(tool, {"nombre": "Test"})
        
        assert "saludo" in resultado
        assert "Test" in resultado["saludo"]
        assert resultado["idioma_usado"] == "es"
    
    @pytest.mark.asyncio
    async def test_calculo_suma(self, plugin):
        tool = plugin.get_tools()[1]  # herramienta calcular
        resultado = await plugin.calcular(tool, {
            "operacion": "suma",
            "a": 5,
            "b": 3
        })
        
        assert resultado["resultado"] == 8
        assert resultado["operacion"] == "suma"
    
    @pytest.mark.asyncio
    async def test_division_por_cero(self, plugin):
        tool = plugin.get_tools()[1]
        
        with pytest.raises(ValueError, match="División por cero"):
            await plugin.calcular(tool, {
                "operacion": "division",
                "a": 5,
                "b": 0
            })
```

---

## Troubleshooting

### Problemas Comunes

#### 1. Plugin No Se Carga

**Síntomas**: El plugin no aparece en la lista de herramientas

**Soluciones**:
- Verificar que el archivo del plugin esté en el directorio correcto
- Comprobar que la función `create_plugin()` existe y retorna una instancia válida
- Revisar logs de error durante la inicialización

#### 2. Errores de Inicialización

**Síntomas**: El plugin falla al inicializar

**Soluciones**:
```python
async def initialize(self) -> bool:
    try:
        # Tu código de inicialización
        return True
    except Exception as e:
        self.logger.error(f"Error inicializando plugin: {e}")
        return False
```

#### 3. Herramientas No Responden

**Síntomas**: Las herramientas del plugin no ejecutan correctamente

**Soluciones**:
- Verificar que los handlers están correctamente definidos
- Comprobar la validación de parámetros
- Revisar que los handlers son funciones async

#### 4. Problemas de Rendimiento

**Síntomas**: El plugin es lento o consume muchos recursos

**Soluciones**:
- Implementar operaciones asíncronas
- Agregar timeouts a operaciones largas
- Usar caché para operaciones repetitivas
- Limitar el tamaño de datos procesados

### Debugging

```python
import traceback

class PluginConDebug(MCPPlugin):
    def __init__(self):
        self.debug_mode = True
    
    async def debug_handler(self, handler, tool, arguments):
        if self.debug_mode:
            print(f"DEBUG: Ejecutando {tool.name}")
            print(f"DEBUG: Argumentos: {arguments}")
        
        try:
            resultado = await handler(tool, arguments)
            if self.debug_mode:
                print(f"DEBUG: Resultado: {resultado}")
            return resultado
        except Exception as e:
            if self.debug_mode:
                print(f"DEBUG: Error: {e}")
                traceback.print_exc()
            raise
```

---

## Conclusión

Este documento proporciona una guía completa para usar el sistema MCP y desarrollar plugins personalizados. Los ejemplos cubren desde casos básicos hasta implementaciones avanzadas con bases de datos y procesamiento de archivos.

### Próximos Pasos

1. **Experimenta** con los ejemplos básicos
2. **Desarrolla** tu primer plugin personalizado
3. **Implementa** las mejores prácticas de seguridad y rendimiento
4. **Contribuye** con nuevos plugins al ecosistema MCP

### Recursos Adicionales

- Documentación del sistema MCP: `docs/MCP-README.md`
- Ejemplos de código: `examples/`
- Tests de referencia: `tests/test_mcp_system.py`
- Plugins existentes: `src/mcp/plugins/`

¡Feliz desarrollo con MCP! 🚀