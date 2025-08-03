# Configuración Automática del Entorno MCP

Esta guía detalla cómo configurar automáticamente el entorno de desarrollo para el sistema MCP.

## 🚀 Instalación Rápida (Nuevo)

### Instaladores Automáticos

El sistema MCP ahora incluye instaladores automáticos que detectan el sistema operativo y configuran todo automáticamente.

#### Windows
```bash
# Instalador automático
install-windows.bat

# O directamente
python install.py
```

#### Linux/macOS
```bash
# Hacer ejecutable y ejecutar
chmod +x install-unix.sh
./install-unix.sh

# O directamente
python install.py
```

### Características de los Instaladores

- ✅ **Detección automática** del sistema operativo
- ✅ **Verificación de requisitos** (Python 3.8+, pip, etc.)
- ✅ **Instalación de dependencias** del sistema
- ✅ **Creación de entorno virtual** automática
- ✅ **Instalación de paquetes Python** desde requirements.txt
- ✅ **Configuración de archivos** .env automática
- ✅ **Scripts de activación** personalizados
- ✅ **Verificación post-instalación** integrada

## 📋 Scripts Disponibles

### `install.py` - Instalador Principal
Instalador multiplataforma inteligente que:

```bash
python install.py
```

**Funcionalidades:**
- Detecta Windows, Linux, macOS automáticamente
- Instala dependencias del sistema según la distribución
- Crea entorno virtual optimizado
- Configura archivos de entorno
- Genera scripts de activación personalizados
- Ejecuta verificación automática

### `verify-setup.py` - Verificador de Instalación
Valida que todo esté configurado correctamente:

```bash
python verify-setup.py
```

**Verificaciones incluidas:**
- Versión de Python (3.8+)
- Entorno virtual activo
- Paquetes requeridos instalados
- Estructura del proyecto
- Módulos MCP importables
- Archivos de configuración
- Funcionalidad básica
- Sintaxis de ejemplos

## 🔧 Configuración Manual (Método Tradicional)

### Windows
```bash
# Ejecutar configuración automática
setup-windows.bat

# O manualmente:
python setup.py --dev
```

### Linux/macOS
```bash
# Hacer ejecutable y ejecutar
chmod +x setup-unix.sh
./setup-unix.sh

# O manualmente:
python3 setup.py --dev
```

## 📋 Opciones del Script de Configuración

```bash
python setup.py [opciones]
```

### Opciones Disponibles

- `--dev` - Instalar dependencias de desarrollo (testing, linting, docs)
- `--prod` - Configuración para producción (gunicorn, monitoring, security)
- `--test` - Ejecutar tests después de la instalación
- `--clean` - Limpiar instalaciones previas
- `--help` - Mostrar ayuda detallada

### Ejemplos de Uso

```bash
# Configuración básica
python setup.py

# Configuración de desarrollo completa
python setup.py --dev --test

# Configuración de producción
python setup.py --prod

# Limpiar y reinstalar
python setup.py --clean --dev
```

## 📁 Archivos Creados

### Archivos de Dependencias
- `requirements.txt` - Dependencias principales
- `requirements-dev.txt` - Dependencias de desarrollo
- `requirements-prod.txt` - Dependencias de producción

### Configuración
- `.env` - Variables de entorno (creado automáticamente)
- `.env.example` - Plantilla de configuración

### Scripts de Activación
- `activate.bat` - Activar entorno en Windows
- `activate.sh` - Activar entorno en Unix/Linux/macOS

### Estructura de Directorios
```
proyecto/
├── mcp-env/          # Entorno virtual
├── data/             # Datos de la aplicación
├── logs/             # Archivos de log
├── temp/             # Archivos temporales
├── backups/          # Respaldos
└── config/           # Configuraciones adicionales
```

## 🔧 Verificación de la Instalación

### 1. Activar el Entorno
```bash
# Windows
activate.bat

# Unix/Linux/macOS
source activate.sh
```

### 2. Ejecutar Tests
```bash
pytest tests/ -v
```

### 3. Probar Aplicación Web
```bash
python examples/mcp_web_application.py
# Abrir: http://localhost:8080
```

### 4. Probar Demo Interactivo
```bash
python examples/mcp_demo_application.py
```

## 🛠️ Dependencias del Sistema

### Requeridas
- **Python 3.8+** - Lenguaje principal
- **Git** - Control de versiones
- **Node.js & npm** - Para dependencias de frontend (opcional)

### Instalación por Sistema Operativo

#### Windows
```bash
# Con Chocolatey
choco install python git nodejs

# O descargar manualmente desde:
# - https://python.org
# - https://git-scm.com
# - https://nodejs.org
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv git nodejs npm
```

#### CentOS/RHEL/Fedora
```bash
sudo yum install python3 python3-pip git nodejs npm
# o con dnf:
sudo dnf install python3 python3-pip git nodejs npm
```

#### macOS
```bash
# Con Homebrew
brew install python git node

# O descargar desde:
# - https://python.org
# - https://git-scm.com
# - https://nodejs.org
```

## 🔍 Solución de Problemas

### Error: "Python no encontrado"
- Verificar que Python 3.8+ esté instalado
- Agregar Python al PATH del sistema
- En Windows, usar `py` en lugar de `python`

### Error: "pip no encontrado"
```bash
# Instalar pip
python -m ensurepip --upgrade

# O descargar get-pip.py
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python get-pip.py
```

### Error: "Permisos denegados"
```bash
# Linux/macOS - usar sudo solo si es necesario
sudo python3 setup.py --dev

# O cambiar permisos del directorio
chmod -R 755 .
```

### Error: "Módulo no encontrado"
```bash
# Verificar que el entorno virtual esté activado
which python  # Debe mostrar la ruta del entorno virtual

# Reinstalar dependencias
pip install -r requirements.txt
```

### Error: "Puerto en uso"
```bash
# Cambiar puerto en .env
MCP_PORT=8081
MCP_WS_PORT=8082

# O matar proceso que usa el puerto
# Windows:
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Linux/macOS:
lsof -ti:8080 | xargs kill -9
```

## 📊 Monitoreo de la Instalación

El script de configuración proporciona:

- ✅ Verificación de versión de Python
- ✅ Detección de dependencias del sistema
- ✅ Creación automática de entorno virtual
- ✅ Instalación de dependencias
- ✅ Configuración de archivos de entorno
- ✅ Creación de estructura de directorios
- ✅ Scripts de activación personalizados
- ✅ Verificación opcional con tests

## 🔄 Actualización del Entorno

Para actualizar el entorno existente:

```bash
# Limpiar y reinstalar
python setup.py --clean --dev

# O actualizar solo dependencias
pip install -r requirements.txt --upgrade
```

## 🚀 Próximos Pasos

Después de la configuración exitosa:

1. **Activar el entorno** con los scripts proporcionados
2. **Explorar los ejemplos** en el directorio `examples/`
3. **Leer la documentación** en `docs/`
4. **Desarrollar plugins** usando las plantillas
5. **Contribuir** al proyecto siguiendo las guías

---

¡El sistema MCP está listo para usar! 🎉