import { describe, expect, it } from 'vitest';
import { buildSupervisorPrompt } from '../domain/SupervisorPromptBuilder.js';
import type { SupervisorContext } from '../domain/ports/SupervisorLLMPort.js';

function createContext(overrides?: Partial<SupervisorContext>): SupervisorContext {
  return {
    workflowCommand: 'bmad-bmm-dev-story',
    storyId: 'EA2-S3',
    storyContent: '# Story EA2-S3\n\n## Acceptance Criteria\n1. Given X when Y then Z',
    projectContext: 'Use hexagonal architecture. ESM modules only.',
    architectureRules: 'Feature-first layout. Ports in domain/ports/.',
    iamtheLawRules: 'R1: All ports must have tests. R2: No direct DB access.',
    sessionHistory: [],
    currentQuestion: 'Which adapter pattern should I use?',
    ...overrides,
  };
}

describe('SupervisorPromptBuilder', () => {
  it('should build prompt containing the decision framework', () => {
    const prompt = buildSupervisorPrompt(createContext());

    expect(prompt).toContain('cop1 Supervisor');
    expect(prompt).toContain('Decision Framework');
    expect(prompt).toContain('ESCALATE:');
  });

  it('should include story content in the prompt', () => {
    const prompt = buildSupervisorPrompt(createContext());

    expect(prompt).toContain('Story EA2-S3');
    expect(prompt).toContain('Acceptance Criteria');
  });

  it('should include project context in the prompt', () => {
    const prompt = buildSupervisorPrompt(createContext());

    expect(prompt).toContain('Use hexagonal architecture');
    expect(prompt).toContain('ESM modules only');
  });

  it('should include architecture rules in the prompt', () => {
    const prompt = buildSupervisorPrompt(createContext());

    expect(prompt).toContain('Feature-first layout');
    expect(prompt).toContain('Ports in domain/ports/');
  });

  it('should include iamthelaw rules in the prompt', () => {
    const prompt = buildSupervisorPrompt(createContext());

    expect(prompt).toContain('R1: All ports must have tests');
    expect(prompt).toContain('R2: No direct DB access');
  });

  it('should include session history when present', () => {
    const context = createContext({
      sessionHistory: [
        { role: 'workflow', content: 'What file should I create first?' },
        { role: 'supervisor', content: 'Create the port interface first.' },
        { role: 'workflow', content: 'Done. What next?' },
      ],
    });

    const prompt = buildSupervisorPrompt(context);

    expect(prompt).toContain('What file should I create first?');
    expect(prompt).toContain('Create the port interface first.');
    expect(prompt).toContain('Done. What next?');
  });

  it('should include the current question in the prompt', () => {
    const prompt = buildSupervisorPrompt(createContext());

    expect(prompt).toContain('Which adapter pattern should I use?');
  });

  it('should handle empty session history', () => {
    const prompt = buildSupervisorPrompt(createContext({ sessionHistory: [] }));

    expect(prompt).toContain('No prior conversation');
  });

  it('should include all five decision framework levels', () => {
    const prompt = buildSupervisorPrompt(createContext());

    expect(prompt).toContain('story AC');
    expect(prompt).toContain('architecture');
    expect(prompt).toContain('process');
    expect(prompt).toContain('continuation prompt');
    expect(prompt).toContain('ESCALATE');
  });

  it('should include commit_anchor guidance for dev-story workflow command', () => {
    const prompt = buildSupervisorPrompt(
      createContext({ workflowCommand: '/bmad-bmm-dev-story' }),
    );

    expect(prompt).toContain('commit_anchor');
    expect(prompt).toContain('Commit Anchor');
    expect(prompt).toContain('Co-Authored-By');
    expect(prompt).toContain('nothing_to_commit');
  });

  it('should include commit_anchor guidance for any command containing dev-story', () => {
    const prompt = buildSupervisorPrompt(
      createContext({ workflowCommand: 'bmad-bmm-dev-story' }),
    );

    expect(prompt).toContain('commit_anchor');
  });

  it('should NOT include commit_anchor guidance for non-dev-story commands', () => {
    const prompt = buildSupervisorPrompt(
      createContext({ workflowCommand: '/bmad-bmm-code-review' }),
    );

    expect(prompt).not.toContain('commit_anchor');
    expect(prompt).not.toContain('Commit Anchor');
  });

  it('should NOT include commit_anchor guidance for create-story command', () => {
    const prompt = buildSupervisorPrompt(
      createContext({ workflowCommand: '/bmad-bmm-create-story' }),
    );

    expect(prompt).not.toContain('commit_anchor');
  });
});
