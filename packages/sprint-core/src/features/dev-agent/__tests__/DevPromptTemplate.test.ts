import { describe, expect, it } from 'vitest';
import { buildDevPrompt, parseLLMResponse } from '../domain/DevPromptTemplate.js';

describe('DevPromptTemplate', () => {
  it('should build a prompt with story context', () => {
    const prompt = buildDevPrompt('E1-S1', 'Create a user service');

    expect(prompt).toContain('E1-S1');
    expect(prompt).toContain('Create a user service');
    expect(prompt).toContain('conventional commit');
  });

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
