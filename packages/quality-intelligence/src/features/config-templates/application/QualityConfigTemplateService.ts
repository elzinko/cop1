import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TemplateContext {
  projectKey: string;
  projectName: string;
}

export class QualityConfigTemplateService {
  private readonly templatesDir: string;
  private readonly outputDir: string;

  constructor(templatesDir: string, projectPath: string) {
    this.templatesDir = templatesDir;
    this.outputDir = join(projectPath, '.cop1/quality');
  }

  apply(context: TemplateContext): string[] {
    const templates = [
      'sonar-project.properties.template',
      '.dependency-cruiser.js.template',
      '.eslintrc.json.template',
    ];

    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }

    const applied: string[] = [];
    for (const template of templates) {
      const templatePath = join(this.templatesDir, template);
      if (!existsSync(templatePath)) continue;

      let content = readFileSync(templatePath, 'utf-8');
      content = content.replace(/\{\{projectKey\}\}/g, context.projectKey);
      content = content.replace(/\{\{projectName\}\}/g, context.projectName);

      const outputName = template.replace('.template', '');
      writeFileSync(join(this.outputDir, outputName), content, 'utf-8');
      applied.push(outputName);
    }

    return applied;
  }
}
