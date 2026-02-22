import { describe, expect, it } from 'vitest';
import {
  buildDevPrompt,
  extractMarkdownSection,
  parseLLMResponse,
} from '../domain/DevPromptTemplate.js';

describe('extractMarkdownSection', () => {
  const storyMarkdown = `# Story E3.S17: DevAgent Prompt Enhancement

## Story

As a Developer,
I want the DevAgent's prompt to include project context.

## Acceptance Criteria

1. buildDevPrompt() includes project context
2. buildDevPrompt() structures the story content

## Tasks / Subtasks

- [ ] Add extractMarkdownSection helper
- [ ] Add project context section

## Dev Notes

- The current buildDevPrompt() is minimal
- Consider including file tree structure
`;

  it('extracts Acceptance Criteria section', () => {
    const ac = extractMarkdownSection(storyMarkdown, 'Acceptance Criteria');
    expect(ac).toContain('buildDevPrompt() includes project context');
    expect(ac).toContain('buildDevPrompt() structures the story content');
  });

  it('extracts Tasks / Subtasks section', () => {
    const tasks = extractMarkdownSection(storyMarkdown, 'Tasks / Subtasks');
    expect(tasks).toContain('Add extractMarkdownSection helper');
    expect(tasks).toContain('Add project context section');
  });

  it('extracts Dev Notes section', () => {
    const notes = extractMarkdownSection(storyMarkdown, 'Dev Notes');
    expect(notes).toContain('current buildDevPrompt() is minimal');
    expect(notes).toContain('file tree structure');
  });

  it('returns empty string for non-existent heading', () => {
    const result = extractMarkdownSection(storyMarkdown, 'Non Existent');
    expect(result).toBe('');
  });

  it('is case-insensitive', () => {
    const result = extractMarkdownSection(storyMarkdown, 'acceptance criteria');
    expect(result).toContain('buildDevPrompt()');
  });

  it('handles content with no ## headings', () => {
    const result = extractMarkdownSection('Just plain text\nwith lines', 'Something');
    expect(result).toBe('');
  });

  it('does not match ### headings as section boundaries', () => {
    const content = `## Main Section

Some content

### Subsection

More content under subsection

## Next Section

Other content`;
    const result = extractMarkdownSection(content, 'Main Section');
    expect(result).toContain('Some content');
    expect(result).toContain('### Subsection');
    expect(result).toContain('More content under subsection');
    expect(result).not.toContain('Other content');
  });
});

describe('buildDevPrompt', () => {
  it('includes project context section', () => {
    const prompt = buildDevPrompt('E1-S1', 'Create a user service');

    expect(prompt).toContain('## Project Context');
    expect(prompt).toContain('TypeScript strict mode');
    expect(prompt).toContain('pnpm workspaces');
    expect(prompt).toContain('Vitest');
    expect(prompt).toContain('Biome');
    expect(prompt).toContain('hexagonal');
    expect(prompt).toContain('kebab-case');
    expect(prompt).toContain('PascalCase');
    expect(prompt).toContain('.js');
  });

  it('includes story ID', () => {
    const prompt = buildDevPrompt('E3-S17', 'Some content');
    expect(prompt).toContain('E3-S17');
  });

  it('structures story content when AC/Tasks/DevNotes sections exist', () => {
    const storyContent = `# Story

## Story

As a Developer, I want something.

## Acceptance Criteria

1. AC one
2. AC two

## Tasks / Subtasks

- [ ] Task one
- [ ] Task two

## Dev Notes

- Note about implementation
`;
    const prompt = buildDevPrompt('E1-S1', storyContent);

    expect(prompt).toContain('## Acceptance Criteria');
    expect(prompt).toContain('AC one');
    expect(prompt).toContain('## Tasks / Subtasks');
    expect(prompt).toContain('Task one');
    expect(prompt).toContain('## Dev Notes');
    expect(prompt).toContain('Note about implementation');
    // Should NOT contain raw dump
    expect(prompt).not.toContain('## Story Content');
  });

  it('falls back to raw content when no structured sections found', () => {
    const prompt = buildDevPrompt('E1-S1', 'Just a plain description of work');

    expect(prompt).toContain('## Story Content');
    expect(prompt).toContain('Just a plain description of work');
  });

  it('includes improved instructions with conventions', () => {
    const prompt = buildDevPrompt('E1-S1', 'Some content');

    expect(prompt).toContain('targeting the correct package');
    expect(prompt).toContain('kebab-case files');
    expect(prompt).toContain('__tests__/');
    expect(prompt).toContain('COMMIT:');
  });

  it('includes story ID in commit message suggestion', () => {
    const prompt = buildDevPrompt('E3-S17', 'Some content');
    expect(prompt).toContain('COMMIT: feat(E3-S17):');
  });

  it('handles partial structured content (only ACs)', () => {
    const storyContent = `# Story

## Acceptance Criteria

1. AC one
2. AC two
`;
    const prompt = buildDevPrompt('E1-S1', storyContent);

    expect(prompt).toContain('## Acceptance Criteria');
    expect(prompt).toContain('AC one');
    expect(prompt).not.toContain('## Tasks / Subtasks');
    expect(prompt).not.toContain('## Dev Notes');
    expect(prompt).not.toContain('## Story Content');
  });
});

describe('parseLLMResponse', () => {
  it('should parse file operations from LLM response', () => {
    const response = `Here is the implementation:

\`\`\`file:src/user.ts
export class User {
  name: string;
}
\`\`\`

\`\`\`file:src/index.ts
export { User } from './user.js';
\`\`\`

COMMIT: feat: add user service`;

    const result = parseLLMResponse(response);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.path).toBe('src/user.ts');
    expect(result.files[0]?.content).toContain('class User');
    expect(result.files[1]?.path).toBe('src/index.ts');
    expect(result.commitMessage).toBe('feat: add user service');
  });

  it('should use fallback commit message when none provided', () => {
    const response = 'No commit message here\n```file:a.ts\nconst x = 1;\n```';

    const result = parseLLMResponse(response);

    expect(result.commitMessage).toMatch(/^feat\(/);
    expect(result.files).toHaveLength(1);
  });

  it('should handle empty LLM response', () => {
    const result = parseLLMResponse('');

    expect(result.files).toHaveLength(0);
  });
});
