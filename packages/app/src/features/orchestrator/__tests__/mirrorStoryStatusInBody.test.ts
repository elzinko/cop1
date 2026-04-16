import { describe, expect, it } from 'vitest';
import { mirrorStoryStatusInBody } from '../application/OrchestratorService.js';

describe('mirrorStoryStatusInBody (EA13-S4)', () => {
  it('rewrites the status line to the new value', () => {
    const input = [
      '# Story EA13.4: Mirror status',
      '',
      'Status: ready-for-dev',
      '## Status: ready-for-dev',
      '',
      '## Story',
      'body',
    ].join('\n');
    const out = mirrorStoryStatusInBody(input, 'done');
    expect(out).toContain('## Status: done');
    expect(out).not.toContain('## Status: ready-for-dev');
    // Other content preserved
    expect(out).toContain('# Story EA13.4: Mirror status');
    expect(out).toContain('## Story');
    expect(out).toContain('body');
  });

  it('is idempotent when status is already the target value', () => {
    const input = '# Title\n\n## Status: done\n\n## Story\nbody\n';
    expect(mirrorStoryStatusInBody(input, 'done')).toBe(input);
  });

  it('returns body unchanged when no `## Status:` line exists (zero-side-effect policy)', () => {
    const input = '# Hand-crafted note\n\nSome unrelated content.\n';
    expect(mirrorStoryStatusInBody(input, 'done')).toBe(input);
  });

  it('only touches the first status line', () => {
    const input = [
      '# Title',
      '',
      '## Status: ready-for-dev',
      '',
      '## Review',
      '## Status: in-review   (second occurrence, should stay)',
    ].join('\n');
    const out = mirrorStoryStatusInBody(input, 'done');
    expect(out).toContain('## Status: done');
    expect(out).toContain('## Status: in-review   (second occurrence, should stay)');
  });

  it('handles extra whitespace around the value', () => {
    const input = '## Status:    weird-status    \n';
    const out = mirrorStoryStatusInBody(input, 'done');
    expect(out).toBe('## Status: done\n');
  });

  it('does not touch the non-heading "Status: <value>" line', () => {
    const input = 'Status: ready-for-dev\n\n## Story\nbody\n';
    expect(mirrorStoryStatusInBody(input, 'done')).toBe(input);
  });
});
