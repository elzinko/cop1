import { describe, expect, it } from 'vitest';
import { SupervisorRateLimitError } from '../domain/errors/SupervisorRateLimitError.js';
import { SupervisorTimeoutError } from '../domain/errors/SupervisorTimeoutError.js';
import type { SupervisorContext, SupervisorQuestion } from '../domain/ports/SupervisorLLMPort.js';
import {
  AgentSdkSupervisorAdapter,
  type SupervisorQueryFunction,
  type SupervisorQueryMessage,
} from '../infrastructure/AgentSdkSupervisorAdapter.js';

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

function createMockQuery(
  responseText: string,
  usage?: { input_tokens: number; output_tokens: number },
): SupervisorQueryFunction {
  return async function* (_options): AsyncIterable<SupervisorQueryMessage> {
    yield {
      type: 'result',
      text: responseText,
      usage: usage ?? { input_tokens: 100, output_tokens: 50 },
    };
  };
}

function createFailingQuery(error: Error): SupervisorQueryFunction {
  return (_options) => ({
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<SupervisorQueryMessage>> {
          throw error;
        },
      };
    },
  });
}

describe('AgentSdkSupervisorAdapter', () => {
  it('should return a non-escalated response for normal answers', async () => {
    const queryFn = createMockQuery('Use the PostgreSQL adapter');
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(
      createQuestion('Which adapter?'),
      createContext('Which adapter?'),
    );

    expect(result.answer).toBe('Use the PostgreSQL adapter');
    expect(result.escalated).toBe(false);
    expect(result.escalationReason).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should detect ESCALATE: prefix and set escalated flag', async () => {
    const queryFn = createMockQuery('ESCALATE: Cannot determine without user input');
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(
      createQuestion('Irreversible decision?'),
      createContext('Irreversible decision?'),
    );

    expect(result.escalated).toBe(true);
    expect(result.escalationReason).toBe('Cannot determine without user input');
    expect(result.answer).toBe('');
  });

  it('should extract tokensUsed from SDK response', async () => {
    const queryFn = createMockQuery('answer', { input_tokens: 200, output_tokens: 80 });
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(createQuestion('test'), createContext('test'));

    expect(result.tokensUsed).toBe(280);
  });

  it('should populate durationMs', async () => {
    const queryFn = createMockQuery('answer');
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(createQuestion('test'), createContext('test'));

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should throw SupervisorTimeoutError on timeout', async () => {
    const timeoutError = new Error('Request timed out');
    timeoutError.name = 'TimeoutError';
    const queryFn = createFailingQuery(timeoutError);
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    await expect(
      adapter.generateResponse(createQuestion('test'), createContext('test')),
    ).rejects.toThrow(SupervisorTimeoutError);
  });

  it('should throw SupervisorRateLimitError on rate limit', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.name = 'RateLimitError';
    const queryFn = createFailingQuery(rateLimitError);
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    await expect(
      adapter.generateResponse(createQuestion('test'), createContext('test')),
    ).rejects.toThrow(SupervisorRateLimitError);
  });

  it('should populate durationMs on SupervisorTimeoutError', async () => {
    const timeoutError = new Error('Request timed out');
    timeoutError.name = 'TimeoutError';
    const queryFn = createFailingQuery(timeoutError);
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    try {
      await adapter.generateResponse(createQuestion('test'), createContext('test'));
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SupervisorTimeoutError);
      if (error instanceof SupervisorTimeoutError) {
        expect(error.durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should populate durationMs on SupervisorRateLimitError', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.name = 'RateLimitError';
    const queryFn = createFailingQuery(rateLimitError);
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    try {
      await adapter.generateResponse(createQuestion('test'), createContext('test'));
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SupervisorRateLimitError);
      if (error instanceof SupervisorRateLimitError) {
        expect(error.durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should trim whitespace around ESCALATE: prefix and reason', async () => {
    const queryFn = createMockQuery('  ESCALATE:   reason with spaces  ');
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(createQuestion('test'), createContext('test'));

    expect(result.escalated).toBe(true);
    expect(result.escalationReason).toBe('reason with spaces');
  });

  it('should not detect lowercase escalate: as escalation (case-sensitive)', async () => {
    const queryFn = createMockQuery('escalate: this is not an escalation');
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(createQuestion('test'), createContext('test'));

    expect(result.escalated).toBe(false);
    expect(result.answer).toBe('escalate: this is not an escalation');
  });

  it('should accumulate text from multiple SDK messages', async () => {
    const queryFn: SupervisorQueryFunction = async function* (_options) {
      yield { type: 'chunk', text: 'Use the ' };
      yield { type: 'chunk', text: 'PostgreSQL adapter' };
      yield { type: 'result', usage: { input_tokens: 100, output_tokens: 50 } };
    };
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(
      createQuestion('Which adapter?'),
      createContext('Which adapter?'),
    );

    expect(result.answer).toBe('Use the PostgreSQL adapter');
  });

  it('should throw SupervisorTimeoutError when error message contains "timed out"', async () => {
    const error = new Error('The request timed out after 30s');
    const queryFn = createFailingQuery(error);
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    await expect(
      adapter.generateResponse(createQuestion('test'), createContext('test')),
    ).rejects.toThrow(SupervisorTimeoutError);
  });

  it('should throw SupervisorRateLimitError when error message contains "rate limit"', async () => {
    const error = new Error('You have exceeded the rate limit');
    const queryFn = createFailingQuery(error);
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    await expect(
      adapter.generateResponse(createQuestion('test'), createContext('test')),
    ).rejects.toThrow(SupervisorRateLimitError);
  });

  it('should rethrow non-Error exceptions unchanged', async () => {
    const queryFn: SupervisorQueryFunction = (_options) => ({
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<SupervisorQueryMessage>> {
            throw 'string error';
          },
        };
      },
    });
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    await expect(
      adapter.generateResponse(createQuestion('test'), createContext('test')),
    ).rejects.toBe('string error');
  });

  it('should return empty answer when SDK yields no text messages', async () => {
    const queryFn: SupervisorQueryFunction = async function* (_options) {
      yield { type: 'result', usage: { input_tokens: 10, output_tokens: 5 } };
    };
    const adapter = new AgentSdkSupervisorAdapter(queryFn);

    const result = await adapter.generateResponse(createQuestion('test'), createContext('test'));

    expect(result.answer).toBe('');
    expect(result.escalated).toBe(false);
  });

  it('should pass allowedTools as empty and maxTurns as 1 to query function', async () => {
    let capturedOptions: unknown;
    const queryFn: SupervisorQueryFunction = async function* (options) {
      capturedOptions = options;
      yield {
        type: 'result',
        text: 'answer',
        usage: { input_tokens: 10, output_tokens: 5 },
      };
    };

    const adapter = new AgentSdkSupervisorAdapter(queryFn);
    await adapter.generateResponse(createQuestion('test'), createContext('test'));

    const opts = capturedOptions as Record<string, unknown>;
    expect(opts).toBeDefined();
    const options = opts.options as Record<string, unknown>;
    expect(options.allowedTools).toEqual([]);
    expect(options.maxTurns).toBe(1);
  });
});
