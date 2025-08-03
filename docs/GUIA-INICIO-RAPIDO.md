# Guía de Inicio Rápido - Sistema MCP

## 🚀 Inicio Rápido

### 1. Ejecutar Ejemplos Básicos

```bash
# Ejemplo básico del sistema MCP
python examples/mcp_basic_example.py

# Ejemplo completo con múltiples plugins
python examples/mcp_complete_example.py

# Aplicación de demostración interactiva
python examples/mcp_demo_application.py
```

### 2. Aplicación Web Interactiva

```bash
# Ejecutar aplicación web completa
python examples/mcp_web_application.py

# Abrir navegador en: http://localhost:8080
```

**Características de la aplicación web:**
- 🌐 Interfaz web moderna y responsiva
- 🔧 Ejecutor de herramientas en tiempo real
- 📊 Demos interactivos de todos los plugins
- 🔌 Gestión dinámica de plugins
- 📡 WebSocket para eventos en tiempo real
- 📈 Monitoreo del estado del sistema

### 3. Plugins Disponibles

#### 📁 Plugin de Sistema de Archivos
```python
# Listar directorio
await mcp_system.call_tool("list_directory", {"path": "."})

# Leer archivo
await mcp_system.call_tool("read_file", {"path": "archivo.txt"})

# Escribir archivo
await mcp_system.call_tool("write_file", {
    "path": "nuevo_archivo.txt",
    "content": "Contenido del archivo"
})
```

#### 🔔 Plugin de Notificaciones
```python
# Crear notificación
await mcp_system.call_tool("crear_notificacion", {
    "titulo": "Nueva Notificación",
    "mensaje": "Este es el contenido de la notificación",
    "tipo": "info"
})

# Listar notificaciones
await mcp_system.call_tool("listar_notificaciones", {
    "tipo": "info",
    "leidas": False
})
```

#### 📋 Plugin de Gestión de Tareas
```python
# Crear tarea
await mcp_system.call_tool("crear_tarea", {
    "title": "Nueva Tarea",
    "description": "Descripción de la tarea",
    "priority": "high"
})

# Listar tareas
await mcp_system.call_tool("listar_tareas", {
    "status": "pending"
})

# Actualizar progreso
await mcp_system.call_tool("actualizar_tarea", {
    "task_id": "task_id_aqui",
    "progress": 50
})
```

#### 📊 Plugin de Análisis de Datos
```python
# Generar dataset de ejemplo
await mcp_system.call_tool("generar_dataset_ejemplo", {
    "type": "sales",
    "size": 100
})

# Análisis estadístico
await mcp_system.call_tool("analisis_estadistico", {
    "dataset_name": "sales_example",
    "column": "sales"
})

# Detectar anomalías
await mcp_system.call_tool("detectar_anomalias", {
    "dataset_name": "sales_example",
    "column": "sales",
    "method": "iqr"
})
```

## 🔧 Configuración del Entorno

### Dependencias Requeridas

```bash
# Instalar dependencias principales
pip install asyncio-mqtt aiohttp aiofiles websockets

# Para desarrollo y testing
pip install pytest pytest-asyncio

# Para aplicación web
pip install aiohttp-cors

# Para análisis de datos
pip install statistics
```

### Estructura del Proyecto

```
lemur-engine/
├── src/mcp/                     # Sistema MCP principal
│   ├── core/                    # Núcleo del sistema
│   └── plugins/                 # Plugins incluidos
├── examples/                    # Ejemplos y demos
│   ├── mcp_web_application.py   # Aplicación web completa
│   ├── mcp_demo_application.py  # Demo interactivo
│   └── plugins/                 # Plugins de ejemplo
├── tests/                       # Tests del sistema
└── docs/                        # Documentación
```

## 🎯 Casos de Uso Comunes

### 1. Integración en Aplicación Web
- Usar `mcp_web_application.py` como base
- Personalizar la interfaz según necesidades
- Agregar autenticación y autorización
- Implementar logging y monitoreo

### 2. Automatización de Tareas
- Usar el plugin de gestión de tareas
- Crear workflows automatizados
- Integrar con sistemas externos
- Programar tareas recurrentes

### 3. Procesamiento de Datos
- Usar el plugin de análisis de datos
- Cargar datos desde diferentes fuentes
- Aplicar transformaciones y análisis
- Generar reportes automáticos

### 4. Sistema de Notificaciones
- Implementar notificaciones en tiempo real
- Integrar con WebSocket para updates live
- Crear diferentes tipos de alertas
- Gestionar suscripciones de usuarios

## 🚨 Solución de Problemas Comunes

### Error: "Plugin no encontrado"
```python
# Verificar que el plugin esté en el path correcto
import sys
sys.path.append('path/to/plugin/directory')

# Cargar plugin con path completo
await mcp_system.load_plugin("examples.plugins.notification_plugin")
```

### Error: "Herramienta no disponible"
```python
# Listar herramientas disponibles
tools = await mcp_system.list_tools()
print([tool['name'] for tool in tools])

# Verificar que el plugin esté cargado
plugins = await mcp_system.list_plugins()
print([plugin['name'] for plugin in plugins])
```

### Error de conexión WebSocket
```javascript
// Verificar URL del WebSocket
const wsUrl = `ws://${window.location.host}/ws`;

// Implementar reconexión automática
function connectWithRetry() {
    const ws = new WebSocket(wsUrl);
    ws.onclose = () => {
        setTimeout(connectWithRetry, 3000);
    };
}
```

## 📚 Recursos Adicionales

- **Documentación completa:** `docs/MCP-EJEMPLOS-Y-PLUGINS.md`
- **Ejemplos de código:** Directorio `examples/`
- **Tests de referencia:** Directorio `tests/`
- **Plugins de ejemplo:** `examples/plugins/`

## 🤝 Contribuir

1. Fork del repositorio
2. Crear rama para nueva funcionalidad
3. Desarrollar y probar cambios
4. Crear pull request con descripción detallada

¡El sistema MCP está diseñado para ser extensible y fácil de usar! 🎉