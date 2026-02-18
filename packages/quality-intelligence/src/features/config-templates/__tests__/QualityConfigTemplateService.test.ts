import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QualityConfigTemplateService } from '../application/QualityConfigTemplateService.js';

describe('QualityConfigTemplateService', () => {
  let testDir: string;
  let templatesDir: string;
  let service: QualityConfigTemplateService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-qt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    templatesDir = join(testDir, 'templates');
    mkdirSync(templatesDir, { recursive: true });

    writeFileSync(
      join(templatesDir, 'sonar-project.properties.template'),
      'sonar.projectKey={{projectKey}}\nsonar.projectName={{projectName}}',
    );
    writeFileSync(
      join(templatesDir, '.dependency-cruiser.js.template'),
      '// {{projectName}} dependency rules',
    );

    service = new QualityConfigTemplateService(templatesDir, testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should apply templates with context substitution', () => {
    const applied = service.apply({ projectKey: 'cop1', projectName: 'cop1-project' });

    expect(applied).toContain('sonar-project.properties');
    const content = readFileSync(join(testDir, '.cop1/quality/sonar-project.properties'), 'utf-8');
    expect(content).toContain('sonar.projectKey=cop1');
    expect(content).toContain('sonar.projectName=cop1-project');
  });

  it('should skip missing templates', () => {
    const applied = service.apply({ projectKey: 'cop1', projectName: 'cop1' });
    // .eslintrc.json.template doesn't exist
    expect(applied).not.toContain('.eslintrc.json');
  });

  it('should create output directory', () => {
    service.apply({ projectKey: 'test', projectName: 'test' });
    expect(existsSync(join(testDir, '.cop1/quality'))).toBe(true);
  });
});
