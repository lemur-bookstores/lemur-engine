import { Command } from "commander";
import { createPlugin } from "../services/plugin-creator";
import { validatePluginName } from "../utils/validation";
import { PluginTemplate } from "../types";

export function createPluginCommand(): Command {
  const command = new Command("create");

  command
    .command("plugin")
    .description("Crear un nuevo plugin")
    .argument("<nombre-plugin>", "Nombre del plugin")
    .option(
      "-t, --template <nombre>",
      "Plantilla base (default, minimal, full)",
      "default",
    )
    .option("--typescript", "Usar TypeScript", true)
    .option("-d, --description <desc>", "Descripción del plugin")
    .option("-a, --author <autor>", "Autor del plugin")
    .option("-v, --version <version>", "Versión inicial", "1.0.0")
    .option(
      "--dependencies <deps>",
      "Lista de dependencias separadas por comas",
    )
    .action(async (pluginName: string, options) => {
      try {
        // Validar nombre del plugin
        validatePluginName(pluginName);

        // Preparar configuración del plugin
        const pluginConfig = {
          name: pluginName,
          template: options.template as PluginTemplate,
          typescript: options.typescript,
          description: options.description,
          author: options.author,
          version: options.version,
          dependencies:
            options.dependencies?.split(",").map((d: string) => d.trim()) || [],
        };

        // Crear plugin
        await createPlugin(pluginConfig);

        console.log(`✅ Plugin ${pluginName} creado exitosamente`);
      } catch (error: any) {
        console.error("❌ Error al crear el plugin:", error.message);
        process.exit(1);
      }
    });

  return command;
}
