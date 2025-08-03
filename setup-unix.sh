#!/bin/bash
# Script de configuración rápida para Unix/Linux/macOS
# ===================================================

set -e  # Salir si hay errores

echo
echo "========================================"
echo "   Configuración Automática MCP"
echo "========================================"
echo

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 no encontrado. Instale Python 3.8+ desde https://python.org"
    exit 1
fi

echo "[INFO] Python encontrado"
python3 --version

# Verificar si pip está instalado
if ! command -v pip3 &> /dev/null; then
    echo "[ERROR] pip3 no encontrado. Instale pip3"
    exit 1
fi

# Ejecutar script de configuración
echo
echo "[INFO] Ejecutando configuración automática..."
python3 setup.py --dev

# Verificar si la configuración fue exitosa
if [ $? -ne 0 ]; then
    echo
    echo "[ERROR] La configuración falló. Revise los errores anteriores."
    exit 1
fi

echo
echo "========================================"
echo "   Configuración Completada!"
echo "========================================"
echo
echo "Para activar el entorno, ejecute:"
echo "  source activate.sh"
echo
echo "Para probar la aplicación web:"
echo "  python examples/mcp_web_application.py"
echo