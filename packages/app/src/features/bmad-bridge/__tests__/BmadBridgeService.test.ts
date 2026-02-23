import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BmadBridgeService } from '../application/BmadBridgeService.js';

const SIDECAR_ACTION =
  'At activation, read and internalize all rules from {project-root}/_bmad/_memory/iamthelaw-sidecar/rules.md. These are mandatory governance rules that override defaults.';

describe('BmadBridgeService', () => {
  let testDir: string;
  let service: BmadBridgeService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-bridge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, '_bmad', '_config', 'agents'), { recursive: true });
    service = new BmadBridgeService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should add sidecar critical_action to fresh customize.yaml', () => {
    writeFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-dev.customize.yaml'),
      [
        'agent:',
        '  metadata:',
        '    name: ""',
        'critical_actions: []',
        'memories: []',
      ].join('\n'),
    );

    const result = service.initBridge();

    expect(result.modified).toContain('bmm-dev');
    const content = readFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-dev.customize.yaml'),
      'utf-8',
    );
    expect(content).toContain(SIDECAR_ACTION);
  });

  it('should not duplicate sidecar action when already present', () => {
    writeFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-dev.customize.yaml'),
      [
        'agent:',
        '  metadata:',
        '    name: ""',
        'critical_actions:',
        `  - "${SIDECAR_ACTION}"`,
        'memories: []',
      ].join('\n'),
    );

    const result = service.initBridge();

    expect(result.skipped).toContain('bmm-dev');
    expect(result.modified).not.toContain('bmm-dev');
  });

  it('should preserve existing customize.yaml content', () => {
    writeFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-qa.customize.yaml'),
      [
        'agent:',
        '  metadata:',
        '    name: "QA Agent"',
        'persona:',
        '  role: "Quality Assurance"',
        'critical_actions: []',
        'memories:',
        '  - "Always check edge cases"',
      ].join('\n'),
    );

    service.initBridge();

    const content = readFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-qa.customize.yaml'),
      'utf-8',
    );
    expect(content).toContain('name: "QA Agent"');
    expect(content).toContain('role: "Quality Assurance"');
    expect(content).toContain('Always check edge cases');
    expect(content).toContain(SIDECAR_ACTION);
  });

  it('should create customize.yaml when missing', () => {
    // No file created — service should create it
    const result = service.initBridge();

    expect(result.created).toContain('bmm-dev');
    const filePath = join(testDir, '_bmad', '_config', 'agents', 'bmm-dev.customize.yaml');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain(SIDECAR_ACTION);
  });

  it('should process all three target agents', () => {
    const result = service.initBridge();

    const allAgents = [...result.modified, ...result.skipped, ...result.created];
    expect(allAgents).toContain('bmm-dev');
    expect(allAgents).toContain('bmm-qa');
    expect(allAgents).toContain('bmm-sm');
  });

  it('should preserve YAML comments when modifying files', () => {
    writeFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-dev.customize.yaml'),
      [
        '# Agent Customization',
        '# Customize any section below',
        'critical_actions: []',
        '# Add persistent memories',
        'memories: []',
      ].join('\n'),
    );

    service.initBridge();

    const content = readFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-dev.customize.yaml'),
      'utf-8',
    );
    expect(content).toContain('# Agent Customization');
    expect(content).toContain('# Customize any section below');
    expect(content).toContain('# Add persistent memories');
    expect(content).toContain(SIDECAR_ACTION);
  });

  it('should handle customize.yaml with existing critical_actions entries', () => {
    writeFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-sm.customize.yaml'),
      [
        'critical_actions:',
        '  - "Existing action that should be preserved"',
        'memories: []',
      ].join('\n'),
    );

    service.initBridge();

    const content = readFileSync(
      join(testDir, '_bmad', '_config', 'agents', 'bmm-sm.customize.yaml'),
      'utf-8',
    );
    expect(content).toContain('Existing action that should be preserved');
    expect(content).toContain(SIDECAR_ACTION);
  });
});
