#!/usr/bin/env python3
"""
Instalador Automático MCP
=========================

Script de instalación automática para el sistema MCP.
Detecta el sistema operativo y configura todo automáticamente.
"""

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path
from typing import List, Optional

class MCPAutoInstaller:
    """Instalador automático del sistema MCP"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.system = platform.system().lower()
        self.is_windows = self.system == "windows"
        self.python_cmd = self._get_python_command()
        self.pip_cmd = self._get_pip_command()
        
    def log(self, message: str, level: str = "INFO"):
        """Logging con colores"""
        colors = {
            "INFO": "\033[94m",
            "SUCCESS": "\033[92m",
            "WARNING": "\033[93m",
            "ERROR": "\033[91m",
            "RESET": "\033[0m"
        }
        
        if self.is_windows:
            # En Windows, usar colores simples
            prefixes = {
                "INFO": "[INFO]",
                "SUCCESS": "[OK]",
                "WARNING": "[WARN]",
                "ERROR": "[ERROR]"
            }
            print(f"{prefixes.get(level, '[INFO]')} {message}")
        else:
            color = colors.get(level, colors["INFO"])
            reset = colors["RESET"]
            print(f"{color}[{level}]{reset} {message}")
    
    def _get_python_command(self) -> str:
        """Obtener comando de Python"""
        commands = ["python3", "python"]
        
        for cmd in commands:
            try:
                result = subprocess.run([cmd, "--version"], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    version_line = result.stdout.strip()
                    if "Python 3." in version_line:
                        return cmd
            except FileNotFoundError:
                continue
        
        raise RuntimeError("No se encontró Python 3.8+ en el sistema")
    
    def _get_pip_command(self) -> str:
        """Obtener comando de pip"""
        if self.python_cmd == "python3":
            return "pip3"
        return "pip"
    
    def run_command(self, command: List[str], description: str, 
                   check: bool = True, capture_output: bool = False) -> subprocess.CompletedProcess:
        """Ejecutar comando con logging"""
        self.log(f"Ejecutando: {description}", "INFO")
        
        try:
            if capture_output:
                result = subprocess.run(command, capture_output=True, text=True, check=check)
            else:
                result = subprocess.run(command, check=check)
            
            if result.returncode == 0:
                self.log(f"✓ {description}", "SUCCESS")
            else:
                self.log(f"✗ {description}", "ERROR")
            
            return result
            
        except subprocess.CalledProcessError as e:
            self.log(f"Error en {description}: {e}", "ERROR")
            raise
        except FileNotFoundError:
            self.log(f"Comando no encontrado para: {description}", "ERROR")
            raise
    
    def check_system_requirements(self) -> bool:
        """Verificar requisitos del sistema"""
        self.log("=== Verificando Requisitos del Sistema ===", "INFO")
        
        # Verificar Python
        try:
            result = self.run_command([self.python_cmd, "--version"], 
                                    "Verificar Python", capture_output=True)
            version_str = result.stdout.strip()
            self.log(f"Python encontrado: {version_str}", "SUCCESS")
            
            # Extraer versión
            version_parts = version_str.split()[1].split('.')
            major, minor = int(version_parts[0]), int(version_parts[1])
            
            if major < 3 or (major == 3 and minor < 8):
                self.log("Se requiere Python 3.8 o superior", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Error verificando Python: {e}", "ERROR")
            return False
        
        # Verificar pip
        try:
            self.run_command([self.pip_cmd, "--version"], 
                           "Verificar pip", capture_output=True)
        except Exception as e:
            self.log(f"Error verificando pip: {e}", "ERROR")
            return False
        
        # Verificar git (opcional)
        try:
            self.run_command(["git", "--version"], 
                           "Verificar git", capture_output=True)
        except Exception:
            self.log("Git no encontrado (opcional)", "WARNING")
        
        return True
    
    def install_system_dependencies(self) -> bool:
        """Instalar dependencias del sistema"""
        self.log("=== Instalando Dependencias del Sistema ===", "INFO")
        
        if self.system == "linux":
            # Detectar distribución
            try:
                with open("/etc/os-release", "r") as f:
                    os_info = f.read().lower()
                
                if "ubuntu" in os_info or "debian" in os_info:
                    self.log("Detectado sistema Ubuntu/Debian", "INFO")
                    try:
                        self.run_command(["sudo", "apt", "update"], 
                                       "Actualizar repositorios")
                        self.run_command(["sudo", "apt", "install", "-y", 
                                        "python3-venv", "python3-dev", "build-essential"], 
                                       "Instalar dependencias Ubuntu/Debian")
                    except Exception as e:
                        self.log(f"Error instalando dependencias: {e}", "WARNING")
                        
                elif "centos" in os_info or "rhel" in os_info or "fedora" in os_info:
                    self.log("Detectado sistema CentOS/RHEL/Fedora", "INFO")
                    try:
                        package_manager = "dnf" if "fedora" in os_info else "yum"
                        self.run_command(["sudo", package_manager, "install", "-y", 
                                        "python3-venv", "python3-devel", "gcc"], 
                                       f"Instalar dependencias con {package_manager}")
                    except Exception as e:
                        self.log(f"Error instalando dependencias: {e}", "WARNING")
                        
            except Exception:
                self.log("No se pudo detectar la distribución Linux", "WARNING")
                
        elif self.system == "darwin":  # macOS
            self.log("Detectado macOS", "INFO")
            try:
                # Verificar si Homebrew está instalado
                self.run_command(["brew", "--version"], 
                               "Verificar Homebrew", capture_output=True)
                self.log("Homebrew encontrado", "SUCCESS")
            except Exception:
                self.log("Homebrew no encontrado. Instale desde: https://brew.sh", "WARNING")
        
        elif self.is_windows:
            self.log("Detectado Windows", "INFO")
            self.log("Asegúrese de tener Visual Studio Build Tools instalado", "INFO")
        
        return True
    
    def create_virtual_environment(self) -> bool:
        """Crear entorno virtual"""
        self.log("=== Creando Entorno Virtual ===", "INFO")
        
        venv_path = self.project_root / "venv"
        
        # Eliminar entorno existente si existe
        if venv_path.exists():
            self.log("Eliminando entorno virtual existente", "INFO")
            shutil.rmtree(venv_path)
        
        # Crear nuevo entorno virtual
        try:
            self.run_command([self.python_cmd, "-m", "venv", str(venv_path)], 
                           "Crear entorno virtual")
        except Exception as e:
            self.log(f"Error creando entorno virtual: {e}", "ERROR")
            return False
        
        return True
    
    def get_venv_python(self) -> str:
        """Obtener ruta del Python del entorno virtual"""
        venv_path = self.project_root / "venv"
        
        if self.is_windows:
            return str(venv_path / "Scripts" / "python.exe")
        else:
            return str(venv_path / "bin" / "python")
    
    def get_venv_pip(self) -> str:
        """Obtener ruta del pip del entorno virtual"""
        venv_path = self.project_root / "venv"
        
        if self.is_windows:
            return str(venv_path / "Scripts" / "pip.exe")
        else:
            return str(venv_path / "bin" / "pip")
    
    def install_python_dependencies(self) -> bool:
        """Instalar dependencias de Python"""
        self.log("=== Instalando Dependencias de Python ===", "INFO")
        
        venv_pip = self.get_venv_pip()
        
        # Actualizar pip
        try:
            self.run_command([venv_pip, "install", "--upgrade", "pip"], 
                           "Actualizar pip")
        except Exception as e:
            self.log(f"Error actualizando pip: {e}", "WARNING")
        
        # Instalar dependencias principales
        requirements_files = [
            "requirements.txt",
            "requirements-dev.txt"
        ]
        
        for req_file in requirements_files:
            req_path = self.project_root / req_file
            if req_path.exists():
                try:
                    self.run_command([venv_pip, "install", "-r", str(req_path)], 
                                   f"Instalar {req_file}")
                except Exception as e:
                    self.log(f"Error instalando {req_file}: {e}", "ERROR")
                    return False
            else:
                self.log(f"Archivo {req_file} no encontrado", "WARNING")
        
        return True
    
    def setup_environment_file(self) -> bool:
        """Configurar archivo de entorno"""
        self.log("=== Configurando Archivo de Entorno ===", "INFO")
        
        env_file = self.project_root / ".env"
        env_example = self.project_root / ".env.example"
        
        if not env_file.exists() and env_example.exists():
            try:
                shutil.copy2(env_example, env_file)
                self.log("Archivo .env creado desde .env.example", "SUCCESS")
            except Exception as e:
                self.log(f"Error copiando .env.example: {e}", "ERROR")
                return False
        elif env_file.exists():
            self.log("Archivo .env ya existe", "INFO")
        else:
            self.log("No se encontró .env.example", "WARNING")
        
        return True
    
    def create_activation_scripts(self) -> bool:
        """Crear scripts de activación"""
        self.log("=== Creando Scripts de Activación ===", "INFO")
        
        # Script para Windows
        if self.is_windows:
            activate_script = self.project_root / "activate.bat"
            script_content = f"""@echo off
echo Activando entorno virtual MCP...
call venv\\Scripts\\activate.bat
echo.
echo Entorno MCP activado. Comandos disponibles:
echo   python examples/mcp_web_application.py    - Ejecutar aplicación web
echo   python examples/mcp_demo_application.py   - Ejecutar demo
echo   python verify-setup.py                    - Verificar instalación
echo.
"""
        else:
            activate_script = self.project_root / "activate.sh"
            script_content = f"""#!/bin/bash
echo "Activando entorno virtual MCP..."
source venv/bin/activate
echo ""
echo "Entorno MCP activado. Comandos disponibles:"
echo "  python examples/mcp_web_application.py    - Ejecutar aplicación web"
echo "  python examples/mcp_demo_application.py   - Ejecutar demo"
echo "  python verify-setup.py                    - Verificar instalación"
echo ""
"""
        
        try:
            with open(activate_script, "w", encoding="utf-8") as f:
                f.write(script_content)
            
            if not self.is_windows:
                os.chmod(activate_script, 0o755)
            
            self.log(f"Script de activación creado: {activate_script.name}", "SUCCESS")
            
        except Exception as e:
            self.log(f"Error creando script de activación: {e}", "ERROR")
            return False
        
        return True
    
    def run_verification(self) -> bool:
        """Ejecutar verificación de la instalación"""
        self.log("=== Verificando Instalación ===", "INFO")
        
        venv_python = self.get_venv_python()
        verify_script = self.project_root / "verify-setup.py"
        
        if not verify_script.exists():
            self.log("Script de verificación no encontrado", "WARNING")
            return True
        
        try:
            self.run_command([venv_python, str(verify_script)], 
                           "Ejecutar verificación")
            return True
        except Exception as e:
            self.log(f"Error en verificación: {e}", "WARNING")
            return False
    
    def show_completion_message(self):
        """Mostrar mensaje de finalización"""
        self.log("\n=== Instalación Completada ===", "SUCCESS")
        self.log("", "INFO")
        
        if self.is_windows:
            self.log("Para activar el entorno, ejecute:", "INFO")
            self.log("  activate.bat", "INFO")
            self.log("", "INFO")
            self.log("O manualmente:", "INFO")
            self.log("  venv\\Scripts\\activate.bat", "INFO")
        else:
            self.log("Para activar el entorno, ejecute:", "INFO")
            self.log("  source activate.sh", "INFO")
            self.log("", "INFO")
            self.log("O manualmente:", "INFO")
            self.log("  source venv/bin/activate", "INFO")
        
        self.log("", "INFO")
        self.log("Comandos útiles:", "INFO")
        self.log("  python examples/mcp_web_application.py    - Aplicación web", "INFO")
        self.log("  python examples/mcp_demo_application.py   - Demo interactivo", "INFO")
        self.log("  python verify-setup.py                    - Verificar instalación", "INFO")
        self.log("", "INFO")
        self.log("Documentación disponible en:", "INFO")
        self.log("  docs/GUIA-INICIO-RAPIDO.md", "INFO")
        self.log("  docs/MCP-EJEMPLOS-Y-PLUGINS.md", "INFO")
        self.log("", "INFO")
        self.log("¡El sistema MCP está listo para usar! 🚀", "SUCCESS")
    
    def install(self) -> bool:
        """Ejecutar instalación completa"""
        try:
            self.log("=== Instalador Automático MCP ===", "INFO")
            self.log(f"Sistema detectado: {platform.system()} {platform.release()}", "INFO")
            self.log(f"Directorio del proyecto: {self.project_root}", "INFO")
            self.log("", "INFO")
            
            # Verificar requisitos
            if not self.check_system_requirements():
                return False
            
            # Instalar dependencias del sistema
            if not self.install_system_dependencies():
                return False
            
            # Crear entorno virtual
            if not self.create_virtual_environment():
                return False
            
            # Instalar dependencias de Python
            if not self.install_python_dependencies():
                return False
            
            # Configurar archivo de entorno
            if not self.setup_environment_file():
                return False
            
            # Crear scripts de activación
            if not self.create_activation_scripts():
                return False
            
            # Ejecutar verificación
            self.run_verification()
            
            # Mostrar mensaje de finalización
            self.show_completion_message()
            
            return True
            
        except KeyboardInterrupt:
            self.log("\nInstalación cancelada por el usuario", "WARNING")
            return False
        except Exception as e:
            self.log(f"Error durante la instalación: {e}", "ERROR")
            return False

def main():
    """Función principal"""
    installer = MCPAutoInstaller()
    success = installer.install()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()