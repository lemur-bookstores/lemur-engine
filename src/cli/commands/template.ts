import { Command } from 'commander';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../services/template-manager';

export function templateCommand(): Command {
  const command = new Command('template');

  command
    .description('Gestionar plantillas del sistema')
    .addCommand(listTemplatesCommand())
    .addCommand(createTemplateCommand())
    .addCommand(updateTemplateCommand())
    .addCommand(deleteTemplateCommand());

  return command;
}

function listTemplatesCommand(): Command {
  return new Command('list')
    .description('Listar plantillas disponibles')
    .option('--type <type>', 'Filtrar por tipo de plantilla (plugin, service)')
    .option('--format <format>', 'Formato de salida (table, json)', 'table')
    .action(async (options: { type?: string; format?: string }) => {
      try {
        const templates = await listTemplates(options.type);
        if (options.format === 'json') {
          console.log(JSON.stringify(templates, null, 2));
        } else {
          console.log('📋 Plantillas disponibles:');
          templates.forEach(template => {
            console.log(`\n🔹 ${template.name}`);
            console.log(`   Tipo: ${template.type}`);
            console.log(`   Descripción: ${template.description}`);
          });
        }
      } catch (error: any) {
        console.error('❌ Error al listar plantillas:', error.message);
        process.exit(1);
      }
    });
}

function createTemplateCommand(): Command {
  return new Command('create')
    .description('Crear una nueva plantilla')
    .argument('<nombre>', 'Nombre de la plantilla')
    .option('-t, --type <type>', 'Tipo de plantilla (plugin, service)', 'plugin')
    .option('-d, --description <desc>', 'Descripción de la plantilla')
    .option('-f, --from <source>', 'Crear plantilla a partir de un proyecto existente')
    .option('--force', 'Sobrescribir si la plantilla ya existe', false)
    .action(async (name, options) => {
      try {
        await createTemplate({
          name,
          type: options.type,
          description: options.description,
          sourcePath: options.from,
          force: options.force
        });
        console.log(`✅ Plantilla ${name} creada exitosamente`);
      } catch (error: any) {
        console.error('❌ Error al crear plantilla:', error.message);
        process.exit(1);
      }
    });
}

interface UpdateTemplateCommand {
  name: string
 description?: string;
 files?: string[]
}

function updateTemplateCommand(): Command {
  return new Command('update')
    .description('Actualizar una plantilla existente')
    .argument('<nombre>', 'Nombre de la plantilla')
    .option('-d, --description <desc>', 'Nueva descripción')
    .option('-f, --files <files...>', 'Archivos a actualizar')
    .action(async (name: UpdateTemplateCommand['name'], options: Omit<UpdateTemplateCommand, 'name'>) => {
      try {
        await updateTemplate({
          name,
          description: options.description,
          files: options.files
        });
        console.log(`✅ Plantilla ${name} actualizada exitosamente`);
      } catch (error: any) {
        console.error('❌ Error al actualizar plantilla:', error.message);
        process.exit(1);
      }
    });
}

function deleteTemplateCommand(): Command {
  return new Command('delete')
    .description('Eliminar una plantilla')
    .argument('<nombre>', 'Nombre de la plantilla')
    .option('--force', 'Forzar eliminación sin confirmación')
    .action(async (name: string, options) => {
      try {
        await deleteTemplate(name, options.force);
        console.log(`✅ Plantilla ${name} eliminada exitosamente`);
      } catch (error: any) {
        console.error('❌ Error al eliminar plantilla:', error.message);
        process.exit(1);
      }
    });
}