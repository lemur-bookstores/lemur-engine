# Instalación Automática del Sistema MCP

Este directorio contiene scripts para la instalación automática del sistema MCP en diferentes plataformas.

## 🚀 Instalación Rápida

### Windows
```bash
# Opción 1: Instalador automático
install-windows.bat

# Opción 2: Manual
python install.py
```

### Linux/macOS
```bash
# Opción 1: Instalador automático
chmod +x install-unix.sh
./install-unix.sh

# Opción 2: Manual
python install.py
```

## 📋 Scripts Disponibles

### `install.py`
**Instalador principal multiplataforma**
- Detecta automáticamente el sistema operativo
- Verifica requisitos del sistema
- Instala dependencias automáticamente
- Crea entorno virtual
- Configura archivos de entorno
- Genera scripts de activación

**Características:**
- ✅ Detección automática de Python 3.8+
- ✅ Instalación de dependencias del sistema
- ✅ Creación de entorno virtual
- ✅ Instalación de paquetes Python
- ✅ Configuración de archivos .env
- ✅ Scripts de activación personalizados
- ✅ Verificación post-instalación

### `install-windows.bat`
**Instalador rápido para Windows**
- Verifica Python en el sistema
- Ejecuta el instalador principal
- Manejo de errores específico para Windows
- Instrucciones de uso post-instalación

### `install-unix.sh`
**Instalador rápido para Linux/macOS**
- Detección automática de distribución Linux
- Instalación de dependencias del sistema
- Colores en terminal para mejor UX
- Manejo de permisos y errores

### `verify-setup.py`
**Verificador de instalación**
- Valida la configuración completa
- Verifica dependencias instaladas
- Prueba funcionalidad básica
- Genera reporte detallado
- Recomendaciones de solución

## 🔧 Requisitos del Sistema

### Mínimos
- **Python:** 3.8 o superior
- **pip:** Incluido con Python
- **Espacio en disco:** 500 MB
- **RAM:** 512 MB disponible

### Recomendados
- **Python:** 3.9 o superior
- **Sistema:** 64-bit
- **Espacio en disco:** 1 GB
- **RAM:** 2 GB disponible

### Dependencias del Sistema

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install python3-venv python3-dev build-essential
```

#### CentOS/RHEL/Fedora
```bash
# Fedora
sudo dnf install python3-venv python3-devel gcc

# CentOS/RHEL
sudo yum install python3-venv python3-devel gcc
```

#### macOS
```bash
# Con Homebrew
brew install python3

# Xcode Command Line Tools
xcode-select --install
```

#### Windows
- Visual Studio Build Tools (opcional, para algunos paquetes)
- Python desde python.org con "Add to PATH" marcado

## 📁 Archivos Generados

Después de la instalación, se crearán los siguientes archivos:

```
proyecto/
├── venv/                    # Entorno virtual
├── .env                     # Variables de entorno
├── activate.bat            # Activación Windows
├── activate.sh             # Activación Unix
└── logs/                   # Directorio de logs
```

## ✅ Verificación de Instalación

Después de la instalación, ejecute:

```bash
# Activar entorno
# Windows: activate.bat
# Unix: source activate.sh

# Verificar instalación
python verify-setup.py

# Ejecutar demo
python examples/mcp_demo_application.py

# Ejecutar aplicación web
python examples/mcp_web_application.py
```

## 🐛 Solución de Problemas

### Error: "Python no encontrado"
**Solución:**
1. Instale Python 3.8+ desde python.org
2. Asegúrese de marcar "Add Python to PATH"
3. Reinicie la terminal

### Error: "Permission denied"
**Solución:**
```bash
# Linux/macOS
chmod +x install-unix.sh
sudo ./install-unix.sh

# Windows
# Ejecutar como administrador
```

### Error: "pip install failed"
**Solución:**
1. Verificar conexión a internet
2. Actualizar pip: `python -m pip install --upgrade pip`
3. Instalar dependencias del sistema

### Error: "Virtual environment creation failed"
**Solución:**
```bash
# Instalar venv manualmente
# Ubuntu/Debian
sudo apt install python3-venv

# CentOS/RHEL
sudo yum install python3-venv
```

### Error: "Module not found"
**Solución:**
1. Activar entorno virtual
2. Reinstalar dependencias: `pip install -r requirements.txt`
3. Verificar instalación: `python verify-setup.py`

## 🔄 Actualización

Para actualizar el sistema MCP:

```bash
# Activar entorno
source activate.sh  # Unix
activate.bat        # Windows

# Actualizar dependencias
pip install --upgrade -r requirements.txt

# Verificar actualización
python verify-setup.py
```

## 🗑️ Desinstalación

Para desinstalar completamente:

```bash
# Eliminar entorno virtual
rm -rf venv/        # Unix
rmdir /s venv\      # Windows

# Eliminar archivos de configuración
rm .env activate.*  # Unix
del .env activate.* # Windows
```

## 📞 Soporte

Si encuentra problemas durante la instalación:

1. **Ejecute el verificador:** `python verify-setup.py`
2. **Revise los logs:** Directorio `logs/`
3. **Consulte la documentación:** `docs/`
4. **Reporte problemas:** Incluya la salida del verificador

## 🎯 Próximos Pasos

Después de la instalación exitosa:

1. **Lea la guía de inicio rápido:** `docs/GUIA-INICIO-RAPIDO.md`
2. **Explore los ejemplos:** `examples/`
3. **Desarrolle plugins:** `docs/MCP-EJEMPLOS-Y-PLUGINS.md`
4. **Configure producción:** `docs/CONFIGURACION-ENTORNO.md`

¡El sistema MCP está listo para usar! 🚀