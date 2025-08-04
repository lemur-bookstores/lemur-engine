import sys
import json
import asyncio
import logging
from typing import Any, Dict

# Añadir el directorio raíz al path para permitir importaciones absolutas
sys.path.append('.')

from src.mcp.core.integration import MCPIntegrationSystem

# Configuración del logging para depurar problemas en el script de Python
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr  # Enviar logs a stderr para no interferir con stdout (usado para JSON-RPC)
)

class BridgeRequestHandler:
    """
    Maneja las solicitudes entrantes del bridge y las dirige
    al método correspondiente del MCPIntegrationSystem.
    """
    def __init__(self, mcp_system: MCPIntegrationSystem):
        self._mcp_system = mcp_system
        # Mapeo de nombres de método JSON-RPC a funciones de la clase MCPIntegrationSystem
        self._method_map = {
            "registerResource": self._mcp_system.register_resource,
            "readResource": self._mcp_system.read_resource,
            "registerTool": self._mcp_system.register_tool,
            "callTool": self._mcp_system.call_tool,
            "listResources": self._mcp_system.list_resources,
            "listTools": self._mcp_system.list_tools,
            "getSystemStats": self._mcp_system.get_system_stats,
        }

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Procesa una solicitud JSON-RPC y devuelve una respuesta.
        """
        request_id = request.get("id")
        method_name = request.get("method")
        params = request.get("params", {})

        if not method_name or method_name not in self._method_map:
            logging.warning(f"Method not found: {method_name}")
            return self._create_error_response(request_id, -32601, f"Method not found: {method_name}")

        try:
            method_to_call = self._method_map[method_name]
            
            # Llama al método, sea síncrono o asíncrono
            if asyncio.iscoroutinefunction(method_to_call):
                result = await method_to_call(**params)
            else:
                result = method_to_call(**params)
            
            return self._create_success_response(request_id, result)

        except Exception as e:
            logging.error(f"Error handling request {request_id} for method {method_name}: {e}", exc_info=True)
            # Adaptar el mensaje de error para que coincida con lo esperado en el test
            if "not found" in str(e):
                 return self._create_error_response(request_id, -32001, "Resource not found")
            return self._create_error_response(request_id, -32603, f"Internal error: {e}")

    def _create_success_response(self, request_id: Any, result: Any) -> Dict[str, Any]:
        return {"id": request_id, "result": result, "jsonrpc": "2.0"}

    def _create_error_response(self, request_id: Any, code: int, message: str) -> Dict[str, Any]:
        return {"id": request_id, "error": {"code": code, "message": message}, "jsonrpc": "2.0"}


async def main_loop(handler: BridgeRequestHandler):
    """
    Bucle principal que lee de stdin, procesa solicitudes y escribe en stdout.
    """
    loop = asyncio.get_event_loop()
    logging.info("Starting main loop. Listening for requests on stdin...")

    while True:
        try:
            # Usar run_in_executor para leer de forma no bloqueante, compatible con Windows
            line = await loop.run_in_executor(None, sys.stdin.readline)
            
            if not line:
                logging.info("Stdin has been closed. Exiting loop.")
                break
            
            line = line.strip()
            if not line:
                continue

            logging.info(f"Received line: {line}")

            try:
                request = json.loads(line)
                response = await handler.handle_request(request)
            except json.JSONDecodeError:
                logging.error(f"Failed to decode JSON from line: {line}")
                response = handler._create_error_response(None, -32700, "Parse error")
            
            # Enviar la respuesta a stdout
            sys.stdout.write(json.dumps(response) + '\n')
            sys.stdout.flush()
            logging.info(f"Sent response: {response}")

        except (BrokenPipeError, KeyboardInterrupt):
            logging.info("Process interrupted. Shutting down.")
            break
        except Exception as e:
            logging.critical(f"An unexpected error occurred in the main loop: {e}", exc_info=True)
            # Evita que un error no manejado rompa el bucle
            continue


async def main():
    """
    Función principal que inicializa el sistema y ejecuta el bucle principal.
    """
    logging.info("MCP Python Bridge script started.")
    
    mcp_system = MCPIntegrationSystem()
    await mcp_system.start()
    
    handler = BridgeRequestHandler(mcp_system)
    
    try:
        await main_loop(handler)
    finally:
        await mcp_system.stop()
        logging.info("MCP Python Bridge script finished.")


if __name__ == "__main__":
    # En Windows, es necesario establecer una política de eventos para que asyncio funcione correctamente
    # con subprocesos y pipes.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Main process interrupted by user.")
    except Exception as e:
        logging.critical(f"Critical error at top level: {e}", exc_info=True)
        sys.exit(1)
