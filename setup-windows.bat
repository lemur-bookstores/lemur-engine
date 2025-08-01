@echo off
REM Script de configuración rápida para Windows
REM ==========================================

echo.
echo ========================================
echo   Configuracion Automatica MCP
echo ========================================
echo.

REM Verificar si Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no encontrado. Instale Python 3.8+ desde https://python.org
    pause
    exit /b 1
)

echo [INFO] Python encontrado
python --version

REM Ejecutar script de configuración
echo.
echo [INFO] Ejecutando configuracion automatica...
python setup.py --dev

REM Verificar si la configuración fue exitosa
if errorlevel 1 (
    echo.
    echo [ERROR] La configuracion fallo. Revise los errores anteriores.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Configuracion Completada!
echo ========================================
echo.
echo Para activar el entorno, ejecute:
echo   activate.bat
echo.
echo Para probar la aplicacion web:
echo   python examples/mcp_web_application.py
echo.
pause