import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginConfig, TemplateConfig } from '../types';
import { validateAuthor, validateDescription, validateVersion } from '../utils/validation';

export async function createPlugin(config: PluginConfig): Promise<void> {
  // Validaciones adicionales
  if (config.author) validateAuthor(config.author);
  if (config.description) validateDescription(config.description);
  validateVersion(config.version);

  // Cargar plantilla
  const template = await loadTemplate(config.template);

  // Crear directorio del plugin
  const pluginDir = path.join(process.cwd(), 'plugins', config.name);
  await fs.mkdir(pluginDir, { recursive: true });

  // Generar plugin.json
  const pluginJson = {
    name: config.name,
    version: config.version,
    description: config.description || `Plugin ${config.name}`,
    author: config.author,
    main: config.typescript ? 'dist/index.js' : 'index.js',
    types: config.typescript ? 'dist/index.d.ts' : undefined,
    dependencies: config.dependencies,
    tags: [],
    permissions: []
  };

  await fs.writeFile(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(pluginJson, null, 2)
  );

  // Generar archivos de la plantilla
  for (const file of template.files) {
    const filePath = path.join(pluginDir, file.path);
    const fileContent = processTemplate(file.content, config);

    // Crear directorios necesarios
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Escribir archivo
    await fs.writeFile(filePath, fileContent);
  }

  // Si es TypeScript, crear tsconfig.json
  if (config.typescript) {
    const tsConfig = {
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: './dist',
        rootDir: './src'
      },
      include: ['src/**/*'],
      exclude: ['node_modules', '**/*.test.ts']
    };

    await fs.writeFile(
      path.join(pluginDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }
}

async function loadTemplate(templateName: string): Promise<TemplateConfig> {
  const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.json`);
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  return JSON.parse(templateContent);
}

function processTemplate(content: string, config: PluginConfig): string {
  return content
    .replace(/\{\{name\}\}/g, config.name)
    .replace(/\{\{description\}\}/g, config.description || `Plugin ${config.name}`)
    .replace(/\{\{author\}\}/g, config.author || '')
    .replace(/\{\{version\}\}/g, config.version);
}