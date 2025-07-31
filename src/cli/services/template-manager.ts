import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { glob, GlobOptions } from 'glob';

interface Template {
  name: string;
  type: 'plugin' | 'service';
  description: string;
  files: TemplateFile[];
  variables: TemplateVariable[];
  created: string;
  updated: string;
}

interface TemplateFile {
  path: string;
  content: string;
}

interface TemplateVariable {
  name: string;
  description: string;
  default?: string;
  required: boolean;
}

interface CreateTemplateOptions {
  name: string;
  type: 'plugin' | 'service';
  description: string;
  sourcePath?: string;
  force?: boolean;
}

interface UpdateTemplateOptions {
  name: string;
  description?: string;
  files?: string[];
}

const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

export async function listTemplates(type?: string): Promise<Template[]> {
  await ensureTemplatesDir();

  const templates: Template[] = [];
  const files = await fs.readdir(TEMPLATES_DIR);

  for (const file of files) {
    if (path.extname(file) === '.json') {
      const template = JSON.parse(
        await fs.readFile(path.join(TEMPLATES_DIR, file), 'utf-8')
      );
      if (!type || template.type === type) {
        templates.push(template);
      }
    }
  }

  return templates;
}

export async function createTemplate(options: CreateTemplateOptions): Promise<void> {
  await ensureTemplatesDir();

  const templatePath = path.join(TEMPLATES_DIR, `${options.name}.json`);

  // Verificar si la plantilla ya existe
  try {
    await fs.access(templatePath);
    if (!options.force) {
      throw new Error(`La plantilla ${options.name} ya existe`);
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }

  let files: TemplateFile[] = [];
  let variables: TemplateVariable[] = [];

  if (options.sourcePath) {
    // Crear plantilla a partir de un proyecto existente
    const sourcePath = path.resolve(options.sourcePath);
    try {
      await fs.access(sourcePath);
      files = await extractFilesFromSource(sourcePath);
      variables = detectVariables(files);
    } catch (error) {
      throw new Error(`No se puede acceder al directorio fuente: ${sourcePath}`);
    }
  }

  const template: Template = {
    name: options.name,
    type: options.type,
    description: options.description,
    files,
    variables,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
}

export async function updateTemplate(options: UpdateTemplateOptions): Promise<void> {
  const templatePath = path.join(TEMPLATES_DIR, `${options.name}.json`);

  // Verificar que la plantilla existe
  try {
    await fs.access(templatePath);
  } catch (error) {
    throw new Error(`La plantilla ${options.name} no existe`);
  }

  // Cargar plantilla existente
  const template: Template = JSON.parse(
    await fs.readFile(templatePath, 'utf-8')
  );

  // Actualizar campos
  if (options.description) {
    template.description = options.description;
  }

  if (options.files) {
    // Actualizar archivos específicos
    for (const filePath of options.files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(process.cwd(), filePath);

        const existingFileIndex = template.files.findIndex(
          f => f.path === relativePath
        );

        if (existingFileIndex >= 0) {
          template.files[existingFileIndex].content = content;
        } else {
          template.files.push({ path: relativePath, content });
        }
      } catch (error: any) {
        console.warn(`No se pudo actualizar el archivo ${filePath}:`, error.message);
      }
    }
  }

  template.updated = new Date().toISOString();
  await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
}

export async function deleteTemplate(name: string, force: boolean): Promise<void> {
  const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);

  try {
    await fs.access(templatePath);
  } catch (error) {
    throw new Error(`La plantilla ${name} no existe`);
  }

  if (!force) {
    // Aquí se podría implementar una confirmación interactiva
    console.log('⚠️ Esta operación no se puede deshacer');
  }

  await fs.unlink(templatePath);
}

async function ensureTemplatesDir(): Promise<void> {
  try {
    await fs.access(TEMPLATES_DIR);
  } catch (error) {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  }
}

async function extractFilesFromSource(sourcePath: string): Promise<TemplateFile[]> {
  const files: TemplateFile[] = [];
  const globAsync = promisify(glob) as (arg1: string | string[], arg2: GlobOptions) => Promise<any>;

  const patterns = [
    '**/*.ts',
    '**/*.js',
    '**/*.json',
    '**/*.md',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/.git/**'
  ];

  const matches = await globAsync(patterns, {
    cwd: sourcePath,
    dot: true
  });

  for (const match of matches) {
    const filePath = path.join(sourcePath, match);
    const content = await fs.readFile(filePath, 'utf-8');
    files.push({
      path: match,
      content
    });
  }

  return files;
}

function detectVariables(files: TemplateFile[]): TemplateVariable[] {
  const variables = new Set<string>();
  const variablePattern = /\{\{\s*([\w.-]+)\s*\}\}/g;

  // Buscar variables en los archivos
  for (const file of files) {
    let match;
    while ((match = variablePattern.exec(file.content)) !== null) {
      variables.add(match[1]);
    }
  }

  // Convertir variables encontradas en TemplateVariable[]
  return Array.from(variables).map(name => ({
    name,
    description: `Variable ${name}`,
    required: true
  }));
}