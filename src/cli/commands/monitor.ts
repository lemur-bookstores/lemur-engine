import { Command } from "commander";
import { startMonitoring, stopMonitoring } from "../services/monitoring";
import { MonitorCommandOptions, MonitorConfig } from "../types";

export function monitorCommand(): Command {
  const command = new Command("monitor");

  command
    .description("Monitorizar el sistema")
    .option("-p, --port <number>", "Puerto para el dashboard web", "3030")
    .option("-h, --host <host>", "Host para el dashboard web", "localhost")
    .option(
      "-i, --updateInterval <seconds>",
      "Intervalo de actualización en segundos",
      "5",
    )
    .option(
      "-m, --metrics <items>",
      "Métricas específicas a monitorear (separadas por comas)",
    )
    .option(
      "-l, --log-level <level>",
      "Nivel de log (debug, info, warn, error)",
      "info",
    )
    .option("--no-dashboard", "Deshabilitar dashboard web")
    .option(
      "-e, --export <format>",
      "Formato de exportación (json, prometheus)",
      "json",
    )
    .option("-o, --output <file>", "Archivo de salida para métricas")
    .option("-a, --alerts <rules>", "Reglas de alertas en formato JSON")
    .action(async (options: MonitorCommandOptions) => {
      try {
        const config: MonitorConfig = {
          port: parseInt(options.port, 10),
          host: options.host,
          updateInterval: parseInt(options.updateInterval, 10) * 1000, // Convertir a milisegundos
          metrics: options.metrics
            ? options.metrics.split(",").map((m) => m.trim())
            : ["cpu", "memory", "disk", "network", "process"],
          logLevel: options.logLevel,
          dashboard: options.dashboard !== "--no-dashboard",
          export: {
            format: options?.format
              ? options.format === "prometheus"
                ? "prometheus"
                : "json"
              : "json",
            output: options.output,
          },
          alerts: options.alerts ? JSON.parse(options.alerts) : undefined,
        };

        // Iniciar monitorización
        await startMonitoring(config).then(() =>
          console.log("Monitoring started..."),
        );
        // Manejar señales para detener el monitoreo gracefully
        process.on("SIGINT", async () => {
          console.log("\n🛑 Deteniendo monitoreo...");
          await stopMonitoring();
          process.exit(0);
        });

        process.on("SIGTERM", async () => {
          console.log("\n🛑 Deteniendo monitoreo...");
          await stopMonitoring();
          process.exit(0);
        });

        // Iniciar monitoreo
        await startMonitoring(config);

        if (config.dashboard) {
          console.log(
            `\n🚀 Dashboard disponible en http://${config.host}:${config.port}`,
          );
        }

        console.log("\n📊 Monitoreo iniciado. Presiona Ctrl+C para detener.");
      } catch (error: any) {
        console.error("❌ Error al iniciar monitoreo:", error?.message);
        if (error?.details) {
          console.error("Detalles:", error?.details);
        }
        process.exit(1);
      }
    });

  return command;
}
