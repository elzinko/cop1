import { readFileSync } from 'node:fs';

export function readTemplate(templatePath: string): string {
  return readFileSync(templatePath, 'utf-8');
}

export function substituteVariables(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
