import type { StructuredLogger } from '@cop1/observability';
import { describe, expect, it, vi } from 'vitest';
import type { SessionHistoryReader } from '../application/SessionHistoryReader.js';
import { type SessionInteraction, SessionLogger } from '../application/SessionLogger.js';
import { SupervisorService } from '../application/SupervisorService.js';
import type {
  SupervisorQuestion,
  SupervisorQuestionContext,
} from '../domain/ports/SupervisorLLMPort.js';
import { InMemorySupervisorAdapter } from '../infrastructure/InMemorySupervisorAdapter.js';

function createMockLogger(): SessionLogger {
  const mockStructuredLogger: Pick<StructuredLogger, 'event'> = { event: vi.fn() };
  return new SessionLogger(mockStructuredLogger as unknown as StructuredLogger);
}

function makeContext(
  overrides: Partial<SupervisorQuestionContext> = {},
): SupervisorQuestionContext {
  return {
    workflowCommand: '/bmad-bmm-dev-story',
    storyId: 'EA9-S3',
    storyContent: '# Story content',
    projectContext: 'project context',
    architectureRules: 'arch rules',
    iamtheLawRules: 'rules',
    sessionHistory: [],
    currentQuestion: 'Continue?',
    ...overrides,
  };
}

function makeQuestion(text: string): SupervisorQuestion {
  return {
    currentQuestion: text,
    workflowCommand: '/bmad-bmm-dev-story',
    storyId: 'EA9-S3',
  };
}

describe('SupervisorService', () => {
  describe('Level 1 — Deterministic matching', () => {
    it('should match continuation prompts and return C', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(makeQuestion('Continue?'), makeContext());

      expect(response.escalated).toBe(false);
      expect(response.answer).toBe('C');
    });

    it('should match [c] prompt', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(makeQuestion('[c] to proceed'), makeContext());

      expect(response.answer).toBe('C');
    });

    it('should match YOLO prompt and return y', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(makeQuestion('[y] YOLO'), makeContext());

      expect(response.answer).toBe('y');
    });

    it('should match story selection prompt using context storyId', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(
        makeQuestion('Which story to select?'),
        makeContext({ storyId: 'EA9-S3' }),
      );

      expect(response.answer).toBe('EA9-S3');
    });

    it('should match confirmation prompts', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(makeQuestion('Looks good?'), makeContext());

      expect(response.answer).toBe('c');
    });

    it('should match party mode / advanced elicitation prompts', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(
        makeQuestion('Start advanced elicitation?'),
        makeContext(),
      );

      expect(response.answer).toBe('c');
    });

    it('should be case insensitive for pattern matching', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(makeQuestion('CONTINUE'), makeContext());

      expect(response.answer).toBe('C');
    });
  });

  describe('Level 2 — LLM fallback', () => {
    it('should delegate to LLM when no deterministic match found', async () => {
      const responses = new Map([
        [
          'complex architecture question',
          { answer: 'Use hexagonal pattern', escalated: false, durationMs: 500, tokensUsed: 100 },
        ],
      ]);
      const adapter = new InMemorySupervisorAdapter(responses);
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(
        makeQuestion('complex architecture question about DDD'),
        makeContext(),
      );

      expect(response.answer).toBe('Use hexagonal pattern');
      expect(response.escalated).toBe(false);
      expect(response.tokensUsed).toBe(100);
    });

    it('should use default response for unmatched LLM questions', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(
        makeQuestion('Something totally unknown'),
        makeContext(),
      );

      // InMemorySupervisorAdapter returns default "C"
      expect(response.answer).toBe('C');
      expect(response.escalated).toBe(false);
    });
  });

  describe('Level 3 — Escalation', () => {
    it('should escalate when LLM response starts with ESCALATE:', async () => {
      const responses = new Map([
        [
          'dangerous',
          {
            answer: 'ESCALATE: Cannot determine safe action',
            escalated: false,
            durationMs: 300,
          },
        ],
      ]);
      const adapter = new InMemorySupervisorAdapter(responses);
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(
        makeQuestion('dangerous operation requested'),
        makeContext(),
      );

      expect(response.escalated).toBe(true);
      expect(response.escalationReason).toBe('Cannot determine safe action');
    });

    it('should escalate when LLM throws an error', async () => {
      const adapter: InMemorySupervisorAdapter = new InMemorySupervisorAdapter(new Map());
      // Override generateResponse to throw
      adapter.generateResponse = async () => {
        throw new Error('API timeout');
      };
      const service = new SupervisorService(adapter, createMockLogger());

      const response = await service.respond(
        makeQuestion('Something that triggers error'),
        makeContext(),
      );

      expect(response.escalated).toBe(true);
      expect(response.escalationReason).toBe('LLM error: API timeout');
    });
  });

  describe('Session logging', () => {
    it('should log both question and answer for each interaction', async () => {
      const mockStructuredLogger = { event: vi.fn() };
      const logger = new SessionLogger(mockStructuredLogger as never);
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, logger);

      await service.respond(makeQuestion('Continue?'), makeContext());

      // 2 calls: question + answer
      expect(mockStructuredLogger.event).toHaveBeenCalledTimes(2);
      expect(mockStructuredLogger.event).toHaveBeenCalledWith(
        'session.turn.question_intercepted',
        expect.objectContaining({ content: 'Continue?', role: 'workflow' }),
      );
      expect(mockStructuredLogger.event).toHaveBeenCalledWith(
        'session.turn.answered_deterministic',
        expect.objectContaining({ content: 'C', role: 'supervisor' }),
      );
    });
  });

  describe('createQuestionHandler', () => {
    it('should return allow with answers for AskUserQuestion', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());
      service.setWorkflowContext('/dev-story', 'EA9-S3', makeContext());

      const handler = service.createQuestionHandler();
      const result = await handler('AskUserQuestion', {
        questions: [{ question: 'Ready to proceed?' }],
      });

      expect(result.behavior).toBe('allow');
      const updated = (result as { behavior: 'allow'; updatedInput: unknown })
        .updatedInput as Record<string, unknown>;
      const answers = updated.answers as Record<string, string>;
      expect(answers['Ready to proceed?']).toBe('C');
    });

    it('should return deny with ESCALATE message when escalated', async () => {
      const adapter: InMemorySupervisorAdapter = new InMemorySupervisorAdapter(new Map());
      adapter.generateResponse = async () => {
        throw new Error('LLM down');
      };
      const service = new SupervisorService(adapter, createMockLogger());
      service.setWorkflowContext('/dev-story', 'EA9-S3', makeContext());

      const handler = service.createQuestionHandler();
      const result = await handler('AskUserQuestion', {
        questions: [{ question: 'Something unexpected and complex' }],
      });

      expect(result.behavior).toBe('deny');
      const denied = result as { behavior: 'deny'; message: string };
      expect(denied.message).toContain('ESCALATE:');
    });

    it('should pass through non-AskUserQuestion tools', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const handler = service.createQuestionHandler();
      const input = { command: 'ls' };
      const result = await handler('Bash', input);

      expect(result.behavior).toBe('allow');
      expect((result as { behavior: 'allow'; updatedInput: unknown }).updatedInput).toBe(input);
    });

    it('should escalate when AskUserQuestion has no question text', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());
      service.setWorkflowContext('/dev-story', 'EA9-S3', makeContext());

      const handler = service.createQuestionHandler();
      const result = await handler('AskUserQuestion', { data: 'no questions field' });

      expect(result.behavior).toBe('deny');
      const denied = result as { behavior: 'deny'; message: string };
      expect(denied.message).toContain('ESCALATE:');
      expect(denied.message).toContain('No question text');
    });
  });

  describe('Session ID tracking', () => {
    it('should include sessionId in log entries when set via setWorkflowContext', async () => {
      const mockStructuredLogger: Pick<StructuredLogger, 'event'> = { event: vi.fn() };
      const logger = new SessionLogger(mockStructuredLogger as unknown as StructuredLogger);
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, logger);
      service.setWorkflowContext('/dev-story', 'EA9-S3', makeContext(), 'sess-abc-123');

      await service.respond(makeQuestion('Continue?'), makeContext());

      expect(mockStructuredLogger.event).toHaveBeenCalledWith(
        'session.turn.question_intercepted',
        expect.objectContaining({ sessionId: 'sess-abc-123' }),
      );
      expect(mockStructuredLogger.event).toHaveBeenCalledWith(
        'session.turn.answered_deterministic',
        expect.objectContaining({ sessionId: 'sess-abc-123' }),
      );
    });
  });

  describe('Custom patterns', () => {
    it('should accept custom patterns via constructor', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const customPatterns = [{ pattern: /custom-trigger/i, answer: 'custom-response' }];
      const service = new SupervisorService(adapter, createMockLogger(), undefined, customPatterns);

      const response = await service.respond(makeQuestion('custom-trigger here'), makeContext());

      expect(response.answer).toBe('custom-response');
    });
  });

  describe('Turn counter', () => {
    it('should increment turn counter across multiple respond calls', async () => {
      const mockStructuredLogger: Pick<StructuredLogger, 'event'> = { event: vi.fn() };
      const logger = new SessionLogger(mockStructuredLogger as unknown as StructuredLogger);
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, logger);

      await service.respond(makeQuestion('Continue?'), makeContext());
      await service.respond(makeQuestion('Continue?'), makeContext());
      await service.respond(makeQuestion('Continue?'), makeContext());

      const eventMock = mockStructuredLogger.event as ReturnType<typeof vi.fn>;
      const turns = eventMock.mock.calls.map((c) => (c[1] as { turn: number }).turn);
      // Each respond logs 2 entries (question + answer) with same turn number
      expect(turns).toEqual([1, 1, 2, 2, 3, 3]);
    });

    it('should reset turn counter when setWorkflowContext is called', async () => {
      const mockStructuredLogger: Pick<StructuredLogger, 'event'> = { event: vi.fn() };
      const logger = new SessionLogger(mockStructuredLogger as unknown as StructuredLogger);
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, logger);

      await service.respond(makeQuestion('Continue?'), makeContext());
      await service.respond(makeQuestion('Continue?'), makeContext());

      service.setWorkflowContext('/new-workflow', 'EA9-S4', makeContext());

      await service.respond(makeQuestion('Continue?'), makeContext());

      const eventMock = mockStructuredLogger.event as ReturnType<typeof vi.fn>;
      const lastTurn = (eventMock.mock.calls.at(-1)?.[1] as { turn: number }).turn;
      expect(lastTurn).toBe(1);
    });
  });

  describe('History enrichment', () => {
    it('should enrich context with session history when historyReader is injected', async () => {
      const mockHistory: SessionInteraction[] = [
        {
          timestamp: '2026-04-05T10:00:00.000Z',
          sessionId: 'prev-session',
          storyId: 'EA9-S3',
          epicId: 'EA9',
          workflowCommand: '/bmad-bmm-dev-story',
          turn: 1,
          role: 'workflow',
          content: 'Previous question from history',
          analysis: { type: 'question_simple', method: 'deterministic' },
          durationMs: 5,
        },
        {
          timestamp: '2026-04-05T10:00:01.000Z',
          sessionId: 'prev-session',
          storyId: 'EA9-S3',
          epicId: 'EA9',
          workflowCommand: '/bmad-bmm-dev-story',
          turn: 1,
          role: 'supervisor',
          content: 'Previous answer',
          analysis: { type: 'question_simple', method: 'deterministic' },
          durationMs: 5,
        },
      ];

      const mockReader: Pick<SessionHistoryReader, 'getHistoryForStory'> = {
        getHistoryForStory: vi.fn().mockResolvedValue(mockHistory),
      };

      const capturedContexts: SupervisorQuestionContext[] = [];
      const adapter = new InMemorySupervisorAdapter(new Map());
      adapter.generateResponse = async (_q, ctx) => {
        capturedContexts.push(ctx);
        return { answer: 'llm-answer', escalated: false, durationMs: 100 };
      };

      const service = new SupervisorService(
        adapter,
        createMockLogger(),
        mockReader as SessionHistoryReader,
      );

      await service.respond(makeQuestion('complex thing'), makeContext());

      expect(mockReader.getHistoryForStory).toHaveBeenCalledWith('EA9-S3');
      expect(capturedContexts[0]?.sessionHistory).toHaveLength(2);
      expect(capturedContexts[0]?.sessionHistory[0]?.role).toBe('workflow');
      expect(capturedContexts[0]?.sessionHistory[0]?.content).toBe(
        'Previous question from history',
      );
    });

    it('should not enrich when context already has sessionHistory', async () => {
      const mockReader: Pick<SessionHistoryReader, 'getHistoryForStory'> = {
        getHistoryForStory: vi.fn().mockResolvedValue([]),
      };
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(
        adapter,
        createMockLogger(),
        mockReader as SessionHistoryReader,
      );

      const contextWithHistory = makeContext({
        sessionHistory: [{ role: 'workflow', content: 'existing' }],
      });

      await service.respond(makeQuestion('complex thing'), contextWithHistory);

      expect(mockReader.getHistoryForStory).not.toHaveBeenCalled();
    });

    it('should gracefully degrade when historyReader throws', async () => {
      const mockReader: Pick<SessionHistoryReader, 'getHistoryForStory'> = {
        getHistoryForStory: vi.fn().mockRejectedValue(new Error('disk error')),
      };
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(
        adapter,
        createMockLogger(),
        mockReader as SessionHistoryReader,
      );

      const response = await service.respond(makeQuestion('complex thing'), makeContext());

      // Should still return LLM answer despite history read failure
      expect(response.answer).toBe('C');
      expect(response.escalated).toBe(false);
    });
  });

  describe('createQuestionHandler — multi-question payload', () => {
    it('should apply the same answer to all questions in payload', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());
      service.setWorkflowContext('/dev-story', 'EA9-S3', makeContext());

      const handler = service.createQuestionHandler();
      const result = await handler('AskUserQuestion', {
        questions: [{ question: 'Continue?' }, { question: 'Ready to proceed?' }],
      });

      expect(result.behavior).toBe('allow');
      const updated = (result as { behavior: 'allow'; updatedInput: unknown })
        .updatedInput as Record<string, unknown>;
      const answers = updated.answers as Record<string, string>;
      expect(answers['Continue?']).toBe('C');
      expect(answers['Ready to proceed?']).toBe('C');
    });

    it('should fall back to a default context when setWorkflowContext was never called', async () => {
      const adapter = new InMemorySupervisorAdapter(new Map());
      const service = new SupervisorService(adapter, createMockLogger());

      const handler = service.createQuestionHandler();
      const result = await handler('AskUserQuestion', {
        questions: [{ question: 'Continue?' }],
      });

      expect(result.behavior).toBe('allow');
    });
  });
});
