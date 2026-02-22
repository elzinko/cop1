import { describe, expect, it } from 'vitest';
import { StoryContextBuilder } from '../domain/StoryContextBuilder.js';

describe('StoryContextBuilder', () => {
  const builder = new StoryContextBuilder();

  it('builds context with story section', () => {
    const result = builder.build({
      storyId: 'EA1-S1',
      storyContent: '## Story\nImplement the port.',
      projectPath: '/project',
    });

    expect(result.story).toContain('# Story: EA1-S1');
    expect(result.story).toContain('## Story\nImplement the port.');
  });

  it('includes projectPath in context', () => {
    const result = builder.build({
      storyId: 'EA1-S2',
      storyContent: 'content',
      projectPath: '/my/project',
    });

    expect(result.projectPath).toBe('/my/project');
  });

  it('handles empty story content', () => {
    const result = builder.build({
      storyId: 'EA1-S1',
      storyContent: '',
      projectPath: '/project',
    });

    expect(result.story).toContain('# Story: EA1-S1');
  });

  it('handles multi-line story content', () => {
    const content = [
      '## Story',
      'As a developer, I want X.',
      '',
      '## Acceptance Criteria',
      '1. First criterion',
      '2. Second criterion',
    ].join('\n');

    const result = builder.build({
      storyId: 'EA1-S3',
      storyContent: content,
      projectPath: '/project',
    });

    expect(result.story).toContain('First criterion');
    expect(result.story).toContain('Second criterion');
  });
});
