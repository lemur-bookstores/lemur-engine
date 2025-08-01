@echo off
REM ============================================
REM Instalador Rápido MCP para Windows
REM ============================================

echo.
echo ========================================
echo    Instalador Automatico MCP
echo ========================================
echo.

REM Verificar si Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no encontrado en el sistema
    echo.
    echo Por favor instale Python 3.8+ desde:
    echo https://www.python.org/downloads/
    echo.
    echo Asegurese de marcar "Add Python to PATH" durante la instalacion
    pause
    exit /b 1
)

echo [INFO] Python encontrado
python --version

REM Verificar versión de Python
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [INFO] Version de Python: %PYTHON_VERSION%

REM Ejecutar instalador automático
echo.
echo [INFO] Ejecutando instalador automatico...
echo.

python install.py

if errorlevel 1 (
    echo.
    echo [ERROR] Error durante la instalacion
    echo.
    echo Soluciones posibles:
    echo 1. Ejecutar como administrador
    echo 2. Verificar conexion a internet
    echo 3. Instalar Visual Studio Build Tools
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Instalacion completada exitosamente!
echo.
echo Para comenzar a usar MCP:
echo 1. Ejecute: activate.bat
echo 2. Luego: python examples/mcp_web_application.py
echo.
pause