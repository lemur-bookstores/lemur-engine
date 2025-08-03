"""
Ejemplo Completo de Integración MPC + MCP
=========================================

Este ejemplo demuestra la integración completa del sistema MCP
con el sistema MPC existente, mostrando cómo usar todos los
protocolos (HTTP, WebSocket, gRPC, MCP) de manera unificada.
"""

import asyncio
import logging
from typing import Dict, Any

# Importaciones del sistema MPC
from src.mpc import (
    MPCRouter, UnifiedGateway, MPCConnectionManager,
    HTTPAdapter, WebSocketAdapter, GRPCAdapter,
    MonitoringSystem, MetricsCollector,
    ProtocolType, Message, MessageType,
    MCP_AVAILABLE
)

# Importaciones del sistema MCP (si está disponible)
if MCP_AVAILABLE:
    from src.mcp import (
        MCPAdapter, MCPIntegrationSystem, MCPPluginManager,
        MCPConfig, DEFAULT_MCP_CONFIG
    )
    from src.mcp.plugins import FileSystemPlugin, UtilityToolsPlugin

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MPCMCPIntegratedSystem:
    """Sistema integrado MPC + MCP"""
    
    def __init__(self):
        self.router = None
        self.gateway = None
        self.connection_manager = None
        self.monitoring = None
        self.mcp_system = None
        self.adapters = {}
        
    async def initialize(self):
        """Inicializa el sistema completo"""
        logger.info("🚀 Inicializando sistema MPC + MCP integrado...")
        
        # 1. Inicializar sistema de monitoreo
        await self._initialize_monitoring()
        
        # 2. Inicializar gestores principales
        await self._initialize_core_managers()
        
        # 3. Inicializar adaptadores de protocolo
        await self._initialize_protocol_adapters()
        
        # 4. Inicializar sistema MCP (si está disponible)
        if MCP_AVAILABLE:
            await self._initialize_mcp_system()
        
        # 5. Configurar gateway unificado
        await self._initialize_gateway()
        
        logger.info("✅ Sistema MPC + MCP inicializado correctamente")
    
    async def _initialize_monitoring(self):
        """Inicializa el sistema de monitoreo"""
        logger.info("📊 Inicializando sistema de monitoreo...")
        
        self.monitoring = MonitoringSystem()
        await self.monitoring.start()
        
        # Configurar métricas personalizadas para MCP
        if MCP_AVAILABLE:
            metrics = self.monitoring.metrics_collector
            metrics.register_counter("mcp_requests_total", "Total MCP requests")
            metrics.register_histogram("mcp_request_duration", "MCP request duration")
            metrics.register_gauge("mcp_active_connections", "Active MCP connections")
    
    async def _initialize_core_managers(self):
        """Inicializa los gestores principales"""
        logger.info("🔧 Inicializando gestores principales...")
        
        # Router de mensajes
        self.router = MPCRouter()
        await self.router.start()
        
        # Gestor de conexiones
        self.connection_manager = MPCConnectionManager()
        await self.connection_manager.start()
    
    async def _initialize_protocol_adapters(self):
        """Inicializa los adaptadores de protocolo"""
        logger.info("🔌 Inicializando adaptadores de protocolo...")
        
        # HTTP Adapter
        http_adapter = HTTPAdapter(
            host="localhost",
            port=8080,
            connection_manager=self.connection_manager
        )
        await http_adapter.start()
        await self.router.register_adapter(ProtocolType.HTTP, http_adapter)
        self.adapters[ProtocolType.HTTP] = http_adapter
        
        # WebSocket Adapter
        ws_adapter = WebSocketAdapter(
            host="localhost",
            port=8081,
            connection_manager=self.connection_manager
        )
        await ws_adapter.start()
        await self.router.register_adapter(ProtocolType.WEBSOCKET, ws_adapter)
        self.adapters[ProtocolType.WEBSOCKET] = ws_adapter
        
        # gRPC Adapter
        grpc_adapter = GRPCAdapter(
            host="localhost",
            port=50051,
            connection_manager=self.connection_manager
        )
        await grpc_adapter.start()
        await self.router.register_adapter(ProtocolType.GRPC, grpc_adapter)
        self.adapters[ProtocolType.GRPC] = grpc_adapter
    
    async def _initialize_mcp_system(self):
        """Inicializa el sistema MCP"""
        logger.info("🤖 Inicializando sistema MCP...")
        
        # Configuración MCP
        mcp_config = DEFAULT_MCP_CONFIG
        mcp_config.server.host = "localhost"
        mcp_config.server.port = 8082
        
        # Sistema de integración MCP
        self.mcp_system = MCPIntegrationSystem(mcp_config)
        await self.mcp_system.start()
        
        # Plugin manager
        plugin_manager = MCPPluginManager()
        
        # Cargar plugins
        filesystem_plugin = FileSystemPlugin()
        utility_plugin = UtilityToolsPlugin()
        
        await plugin_manager.load_plugin(filesystem_plugin)
        await plugin_manager.load_plugin(utility_plugin)
        
        # Registrar plugins en el sistema MCP
        await self.mcp_system.register_plugin_manager(plugin_manager)
        
        # MCP Adapter
        mcp_adapter = MCPAdapter(
            integration_system=self.mcp_system,
            connection_manager=self.connection_manager
        )
        await mcp_adapter.start()
        await self.router.register_adapter(ProtocolType.MCP, mcp_adapter)
        self.adapters[ProtocolType.MCP] = mcp_adapter
    
    async def _initialize_gateway(self):
        """Inicializa el gateway unificado"""
        logger.info("🌐 Inicializando gateway unificado...")
        
        self.gateway = UnifiedGateway(
            router=self.router,
            connection_manager=self.connection_manager,
            monitoring_system=self.monitoring
        )
        await self.gateway.start()
    
    async def demonstrate_multi_protocol_communication(self):
        """Demuestra comunicación multi-protocolo"""
        logger.info("🔄 Demostrando comunicación multi-protocolo...")
        
        # Mensaje HTTP
        http_message = Message(
            id="http-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.HTTP,
            source="client",
            destination="http://localhost:8080/api/test",
            payload={"action": "test", "data": "HTTP message"}
        )
        
        # Mensaje WebSocket
        ws_message = Message(
            id="ws-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.WEBSOCKET,
            source="client",
            destination="ws://localhost:8081/ws",
            payload={"action": "test", "data": "WebSocket message"}
        )
        
        # Mensaje gRPC
        grpc_message = Message(
            id="grpc-001",
            type=MessageType.REQUEST,
            protocol=ProtocolType.GRPC,
            source="client",
            destination="grpc://localhost:50051/TestService/TestMethod",
            payload={"action": "test", "data": "gRPC message"}
        )
        
        # Enviar mensajes a través del router
        try:
            await self.router.route_message(http_message)
            logger.info("✅ Mensaje HTTP enviado")
            
            await self.router.route_message(ws_message)
            logger.info("✅ Mensaje WebSocket enviado")
            
            await self.router.route_message(grpc_message)
            logger.info("✅ Mensaje gRPC enviado")
            
        except Exception as e:
            logger.error(f"❌ Error enviando mensajes: {e}")
        
        # Demostrar MCP si está disponible
        if MCP_AVAILABLE and self.mcp_system:
            await self._demonstrate_mcp_capabilities()
    
    async def _demonstrate_mcp_capabilities(self):
        """Demuestra las capacidades MCP"""
        logger.info("🤖 Demostrando capacidades MCP...")
        
        try:
            # Listar recursos disponibles
            resources = await self.mcp_system.list_resources()
            logger.info(f"📁 Recursos MCP disponibles: {len(resources)}")
            
            # Listar herramientas disponibles
            tools = await self.mcp_system.list_tools()
            logger.info(f"🔧 Herramientas MCP disponibles: {len(tools)}")
            
            # Mensaje MCP
            mcp_message = Message(
                id="mcp-001",
                type=MessageType.REQUEST,
                protocol=ProtocolType.MCP,
                source="client",
                destination="mcp://localhost:8082/tools/hash_text",
                payload={
                    "tool": "hash_text",
                    "arguments": {
                        "text": "Hello MCP!",
                        "algorithm": "sha256"
                    }
                }
            )
            
            await self.router.route_message(mcp_message)
            logger.info("✅ Mensaje MCP enviado")
            
        except Exception as e:
            logger.error(f"❌ Error en demostración MCP: {e}")
    
    async def show_system_status(self):
        """Muestra el estado del sistema"""
        logger.info("📊 Estado del sistema:")
        
        # Estado de adaptadores
        for protocol, adapter in self.adapters.items():
            status = "🟢 Activo" if adapter.is_running else "🔴 Inactivo"
            logger.info(f"  {protocol.value}: {status}")
        
        # Estado del router
        router_status = "🟢 Activo" if self.router.is_running else "🔴 Inactivo"
        logger.info(f"  Router: {router_status}")
        
        # Estado del gateway
        gateway_status = "🟢 Activo" if self.gateway.is_running else "🔴 Inactivo"
        logger.info(f"  Gateway: {gateway_status}")
        
        # Estado MCP
        if MCP_AVAILABLE and self.mcp_system:
            mcp_status = "🟢 Activo" if self.mcp_system.is_running else "🔴 Inactivo"
            logger.info(f"  MCP System: {mcp_status}")
        else:
            logger.info(f"  MCP System: ⚠️ No disponible")
        
        # Métricas del sistema
        if self.monitoring:
            metrics = await self.monitoring.get_metrics()
            logger.info(f"📈 Métricas del sistema:")
            for metric_name, metric_value in metrics.items():
                logger.info(f"    {metric_name}: {metric_value}")
    
    async def shutdown(self):
        """Cierra el sistema completo"""
        logger.info("🛑 Cerrando sistema MPC + MCP...")
        
        # Cerrar gateway
        if self.gateway:
            await self.gateway.stop()
        
        # Cerrar adaptadores
        for adapter in self.adapters.values():
            await adapter.stop()
        
        # Cerrar sistema MCP
        if self.mcp_system:
            await self.mcp_system.stop()
        
        # Cerrar router
        if self.router:
            await self.router.stop()
        
        # Cerrar connection manager
        if self.connection_manager:
            await self.connection_manager.stop()
        
        # Cerrar monitoreo
        if self.monitoring:
            await self.monitoring.stop()
        
        logger.info("✅ Sistema cerrado correctamente")


async def main():
    """Función principal del ejemplo"""
    system = MPCMCPIntegratedSystem()
    
    try:
        # Inicializar sistema
        await system.initialize()
        
        # Mostrar estado inicial
        await system.show_system_status()
        
        # Demostrar comunicación multi-protocolo
        await system.demonstrate_multi_protocol_communication()
        
        # Esperar un poco para ver los resultados
        await asyncio.sleep(2)
        
        # Mostrar estado final
        await system.show_system_status()
        
        # Mantener el sistema corriendo por un tiempo
        logger.info("🔄 Sistema corriendo... (Presiona Ctrl+C para detener)")
        await asyncio.sleep(30)
        
    except KeyboardInterrupt:
        logger.info("⚠️ Interrupción del usuario detectada")
    except Exception as e:
        logger.error(f"❌ Error en el sistema: {e}")
    finally:
        await system.shutdown()


if __name__ == "__main__":
    print("🚀 Iniciando ejemplo de integración MPC + MCP")
    print("=" * 50)
    
    if not MCP_AVAILABLE:
        print("⚠️ ADVERTENCIA: MCP no está disponible")
        print("   El ejemplo funcionará solo con HTTP, WebSocket y gRPC")
        print()
    
    asyncio.run(main())