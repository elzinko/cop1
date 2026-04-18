import { describe, expect, it } from 'vitest';
import type {
  SupervisorQuestion,
  SupervisorQuestionContext,
  SupervisorResponse,
} from '../domain/ports/SupervisorLLMPort.js';
import { InMemorySupervisorAdapter } from '../infrastructure/InMemorySupervisorAdapter.js';

function createQuestion(currentQuestion: string): SupervisorQuestion {
  return {
    currentQuestion,
    workflowCommand: 'bmad-bmm-dev-story',
    storyId: 'EA2-S3',
  };
}

function createContext(currentQuestion: string): SupervisorQuestionContext {
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

describe('InMemorySupervisorAdapter', () => {
  it('should return pre-configured response for exact question match', async () => {
    const expected: SupervisorResponse = {
      answer: 'Use PostgreSQL',
      escalated: false,
      durationMs: 50,
      tokensUsed: 100,
    };

    const adapter = new InMemorySupervisorAdapter(new Map([['Which database?', expected]]));

    const result = await adapter.generateResponse(
      createQuestion('Which database?'),
      createContext('Which database?'),
    );

    expect(result).toEqual(expected);
  });

  it('should return pre-configured response for pattern match (substring)', async () => {
    const expected: SupervisorResponse = {
      answer: 'Continue',
      escalated: false,
      durationMs: 10,
    };

    const adapter = new InMemorySupervisorAdapter(new Map([['continue', expected]]));

    const result = await adapter.generateResponse(
      createQuestion('Do you want to continue with the next step?'),
      createContext('Do you want to continue with the next step?'),
    );

    expect(result).toEqual(expected);
  });

  it('should return default response when no match found', async () => {
    const adapter = new InMemorySupervisorAdapter(new Map());

    const result = await adapter.generateResponse(
      createQuestion('Unknown question'),
      createContext('Unknown question'),
    );

    expect(result.answer).toBe('C');
    expect(result.escalated).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should return custom default response when configured', async () => {
    const defaultResponse: SupervisorResponse = {
      answer: 'Custom default',
      escalated: false,
      durationMs: 5,
    };

    const adapter = new InMemorySupervisorAdapter(new Map(), defaultResponse);

    const result = await adapter.generateResponse(
      createQuestion('Any question'),
      createContext('Any question'),
    );

    expect(result).toEqual(defaultResponse);
  });

  it('should support escalation simulation', async () => {
    const escalatedResponse: SupervisorResponse = {
      answer: '',
      escalated: true,
      escalationReason: 'Cannot determine without user input',
      durationMs: 30,
    };

    const adapter = new InMemorySupervisorAdapter(
      new Map([['irreversible decision', escalatedResponse]]),
    );

    const result = await adapter.generateResponse(
      createQuestion('Should I make this irreversible decision?'),
      createContext('Should I make this irreversible decision?'),
    );

    expect(result.escalated).toBe(true);
    expect(result.escalationReason).toBe('Cannot determine without user input');
  });

  it('should implement SupervisorLLMPort interface', () => {
    const adapter = new InMemorySupervisorAdapter(new Map());
    expect(adapter.generateResponse).toBeDefined();
    expect(typeof adapter.generateResponse).toBe('function');
  });

  it('should match patterns case-insensitively', async () => {
    const expected: SupervisorResponse = {
      answer: 'Yes',
      escalated: false,
      durationMs: 10,
    };

    const adapter = new InMemorySupervisorAdapter(new Map([['database', expected]]));

    const result = await adapter.generateResponse(
      createQuestion('Which DATABASE should I use?'),
      createContext('Which DATABASE should I use?'),
    );

    expect(result).toEqual(expected);
  });
});
