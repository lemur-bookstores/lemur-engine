import { Command } from "commander";
import { runTests, TestConfig } from "../services/test-runner";

export function testCommand(): Command {
  const command = new Command("test");

  command
    .description("Ejecutar pruebas del sistema")
    .option("-w, --watch", "Ejecutar pruebas en modo watch", false)
    .option("-c, --coverage", "Generar reporte de cobertura", false)
    .option("-u, --update-snapshots", "Actualizar snapshots", false)
    .option("-f, --filter <pattern>", "Filtrar pruebas por patrón")
    .option(
      "-t, --tag <tags>",
      "Filtrar pruebas por etiquetas (separadas por comas)",
    )
    .option("--ci", "Ejecutar en modo CI", false)
    .option("--verbose", "Mostrar salida detallada", false)
    .option("--silent", "Suprimir toda la salida excepto errores", false)
    .option("--fail-fast", "Detener ejecución al primer fallo", false)
    .option("--timeout <ms>", "Timeout por prueba en milisegundos", "5000")
    .option("--report <format>", "Formato del reporte (junit, json)", "junit")
    .option("--report-dir <dir>", "Directorio para reportes", "./test-reports")
    .action(async (options) => {
      try {
        const config: TestConfig = {
          watch: options.watch,
          coverage: options.coverage,
          updateSnapshots: options.updateSnapshots,
          filter: options.filter,
          tags:
            typeof options?.tag === "string"
              ? `${options.tag}`?.split(",").map((t) => t.trim())
              : undefined,
          ci: options.ci,
          verbose: options.verbose,
          silent: options.silent,
          failFast: options.failFast,
          timeout: parseInt(options.timeout, 10),
          report: {
            format: options.report,
            directory: options.reportDir,
          },
        };

        const results = await runTests(config);

        if (options.verbose) {
          console.log("\n📊 Resumen de pruebas:");
          console.log(`Total: ${results.total}`);
          console.log(`Pasadas: ${results.passed}`);
          console.log(`Fallidas: ${results.failed}`);
          console.log(`Saltadas: ${results.skipped}`);
          console.log(`Duración: ${results.duration}ms`);

          if (results.coverage) {
            console.log("\n📈 Cobertura:");
            console.log(`Líneas: ${results.coverage.lines}%`);
            console.log(`Funciones: ${results.coverage.functions}%`);
            console.log(`Ramas: ${results.coverage.branches}%`);
            console.log(`Declaraciones: ${results.coverage.statements}%`);
          }
        }

        if (results.failed > 0) {
          process.exit(1);
        }
      } catch (error: any) {
        console.error("❌ Error al ejecutar pruebas:", error.message);
        if (error.details) {
          console.error("Detalles:", error.details);
        }
        process.exit(1);
      }
    });

  return command;
}
