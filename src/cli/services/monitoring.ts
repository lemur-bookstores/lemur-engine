import * as http from "http";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import mustache from "mustache";
import { MonitorConfig, SystemMetrics } from "../types";

const execAsync = promisify(exec);

class MetricsCollector {
  private metrics: SystemMetrics[];
  private maxHistorySize: number;

  constructor(maxHistorySize = 1000) {
    this.metrics = [];
    this.maxHistorySize = maxHistorySize;
  }

  async collect(): Promise<SystemMetrics> {
    try {
      const cpuUsage = await this.getCpuUsage();
      const memInfo = this.getMemoryInfo();
      const diskInfo = await this.getDiskInfo();
      const networkInfo = await this.getNetworkInfo();
      const processInfo = this.getProcessInfo();

      const metrics: SystemMetrics = {
        timestamp: Date.now(),
        cpu: cpuUsage,
        memory: memInfo,
        disk: diskInfo,
        network: networkInfo,
        process: processInfo,
      };

      this.metrics.push(metrics);
      if (this.metrics.length > this.maxHistorySize) {
        this.metrics.shift();
      }

      return metrics;
    } catch (error: any) {
      console.error("Error collecting metrics:", error);
      throw error;
    }
  }

  // Corrección de índices dinámicos en cpu.times
  private async getCpuUsage(): Promise<SystemMetrics["cpu"]> {
    const load = os.loadavg();
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      totalTick +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
      totalIdle += cpu.times.idle;
    });

    const usage = 100 - (totalIdle / totalTick) * 100;

    return {
      usage: Math.round(usage * 100) / 100,
      load,
    };
  }

  private getMemoryInfo(): SystemMetrics["memory"] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;

    return {
      total,
      used,
      free,
      usage: Math.round(usage * 100) / 100,
    };
  }

  private async getDiskInfo(): Promise<SystemMetrics["disk"]> {
    try {
      const stats = await fs.statfs("/");
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      const usage = (used / total) * 100;

      return {
        total,
        used,
        free,
        usage: Math.round(usage * 100) / 100,
      };
    } catch (error: any) {
      console.warn("Error al obtener información del disco:", error.message);
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0,
      };
    }
  }

  // Implementación completa con soporte para Windows y Linux
  private async getNetworkInfo(): Promise<SystemMetrics["network"]> {
    if (process.platform === "win32") {
      return await this.getWindowsNetworkInfo();
    } else {
      return await this.getLinuxNetworkInfo();
    }
  }

  private async getWindowsNetworkInfo(): Promise<SystemMetrics["network"]> {
    try {
      // Opción 1: Primero verificamos qué adaptadores están disponibles
      const checkCommand = `powershell -Command "Get-NetAdapterStatistics | Where-Object {$_.Name -notlike '*Loopback*' -and $_.Name -notlike '*Teredo*' -and $_.Name -notlike '*isatap*'} | Select-Object Name, BytesReceived, BytesSent, PacketsInbound, PacketsOutbound | ConvertTo-Json"`;

      const { stdout } = await execAsync(checkCommand);

      if (!stdout.trim()) {
        console.warn("No se encontraron adaptadores de red válidos");
        return await this.getWindowsNetworkInfoWMIC();
      }

      const adapters = JSON.parse(stdout);
      const adapterArray = Array.isArray(adapters) ? adapters : [adapters];

      let bytesIn = 0;
      let bytesOut = 0;
      let packetsIn = 0;
      let packetsOut = 0;

      adapterArray.forEach((adapter: any) => {
        if (adapter) {
          bytesIn += parseInt(adapter.BytesReceived) || 0;
          bytesOut += parseInt(adapter.BytesSent) || 0;
          packetsIn += parseInt(adapter.PacketsInbound) || 0;
          packetsOut += parseInt(adapter.PacketsOutbound) || 0;
        }
      });

      return { bytesIn, bytesOut, packetsIn, packetsOut };
    } catch (error: any) {
      console.warn(
        "Error con PowerShell, intentando enfoque alternativo:",
        (error as Error).message,
      );

      try {
        // Opción 2: Enfoque alternativo con Get-Counter
        return await this.getWindowsNetworkInfoCounter();
      } catch (counterError) {
        console.warn(
          "Error con Get-Counter, intentando con WMIC:",
          (counterError as Error).message,
        );

        try {
          // Opción 3: Fallback usando WMIC
          return await this.getWindowsNetworkInfoWMIC();
        } catch (wmicError) {
          console.warn(
            "Error al obtener información de red en Windows:",
            (wmicError as Error).message,
          );
          return {
            bytesIn: 0,
            bytesOut: 0,
            packetsIn: 0,
            packetsOut: 0,
          };
        }
      }
    }
  }

  private async getWindowsNetworkInfoCounter(): Promise<
    SystemMetrics["network"]
  > {
    const command = `powershell -Command "Get-Counter '\\Network Interface(*)\\Bytes Received/sec', '\\Network Interface(*)\\Bytes Sent/sec', '\\Network Interface(*)\\Packets Received/sec', '\\Network Interface(*)\\Packets Sent/sec' | ForEach-Object { $_.CounterSamples | Where-Object { $_.InstanceName -notlike '*Loopback*' -and $_.InstanceName -notlike '*Teredo*' -and $_.InstanceName -ne '_Total' } | Select-Object InstanceName, Path, CookedValue | ConvertTo-Json }"`;

    const { stdout } = await execAsync(command);
    const counters = JSON.parse(stdout);
    const counterArray = Array.isArray(counters) ? counters : [counters];

    let bytesIn = 0;
    let bytesOut = 0;
    let packetsIn = 0;
    let packetsOut = 0;

    counterArray.forEach((counter: any) => {
      if (counter && counter.Path) {
        const path = counter.Path.toLowerCase();
        const value = parseFloat(counter.CookedValue) || 0;

        if (path.includes("bytes received")) {
          bytesIn += value;
        } else if (path.includes("bytes sent")) {
          bytesOut += value;
        } else if (path.includes("packets received")) {
          packetsIn += value;
        } else if (path.includes("packets sent")) {
          packetsOut += value;
        }
      }
    });

    return {
      bytesIn: Math.round(bytesIn),
      bytesOut: Math.round(bytesOut),
      packetsIn: Math.round(packetsIn),
      packetsOut: Math.round(packetsOut),
    };
  }

  private async getWindowsNetworkInfoWMIC(): Promise<SystemMetrics["network"]> {
    try {
      // Obtenemos las estadísticas de rendimiento directamente
      const statsCommand = `wmic path Win32_PerfRawData_Tcpip_NetworkInterface get Name,BytesReceivedPerSec,BytesSentPerSec,PacketsReceivedPerSec,PacketsSentPerSec /format:csv`;
      const { stdout: statsOutput } = await execAsync(statsCommand);

      const lines = statsOutput
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("Node"));

      let bytesIn = 0;
      let bytesOut = 0;
      let packetsIn = 0;
      let packetsOut = 0;

      lines.forEach((line) => {
        const parts = line.split(",").map((part) => part.trim());
        if (parts.length >= 6) {
          const name = parts[5];

          // Filtrar interfaces no deseadas con mejor lógica
          if (
            name &&
            !name.toLowerCase().includes("loopback") &&
            !name.toLowerCase().includes("teredo") &&
            !name.toLowerCase().includes("isatap") &&
            !name.toLowerCase().includes("6to4") &&
            name !== "_Total" &&
            name !== "MS TCP Loopback interface"
          ) {
            const bytesRec = parseInt(parts[1]) || 0;
            const bytesSent = parseInt(parts[2]) || 0;
            const packetsRec = parseInt(parts[3]) || 0;
            const packetsSent = parseInt(parts[4]) || 0;

            // Solo sumar si los valores son razonables (no negativos ni extremadamente grandes)
            if (bytesRec >= 0 && bytesRec < Number.MAX_SAFE_INTEGER)
              bytesIn += bytesRec;
            if (bytesSent >= 0 && bytesSent < Number.MAX_SAFE_INTEGER)
              bytesOut += bytesSent;
            if (packetsRec >= 0 && packetsRec < Number.MAX_SAFE_INTEGER)
              packetsIn += packetsRec;
            if (packetsSent >= 0 && packetsSent < Number.MAX_SAFE_INTEGER)
              packetsOut += packetsSent;
          }
        }
      });

      return { bytesIn, bytesOut, packetsIn, packetsOut };
    } catch (error: any) {
      console.warn(
        "Error en WMIC, usando valores por defecto:",
        (error as Error).message,
      );

      // Como último recurso, intentamos un comando más simple
      try {
        const simpleCommand = `powershell -Command "Get-WmiObject -Class Win32_NetworkAdapterConfiguration | Where-Object {$_.IPEnabled -eq $true} | Measure-Object | Select-Object Count | ConvertTo-Json"`;
        await execAsync(simpleCommand);

        // Si llegamos aquí, al menos PowerShell funciona, pero no tenemos estadísticas detalladas
        console.info(
          "Sistema Windows detectado pero sin estadísticas de red detalladas disponibles",
        );
      } catch (finalError) {
        console.warn("No se pudieron obtener estadísticas de red en Windows");
      }

      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
      };
    }
  }

  private async getLinuxNetworkInfo(): Promise<SystemMetrics["network"]> {
    try {
      const stats = await fs.readFile("/proc/net/dev", "utf8");
      let bytesIn = 0;
      let bytesOut = 0;
      let packetsIn = 0;
      let packetsOut = 0;

      stats
        .split("\n")
        .slice(2)
        .forEach((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 10 && !parts[0].startsWith("lo:")) {
            bytesIn += parseInt(parts[1], 10);
            packetsIn += parseInt(parts[2], 10);
            bytesOut += parseInt(parts[9], 10);
            packetsOut += parseInt(parts[10], 10);
          }
        });

      return { bytesIn, bytesOut, packetsIn, packetsOut };
    } catch (error: unknown) {
      console.warn(
        "Error al obtener información de red:",
        (error as Error).message,
      );
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
      };
    }
  }

  private getProcessInfo(): SystemMetrics["process"] {
    const startTime = process.uptime();
    const memoryUsage = process.memoryUsage();

    return {
      pid: process.pid,
      uptime: Math.round(startTime),
      memory: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      cpu: 0, // Se actualiza en la siguiente recolección
    };
  }

  getHistory(): SystemMetrics[] {
    return this.metrics;
  }

  getLatest(): SystemMetrics | undefined {
    return this.metrics[this.metrics.length - 1];
  }
}

class MetricsExporter {
  private lastExportTime: number = 0;
  private exportQueue: SystemMetrics[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly MIN_EXPORT_INTERVAL = 1000;
  private config: MonitorConfig;
  private metricsHistory: SystemMetrics[] = [];

  constructor(config: MonitorConfig) {
    this.config = config;
    this.loadExistingMetrics();
  }

  private async loadExistingMetrics(): Promise<void> {
    if (!this.config.export.output) return;

    try {
      const data = await fs.readFile(this.config.export.output, "utf8");
      this.metricsHistory = JSON.parse(data);
    } catch (error: any) {
      // Archivo no existe o está vacío, empezar con array vacío
      this.metricsHistory = [];
    }
  }

  async export(metrics: SystemMetrics): Promise<void> {
    const outputPath =
      this.config.export.output ||
      path.resolve(__dirname, "static/metrics.json");

    this.exportQueue.push(metrics);
    this.metricsHistory.push(metrics);

    // Mantener solo las últimas 1000 métricas para evitar archivos muy grandes
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }

    const now = Date.now();
    const exportData =
      this.exportQueue.length >= this.BATCH_SIZE ||
      now - this.lastExportTime >= this.MIN_EXPORT_INTERVAL;
    if (!exportData) return;

    let data = JSON.stringify(this.exportQueue, null, 2);

    if (this.config.export.format === "prometheus") {
      data = this.exportQueue.map((m) => this.toPrometheusFormat(m)).join("\n");
    }

    await fs.writeFile(outputPath, data); // writeFile en lugar de appendFile
    this.lastExportTime = now;
    this.exportQueue = [];
  }

  // Cambiar método privado a público en MetricsExporter
  toPrometheusFormat(metrics: SystemMetrics): string {
    const lines: string[] = [];
    const timestamp = Math.round(metrics.timestamp / 1000);
    const labels = this.getCommonLabels();

    lines.push(
      `# HELP lemur_cpu_usage Current CPU usage percentage\n# TYPE lemur_cpu_usage gauge`,
    );
    lines.push(`lemur_cpu_usage${labels} ${metrics.cpu.usage} ${timestamp}`);

    return lines.join("\n");
  }

  private getCommonLabels(): string {
    return '{instance="localhost"}'; // Ejemplo de etiquetas comunes
  }
}

class Dashboard {
  private server: http.Server;
  private metricsHistory: SystemMetrics[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    private collector: MetricsCollector,
    private config: MonitorConfig,
  ) {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`Dashboard running at http://localhost:${port}`);
        this.startMetricsCollection();
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private startMetricsCollection(): void {
    this.updateInterval = setInterval(() => {
      const metrics = this.collector.getLatest();
      if (metrics) {
        this.metricsHistory.push(metrics);
        this.checkAlerts(metrics);
      }
    }, this.config.updateInterval);
  }

  // Corrección de acceso a propiedad rules
  private checkAlerts(metrics: SystemMetrics): void {
    if (!this.config.alerts) return;

    for (const rule of this.config.alerts) {
      let value: number;
      switch (rule.metric) {
        case "cpu":
          value = metrics.cpu.usage;
          break;
        case "memory":
          value = metrics.memory.usage;
          break;
        case "disk":
          value = metrics.disk.usage;
          break;
        default:
          continue;
      }

      if (value > rule.threshold) {
        console.warn(
          `[ALERT] ${rule.metric.toUpperCase()} usage is above ${rule.threshold}%: ${value}%`,
        );
      }
    }
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);

      if (url.pathname.startsWith("/static/")) {
        return this.handleStaticFile(url.pathname, res);
      }

      switch (url.pathname) {
        case "/":
          const html = await this.getDashboardHtml();
          res.writeHead(200, {
            "Content-Type": "text/html",
            "Cache-Control": "no-cache",
          });
          res.end(html);
          break;

        case "/metrics":
          const metrics = this.collector.getLatest();
          const format = url.searchParams.get("format");

          if (format === "prometheus") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            if (metrics) {
              res.end(
                new MetricsExporter(this.config).toPrometheusFormat(metrics),
              );
            } else {
              res.writeHead(500);
              res.end("Metrics not available");
            }
          } else {
            // Intentar leer desde archivo JSON primero, luego usar métricas en memoria
            try {
              const metricsPath = path.resolve(
                __dirname,
                "static/metrics.json",
              );
              const fileData = await fs.readFile(metricsPath, "utf8");
              const allMetrics = JSON.parse(fileData);
              const latestMetrics =
                allMetrics[allMetrics.length - 1] || metrics;

              res.writeHead(200, {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
              });
              res.end(JSON.stringify(latestMetrics));
            } catch (error: any) {
              // Fallback a métricas en memoria
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
              });
              res.end(JSON.stringify(metrics));
            }
          }
          break;

        case "/metrics/history":
          const limit = parseInt(url.searchParams.get("limit") || "60");
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          });
          res.end(JSON.stringify(this.metricsHistory.slice(-limit)));
          break;

        default:
          if (url.pathname.startsWith("/static/")) {
            await this.handleStaticFiles(req, res);
          } else {
            res.writeHead(404);
            res.end("Not Found");
          }
      }
    } catch (error: any) {
      console.error("Error handling request:", error);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }

  private async getDashboardHtml(): Promise<string> {
    const templatePath = path.resolve(
      __dirname,
      "static/template/index.mustache",
    );
    const template = await fs.readFile(templatePath, "utf8");

    const data = {
      updateInterval: this.config.updateInterval,
      metrics: [
        { id: "cpu", title: "CPU", unit: "%" },
        { id: "memory", title: "Memoria", unit: "%" },
        { id: "disk", title: "Disco", unit: "%" },
        { id: "network", title: "Red", unit: "MB/s" },
      ],
    };

    return mustache.render(template, data);
  }

  private async handleStaticFile(
    pathname: string,
    res: http.ServerResponse,
  ): Promise<void> {
    try {
      // Remover /static/ del pathname y resolver la ruta del archivo
      const filePath = path.resolve(__dirname, pathname.replace(/^\//, ""));

      // Verificar que el archivo existe y está dentro del directorio permitido
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        res.writeHead(404);
        res.end("File not found");
        return;
      }

      // Determinar el Content-Type basado en la extensión
      const ext = path.extname(filePath).toLowerCase();
      const contentType = this.getContentType(ext);

      // Leer y enviar el archivo
      const fileContent = await fs.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache por 1 hora
      });
      res.end(fileContent);
    } catch (error: any) {
      console.error("Error serving static file:", error);
      res.writeHead(404);
      res.end("File not found");
    }
  }

  private async handleStaticFiles(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    await this.handleStaticFile(url.pathname, res);
  }

  private getContentType(ext: string): string {
    const types: { [key: string]: string } = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".eot": "application/vnd.ms-fontobject",
    };
    return types[ext] || "application/octet-stream";
  }
}

export async function startMonitoring(config: MonitorConfig): Promise<void> {
  const collector = new MetricsCollector(config.maxHistorySize || 60);
  const exporter = new MetricsExporter(config);
  const dashboard = new Dashboard(collector, config);

  // Configurar ruta por defecto para métricas si no se especifica
  if (config.export?.format && !config.export.output) {
    config.export.output = path.resolve(__dirname, "static/metrics.json");
  }

  if (config.dashboard) {
    await dashboard.start(config.port);
  }

  const interval = setInterval(async () => {
    await collector.collect();
    const metrics = collector.getLatest();

    if (config.export?.format && metrics) {
      await exporter.export(metrics);
    }
  }, config.updateInterval);

  process.on("SIGINT", async () => {
    clearInterval(interval);
    if (config.dashboard) {
      await dashboard.stop();
    }
    process.exit(0);
  });
}

export async function stopMonitoring(
  stopFn?: () => Promise<void>,
): Promise<void> {
  stopFn ? await stopFn() : undefined;
}
