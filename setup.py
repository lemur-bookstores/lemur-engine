#!/usr/bin/env python3
"""
Script de Configuración Automática del Entorno MCP
==================================================

Este script configura automáticamente el entorno de desarrollo para el Sistema MCP.
Detecta el sistema operativo y configura las dependencias necesarias.

Uso:
    python setup.py [opciones]

Opciones:
    --dev       Instalar dependencias de desarrollo
    --prod      Configuración para producción
    --test      Ejecutar tests después de la instalación
    --clean     Limpiar instalaciones previas
    --help      Mostrar esta ayuda
"""

import os
import sys
import subprocess
import platform
import argparse
import json
import shutil
from pathlib import Path
from typing import List, Dict, Optional

class MCPEnvironmentSetup:
    """Configurador automático del entorno MCP"""
    
    def __init__(self):
        self.system = platform.system().lower()
        self.python_version = sys.version_info
        self.project_root = Path(__file__).parent
        self.venv_name = "mcp-env"
        self.requirements_files = {
            'base': 'requirements.txt',
            'dev': 'requirements-dev.txt',
            'prod': 'requirements-prod.txt'
        }
        
    def log(self, message: str, level: str = "INFO"):
        """Logging con colores"""
        colors = {
            "INFO": "\033[94m",    # Azul
            "SUCCESS": "\033[92m", # Verde
            "WARNING": "\033[93m", # Amarillo
            "ERROR": "\033[91m",   # Rojo
            "RESET": "\033[0m"     # Reset
        }
        
        color = colors.get(level, colors["INFO"])
        reset = colors["RESET"]
        print(f"{color}[{level}]{reset} {message}")
    
    def check_python_version(self) -> bool:
        """Verificar versión de Python"""
        self.log("Verificando versión de Python...")
        
        if self.python_version < (3, 8):
            self.log(f"Python {self.python_version.major}.{self.python_version.minor} detectado. Se requiere Python 3.8+", "ERROR")
            return False
        
        self.log(f"Python {self.python_version.major}.{self.python_version.minor}.{self.python_version.micro} ✓", "SUCCESS")
        return True
    
    def check_system_dependencies(self) -> bool:
        """Verificar dependencias del sistema"""
        self.log("Verificando dependencias del sistema...")
        
        dependencies = []
        
        if self.system == "windows":
            dependencies = ["git", "node", "npm"]
        elif self.system == "linux":
            dependencies = ["git", "nodejs", "npm", "python3-venv"]
        elif self.system == "darwin":  # macOS
            dependencies = ["git", "node", "npm"]
        
        missing = []
        for dep in dependencies:
            if not self.command_exists(dep):
                missing.append(dep)
        
        if missing:
            self.log(f"Dependencias faltantes: {', '.join(missing)}", "WARNING")
            self.suggest_installation(missing)
            return False
        
        self.log("Todas las dependencias del sistema están disponibles ✓", "SUCCESS")
        return True
    
    def command_exists(self, command: str) -> bool:
        """Verificar si un comando existe"""
        return shutil.which(command) is not None
    
    def suggest_installation(self, missing: List[str]):
        """Sugerir comandos de instalación según el SO"""
        self.log("Comandos sugeridos para instalar dependencias faltantes:", "INFO")
        
        if self.system == "windows":
            self.log("Windows - Usar chocolatey o descargar manualmente:", "INFO")
            for dep in missing:
                if dep == "git":
                    print("  choco install git")
                elif dep in ["node", "npm"]:
                    print("  choco install nodejs")
        
        elif self.system == "linux":
            self.log("Ubuntu/Debian:", "INFO")
            deps_map = {
                "git": "git",
                "nodejs": "nodejs",
                "npm": "npm",
                "python3-venv": "python3-venv"
            }
            cmd = "sudo apt-get install " + " ".join(deps_map.get(dep, dep) for dep in missing)
            print(f"  {cmd}")
        
        elif self.system == "darwin":
            self.log("macOS - Usar homebrew:", "INFO")
            for dep in missing:
                if dep == "git":
                    print("  brew install git")
                elif dep in ["node", "npm"]:
                    print("  brew install node")
    
    def create_virtual_environment(self) -> bool:
        """Crear entorno virtual"""
        venv_path = self.project_root / self.venv_name
        
        if venv_path.exists():
            self.log(f"Entorno virtual '{self.venv_name}' ya existe", "WARNING")
            return True
        
        self.log(f"Creando entorno virtual '{self.venv_name}'...")
        
        try:
            subprocess.run([
                sys.executable, "-m", "venv", str(venv_path)
            ], check=True, capture_output=True)
            
            self.log(f"Entorno virtual creado en: {venv_path}", "SUCCESS")
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"Error creando entorno virtual: {e}", "ERROR")
            return False
    
    def get_venv_python(self) -> str:
        """Obtener ruta del Python del entorno virtual"""
        venv_path = self.project_root / self.venv_name
        
        if self.system == "windows":
            return str(venv_path / "Scripts" / "python.exe")
        else:
            return str(venv_path / "bin" / "python")
    
    def get_venv_pip(self) -> str:
        """Obtener ruta del pip del entorno virtual"""
        venv_path = self.project_root / self.venv_name
        
        if self.system == "windows":
            return str(venv_path / "Scripts" / "pip.exe")
        else:
            return str(venv_path / "bin" / "pip")
    
    def create_requirements_files(self):
        """Crear archivos de requirements si no existen"""
        
        # requirements.txt (base)
        base_requirements = """# Dependencias principales del Sistema MCP
asyncio-mqtt>=0.11.0
aiohttp>=3.8.0
aiofiles>=22.1.0
websockets>=11.0.0
aiohttp-cors>=0.7.0

# Utilidades
pydantic>=2.0.0
python-dotenv>=1.0.0
click>=8.1.0

# Logging y monitoreo
structlog>=23.1.0
prometheus-client>=0.17.0

# Análisis de datos
statistics
"""
        
        # requirements-dev.txt
        dev_requirements = """-r requirements.txt

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0
pytest-mock>=3.11.0

# Desarrollo
black>=23.7.0
flake8>=6.0.0
mypy>=1.5.0
isort>=5.12.0

# Documentación
mkdocs>=1.5.0
mkdocs-material>=9.2.0

# Debugging
ipdb>=0.13.0
"""
        
        # requirements-prod.txt
        prod_requirements = """-r requirements.txt

# Producción
gunicorn>=21.2.0
uvicorn[standard]>=0.23.0

# Monitoreo
sentry-sdk>=1.32.0

# Base de datos
redis>=4.6.0
asyncpg>=0.28.0

# Seguridad
cryptography>=41.0.0
"""
        
        requirements_content = {
            'requirements.txt': base_requirements,
            'requirements-dev.txt': dev_requirements,
            'requirements-prod.txt': prod_requirements
        }
        
        for filename, content in requirements_content.items():
            file_path = self.project_root / filename
            if not file_path.exists():
                self.log(f"Creando {filename}...")
                file_path.write_text(content.strip())
                self.log(f"Archivo {filename} creado ✓", "SUCCESS")
    
    def install_python_dependencies(self, mode: str = "base") -> bool:
        """Instalar dependencias de Python"""
        self.log(f"Instalando dependencias de Python (modo: {mode})...")
        
        pip_path = self.get_venv_pip()
        
        # Actualizar pip
        try:
            subprocess.run([
                pip_path, "install", "--upgrade", "pip"
            ], check=True, capture_output=True)
            self.log("pip actualizado ✓", "SUCCESS")
        except subprocess.CalledProcessError:
            self.log("Error actualizando pip", "WARNING")
        
        # Instalar dependencias
        req_file = self.requirements_files.get(mode, 'requirements.txt')
        req_path = self.project_root / req_file
        
        if not req_path.exists():
            self.log(f"Archivo {req_file} no encontrado", "ERROR")
            return False
        
        try:
            subprocess.run([
                pip_path, "install", "-r", str(req_path)
            ], check=True)
            
            self.log(f"Dependencias instaladas desde {req_file} ✓", "SUCCESS")
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"Error instalando dependencias: {e}", "ERROR")
            return False
    
    def install_node_dependencies(self) -> bool:
        """Instalar dependencias de Node.js"""
        package_json = self.project_root / "package.json"
        
        if not package_json.exists():
            self.log("package.json no encontrado, saltando dependencias de Node.js", "WARNING")
            return True
        
        self.log("Instalando dependencias de Node.js...")
        
        try:
            subprocess.run([
                "npm", "install"
            ], cwd=self.project_root, check=True)
            
            self.log("Dependencias de Node.js instaladas ✓", "SUCCESS")
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"Error instalando dependencias de Node.js: {e}", "ERROR")
            return False
    
    def create_environment_file(self):
        """Crear archivo .env con configuración por defecto"""
        env_file = self.project_root / ".env"
        
        if env_file.exists():
            self.log("Archivo .env ya existe", "WARNING")
            return
        
        env_content = """# Configuración del Sistema MCP
MCP_DEBUG=true
MCP_LOG_LEVEL=INFO
MCP_HOST=localhost
MCP_PORT=8080
MCP_WS_PORT=8081

# Base de datos
DATABASE_URL=sqlite:///./mcp_data.db
REDIS_URL=redis://localhost:6379

# Seguridad
SECRET_KEY=your-secret-key-here-change-in-production

# Monitoreo
PROMETHEUS_PORT=9090
METRICS_ENABLED=true

# Plugins
PLUGINS_DIR=src/mcp/plugins
AUTO_LOAD_PLUGINS=true
"""
        
        self.log("Creando archivo .env...")
        env_file.write_text(env_content.strip())
        self.log("Archivo .env creado ✓", "SUCCESS")
    
    def create_activation_scripts(self):
        """Crear scripts de activación del entorno"""
        
        # Script para Windows
        if self.system == "windows":
            activate_bat = self.project_root / "activate.bat"
            bat_content = f"""@echo off
echo Activando entorno MCP...
call {self.venv_name}\\Scripts\\activate.bat
echo Entorno MCP activado!
echo.
echo Comandos disponibles:
echo   python examples/mcp_web_application.py  - Ejecutar aplicación web
echo   python examples/mcp_demo_application.py - Ejecutar demo interactivo
echo   pytest tests/                           - Ejecutar tests
echo.
"""
            activate_bat.write_text(bat_content)
            self.log("Script activate.bat creado ✓", "SUCCESS")
        
        # Script para Unix/Linux/macOS
        activate_sh = self.project_root / "activate.sh"
        sh_content = f"""#!/bin/bash
echo "Activando entorno MCP..."
source {self.venv_name}/bin/activate
echo "Entorno MCP activado!"
echo
echo "Comandos disponibles:"
echo "  python examples/mcp_web_application.py  - Ejecutar aplicación web"
echo "  python examples/mcp_demo_application.py - Ejecutar demo interactivo"
echo "  pytest tests/                           - Ejecutar tests"
echo
"""
        activate_sh.write_text(sh_content)
        
        # Hacer ejecutable en Unix
        if self.system in ["linux", "darwin"]:
            os.chmod(activate_sh, 0o755)
        
        self.log("Script activate.sh creado ✓", "SUCCESS")
    
    def run_tests(self) -> bool:
        """Ejecutar tests para verificar la instalación"""
        self.log("Ejecutando tests para verificar la instalación...")
        
        python_path = self.get_venv_python()
        
        try:
            result = subprocess.run([
                python_path, "-m", "pytest", "tests/", "-v", "--tb=short"
            ], cwd=self.project_root, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.log("Todos los tests pasaron ✓", "SUCCESS")
                return True
            else:
                self.log("Algunos tests fallaron", "WARNING")
                print(result.stdout)
                print(result.stderr)
                return False
                
        except subprocess.CalledProcessError as e:
            self.log(f"Error ejecutando tests: {e}", "ERROR")
            return False
    
    def clean_environment(self):
        """Limpiar instalaciones previas"""
        self.log("Limpiando entorno previo...")
        
        venv_path = self.project_root / self.venv_name
        if venv_path.exists():
            shutil.rmtree(venv_path)
            self.log(f"Entorno virtual {self.venv_name} eliminado", "SUCCESS")
        
        # Limpiar archivos de cache
        cache_dirs = [
            "__pycache__",
            ".pytest_cache",
            "*.pyc",
            "*.pyo"
        ]
        
        for pattern in cache_dirs:
            for path in self.project_root.rglob(pattern):
                if path.is_dir():
                    shutil.rmtree(path)
                elif path.is_file():
                    path.unlink()
        
        self.log("Cache limpiado ✓", "SUCCESS")
    
    def create_project_structure(self):
        """Crear estructura de directorios del proyecto"""
        directories = [
            "data",
            "logs",
            "temp",
            "backups",
            "config"
        ]
        
        for dir_name in directories:
            dir_path = self.project_root / dir_name
            if not dir_path.exists():
                dir_path.mkdir(parents=True)
                self.log(f"Directorio {dir_name}/ creado", "SUCCESS")
                
                # Crear .gitkeep para mantener directorios vacíos en git
                gitkeep = dir_path / ".gitkeep"
                gitkeep.touch()
    
    def setup(self, mode: str = "base", run_tests: bool = False, clean: bool = False):
        """Ejecutar configuración completa"""
        self.log("=== Configuración Automática del Entorno MCP ===", "INFO")
        self.log(f"Sistema operativo: {self.system}", "INFO")
        self.log(f"Directorio del proyecto: {self.project_root}", "INFO")
        
        if clean:
            self.clean_environment()
        
        # Verificaciones previas
        if not self.check_python_version():
            return False
        
        if not self.check_system_dependencies():
            self.log("Instale las dependencias faltantes y ejecute el script nuevamente", "ERROR")
            return False
        
        # Crear archivos de configuración
        self.create_requirements_files()
        self.create_environment_file()
        self.create_project_structure()
        
        # Configurar entorno Python
        if not self.create_virtual_environment():
            return False
        
        if not self.install_python_dependencies(mode):
            return False
        
        # Configurar entorno Node.js
        self.install_node_dependencies()
        
        # Crear scripts de activación
        self.create_activation_scripts()
        
        # Ejecutar tests si se solicita
        if run_tests:
            self.run_tests()
        
        self.log("=== Configuración Completada ===", "SUCCESS")
        self.log("", "INFO")
        self.log("Próximos pasos:", "INFO")
        
        if self.system == "windows":
            self.log("1. Ejecutar: activate.bat", "INFO")
        else:
            self.log("1. Ejecutar: source activate.sh", "INFO")
        
        self.log("2. Probar: python examples/mcp_web_application.py", "INFO")
        self.log("3. Abrir: http://localhost:8080", "INFO")
        
        return True

def main():
    parser = argparse.ArgumentParser(
        description="Configuración automática del entorno MCP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--dev", 
        action="store_true", 
        help="Instalar dependencias de desarrollo"
    )
    
    parser.add_argument(
        "--prod", 
        action="store_true", 
        help="Configuración para producción"
    )
    
    parser.add_argument(
        "--test", 
        action="store_true", 
        help="Ejecutar tests después de la instalación"
    )
    
    parser.add_argument(
        "--clean", 
        action="store_true", 
        help="Limpiar instalaciones previas"
    )
    
    args = parser.parse_args()
    
    # Determinar modo de instalación
    mode = "base"
    if args.dev:
        mode = "dev"
    elif args.prod:
        mode = "prod"
    
    # Ejecutar configuración
    setup = MCPEnvironmentSetup()
    success = setup.setup(
        mode=mode,
        run_tests=args.test,
        clean=args.clean
    )
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()