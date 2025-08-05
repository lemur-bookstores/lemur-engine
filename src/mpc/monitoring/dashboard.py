"""
Dashboard de Monitoreo para MPC
===============================

Este módulo implementa un dashboard web para visualizar
las métricas y el estado del sistema MPC.
"""

import json
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

try:
    from aiohttp import web, WSMsgType
    from aiohttp.web import Application, Request, Response, WebSocketResponse
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    # Mock classes
    class Application: pass
    class Request: pass
    class Response: pass
    class WebSocketResponse: pass
    web = None

from ..monitoring.metrics import MonitoringSystem, HealthStatus


class DashboardServer:
    """Servidor del dashboard de monitoreo"""
    
    def __init__(self, monitoring_system: MonitoringSystem, port: int = 8080):
        self.monitoring_system = monitoring_system
        self.port = port
        self.app = None
        self.runner = None
        self.site = None
        self.websockets = set()
        
        if not AIOHTTP_AVAILABLE:
            logging.warning("aiohttp not available, dashboard will not work")
    
    async def start(self):
        """Inicia el servidor del dashboard"""
        if not AIOHTTP_AVAILABLE:
            logging.error("Cannot start dashboard: aiohttp not available")
            return
        
        self.app = web.Application()
        self._setup_routes()
        
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        
        self.site = web.TCPSite(self.runner, 'localhost', self.port)
        await self.site.start()
        
        # Iniciar broadcast de métricas
        asyncio.create_task(self._metrics_broadcast_loop())
        
        logging.info(f"Dashboard server started on http://localhost:{self.port}")
    
    async def stop(self):
        """Detiene el servidor del dashboard"""
        if self.site:
            await self.site.stop()
        if self.runner:
            await self.runner.cleanup()
        
        # Cerrar todas las conexiones WebSocket
        for ws in self.websockets.copy():
            await ws.close()
        
        logging.info("Dashboard server stopped")
    
    def _setup_routes(self):
        """Configura las rutas del servidor"""
        self.app.router.add_get('/', self._index_handler)
        self.app.router.add_get('/api/health', self._health_handler)
        self.app.router.add_get('/api/metrics', self._metrics_handler)
        self.app.router.add_get('/api/performance', self._performance_handler)
        self.app.router.add_get('/ws', self._websocket_handler)
        self.app.router.add_static('/static', self._get_static_path())
    
    def _get_static_path(self) -> str:
        """Obtiene la ruta de archivos estáticos"""
        # En una implementación real, esto apuntaría a archivos CSS/JS
        return "."
    
    async def _index_handler(self, request: Request) -> Response:
        """Handler para la página principal"""
        html_content = self._generate_dashboard_html()
        return web.Response(text=html_content, content_type='text/html')
    
    async def _health_handler(self, request: Request) -> Response:
        """Handler para el endpoint de salud"""
        health_status = self.monitoring_system.health_monitor.get_health_status()
        return web.json_response(health_status)
    
    async def _metrics_handler(self, request: Request) -> Response:
        """Handler para el endpoint de métricas"""
        # Obtener parámetros de consulta
        since_param = request.query.get('since')
        since = None
        if since_param:
            try:
                since = float(since_param)
            except ValueError:
                pass
        
        metrics = self.monitoring_system.metrics_collector.get_all_metrics()
        
        # Filtrar por tiempo si se especifica
        if since:
            filtered_metrics = {}
            for name, points in metrics.items():
                filtered_points = [p for p in points if p.timestamp >= since]
                if filtered_points:
                    filtered_metrics[name] = [
                        {
                            'timestamp': p.timestamp,
                            'value': p.value,
                            'labels': p.labels
                        }
                        for p in filtered_points
                    ]
            metrics = filtered_metrics
        else:
            # Convertir a formato JSON serializable
            metrics = {
                name: [
                    {
                        'timestamp': p.timestamp,
                        'value': p.value,
                        'labels': p.labels
                    }
                    for p in points
                ]
                for name, points in metrics.items()
            }
        
        return web.json_response(metrics)
    
    async def _performance_handler(self, request: Request) -> Response:
        """Handler para el endpoint de rendimiento"""
        performance_stats = self.monitoring_system.performance_monitor.get_performance_stats()
        return web.json_response(performance_stats)
    
    async def _websocket_handler(self, request: Request) -> WebSocketResponse:
        """Handler para conexiones WebSocket"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        self.websockets.add(ws)
        
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        await self._handle_websocket_message(ws, data)
                    except json.JSONDecodeError:
                        await ws.send_str(json.dumps({
                            'error': 'Invalid JSON'
                        }))
                elif msg.type == WSMsgType.ERROR:
                    logging.error(f'WebSocket error: {ws.exception()}')
        except Exception as e:
            logging.error(f"WebSocket handler error: {e}")
        finally:
            self.websockets.discard(ws)
        
        return ws
    
    async def _handle_websocket_message(self, ws: WebSocketResponse, data: Dict[str, Any]):
        """Maneja mensajes WebSocket"""
        message_type = data.get('type')
        
        if message_type == 'subscribe':
            # El cliente se suscribe a actualizaciones
            await ws.send_str(json.dumps({
                'type': 'subscribed',
                'message': 'Successfully subscribed to metrics updates'
            }))
        elif message_type == 'get_status':
            # Enviar estado actual
            status = self.monitoring_system.get_system_status()
            await ws.send_str(json.dumps({
                'type': 'status',
                'data': status
            }))
    
    async def _metrics_broadcast_loop(self):
        """Loop para broadcast de métricas a clientes WebSocket"""
        while True:
            try:
                if self.websockets:
                    status = self.monitoring_system.get_system_status()
                    message = json.dumps({
                        'type': 'metrics_update',
                        'timestamp': datetime.now().isoformat(),
                        'data': status
                    })
                    
                    # Enviar a todos los clientes conectados
                    disconnected = set()
                    for ws in self.websockets:
                        try:
                            await ws.send_str(message)
                        except Exception:
                            disconnected.add(ws)
                    
                    # Remover conexiones desconectadas
                    self.websockets -= disconnected
                
                await asyncio.sleep(5)  # Actualizar cada 5 segundos
                
            except Exception as e:
                logging.error(f"Error in metrics broadcast loop: {e}")
                await asyncio.sleep(5)
    
    def _generate_dashboard_html(self) -> str:
        """Genera el HTML del dashboard"""
        return """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MPC Monitoring Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .card h3 {
            color: #4a5568;
            margin-bottom: 15px;
            font-size: 1.3em;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .status-healthy { background-color: #48bb78; }
        .status-degraded { background-color: #ed8936; }
        .status-unhealthy { background-color: #f56565; }
        .status-unknown { background-color: #a0aec0; }
        
        .metric-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f7fafc;
        }
        
        .metric-item:last-child {
            border-bottom: none;
        }
        
        .metric-value {
            font-weight: bold;
            color: #2d3748;
        }
        
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 25px;
            color: white;
            font-weight: bold;
            z-index: 1000;
        }
        
        .connected { background-color: #48bb78; }
        .disconnected { background-color: #f56565; }
        
        .charts-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        
        .chart-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .chart {
            width: 100%;
            height: 200px;
            background: #f8f9fa;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
            font-style: italic;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .loading {
            animation: pulse 2s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 MPC Monitoring Dashboard</h1>
            <p>Sistema de Monitoreo Multi-Protocolo en Tiempo Real</p>
        </div>
        
        <div id="connectionStatus" class="connection-status disconnected">
            Desconectado
        </div>
        
        <div class="status-grid">
            <div class="card">
                <h3>🏥 Estado de Salud</h3>
                <div id="healthStatus" class="loading">
                    Cargando estado de salud...
                </div>
            </div>
            
            <div class="card">
                <h3>⚡ Rendimiento</h3>
                <div id="performanceStatus" class="loading">
                    Cargando métricas de rendimiento...
                </div>
            </div>
            
            <div class="card">
                <h3>🔗 Conexiones Activas</h3>
                <div id="connectionsStatus" class="loading">
                    Cargando información de conexiones...
                </div>
            </div>
            
            <div class="card">
                <h3>📊 Métricas Generales</h3>
                <div id="metricsStatus" class="loading">
                    Cargando métricas del sistema...
                </div>
            </div>
        </div>
        
        <div class="charts-container">
            <div class="chart-card">
                <h3>📈 Requests por Segundo</h3>
                <div class="chart">
                    Gráfico de requests en tiempo real
                </div>
            </div>
            
            <div class="chart-card">
                <h3>⏱️ Latencia Promedio</h3>
                <div class="chart">
                    Gráfico de latencia en tiempo real
                </div>
            </div>
            
            <div class="chart-card">
                <h3>💾 Uso de Memoria</h3>
                <div class="chart">
                    Gráfico de memoria en tiempo real
                </div>
            </div>
            
            <div class="chart-card">
                <h3>🔄 CPU Usage</h3>
                <div class="chart">
                    Gráfico de CPU en tiempo real
                </div>
            </div>
        </div>
    </div>

    <script>
        class DashboardClient {
            constructor() {
                this.ws = null;
                this.reconnectAttempts = 0;
                this.maxReconnectAttempts = 5;
                this.reconnectDelay = 1000;
                this.connect();
            }
            
            connect() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws`;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('Connected to dashboard WebSocket');
                    this.updateConnectionStatus(true);
                    this.reconnectAttempts = 0;
                    
                    // Suscribirse a actualizaciones
                    this.send({ type: 'subscribe' });
                    
                    // Solicitar estado inicial
                    this.send({ type: 'get_status' });
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error: any) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };
                
                this.ws.onclose = () => {
                    console.log('Disconnected from dashboard WebSocket');
                    this.updateConnectionStatus(false);
                    this.attemptReconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };
            }
            
            send(data) {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(data));
                }
            }
            
            handleMessage(data) {
                switch (data.type) {
                    case 'subscribed':
                        console.log('Successfully subscribed to updates');
                        break;
                    case 'status':
                    case 'metrics_update':
                        this.updateDashboard(data.data);
                        break;
                    default:
                        console.log('Unknown message type:', data.type);
                }
            }
            
            updateConnectionStatus(connected) {
                const statusEl = document.getElementById('connectionStatus');
                if (connected) {
                    statusEl.textContent = 'Conectado';
                    statusEl.className = 'connection-status connected';
                } else {
                    statusEl.textContent = 'Desconectado';
                    statusEl.className = 'connection-status disconnected';
                }
            }
            
            attemptReconnect() {
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    
                    setTimeout(() => {
                        this.connect();
                    }, this.reconnectDelay * this.reconnectAttempts);
                } else {
                    console.log('Max reconnection attempts reached');
                }
            }
            
            updateDashboard(systemStatus) {
                this.updateHealthStatus(systemStatus.health);
                this.updatePerformanceStatus(systemStatus.performance);
                this.updateMetricsStatus(systemStatus);
            }
            
            updateHealthStatus(health) {
                const healthEl = document.getElementById('healthStatus');
                const overallStatus = health.overall_status;
                
                let html = `
                    <div class="metric-item">
                        <span>Estado General:</span>
                        <span class="metric-value">
                            <span class="status-indicator status-${overallStatus}"></span>
                            ${overallStatus.toUpperCase()}
                        </span>
                    </div>
                `;
                
                Object.entries(health.checks || {}).forEach(([name, check]) => {
                    html += `
                        <div class="metric-item">
                            <span>${name}:</span>
                            <span class="metric-value">
                                <span class="status-indicator status-${check.status}"></span>
                                ${check.status.toUpperCase()}
                            </span>
                        </div>
                    `;
                });
                
                healthEl.innerHTML = html;
            }
            
            updatePerformanceStatus(performance) {
                const perfEl = document.getElementById('performanceStatus');
                
                let html = '';
                
                // Rate Limiters
                Object.entries(performance.rate_limiters || {}).forEach(([name, limiter]) => {
                    html += `
                        <div class="metric-item">
                            <span>${name} (tokens):</span>
                            <span class="metric-value">${limiter.tokens.toFixed(1)}</span>
                        </div>
                    `;
                });
                
                // Circuit Breakers
                Object.entries(performance.circuit_breakers || {}).forEach(([name, breaker]) => {
                    html += `
                        <div class="metric-item">
                            <span>${name}:</span>
                            <span class="metric-value">${breaker.state.toUpperCase()}</span>
                        </div>
                    `;
                });
                
                if (!html) {
                    html = '<div class="metric-item"><span>No hay datos de rendimiento disponibles</span></div>';
                }
                
                perfEl.innerHTML = html;
            }
            
            updateMetricsStatus(systemStatus) {
                const metricsEl = document.getElementById('metricsStatus');
                
                const html = `
                    <div class="metric-item">
                        <span>Métricas Disponibles:</span>
                        <span class="metric-value">${systemStatus.metrics_available ? 'Sí' : 'No'}</span>
                    </div>
                    <div class="metric-item">
                        <span>Prometheus Habilitado:</span>
                        <span class="metric-value">${systemStatus.prometheus_enabled ? 'Sí' : 'No'}</span>
                    </div>
                    <div class="metric-item">
                        <span>Última Actualización:</span>
                        <span class="metric-value">${new Date().toLocaleTimeString()}</span>
                    </div>
                `;
                
                metricsEl.innerHTML = html;
                
                // Actualizar conexiones (simulado)
                const connectionsEl = document.getElementById('connectionsStatus');
                connectionsEl.innerHTML = `
                    <div class="metric-item">
                        <span>HTTP:</span>
                        <span class="metric-value">0</span>
                    </div>
                    <div class="metric-item">
                        <span>WebSocket:</span>
                        <span class="metric-value">0</span>
                    </div>
                    <div class="metric-item">
                        <span>gRPC:</span>
                        <span class="metric-value">0</span>
                    </div>
                `;
            }
        }
        
        // Inicializar dashboard cuando se carga la página
        document.addEventListener('DOMContentLoaded', () => {
            new DashboardClient();
        });
    </script>
</body>
</html>
        """


class MetricsDashboard:
    """Dashboard simplificado para métricas"""
    
    def __init__(self, monitoring_system: MonitoringSystem):
        self.monitoring_system = monitoring_system
    
    def generate_text_dashboard(self) -> str:
        """Genera un dashboard en formato texto"""
        status = self.monitoring_system.get_system_status()
        
        lines = []
        lines.append("=" * 60)
        lines.append("🚀 MPC MONITORING DASHBOARD")
        lines.append("=" * 60)
        lines.append(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # Estado de salud
        health = status['health']
        lines.append("🏥 HEALTH STATUS")
        lines.append("-" * 20)
        lines.append(f"Overall Status: {health['overall_status'].upper()}")
        
        for name, check in health.get('checks', {}).items():
            status_icon = {
                'healthy': '✅',
                'degraded': '⚠️',
                'unhealthy': '❌',
                'unknown': '❓'
            }.get(check['status'], '❓')
            
            lines.append(f"{status_icon} {name}: {check['status'].upper()}")
        
        lines.append("")
        
        # Rendimiento
        performance = status['performance']
        lines.append("⚡ PERFORMANCE")
        lines.append("-" * 20)
        
        for name, limiter in performance.get('rate_limiters', {}).items():
            lines.append(f"Rate Limiter {name}: {limiter['tokens']:.1f} tokens")
        
        for name, breaker in performance.get('circuit_breakers', {}).items():
            lines.append(f"Circuit Breaker {name}: {breaker['state'].upper()}")
        
        lines.append("")
        
        # Sistema
        lines.append("📊 SYSTEM INFO")
        lines.append("-" * 20)
        lines.append(f"Metrics Available: {'Yes' if status['metrics_available'] else 'No'}")
        lines.append(f"Prometheus Enabled: {'Yes' if status['prometheus_enabled'] else 'No'}")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def print_dashboard(self):
        """Imprime el dashboard en consola"""
        print(self.generate_text_dashboard())