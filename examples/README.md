# Ejemplos del Sistema MCP

Este directorio contiene ejemplos completos y documentación para el uso del Sistema de Protocolo de Comunicación de Modelos (MCP).

## 📚 Documentación Completa

### 🚀 Guías Principales
- **[Guía de Inicio Rápido](../docs/GUIA-INICIO-RAPIDO.md)** - Comenzar rápidamente con el sistema MCP
- **[Ejemplos y Plugins Completos](../docs/MCP-EJEMPLOS-Y-PLUGINS.md)** - Documentación detallada con ejemplos de uso y desarrollo de plugins
- **[Integraciones con Frameworks](INTEGRACIONES.md)** - Ejemplos de integración con FastAPI, Django, Flask, Celery y más

### 🔧 Ejemplos Prácticos

#### Aplicaciones de Demostración
- **[mcp_web_application.py](mcp_web_application.py)** - Aplicación web completa con interfaz moderna
- **[mcp_demo_application.py](mcp_demo_application.py)** - Demo interactivo del sistema MCP
- **[mcp_complete_example.py](mcp_complete_example.py)** - Ejemplo completo con múltiples plugins
- **[mcp_basic_example.py](mcp_basic_example.py)** - Ejemplo básico para comenzar

#### Plugins de Ejemplo
- **[notification_plugin.py](plugins/notification_plugin.py)** - Sistema completo de notificaciones
- **[task_manager_plugin.py](plugins/task_manager_plugin.py)** - Gestión avanzada de tareas
- **[data_analysis_plugin.py](plugins/data_analysis_plugin.py)** - Análisis y procesamiento de datos

## 🎯 Casos de Uso por Categoría

### 🌐 Aplicaciones Web
```bash
# Aplicación web completa con UI moderna
python mcp_web_application.py
# Acceder a: http://localhost:8080

# Demo interactivo
python mcp_demo_application.py
```

### 📊 Análisis de Datos
```python
# Cargar y analizar datasets
await mcp_system.call_tool("generar_dataset_ejemplo", {"type": "sales", "size": 100})
await mcp_system.call_tool("analisis_estadistico", {"dataset_name": "sales_example"})
```

### 📋 Gestión de Tareas
```python
# Sistema completo de tareas con jerarquías
await mcp_system.call_tool("crear_tarea", {
    "title": "Tarea Principal",
    "description": "Descripción detallada",
    "priority": "high"
})
```

### 🔔 Notificaciones
```python
# Sistema de notificaciones en tiempo real
await mcp_system.call_tool("crear_notificacion", {
    "titulo": "Alerta Importante",
    "mensaje": "Contenido de la notificación",
    "tipo": "warning"
})
```

## 🚀 Inicio Rápido

### 1. Ejecutar Ejemplo Básico
```bash
python mcp_basic_example.py
```

### 2. Aplicación Web Interactiva
```bash
python mcp_web_application.py
# Abrir: http://localhost:8080
```

### 3. Demo Completo
```bash
python mcp_demo_application.py
```

## 📁 Estructura de Archivos

```
examples/
├── README.md                    # Esta guía
├── INTEGRACIONES.md            # Ejemplos de integración con frameworks
├── mcp_web_application.py      # Aplicación web completa
├── mcp_demo_application.py     # Demo interactivo
├── mcp_complete_example.py     # Ejemplo completo
├── mcp_basic_example.py        # Ejemplo básico
├── plugins/                    # Plugins de ejemplo
│   ├── notification_plugin.py  # Sistema de notificaciones
│   ├── task_manager_plugin.py  # Gestión de tareas
│   └── data_analysis_plugin.py # Análisis de datos
└── [otros ejemplos...]
```

## 🔧 Configuración del Entorno

### Dependencias Principales
```bash
pip install asyncio-mqtt aiohttp aiofiles websockets aiohttp-cors
```

### Para Desarrollo
```bash
pip install pytest pytest-asyncio
```

## 🌟 Características Destacadas

### 🎨 Interfaz Web Moderna
- Diseño responsivo y moderno
- Ejecutor de herramientas en tiempo real
- WebSocket para actualizaciones live
- Demos interactivos de todos los plugins

### 🔌 Sistema de Plugins Extensible
- Plugins fáciles de desarrollar
- Carga dinámica de plugins
- Gestión de estado y configuración
- Manejo de errores robusto

### 📊 Monitoreo y Logging
- Logging estructurado
- Métricas de rendimiento
- Monitoreo de estado del sistema
- Debugging avanzado

### 🔒 Seguridad
- Validación de parámetros
- Manejo seguro de archivos
- Control de acceso a herramientas
- Sanitización de datos

## 🤝 Contribuir

1. **Fork** del repositorio
2. **Crear** rama para nueva funcionalidad
3. **Desarrollar** siguiendo las mejores prácticas
4. **Probar** con los ejemplos existentes
5. **Documentar** cambios y nuevas funcionalidades
6. **Crear** pull request

## 📞 Soporte

- **Documentación:** Revisar las guías en `/docs/`
- **Ejemplos:** Explorar los archivos en este directorio
- **Issues:** Reportar problemas en el repositorio
- **Discusiones:** Participar en las discusiones del proyecto

---

¡El sistema MCP está diseñado para ser potente, flexible y fácil de usar! 🎉

**Próximos pasos recomendados:**
1. 📖 Leer la [Guía de Inicio Rápido](../docs/GUIA-INICIO-RAPIDO.md)
2. 🚀 Ejecutar `mcp_web_application.py` para ver el sistema en acción
3. 🔧 Explorar los plugins de ejemplo
4. 🛠️ Desarrollar tu primer plugin personalizado
