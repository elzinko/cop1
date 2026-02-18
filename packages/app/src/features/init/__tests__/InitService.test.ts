import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InitService } from '../application/InitService.js';

describe('InitService', () => {
  let testDir: string;
  let service: InitService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    service = new InitService();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect existing .cop1 directory', () => {
    expect(service.checkExists(testDir)).toBe(false);
    mkdirSync(join(testDir, '.cop1'));
    expect(service.checkExists(testDir)).toBe(true);
  });

  it('should create .cop1 directory structure', () => {
    service.createStructure(testDir);

    expect(existsSync(join(testDir, '.cop1'))).toBe(true);
    expect(existsSync(join(testDir, '.cop1/quality'))).toBe(true);
    expect(existsSync(join(testDir, '.cop1/stories'))).toBe(true);
    expect(existsSync(join(testDir, '.cop1/reports'))).toBe(true);
  });

  it('should copy and render templates with variable substitution', () => {
    service.createStructure(testDir);
    const created = service.copyTemplates(testDir, {
      projectKey: 'my-key',
      projectName: 'My Project',
      projectVersion: '1.0.0',
    });

    expect(created.length).toBe(4);

    // Verify sonar-project.properties
    const sonar = readFileSync(join(testDir, '.cop1/quality/sonar-project.properties'), 'utf-8');
    expect(sonar).toContain('sonar.projectKey=my-key');
    expect(sonar).toContain('sonar.projectName=My Project');
    expect(sonar).toContain('sonar.projectVersion=1.0.0');
    expect(sonar).not.toContain('{{');

    // Verify config.yaml
    const config = readFileSync(join(testDir, '.cop1/config.yaml'), 'utf-8');
    expect(config).toContain('key: my-key');
    expect(config).toContain('name: My Project');
    expect(config).not.toContain('{{');
  });

  it('should auto-detect project vars from directory name', () => {
    const vars = service.detectVars(testDir);
    expect(vars.projectKey).toBe(testDir.split('/').pop());
    expect(vars.projectVersion).toBe('0.1.0');
  });

  it('should detect project name from package.json', () => {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ name: '@scope/my-app' }));

    const vars = service.detectVars(testDir);
    expect(vars.projectName).toBe('@scope/my-app');
  });

  it('should not leave any unreplaced template variables', () => {
    service.createStructure(testDir);
    const created = service.copyTemplates(testDir, {
      projectKey: 'test-key',
      projectName: 'Test',
      projectVersion: '0.1.0',
    });

    for (const relativePath of created) {
      const content = readFileSync(join(testDir, relativePath), 'utf-8');
      expect(content).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });
});
