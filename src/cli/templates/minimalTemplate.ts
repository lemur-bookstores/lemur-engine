import { TemplateConfig } from "../types";

export const minimalTemplate: TemplateConfig = {
  name: "minimal",
  description: "Plantilla minimalista para plugins de Lemur Engine",
  files: [
    {
      path: "src/index.ts",
      content: `import { Plugin, PluginContext } from '@lemur-engine/core';

export default class {{name}}Plugin implements Plugin {
  constructor(private context: PluginContext) {}

  async initialize(): Promise<void> {
    this.context.logger.info('{{name}} plugin inicializado');
  }

  async start(): Promise<void> {}

  async stop(): Promise<void> {}
}`,
    },
    {
      path: "__tests__/index.test.ts",
      content: `import { createMockPluginContext } from '@lemur-engine/testing';
import {{name}}Plugin from '../src';

describe('{{name}}Plugin', () => {
  it('debería inicializarse correctamente', async () => {
    const context = createMockPluginContext();
    const plugin = new {{name}}Plugin(context);
    await plugin.initialize();
    expect(context.logger.info).toHaveBeenCalledWith('{{name}} plugin inicializado');
  });
});`,
    },
    {
      path: "README.md",
      content: `# {{name}} Plugin

{{description}}

## Instalación

\`\`\`bash
npm install {{name}}
\`\`\`

## Uso

\`\`\`typescript
import {{name}}Plugin from '{{name}}';

// Configura el plugin en tu kernel.config.json
{
  "plugins": [
    {
      "name": "{{name}}",
      "enabled": true
    }
  ]
}
\`\`\`

## Licencia

MIT`,
    },
    {
      path: "package.json",
      content: `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "@lemur-engine/core": "^1.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "@types/node": "^18.0.0",
    "@lemur-engine/testing": "^1.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "ts-node": "^10.0.0",
    "typescript": "^5.0.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node"
  }
}`,
    },
  ],
};
