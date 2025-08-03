# Sistema MCP (Model Context Protocol)

## Descripción

El sistema MCP (Model Context Protocol) es la implementación de la **Fase 5** del proyecto MPC, que proporciona integración avanzada con LLMs (Large Language Models) y sistemas de IA. MCP permite la exposición de recursos y herramientas del sistema a modelos de lenguaje de manera estandarizada y segura.

## Características Principales

### 🤖 Integración con LLMs
- Soporte para múltiples proveedores de IA (OpenAI, Anthropic, etc.)
- Protocolo estandarizado para comunicación con modelos
- Gestión de contexto y memoria conversacional

### 🔧 Sistema de Herramientas
- Registro dinámico de herramientas personalizadas
- Validación automática de argumentos
- Ejecución segura y controlada
- Métricas y estadísticas de uso

### 📁 Gestión de Recursos
- Acceso a archivos del sistema
- Recursos web (HTTP/HTTPS)
- Contenido JSON estructurado
- Cache inteligente con TTL

### 🔌 Sistema de Plugins
- Arquitectura extensible
- Plugins de recursos y herramientas
- Carga dinámica y hot-reload
- Gestión de dependencias

### 🛡️ Seguridad y Control
- Autenticación y autorización
- Rate limiting configurable
- Validación de entrada
- Logging de auditoría

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Sistema MCP                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ MCP Adapter │  │ MCP Client  │  │ Integration │         │
│  │             │  │             │  │   System    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Resource   │  │    Tool     │  │   Plugin    │         │
│  │  Manager    │  │  Manager    │  │   System    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ FileSystem  │  │  Utility    │  │   Custom    │         │
│  │   Plugin    │  │   Tools     │  │   Plugins   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Instalación

### Requisitos Previos
- Python 3.8+
- Sistema MPC base instalado

### Instalación de Dependencias
```bash
pip install -r requirements.txt
```

### Dependencias Opcionales
```bash
# Para integración con OpenAI
pip install openai>=1.3.0

# Para integración con Anthropic
pip install anthropic>=0.7.0

# Para características avanzadas
pip install sentence-transformers numpy pandas
```

## Configuración

### Configuración Básica
```python
from src.mcp.core.config import MCPConfig

config = MCPConfig()
config.server.host = "localhost"
config.server.port = 8080
config.enable_mcp = True
```

### Configuración desde Archivo JSON
```json
{
  "enable_mcp": true,
  "debug_mode": false,
  "server": {
    "host": "localhost",
    "port": 8080,
    "transport": "http",
    "max_connections": 100
  },
  "client": {
    "timeout": 30,
    "retry_attempts": 3
  },
  "security": {
    "enable_authentication": false,
    "enable_rate_limiting": true,
    "max_requests_per_minute": 1000
  }
}
```

## Uso Básico

### Inicialización del Sistema
```python
import asyncio
from src.mcp.core.integration import MCPIntegrationSystem
from src.mcp.core.config import MCPConfig

async def main():
    # Configuración
    config = MCPConfig()
    
    # Sistema de integración
    mcp_system = MCPIntegrationSystem(config)
    await mcp_system.start()
    
    # Tu código aquí...
    
    await mcp_system.stop()

asyncio.run(main())
```

### Registro de Recursos
```python
from src.mcp.adapters.mcp_adapter import MCPResource

# Recurso de archivo
resource = MCPResource(
    uri="file:///path/to/document.txt",
    name="Important Document",
    description="A document with important information",
    mime_type="text/plain"
)

await mcp_system.register_local_resource(resource)
```

### Registro de Herramientas
```python
from src.mcp.adapters.mcp_adapter import MCPTool

# Definir herramienta
tool = MCPTool(
    name="calculate_sum",
    description="Calculates the sum of two numbers",
    input_schema={
        "type": "object",
        "properties": {
            "a": {"type": "number"},
            "b": {"type": "number"}
        },
        "required": ["a", "b"]
    }
)

# Handler de la herramienta
async def sum_handler(arguments):
    return {"result": arguments["a"] + arguments["b"]}

await mcp_system.register_local_tool(tool, sum_handler)
```

### Uso de Plugins
```python
from src.mcp.core.plugin_system import MCPPluginManager
from src.mcp.plugins import FileSystemPlugin, UtilityToolsPlugin

# Plugin manager
plugin_manager = MCPPluginManager()

# Cargar plugins
filesystem_plugin = FileSystemPlugin()
utility_plugin = UtilityToolsPlugin()

await plugin_manager.load_plugin(filesystem_plugin)
await plugin_manager.load_plugin(utility_plugin)

# Registrar en el sistema MCP
await mcp_system.register_plugin_manager(plugin_manager)
```

## Plugins Incluidos

### FileSystemPlugin
Proporciona acceso a recursos del sistema de archivos:
- Listado de archivos y directorios
- Lectura de contenido de archivos
- Metadatos de archivos
- Filtrado por extensiones

### UtilityToolsPlugin
Herramientas de utilidad para IA:
- `hash_text`: Genera hash de texto
- `encode_base64`: Codificación Base64
- `decode_base64`: Decodificación Base64
- `validate_json`: Validación de JSON
- `format_json`: Formateo de JSON
- `generate_uuid`: Generación de UUID
- `current_timestamp`: Timestamp actual
- `analyze_text`: Análisis básico de texto

## Ejemplos

### Ejemplo Completo
```python
# Ver examples/mcp_complete_example.py
python examples/mcp_complete_example.py
```

### Integración con MPC
```python
# Ver examples/mpc_mcp_integration_example.py
python examples/mpc_mcp_integration_example.py
```

## API Reference

### MCPAdapter
```python
class MCPAdapter(ProtocolAdapter):
    async def start() -> None
    async def stop() -> None
    async def send_message(message: Message) -> bool
    async def receive_message() -> Optional[Message]
```

### MCPClient
```python
class MCPClient:
    async def connect(server_url: str) -> bool
    async def disconnect() -> None
    async def list_resources() -> List[MCPResource]
    async def read_resource(uri: str) -> ResourceContent
    async def list_tools() -> List[MCPTool]
    async def call_tool(name: str, arguments: Dict) -> ToolResult
```

### MCPIntegrationSystem
```python
class MCPIntegrationSystem:
    async def start() -> None
    async def stop() -> None
    async def register_local_resource(resource: MCPResource) -> None
    async def register_local_tool(tool: MCPTool, handler: Callable) -> None
    async def list_resources() -> List[MCPResource]
    async def list_tools() -> List[MCPTool]
```

## Testing

### Ejecutar Tests
```bash
# Tests unitarios
pytest tests/test_mcp_system.py -v

# Tests de integración
pytest tests/test_mcp_system.py::TestMCPIntegration -v

# Todos los tests
pytest tests/ -v
```

### Coverage
```bash
pytest --cov=src/mcp tests/
```

## Desarrollo

### Estructura del Proyecto
```
src/mcp/
├── adapters/           # Adaptadores de protocolo
│   ├── mcp_adapter.py
│   └── mcp_client.py
├── core/              # Componentes principales
│   ├── config.py
│   ├── integration.py
│   ├── plugin_system.py
│   └── resource_manager.py
├── plugins/           # Plugins incluidos
│   ├── filesystem_plugin.py
│   └── utility_tools_plugin.py
└── __init__.py
```

### Crear Plugin Personalizado
```python
from src.mcp.core.plugin_system import MCPPlugin

class MyCustomPlugin(MCPPlugin):
    def __init__(self):
        super().__init__("my_plugin", "1.0.0", "My Custom Plugin")
    
    async def initialize(self):
        # Inicialización del plugin
        pass
    
    async def shutdown(self):
        # Limpieza del plugin
        pass
```

## Monitoreo y Métricas

### Métricas Disponibles
- `mcp_requests_total`: Total de requests MCP
- `mcp_request_duration`: Duración de requests
- `mcp_active_connections`: Conexiones activas
- `mcp_resources_registered`: Recursos registrados
- `mcp_tools_registered`: Herramientas registradas
- `mcp_plugin_load_time`: Tiempo de carga de plugins

### Health Checks
- Estado del servidor MCP
- Conectividad con clientes
- Estado de plugins
- Disponibilidad de recursos

## Troubleshooting

### Problemas Comunes

#### MCP no está disponible
```
Error: MCP_AVAILABLE = False
```
**Solución**: Verificar que todas las dependencias MCP estén instaladas.

#### Error de conexión
```
Error: Cannot connect to MCP server
```
**Solución**: Verificar que el servidor MCP esté corriendo y el puerto esté disponible.

#### Plugin no carga
```
Error: Failed to load plugin
```
**Solución**: Verificar que el plugin implemente correctamente la interfaz MCPPlugin.

### Logs de Debug
```python
import logging
logging.basicConfig(level=logging.DEBUG)

config = MCPConfig()
config.debug_mode = True
config.log_level = MCPLogLevel.DEBUG
```

## Roadmap

### Versión Actual (5.0.0)
- ✅ Implementación básica de MCP
- ✅ Sistema de plugins
- ✅ Recursos y herramientas
- ✅ Integración con MPC

### Próximas Versiones
- 🔄 Integración con más proveedores de IA
- 🔄 Plugins avanzados (base de datos, APIs)
- 🔄 Interface web para gestión
- 🔄 Clustering y alta disponibilidad

## Contribución

### Cómo Contribuir
1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

### Estándares de Código
- Seguir PEP 8
- Documentar funciones y clases
- Incluir tests para nuevas funcionalidades
- Mantener cobertura de tests > 80%

## Licencia

Este proyecto está bajo la licencia MIT. Ver archivo LICENSE para más detalles.

## Soporte

- 📧 Email: support@lemur-engine.com
- 💬 Discord: [Lemur Engine Community](https://discord.gg/lemur-engine)
- 📖 Documentación: [docs.lemur-engine.com](https://docs.lemur-engine.com)
- 🐛 Issues: [GitHub Issues](https://github.com/lemur-engine/issues)

---

**Lemur Engine Team** - Sistema MPC v5.0.0 con MCP Integration