import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { TEMPLATES } from '@cop1/quality-intelligence/templates/index.js';
import { readTemplate, substituteVariables } from '../infrastructure/TemplateReader.js';

export interface InitVars {
  projectKey: string;
  projectName: string;
  projectVersion: string;
}

export class InitService {
  checkExists(projectPath: string): boolean {
    return existsSync(join(projectPath, '.cop1'));
  }

  createStructure(projectPath: string): void {
    const dirs = ['.cop1', '.cop1/quality', '.cop1/stories', '.cop1/reports'];
    for (const dir of dirs) {
      mkdirSync(join(projectPath, dir), { recursive: true });
    }
  }

  copyTemplates(projectPath: string, vars: InitVars): string[] {
    const created: string[] = [];

    for (const template of TEMPLATES) {
      const content = readTemplate(template.sourcePath);
      const rendered = substituteVariables(content, {
        projectKey: vars.projectKey,
        projectName: vars.projectName,
        projectVersion: vars.projectVersion,
      });

      const targetPath = join(projectPath, template.targetRelativePath);
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, rendered, 'utf-8');
      created.push(template.targetRelativePath);
    }

    return created;
  }

  detectVars(projectPath: string): InitVars {
    const projectKey = basename(projectPath);
    let projectName = projectKey;
    const projectVersion = '0.1.0';

    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
          name?: string;
        };
        if (pkg.name) {
          projectName = pkg.name;
        }
      } catch {
        // Ignore parse errors
      }
    }

    return { projectKey, projectName, projectVersion };
  }
}
