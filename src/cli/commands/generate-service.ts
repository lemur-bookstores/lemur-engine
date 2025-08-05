import { Command } from "commander";
import { generateService } from "../services/service-generator";
import { validateServiceName } from "../utils/validation";
import { CommandOptions, ServiceConfig } from "../types";

export function generateServiceCommand(): Command {
  const command = new Command("generate");

  command
    .command("service")
    .description("Generar un nuevo servicio")
    .argument("<nombre-servicio>", "Nombre del servicio")
    .option(
      "-t, --type <tipo>",
      "Tipo de servicio (singleton, transient)",
      "singleton",
    )
    .option(
      "-i, --interfaces <interfaces>",
      "Interfaces que implementa (separadas por comas)",
    )
    .option(
      "-d, --dependencies <deps>",
      "Dependencias del servicio (separadas por comas)",
    )
    .option("--plugin <plugin>", "Nombre del plugin donde generar el servicio")
    .action(async (serviceName: string, options: CommandOptions) => {
      try {
        // Validar nombre del servicio
        validateServiceName(serviceName);

        // Preparar configuración del servicio
        const serviceConfig: ServiceConfig = {
          name: serviceName,
          type: options.type as "singleton" | "transient",
          interfaces: options.interfaces?.split(",").map((i) => i.trim()),
          dependencies: options.dependencies?.split(",").map((d) => d.trim()),
        };

        // Generar servicio
        await generateService(serviceConfig, options.plugin);

        console.log(`✅ Servicio ${serviceName} generado exitosamente`);
      } catch (error: any) {
        console.error("❌ Error al generar el servicio:", error.message);
        process.exit(1);
      }
    });

  return command;
}
