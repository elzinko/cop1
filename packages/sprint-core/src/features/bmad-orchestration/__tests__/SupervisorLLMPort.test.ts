import { describe, expect, it } from 'vitest';
import type {
  SupervisorContext,
  SupervisorLLMPort,
  SupervisorQuestion,
} from '../domain/ports/SupervisorLLMPort.js';
import { InMemorySupervisorAdapter } from '../infrastructure/InMemorySupervisorAdapter.js';

function createQuestion(currentQuestion: string): SupervisorQuestion {
  return {
    currentQuestion,
    workflowCommand: 'bmad-bmm-dev-story',
    storyId: 'EA2-S3',
  };
}

function createContext(currentQuestion: string): SupervisorContext {
  return {
    workflowCommand: 'bmad-bmm-dev-story',
    storyId: 'EA2-S3',
    storyContent: '# Story',
    projectContext: 'project context',
    architectureRules: 'architecture rules',
    iamtheLawRules: 'iamthelaw rules',
    sessionHistory: [],
    currentQuestion,
  };
}

describe('SupervisorLLMPort', () => {
  it('should accept InMemorySupervisorAdapter as a valid implementation', async () => {
    const port: SupervisorLLMPort = new InMemorySupervisorAdapter(new Map());

    const result = await port.generateResponse(createQuestion('test'), createContext('test'));

    expect(result.answer).toBeDefined();
    expect(typeof result.escalated).toBe('boolean');
    expect(typeof result.durationMs).toBe('number');
  });

  it('should return escalationReason only when escalated', async () => {
    const port: SupervisorLLMPort = new InMemorySupervisorAdapter(
      new Map([
        [
          'escalate this',
          {
            answer: '',
            escalated: true,
            escalationReason: 'Out of mandate',
            durationMs: 50,
          },
        ],
      ]),
    );

    const normal = await port.generateResponse(
      createQuestion('normal question'),
      createContext('normal question'),
    );
    expect(normal.escalated).toBe(false);
    expect(normal.escalationReason).toBeUndefined();

    const escalated = await port.generateResponse(
      createQuestion('please escalate this'),
      createContext('please escalate this'),
    );
    expect(escalated.escalated).toBe(true);
    expect(escalated.escalationReason).toBe('Out of mandate');
  });

  it('should support optional tokensUsed in response', async () => {
    const port: SupervisorLLMPort = new InMemorySupervisorAdapter(
      new Map([
        ['with-tokens', { answer: 'ok', escalated: false, durationMs: 10, tokensUsed: 150 }],
      ]),
    );

    const withTokens = await port.generateResponse(
      createQuestion('with-tokens'),
      createContext('with-tokens'),
    );
    expect(withTokens.tokensUsed).toBe(150);

    const withoutTokens = await port.generateResponse(
      createQuestion('no match'),
      createContext('no match'),
    );
    expect(withoutTokens.tokensUsed).toBeUndefined();
  });
});
