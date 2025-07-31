import { Command } from 'commander';
import { createPluginCommand } from './commands/create-plugin';
import { generateServiceCommand } from './commands/generate-service';
import { deployCommand } from './commands/deploy';
import { monitorCommand } from './commands/monitor';
import { templateCommand } from './commands/template';
import { testCommand } from './commands/test';

const program = new Command();

program
  .name('lemur')
  .description('CLI avanzado para Lemur Engine')
  .version('1.0.0');

// Registrar comandos
program
  .addCommand(createPluginCommand())
  .addCommand(generateServiceCommand())
  .addCommand(deployCommand())
  .addCommand(monitorCommand())
  .addCommand(templateCommand())
  .addCommand(testCommand());

export function runCLI() {
  program.parse(process.argv);
}