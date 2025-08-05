import { Command } from "commander";
import { deployApplication } from "../services/deployment";
import { DeployConfig } from "../types";

export function deployCommand(): Command {
  const command = new Command("deploy");

  command
    .description("Desplegar la aplicación")
    .option(
      "-e, --env <environment>",
      "Entorno de despliegue (development, staging, production)",
      "development",
    )
    .option(
      "-c, --config <path>",
      "Ruta al archivo de configuración de despliegue",
    )
    .option(
      "--dry-run",
      "Ejecutar en modo simulación sin realizar cambios reales",
      false,
    )
    .option(
      "-f, --force",
      "Forzar el despliegue incluso si hay advertencias",
      false,
    )
    .option(
      "--rollback <version>",
      "Versión a la que hacer rollback en caso de fallo",
    )
    .action(async (options) => {
      try {
        const config: DeployConfig = {
          environment: options.env,
          configPath: options.config,
          dryRun: options.dryRun,
          force: options.force,
          rollbackVersion: options.rollback,
        };

        // Ejecutar el despliegue
        await deployApplication(config);

        if (options.dryRun) {
          console.log("✅ Simulación de despliegue completada exitosamente");
        } else {
          console.log(
            `✅ Aplicación desplegada exitosamente en entorno ${options.env}`,
          );
        }
      } catch (error: any) {
        console.error(
          "❌ Error durante el despliegue:",
          (error as Error).message,
        );
        if ((error as any).details) {
          console.error("Detalles:", (error as any).details);
        }
        process.exit(1);
      }
    });

  return command;
}
