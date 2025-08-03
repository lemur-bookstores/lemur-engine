# Lemur Engine

Un sistema de integración MCP (Model Context Protocol) avanzado para la gestión de herramientas y recursos.

## 🚀 Instalación Rápida

### Instalación Automática (Recomendado)

**Windows:**
```bash
install-windows.bat
```

**Linux/macOS:**
```bash
chmod +x install-unix.sh
./install-unix.sh
```

**Manual (Todas las plataformas):**
```bash
python install.py
```

### Instalación Manual Tradicional

```bash
# Clonar el repositorio
git clone <repository-url>
cd lemur-engine

# Ejecutar configuración automática
python setup.py --dev

# O instalación manual
pip install -r requirements.txt
cp .env.example .env
```

📖 **Documentación completa:** [INSTALACION.md](INSTALACION.md)

## ✅ Verificación

Después de la instalación:

```bash
# Activar entorno
activate.bat        # Windows
source activate.sh  # Linux/macOS

# Verificar instalación
python verify-setup.py

# Ejecutar aplicación web
python examples/mcp_web_application.py
```

## Características

- Sistema de plugins modular
- Gestión de recursos distribuidos
- Protocolo de comunicación asíncrono
- Interfaz web integrada
- Monitoreo y métricas en tiempo real
- Instalación automática multiplataforma
- Verificación de entorno integrada
