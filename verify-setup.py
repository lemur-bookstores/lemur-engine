#!/usr/bin/env python3
"""
Verificador del Entorno MCP
==========================

Script para verificar que el entorno MCP esté configurado correctamente.
Ejecuta una serie de tests para validar la instalación.
"""

import sys
import os
import subprocess
import importlib
from pathlib import Path
from typing import List, Tuple, Dict

class MCPEnvironmentValidator:
    """Validador del entorno MCP"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.errors = []
        self.warnings = []
        self.success_count = 0
        self.total_tests = 0
    
    def log(self, message: str, level: str = "INFO"):
        """Logging con colores"""
        colors = {
            "INFO": "\033[94m",
            "SUCCESS": "\033[92m",
            "WARNING": "\033[93m",
            "ERROR": "\033[91m",
            "RESET": "\033[0m"
        }
        
        color = colors.get(level, colors["INFO"])
        reset = colors["RESET"]
        print(f"{color}[{level}]{reset} {message}")
    
    def test_python_version(self) -> bool:
        """Verificar versión de Python"""
        self.total_tests += 1
        version = sys.version_info
        
        if version >= (3, 8):
            self.log(f"Python {version.major}.{version.minor}.{version.micro} ✓", "SUCCESS")
            self.success_count += 1
            return True
        else:
            self.log(f"Python {version.major}.{version.minor} - Se requiere 3.8+", "ERROR")
            self.errors.append("Versión de Python insuficiente")
            return False
    
    def test_virtual_environment(self) -> bool:
        """Verificar entorno virtual"""
        self.total_tests += 1
        
        # Verificar si estamos en un entorno virtual
        in_venv = (
            hasattr(sys, 'real_prefix') or
            (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
        )
        
        if in_venv:
            self.log("Entorno virtual activo ✓", "SUCCESS")
            self.success_count += 1
            return True
        else:
            self.log("No se detectó entorno virtual activo", "WARNING")
            self.warnings.append("Entorno virtual no activo")
            return False
    
    def test_required_packages(self) -> bool:
        """Verificar paquetes requeridos"""
        required_packages = [
            'aiohttp',
            'aiofiles',
            'websockets',
            'asyncio_mqtt',
            'structlog',
            'prometheus_client'
        ]
        
        all_installed = True
        
        for package in required_packages:
            self.total_tests += 1
            try:
                importlib.import_module(package)
                self.log(f"Paquete {package} ✓", "SUCCESS")
                self.success_count += 1
            except ImportError:
                self.log(f"Paquete {package} no encontrado", "ERROR")
                self.errors.append(f"Paquete faltante: {package}")
                all_installed = False
        
        return all_installed
    
    def test_project_structure(self) -> bool:
        """Verificar estructura del proyecto"""
        required_dirs = [
            'src/mcp',
            'examples',
            'tests',
            'docs'
        ]
        
        required_files = [
            'requirements.txt',
            'setup.py',
            'src/mcp/core/integration.py',
            'examples/mcp_web_application.py'
        ]
        
        all_present = True
        
        # Verificar directorios
        for dir_path in required_dirs:
            self.total_tests += 1
            full_path = self.project_root / dir_path
            if full_path.exists() and full_path.is_dir():
                self.log(f"Directorio {dir_path} ✓", "SUCCESS")
                self.success_count += 1
            else:
                self.log(f"Directorio {dir_path} no encontrado", "ERROR")
                self.errors.append(f"Directorio faltante: {dir_path}")
                all_present = False
        
        # Verificar archivos
        for file_path in required_files:
            self.total_tests += 1
            full_path = self.project_root / file_path
            if full_path.exists() and full_path.is_file():
                self.log(f"Archivo {file_path} ✓", "SUCCESS")
                self.success_count += 1
            else:
                self.log(f"Archivo {file_path} no encontrado", "ERROR")
                self.errors.append(f"Archivo faltante: {file_path}")
                all_present = False
        
        return all_present
    
    def test_mcp_imports(self) -> bool:
        """Verificar que los módulos MCP se puedan importar"""
        mcp_modules = [
            'src.mcp.core.integration',
            'src.mcp.core.resource_manager',
            'src.mcp.plugins.filesystem_plugin'
        ]
        
        all_imported = True
        
        # Agregar src al path temporalmente
        src_path = str(self.project_root / 'src')
        if src_path not in sys.path:
            sys.path.insert(0, src_path)
        
        for module in mcp_modules:
            self.total_tests += 1
            try:
                importlib.import_module(module)
                self.log(f"Módulo {module} ✓", "SUCCESS")
                self.success_count += 1
            except ImportError as e:
                self.log(f"Error importando {module}: {e}", "ERROR")
                self.errors.append(f"Error de importación: {module}")
                all_imported = False
        
        return all_imported
    
    def test_environment_file(self) -> bool:
        """Verificar archivo de entorno"""
        self.total_tests += 1
        
        env_file = self.project_root / '.env'
        env_example = self.project_root / '.env.example'
        
        if env_file.exists():
            self.log("Archivo .env encontrado ✓", "SUCCESS")
            self.success_count += 1
            return True
        elif env_example.exists():
            self.log("Archivo .env no encontrado, pero .env.example existe", "WARNING")
            self.warnings.append("Copie .env.example a .env y configure las variables")
            return False
        else:
            self.log("Archivos de configuración no encontrados", "ERROR")
            self.errors.append("Archivos .env y .env.example faltantes")
            return False
    
    def test_basic_functionality(self) -> bool:
        """Test básico de funcionalidad"""
        self.total_tests += 1
        
        try:
            # No es necesario modificar el sys.path si se ejecuta como módulo
            from src.mcp.core.integration import MCPIntegrationSystem
            
            # Crear instancia (sin inicializar para evitar async)
            mcp_system = MCPIntegrationSystem()
            
            self.log("Funcionalidad básica MCP ✓", "SUCCESS")
            self.success_count += 1
            return True
            
        except Exception as e:
            self.log(f"Error en funcionalidad básica: {e}", "ERROR")
            self.errors.append(f"Error funcional: {str(e)}")
            return False
    
    def test_example_files(self) -> bool:
        """Verificar que los archivos de ejemplo sean válidos"""
        example_files = [
            'examples/mpc_basic_example.py',
            'examples/mcp_web_application.py',
            'examples/mcp_demo_application.py'
        ]
        
        all_valid = True
        
        for file_path in example_files:
            self.total_tests += 1
            full_path = self.project_root / file_path
            
            if not full_path.exists():
                self.log(f"Archivo {file_path} no encontrado", "ERROR")
                self.errors.append(f"Ejemplo faltante: {file_path}")
                all_valid = False
                continue
            
            # Verificar sintaxis Python
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                compile(content, str(full_path), 'exec')
                self.log(f"Ejemplo {file_path} ✓", "SUCCESS")
                self.success_count += 1
                
            except SyntaxError as e:
                self.log(f"Error de sintaxis en {file_path}: {e}", "ERROR")
                self.errors.append(f"Sintaxis inválida: {file_path}")
                all_valid = False
            except Exception as e:
                self.log(f"Error leyendo {file_path}: {e}", "ERROR")
                self.errors.append(f"Error de lectura: {file_path}")
                all_valid = False
        
        return all_valid
    
    def run_validation(self) -> bool:
        """Ejecutar todas las validaciones"""
        self.log("=== Validación del Entorno MCP ===", "INFO")
        self.log(f"Directorio del proyecto: {self.project_root}", "INFO")
        self.log("", "INFO")
        
        # Ejecutar tests
        tests = [
            ("Versión de Python", self.test_python_version),
            ("Entorno Virtual", self.test_virtual_environment),
            ("Paquetes Requeridos", self.test_required_packages),
            ("Estructura del Proyecto", self.test_project_structure),
            ("Módulos MCP", self.test_mcp_imports),
            ("Archivo de Entorno", self.test_environment_file),
            ("Funcionalidad Básica", self.test_basic_functionality),
            ("Archivos de Ejemplo", self.test_example_files)
        ]
        
        for test_name, test_func in tests:
            self.log(f"\n--- {test_name} ---", "INFO")
            test_func()
        
        # Mostrar resumen
        self.log("\n=== Resumen de Validación ===", "INFO")
        self.log(f"Tests ejecutados: {self.total_tests}", "INFO")
        self.log(f"Tests exitosos: {self.success_count}", "SUCCESS")
        self.log(f"Errores: {len(self.errors)}", "ERROR" if self.errors else "INFO")
        self.log(f"Advertencias: {len(self.warnings)}", "WARNING" if self.warnings else "INFO")
        
        success_rate = (self.success_count / self.total_tests) * 100 if self.total_tests > 0 else 0
        self.log(f"Tasa de éxito: {success_rate:.1f}%", "SUCCESS" if success_rate >= 80 else "WARNING")
        
        # Mostrar errores y advertencias
        if self.errors:
            self.log("\n--- Errores Encontrados ---", "ERROR")
            for error in self.errors:
                self.log(f"• {error}", "ERROR")
        
        if self.warnings:
            self.log("\n--- Advertencias ---", "WARNING")
            for warning in self.warnings:
                self.log(f"• {warning}", "WARNING")
        
        # Recomendaciones
        self.log("\n--- Recomendaciones ---", "INFO")
        
        if self.errors:
            self.log("1. Ejecute: python setup.py --dev", "INFO")
            self.log("2. Verifique las dependencias faltantes", "INFO")
            self.log("3. Revise la documentación en docs/", "INFO")
        elif self.warnings:
            self.log("1. Active el entorno virtual si no está activo", "INFO")
            self.log("2. Configure el archivo .env", "INFO")
            self.log("3. El sistema debería funcionar correctamente", "INFO")
        else:
            self.log("¡El entorno está configurado correctamente! 🎉", "SUCCESS")
            self.log("Puede ejecutar: python examples/mcp_web_application.py", "INFO")
        
        return len(self.errors) == 0

def main():
    """Función principal"""
    validator = MCPEnvironmentValidator()
    success = validator.run_validation()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()