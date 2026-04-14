import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const LEGACY_CLASSES: ReadonlyArray<{ file: string; className: string }> = [
  { file: 'dev-agent/application/DevAgent.ts', className: 'DevAgent' },
  { file: 'reviewer-agent/application/ReviewerAgent.ts', className: 'ReviewerAgent' },
  { file: 'qa-agent/application/QAAgent.ts', className: 'QAAgent' },
  { file: 'pm-agent/application/PMAgent.ts', className: 'PMAgent' },
  { file: 'pm-agent/application/PMAgentWorkflowStep.ts', className: 'PMAgentWorkflowStep' },
  { file: 'workflow/infrastructure/steps/DevAgentStep.ts', className: 'DevAgentStep' },
  { file: 'workflow/infrastructure/steps/ReviewerAgentStep.ts', className: 'ReviewerAgentStep' },
  { file: 'workflow/infrastructure/steps/QAAgentStep.ts', className: 'QAAgentStep' },
  { file: 'workflow/infrastructure/steps/PMAgentStep.ts', className: 'PMAgentStep' },
];

describe('EA11-S1 — Legacy cop1 agent classes deprecation guard', () => {
  it.each(LEGACY_CLASSES)(
    '$className has class-level @deprecated JSDoc with required references',
    ({ file, className }) => {
      const source = readFileSync(join(ROOT, file), 'utf8');
      const exportDecl = `export class ${className}`;
      const classIndex = source.indexOf(exportDecl);
      expect(classIndex, `${className} export not found in ${file}`).toBeGreaterThan(-1);

      const preamble = source.slice(0, classIndex);
      const lastBlock = preamble.lastIndexOf('/**');
      expect(lastBlock, `${className} missing preceding JSDoc block`).toBeGreaterThan(-1);

      const jsdoc = preamble.slice(lastBlock);
      expect(jsdoc).toContain('@deprecated');
      expect(jsdoc).toContain('EA11-S1');
      expect(jsdoc).toContain('ADR-012');
      expect(jsdoc).toMatch(/EA10(-S9)?/);
    },
  );
});
