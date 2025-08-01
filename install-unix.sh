#!/bin/bash
# ============================================
# Instalador Rápido MCP para Linux/macOS
# ============================================

echo ""
echo "========================================"
echo "    Instalador Automático MCP"
echo "========================================"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar si Python está instalado
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        log_error "Python no encontrado en el sistema"
        echo ""
        echo "Por favor instale Python 3.8+ desde:"
        echo "  Ubuntu/Debian: sudo apt install python3 python3-pip"
        echo "  CentOS/RHEL:   sudo yum install python3 python3-pip"
        echo "  macOS:         brew install python3"
        echo ""
        exit 1
    fi
    
    log_info "Python encontrado: $PYTHON_CMD"
    $PYTHON_CMD --version
}

# Verificar versión de Python
check_python_version() {
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
    log_info "Versión de Python: $PYTHON_VERSION"
    
    # Verificar que sea 3.8+
    MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    
    if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 8 ]); then
        log_error "Se requiere Python 3.8 o superior"
        log_error "Versión actual: $PYTHON_VERSION"
        exit 1
    fi
}

# Verificar permisos
check_permissions() {
    if [ ! -w "." ]; then
        log_error "No tiene permisos de escritura en el directorio actual"
        log_info "Ejecute el script desde el directorio del proyecto MCP"
        exit 1
    fi
}

# Instalar dependencias del sistema
install_system_deps() {
    log_info "Verificando dependencias del sistema..."
    
    # Detectar distribución
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        
        case $OS in
            *"Ubuntu"*|*"Debian"*)
                log_info "Detectado: $OS"
                if command -v apt &> /dev/null; then
                    log_info "Instalando dependencias con apt..."
                    sudo apt update
                    sudo apt install -y python3-venv python3-dev build-essential
                fi
                ;;
            *"CentOS"*|*"Red Hat"*|*"Fedora"*)
                log_info "Detectado: $OS"
                if command -v dnf &> /dev/null; then
                    log_info "Instalando dependencias con dnf..."
                    sudo dnf install -y python3-venv python3-devel gcc
                elif command -v yum &> /dev/null; then
                    log_info "Instalando dependencias con yum..."
                    sudo yum install -y python3-venv python3-devel gcc
                fi
                ;;
            *)
                log_warning "Distribución no reconocida: $OS"
                ;;
        esac
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "Detectado: macOS"
        if command -v brew &> /dev/null; then
            log_info "Homebrew encontrado"
        else
            log_warning "Homebrew no encontrado. Instale desde: https://brew.sh"
        fi
    else
        log_warning "Sistema operativo no reconocido"
    fi
}

# Función principal
main() {
    log_info "Iniciando instalación automática de MCP..."
    echo ""
    
    # Verificaciones previas
    check_permissions
    check_python
    check_python_version
    
    # Instalar dependencias del sistema
    install_system_deps
    
    echo ""
    log_info "Ejecutando instalador automático..."
    echo ""
    
    # Ejecutar instalador Python
    $PYTHON_CMD install.py
    
    if [ $? -eq 0 ]; then
        echo ""
        log_success "¡Instalación completada exitosamente!"
        echo ""
        echo "Para comenzar a usar MCP:"
        echo "1. Ejecute: source activate.sh"
        echo "2. Luego: python examples/mcp_web_application.py"
        echo ""
    else
        echo ""
        log_error "Error durante la instalación"
        echo ""
        echo "Soluciones posibles:"
        echo "1. Verificar conexión a internet"
        echo "2. Instalar dependencias del sistema manualmente"
        echo "3. Revisar permisos de escritura"
        echo ""
        exit 1
    fi
}

# Ejecutar función principal
main "$@"