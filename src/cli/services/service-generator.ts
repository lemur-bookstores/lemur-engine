import * as fs from 'fs/promises';
import * as path from 'path';
import { ServiceConfig } from '../types';

export async function generateService(config: ServiceConfig, pluginName?: string): Promise<void> {
  // Determinar la ruta base
  const basePath = pluginName
    ? path.join(process.cwd(), 'plugins', pluginName, 'src', 'services')
    : path.join(process.cwd(), 'src', 'services');

  // Crear directorio si no existe
  await fs.mkdir(basePath, { recursive: true });

  // Generar el archivo del servicio
  const serviceContent = generateServiceContent(config);
  const fileName = `${config.name}Service.ts`;
  await fs.writeFile(path.join(basePath, fileName), serviceContent);

  // Generar archivo de pruebas
  const testContent = generateTestContent(config);
  const testBasePath = pluginName
    ? path.join(process.cwd(), 'plugins', pluginName, '__tests__', 'services')
    : path.join(process.cwd(), '__tests__', 'services');

  await fs.mkdir(testBasePath, { recursive: true });
  await fs.writeFile(path.join(testBasePath, `${config.name}Service.test.ts`), testContent);

  // Actualizar index.ts si existe
  const indexPath = path.join(basePath, 'index.ts');
  try {
    let indexContent = await fs.readFile(indexPath, 'utf-8');
    if (!indexContent.includes(`export * from './${config.name}Service'`)) {
      indexContent += `\nexport * from './${config.name}Service';\n`;
      await fs.writeFile(indexPath, indexContent);
    }
  } catch (error) {
    // Si no existe el index.ts, lo creamos
    await fs.writeFile(indexPath, `export * from './${config.name}Service';\n`);
  }
}

function generateServiceContent(config: ServiceConfig): string {
  const decorators = [`@Injectable({ type: '${config.type}' })`];
  const interfaces = config.interfaces?.length ? ` implements ${config.interfaces.join(', ')}` : '';
  const dependencies = config.dependencies || [];

  const constructorParams = dependencies
    .map(dep => `private ${dep.charAt(0).toLowerCase() + dep.slice(1)}: ${dep}`)
    .join(', ');

  return `import { Injectable } from '@lemur-engine/core';
${config.interfaces?.map(i => `import { ${i} } from '../interfaces';`).join('\n') || ''}
${dependencies.map(d => `import { ${d} } from './${d}';`).join('\n') || ''}

${decorators.join('\n')}
export class ${config.name}Service${interfaces} {
  constructor(${constructorParams}) {}

  // Implementa los métodos del servicio aquí
}
`;
}

function generateTestContent(config: ServiceConfig): string {
  const dependencies = config.dependencies || [];
  const mockDeps = dependencies
    .map(dep => `let ${dep.charAt(0).toLowerCase() + dep.slice(1)}: jest.Mocked<${dep}>;`)
    .join('\n  ');

  const initMocks = dependencies
    .map(dep => `    ${dep.charAt(0).toLowerCase() + dep.slice(1)} = {
      // Define los mocks necesarios
    } as any;`)
    .join('\n');

  const depParams = dependencies
    .map(dep => dep.charAt(0).toLowerCase() + dep.slice(1))
    .join(', ');

  return `import { ${config.name}Service } from '../../src/services/${config.name}Service';
${dependencies.map(d => `import { ${d} } from '../../src/services/${d}';`).join('\n')}

describe('${config.name}Service', () => {
  let service: ${config.name}Service;
  ${mockDeps}

  beforeEach(() => {
${initMocks}

    service = new ${config.name}Service(${depParams});
  });

  it('debería crearse correctamente', () => {
    expect(service).toBeInstanceOf(${config.name}Service);
  });

  // Agrega más pruebas según sea necesario
});
`;
}