"""
Ejemplo completo de uso del sistema MCP con múltiples plugins
Este ejemplo demuestra cómo integrar el sistema MCP en una aplicación real
"""

import asyncio
import logging
from datetime import datetime
from src.mcp.core.integration import MCPIntegrationSystem

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MCPDemoApplication:
    """Aplicación de demostración que usa el sistema MCP"""
    
    def __init__(self):
        self.mcp_system = MCPIntegrationSystem()
        self.running = False
    
    async def initialize(self):
        """Inicializa la aplicación y el sistema MCP"""
        logger.info("Inicializando aplicación MCP Demo...")
        
        # Inicializar sistema MCP
        success = await self.mcp_system.initialize()
        if not success:
            raise RuntimeError("Error inicializando sistema MCP")
        
        logger.info("Sistema MCP inicializado exitosamente")
        
        # Mostrar herramientas disponibles
        await self.mostrar_herramientas_disponibles()
    
    async def mostrar_herramientas_disponibles(self):
        """Muestra todas las herramientas disponibles"""
        tools = await self.mcp_system.list_tools()
        logger.info(f"Herramientas disponibles ({len(tools)}):")
        
        for tool in tools:
            logger.info(f"  - {tool.name}: {tool.description}")
            if tool.parameters:
                logger.info(f"    Parámetros: {list(tool.parameters.keys())}")
    
    async def demo_herramientas_basicas(self):
        """Demuestra el uso de herramientas básicas"""
        logger.info("\n=== Demo: Herramientas Básicas ===")
        
        try:
            # Herramienta echo
            result = await self.mcp_system.call_tool("echo", {
                "message": "¡Hola desde MCP Demo!"
            })
            logger.info(f"Echo result: {result}")
            
            # Herramienta timestamp
            result = await self.mcp_system.call_tool("timestamp", {})
            logger.info(f"Timestamp result: {result}")
            
            # Herramienta UUID
            result = await self.mcp_system.call_tool("uuid", {})
            logger.info(f"UUID result: {result}")
            
        except Exception as e:
            logger.error(f"Error en demo básico: {e}")
    
    async def demo_herramientas_filesystem(self):
        """Demuestra el uso de herramientas de filesystem"""
        logger.info("\n=== Demo: Herramientas de Filesystem ===")
        
        try:
            # Crear un archivo de prueba
            test_content = f"Archivo de prueba creado en {datetime.now()}"
            result = await self.mcp_system.call_tool("write_file", {
                "path": "demo_test.txt",
                "content": test_content
            })
            logger.info(f"Archivo creado: {result}")
            
            # Leer el archivo
            result = await self.mcp_system.call_tool("read_file", {
                "path": "demo_test.txt"
            })
            logger.info(f"Contenido leído: {result}")
            
            # Listar directorio actual
            result = await self.mcp_system.call_tool("list_directory", {
                "path": "."
            })
            logger.info(f"Archivos en directorio: {len(result.get('result', {}).get('files', []))} archivos")
            
        except Exception as e:
            logger.error(f"Error en demo filesystem: {e}")
    
    async def demo_manejo_errores(self):
        """Demuestra el manejo de errores"""
        logger.info("\n=== Demo: Manejo de Errores ===")
        
        # Intentar usar herramienta inexistente
        try:
            await self.mcp_system.call_tool("herramienta_inexistente", {})
        except Exception as e:
            logger.info(f"Error esperado para herramienta inexistente: {e}")
        
        # Intentar leer archivo inexistente
        try:
            await self.mcp_system.call_tool("read_file", {
                "path": "archivo_inexistente.txt"
            })
        except Exception as e:
            logger.info(f"Error esperado para archivo inexistente: {e}")
    
    async def demo_estadisticas(self):
        """Muestra estadísticas del sistema"""
        logger.info("\n=== Demo: Estadísticas del Sistema ===")
        
        try:
            status = await self.mcp_system.get_system_status()
            logger.info(f"Estado del sistema: {status}")
            
            # Obtener estadísticas de herramientas
            tools = await self.mcp_system.list_tools()
            stats = {}
            
            for tool in tools:
                # Simular algunas llamadas para generar estadísticas
                try:
                    if tool.name == "echo":
                        await self.mcp_system.call_tool("echo", {"message": "test"})
                    elif tool.name == "timestamp":
                        await self.mcp_system.call_tool("timestamp", {})
                except:
                    pass
            
            logger.info("Estadísticas de uso generadas")
            
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
    
    async def run_interactive_demo(self):
        """Ejecuta demo interactivo"""
        logger.info("\n=== Demo Interactivo ===")
        logger.info("Comandos disponibles:")
        logger.info("  list - Listar herramientas")
        logger.info("  call <tool> <args> - Llamar herramienta")
        logger.info("  status - Estado del sistema")
        logger.info("  quit - Salir")
        
        while self.running:
            try:
                command = input("\nMCP> ").strip().split()
                if not command:
                    continue
                
                if command[0] == "quit":
                    break
                elif command[0] == "list":
                    await self.mostrar_herramientas_disponibles()
                elif command[0] == "status":
                    status = await self.mcp_system.get_system_status()
                    print(f"Estado: {status}")
                elif command[0] == "call" and len(command) >= 2:
                    tool_name = command[1]
                    args = {}
                    
                    # Parsear argumentos simples (key=value)
                    for arg in command[2:]:
                        if "=" in arg:
                            key, value = arg.split("=", 1)
                            args[key] = value
                    
                    result = await self.mcp_system.call_tool(tool_name, args)
                    print(f"Resultado: {result}")
                else:
                    print("Comando no reconocido")
                    
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")
    
    async def run_full_demo(self):
        """Ejecuta todas las demostraciones"""
        self.running = True
        
        try:
            await self.initialize()
            
            # Ejecutar demos automáticos
            await self.demo_herramientas_basicas()
            await self.demo_herramientas_filesystem()
            await self.demo_manejo_errores()
            await self.demo_estadisticas()
            
            # Demo interactivo (opcional)
            print("\n¿Deseas ejecutar el demo interactivo? (y/n): ", end="")
            if input().lower().startswith('y'):
                await self.run_interactive_demo()
            
        except Exception as e:
            logger.error(f"Error en demo: {e}")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Cierra la aplicación"""
        logger.info("Cerrando aplicación...")
        self.running = False
        await self.mcp_system.shutdown()
        logger.info("Aplicación cerrada")

async def main():
    """Función principal"""
    app = MCPDemoApplication()
    await app.run_full_demo()

if __name__ == "__main__":
    asyncio.run(main())