import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StructuredLogger } from '@cop1/observability';
import { EventBus } from '@cop1/shared-kernel';
import {
  type DoDContext,
  type DoDEvaluation,
  DoDService,
  type HistoryEntry,
  InMemorySessionAdapter,
  InMemorySupervisorAdapter,
  type RuleSet,
  SessionLogger,
  type SupervisorQuestionContext,
  SupervisorService,
} from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultBMADCommandRunner } from '../DefaultBMADCommandRunner.js';

/** Captures the iamtheLawRules carried by the supervisor context. */
class SpySupervisorService extends SupervisorService {
  capturedIamTheLawRules: string | undefined;
  override setWorkflowContext(
    command: string,
    storyId: string,
    context: SupervisorQuestionContext,
    sessionId?: string,
  ): void {
    this.capturedIamTheLawRules = context.iamtheLawRules;
    super.setWorkflowContext(command, storyId, context, sessionId);
  }
}

function spySupervisor(projectRoot: string): SpySupervisorService {
  const eventBus = new EventBus();
  const sessionLogger = new SessionLogger(new StructuredLogger(projectRoot), eventBus);
  return new SpySupervisorService(new InMemorySupervisorAdapter(new Map()), sessionLogger);
}

function completedSession(output = 'done'): InMemorySessionAdapter {
  return new InMemorySessionAdapter([{ completed: true, output, durationMs: 1 }]);
}

/** A DoDService stub that records the criteria handed to evaluate. */
class StubDoDService extends DoDService {
  readonly calls: { criteria: string[]; ctx: DoDContext }[] = [];
  constructor(private readonly verdict: DoDEvaluation) {
    super();
  }
  override async evaluate(ctx: DoDContext, criteria: string[]): Promise<DoDEvaluation> {
    this.calls.push({ criteria, ctx });
    return this.verdict;
  }
}

function emptyRuleSet(): RuleSet {
  return { global: [], scrum: [], architecture: [], agents: {} };
}

describe('DefaultBMADCommandRunner iamthelaw enforcement (fiche 0014)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'iamthelaw-runner-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('advisory injection', () => {
    it('injects formatted advisory rules into the supervisor context', async () => {
      const ruleSet: RuleSet = {
        global: [{ id: 'G1', description: 'No force push', source: 'team' }],
        scrum: [{ id: 'S1', description: 'Small PRs', source: 'scrum' }],
        architecture: [],
        agents: {},
      };
      const supervisor = spySupervisor(dir);
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: supervisor,
        dodService: new StubDoDService({ passed: true, failures: [] }),
        lawProvider: () => ruleSet,
      });

      await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(supervisor.capturedIamTheLawRules).toBe('- No force push (team)\n- Small PRs (scrum)');
    });

    it('excludes enforced (checked) rules from the advisory text', async () => {
      const ruleSet: RuleSet = {
        global: [
          { id: 'G1', description: 'verify', source: 'team', check: 'verification' },
          { id: 'G2', description: 'No force push', source: 'team' },
        ],
        scrum: [],
        architecture: [],
        agents: {},
      };
      const supervisor = spySupervisor(dir);
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: supervisor,
        dodService: new StubDoDService({ passed: true, failures: [] }),
        lawProvider: () => ruleSet,
      });

      await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(supervisor.capturedIamTheLawRules).toBe('- No force push (team)');
    });

    it('survives a rule-load failure: falls back to no rules, run is not crashed', async () => {
      const supervisor = spySupervisor(dir);
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: supervisor,
        dodService: new StubDoDService({ passed: true, failures: [] }),
        lawProvider: () => {
          throw new Error('EACCES reading iamthelaw/');
        },
      });

      const result = await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      // The night-loop must not crash on a rule-load throw; it advances with no rules.
      expect(result.success).toBe(true);
      expect(supervisor.capturedIamTheLawRules).toBe('');
    });

    it('keeps iamtheLawRules empty when there are no rules', async () => {
      const supervisor = spySupervisor(dir);
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: supervisor,
        dodService: new StubDoDService({ passed: true, failures: [] }),
        lawProvider: () => emptyRuleSet(),
      });

      await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(supervisor.capturedIamTheLawRules).toBe('');
    });
  });

  describe('enforced criteria', () => {
    it('appends a checked rule id to the DoD criteria (deduped)', async () => {
      const ruleSet: RuleSet = {
        global: [{ id: 'G1', description: 'verify', source: 'team', check: 'verification' }],
        scrum: [{ id: 'S1', description: 'verify too', source: 'scrum', check: 'verification' }],
        architecture: [],
        agents: {},
      };
      const dodService = new StubDoDService({ passed: true, failures: [] });
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: spySupervisor(dir),
        dodService,
        lawProvider: () => ruleSet,
      });

      await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      const criteria = dodService.calls[0]?.criteria ?? [];
      expect(criteria).toEqual(['verification', 'review_verdict']);
      expect(criteria.filter((c) => c === 'verification')).toHaveLength(1);
    });

    it('passes an unknown check id through without crashing', async () => {
      const ruleSet: RuleSet = {
        global: [{ id: 'G1', description: 'custom', source: 'team', check: 'my_custom_check' }],
        scrum: [],
        architecture: [],
        agents: {},
      };
      const dodService = new StubDoDService({ passed: true, failures: [] });
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: spySupervisor(dir),
        dodService,
        lawProvider: () => ruleSet,
      });

      const result = await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(result.success).toBe(true);
      expect(dodService.calls[0]?.criteria).toEqual([
        'verification',
        'review_verdict',
        'my_custom_check',
      ]);
    });

    it('uses only the built-in criteria when no rules opt into a check', async () => {
      const dodService = new StubDoDService({ passed: true, failures: [] });
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: spySupervisor(dir),
        dodService,
        lawProvider: () => emptyRuleSet(),
      });

      await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(dodService.calls[0]?.criteria).toEqual(['verification', 'review_verdict']);
    });
  });

  describe('audit', () => {
    it('appends a history entry when a DoD failure is attributable to a check rule', async () => {
      const ruleSet: RuleSet = {
        global: [{ id: 'G1', description: 'verify', source: 'team', check: 'verification' }],
        scrum: [],
        architecture: [],
        agents: {},
      };
      const entries: HistoryEntry[] = [];
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: spySupervisor(dir),
        dodService: new StubDoDService({
          passed: false,
          failures: [{ id: 'verification', detail: 'verify failed: injected' }],
        }),
        lawProvider: () => ruleSet,
        auditSink: (entry) => entries.push(entry),
      });

      const result = await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(result.success).toBe(false);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.id).toBe('G1');
      expect(entries[0]?.status).toBe('violated');
      expect(entries[0]?.source).toBe('team');
      expect(entries[0]?.rationale).toBe('verify failed: injected');
      expect(entries[0]?.added_by).toBe('orchestrator');
      expect(entries[0]?.added_at).toBeTruthy();
    });

    it('does not append history when the DoD failure is a built-in (non-check) criterion', async () => {
      const entries: HistoryEntry[] = [];
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: spySupervisor(dir),
        dodService: new StubDoDService({
          passed: false,
          failures: [{ id: 'verification', detail: 'verify failed: injected' }],
        }),
        lawProvider: () => emptyRuleSet(),
        auditSink: (entry) => entries.push(entry),
      });

      await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(entries).toHaveLength(0);
    });

    it('appends nothing on a clean run', async () => {
      const ruleSet: RuleSet = {
        global: [{ id: 'G1', description: 'verify', source: 'team', check: 'verification' }],
        scrum: [],
        architecture: [],
        agents: {},
      };
      const entries: HistoryEntry[] = [];
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: spySupervisor(dir),
        dodService: new StubDoDService({ passed: true, failures: [] }),
        lawProvider: () => ruleSet,
        auditSink: (entry) => entries.push(entry),
      });

      const result = await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      expect(result.success).toBe(true);
      expect(entries).toHaveLength(0);
    });

    it('does not fail the run when the audit sink throws', async () => {
      const ruleSet: RuleSet = {
        global: [{ id: 'G1', description: 'verify', source: 'team', check: 'verification' }],
        scrum: [],
        architecture: [],
        agents: {},
      };
      const runner = createDefaultBMADCommandRunner({
        sessionPort: completedSession(),
        supervisorService: spySupervisor(dir),
        dodService: new StubDoDService({
          passed: false,
          failures: [{ id: 'verification', detail: 'verify failed: injected' }],
        }),
        lawProvider: () => ruleSet,
        auditSink: () => {
          throw new Error('disk full');
        },
      });

      const result = await runner({
        command: '/bmad-bmm-dev-story',
        storyKey: 'EA1-S1',
        epicId: 'EA1',
        projectRoot: dir,
      });

      // The run still reports the DoD failure (not an audit crash).
      expect(result.success).toBe(false);
      expect(result.note).toBe('verify failed: injected');
    });
  });
});
