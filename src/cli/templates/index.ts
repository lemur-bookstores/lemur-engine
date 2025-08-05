import { defaultTemplate } from "./defaultTemplate";
import { minimalTemplate } from "./minimalTemplate";
import { fullTemplate } from "./fullTemplate";

export interface TemplateFile {
  path: string;
  content: string;
}

export interface Template {
  name: string;
  description: string;
  files: TemplateFile[];
}

export const templates: Record<string, Template> = {
  default: defaultTemplate,
  minimal: minimalTemplate,
  full: fullTemplate,
};

export function getTemplate(name: string): Template | undefined {
  return templates[name];
}

export function getAvailableTemplates(): string[] {
  return Object.keys(templates);
}

export function validateTemplate(template: Template): boolean {
  if (
    !template.name ||
    !template.description ||
    !Array.isArray(template.files)
  ) {
    return false;
  }

  return template.files.every(
    (file) => typeof file.path === "string" && typeof file.content === "string",
  );
}
