import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { EventBus } from '@cop1/shared-kernel';
import { defaultCommandsForPhase } from '@cop1/sprint-core';
import type { BudgetGuard } from '../domain/RunBudget.js';
import type { SupervisorPlaybook } from '../domain/SupervisorPlaybook.js';

// NOTE — `sprint-status.yaml` file-level coupling is intentional and localized
// here (the orchestrator reads BMAD's story list). Target architecture
// (EA12-S4 follow-up, V1.1) replaces this with a `SprintStatusPort` injection
// wired to a `BmadCommandStatusAdapter`. The invariant test at
// `infrastructure/__tests__/sprint-status-coupling-invariant.test.ts` allows
// this single reference.

export type OrchestratorMode = 'normal' | 'step-by-step' | 'abort-on-escalation';

export interface OrchestratorRunOptions {
  playbook: SupervisorPlaybook;
  epicId: string;
  projectRoot: string;
  mode: OrchestratorMode;
}

export interface StoryOutcome {
  storyKey: string;
  previousStatus: string;
  nextStatus: string;
  commandsRun: string[];
  error?: string;
}

export interface OrchestratorRunResult {
  epicId: string;
  storiesProcessed: StoryOutcome[];
  escalated: boolean;
  aborted: boolean;
}

/**
 * Per-story command handler. Returns the new status the story should transition
 * to. Implementations wire through `SprintRunner` / `BMADSessionPort` per ADR-013.
 */
export type BMADCommandRunner = (input: {
  command: string;
  storyKey: string;
  epicId: string;
  projectRoot: string;
}) => Promise<{ success: boolean; nextStatus?: string; escalated?: boolean; note?: string }>;

/**
 * Injectable sink for inter-command pause approvals. Default = immediate continue.
 * Wired from `StepByStepController` (EA11-S3) in EA10-S5.
 */
export type InterCommandGate = (context: {
  storyKey: string;
  nextCommand: string;
}) => Promise<'continue' | 'skip' | 'abort'>;

/**
 * Inter-command orchestrator driven by a supervisor playbook.
 *
 * Responsibilities (per ADR-013):
 *   - Read the target epic's stories from sprint-status.yaml
 *   - For each story, run the canonical command sequence
 *   - Persist state transitions (backlog → ready-for-dev → in-progress → review → done / blocked)
 *   - Emit structured events on the EventBus
 *   - Log auto-decisions
 *
 * Intra-command concerns (worktree, checkpoint, session lifecycle) remain in
 * `SprintRunner` — the `BMADCommandRunner` callback is the delegation seam.
 */
export class OrchestratorService {
  constructor(
    private readonly runner: BMADCommandRunner,
    private readonly eventBus: EventBus,
    private readonly gate: InterCommandGate = async () => 'continue',
    private readonly autoDecisionLogger?: (payload: Record<string, unknown>) => void,
    private readonly budgetGuard?: BudgetGuard,
  ) {}

  async run(options: OrchestratorRunOptions): Promise<OrchestratorRunResult> {
    const statusPath = join(
      options.projectRoot,
      '_bmad-output',
      'implementation-artifacts',
      'sprint-status.yaml',
    );
    const statusRaw = await readFile(statusPath, 'utf-8');
    const stories = extractStoryKeysForEpic(statusRaw, options.epicId);

    this.eventBus.emit('orchestrator.run.started', {
      epicId: options.epicId,
      storyCount: stories.length,
      ts: new Date().toISOString(),
    });

    const outcomes: StoryOutcome[] = [];
    let escalated = false;
    let aborted = false;

    storyLoop: for (const storyKey of stories) {
      const previousStatus = getStoryStatus(statusRaw, storyKey);
      if (previousStatus === 'done' || previousStatus === 'cancelled') {
        continue;
      }

      this.eventBus.emit('orchestrator.story.started', { storyKey, ts: new Date().toISOString() });
      const commandsRun: string[] = [];

      for (const phase of options.playbook.phases) {
        // EA12-S3 / A5 pivot: if the playbook doesn't enumerate phase commands,
        // fall back to the canonical cycle from sprint-core. Unknown phase names
        // with no commands are silently skipped.
        const phaseCommands =
          phase.commands ?? defaultCommandsForPhase(phase.name)?.map((command) => ({ command }));
        if (!phaseCommands || phaseCommands.length === 0) continue;
        for (const cmd of phaseCommands) {
          // Budget / kill-switch: stop the whole run cleanly before each command.
          // No status is persisted — the run is interrupted, not the story.
          if (this.budgetGuard) {
            const budget = this.budgetGuard.status();
            if (budget.tripped) {
              aborted = true;
              outcomes.push({
                storyKey,
                previousStatus,
                nextStatus: previousStatus,
                commandsRun,
                error: `budget tripped: ${budget.reason}`,
              });
              this.eventBus.emit('orchestrator.run.aborted', {
                reason: budget.reason,
                ts: new Date().toISOString(),
              });
              break storyLoop;
            }
          }

          if (options.mode === 'step-by-step') {
            const gate = await this.gate({ storyKey, nextCommand: cmd.command });
            if (gate === 'abort') {
              aborted = true;
              outcomes.push({
                storyKey,
                previousStatus,
                nextStatus: previousStatus,
                commandsRun,
                error: 'aborted by step-by-step gate',
              });
              break storyLoop;
            }
            if (gate === 'skip') continue;
          }

          this.eventBus.emit('orchestrator.command.started', {
            storyKey,
            command: cmd.command,
            ts: new Date().toISOString(),
          });
          const result = await this.runner({
            command: cmd.command,
            storyKey,
            epicId: options.epicId,
            projectRoot: options.projectRoot,
          });
          commandsRun.push(cmd.command);

          this.autoDecisionLogger?.({
            ts: new Date().toISOString(),
            event: 'auto-decision',
            storyKey,
            command: cmd.command,
            success: result.success,
            escalated: result.escalated ?? false,
            nextStatus: result.nextStatus,
            note: result.note,
          });
          this.eventBus.emit('orchestrator.command.completed', {
            storyKey,
            command: cmd.command,
            success: result.success,
            ts: new Date().toISOString(),
          });

          if (result.escalated) {
            escalated = true;
            if (options.mode === 'abort-on-escalation') {
              outcomes.push({
                storyKey,
                previousStatus,
                nextStatus: 'blocked',
                commandsRun,
                error: 'supervisor escalation',
              });
              await this.persistStatus(statusPath, storyKey, 'blocked');
              aborted = true;
              break storyLoop;
            }
          }

          if (!result.success) {
            outcomes.push({
              storyKey,
              previousStatus,
              nextStatus: 'blocked',
              commandsRun,
              error: result.note ?? 'command failed',
            });
            await this.persistStatus(statusPath, storyKey, 'blocked');
            continue storyLoop;
          }

          if (result.nextStatus) {
            await this.persistStatus(statusPath, storyKey, result.nextStatus);
          }
        }
      }

      const finalStatus = getStoryStatusFromFile(await readFile(statusPath, 'utf-8'), storyKey);
      outcomes.push({
        storyKey,
        previousStatus,
        nextStatus: finalStatus ?? previousStatus,
        commandsRun,
      });
      this.eventBus.emit('orchestrator.story.completed', {
        storyKey,
        finalStatus,
        ts: new Date().toISOString(),
      });
    }

    this.eventBus.emit('orchestrator.run.completed', {
      epicId: options.epicId,
      storiesProcessed: outcomes.length,
      escalated,
      aborted,
      ts: new Date().toISOString(),
    });

    return { epicId: options.epicId, storiesProcessed: outcomes, escalated, aborted };
  }

  private async persistStatus(path: string, storyKey: string, nextStatus: string): Promise<void> {
    const current = await readFile(path, 'utf-8');
    const updated = rewriteStoryStatus(current, storyKey, nextStatus);
    await writeFile(path, updated, 'utf-8');

    // EA13-S4 — mirror status into the story body file. Closes EA12 retro
    // action item #4 (Story↔Session↔Commit triangle). No-op if the body file
    // does not exist (hand-crafted stories / unrelated artefacts).
    const bodyPath = join(dirname(path), `${storyKey}.md`);
    try {
      const body = await readFile(bodyPath, 'utf-8');
      const mirrored = mirrorStoryStatusInBody(body, nextStatus);
      if (mirrored !== body) {
        await writeFile(bodyPath, mirrored, 'utf-8');
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'ENOENT') throw err;
      // ENOENT: no body file for this story — silent no-op.
    }
  }
}

// --- Pure helpers (exported for tests) ---

export function extractStoryKeysForEpic(yaml: string, epicId: string): string[] {
  const epicLower = epicId.toLowerCase();
  const result: string[] = [];
  const lines = yaml.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s+([A-Za-z0-9]+-S[A-Za-z0-9]+):\s*[a-zA-Z-]+/);
    if (!match) continue;
    const key = match[1];
    if (!key) continue;
    const prefix = key.split('-')[0]?.toLowerCase();
    if (prefix === epicLower) {
      result.push(key);
    }
  }
  return result;
}

export function getStoryStatus(yaml: string, storyKey: string): string {
  return getStoryStatusFromFile(yaml, storyKey) ?? 'backlog';
}

function getStoryStatusFromFile(yaml: string, storyKey: string): string | undefined {
  const re = new RegExp(`^\\s+${escapeRegex(storyKey)}:\\s+([a-zA-Z-]+)`, 'm');
  const match = yaml.match(re);
  return match?.[1];
}

export function rewriteStoryStatus(yaml: string, storyKey: string, nextStatus: string): string {
  const re = new RegExp(`^(\\s+${escapeRegex(storyKey)}:\\s+)([a-zA-Z-]+)(.*)$`, 'm');
  return yaml.replace(re, `$1${nextStatus}$3`);
}

/**
 * Rewrites the first `## Status: <value>` line in a story markdown body to
 * `## Status: <nextStatus>`. Returns the body unchanged if no status line is
 * present (zero-side-effect policy — see EA13-S4 dev notes for rationale).
 *
 * Exported for direct unit testing. Caller drives I/O.
 */
export function mirrorStoryStatusInBody(body: string, nextStatus: string): string {
  const re = /^##\s+Status:\s*[^\n]*$/m;
  if (!re.test(body)) return body;
  return body.replace(re, `## Status: ${nextStatus}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
