import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { EventBus } from '@cop1/shared-kernel';
import { BMADTimeoutError } from '../domain/errors/BMADTimeoutError.js';
import type {
  BMADSessionContext,
  BMADSessionPort,
  QuestionHandler,
  SessionHandle,
  SessionTurnResult,
} from '../domain/ports/BMADSessionPort.js';

export interface ClaudeResumeSessionAdapterOptions {
  /** Per-spawn timeout in ms (default 300_000). */
  timeoutMs?: number;
  /** Grace period after SIGTERM before SIGKILL (default 10_000). */
  gracefulShutdownMs?: number;
  /** Max recursive auto-replies on detected questions before bailing out (default 5). */
  maxAutoReplies?: number;
  /** Question handler injected by SupervisorService.createQuestionHandler(). */
  questionHandler?: QuestionHandler;
}

export type ProcessSpawner = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: ['pipe', 'pipe', 'pipe'] },
) => ChildProcess;

const defaultSpawner: ProcessSpawner = (cmd, args, opts) => spawn(cmd, args, opts);

interface SessionState {
  cliSessionId: string;
  context: BMADSessionContext;
  turn: number;
  startedAt: number;
}

/**
 * V0 fallback `BMADSessionPort` implementation that drives multi-turn BMAD
 * workflows by spawning the local `claude` CLI with `--resume <session_id>`
 * between turns. See ADR-012 §3 Option A / §4.1 / §10 D4.
 *
 * Schema assumption for `claude -p ... --output-format json` envelope (verify
 * via `claude --help`; documented here so the next maintainer doesn't have to
 * re-discover it):
 *   {
 *     "session_id": "<uuid>",         // top-level (used for --resume)
 *     "result": "...assistant text...",
 *     "stop_reason": "end_turn" | ...,
 *     "usage": { "input_tokens": N, "output_tokens": M }
 *   }
 *
 * Limitations (V0, intentional):
 * - Question detection is a fragile text heuristic (no canUseTool callback in
 *   --resume mode). The maxAutoReplies cap bounds blast radius.
 * - Workflow loading is best-effort: read .claude/skills/<slug>/workflow.md if
 *   present, else send the bare `command` and emit a warning event.
 * - Timeouts surface as `error: true` in `SessionTurnResult` (NOT thrown),
 *   matching the AgentSdkSessionAdapter convention so BMADSessionStep stays
 *   adapter-agnostic.
 */
export class ClaudeResumeSessionAdapter implements BMADSessionPort {
  private readonly eventBus?: EventBus;
  private readonly timeoutMs: number;
  private readonly gracefulShutdownMs: number;
  private readonly maxAutoReplies: number;
  private readonly questionHandler?: QuestionHandler;
  private readonly spawner: ProcessSpawner;
  private readonly sessions = new Map<string, SessionState>();

  constructor(
    eventBus?: EventBus,
    options?: ClaudeResumeSessionAdapterOptions,
    spawner?: ProcessSpawner,
  ) {
    this.eventBus = eventBus;
    this.timeoutMs = options?.timeoutMs ?? 300_000;
    this.gracefulShutdownMs = options?.gracefulShutdownMs ?? 10_000;
    this.maxAutoReplies = options?.maxAutoReplies ?? 5;
    this.questionHandler = options?.questionHandler;
    this.spawner = spawner ?? defaultSpawner;
  }

  async startSession(command: string, context: BMADSessionContext): Promise<SessionHandle> {
    const sessionId = randomUUID();
    const startTime = Date.now();

    this.eventBus?.emit('session.started', {
      sessionId,
      command,
      storyId: context.storyId,
      timestamp: new Date().toISOString(),
    });

    const prompt = this.buildInitialPrompt(command, context);
    const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits'];

    const firstTurn = await this.runTurn({
      sessionId,
      args,
      cwd: context.projectPath,
      startTime,
      isFirstTurn: true,
      context,
    });

    return { sessionId, firstTurn };
  }

  async continueSession(sessionId: string, message: string): Promise<SessionTurnResult> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(
        `Unknown sessionId for ClaudeResumeSessionAdapter.continueSession: ${sessionId}`,
      );
    }
    return this.continueInternal(sessionId, message, 0);
  }

  private async continueInternal(
    sessionId: string,
    message: string,
    autoReplyDepth: number,
  ): Promise<SessionTurnResult> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(
        `Unknown sessionId for ClaudeResumeSessionAdapter.continueSession: ${sessionId}`,
      );
    }

    const startTime = Date.now();
    const args = ['--resume', state.cliSessionId, '-p', message, '--output-format', 'json'];

    const result = await this.runTurn({
      sessionId,
      args,
      cwd: state.context.projectPath,
      startTime,
      isFirstTurn: false,
      context: state.context,
    });

    return this.maybeAutoReply(sessionId, result, autoReplyDepth);
  }

  private async maybeAutoReply(
    sessionId: string,
    result: SessionTurnResult,
    autoReplyDepth: number,
  ): Promise<SessionTurnResult> {
    if (result.error || result.completed) return result;
    if (!this.questionHandler) return result;

    const question = this.detectQuestion(result.output);
    if (!question) return result;

    if (autoReplyDepth + 1 >= this.maxAutoReplies) {
      const errorMessage =
        'ClaudeResumeSessionAdapter: maxAutoReplies exceeded — heuristic question detection likely looped';
      const state = this.sessions.get(sessionId);
      this.eventBus?.emit('session.workflow.failed', {
        sessionId,
        storyId: state?.context.storyId,
        error: errorMessage,
        turn: state?.turn ?? 0,
      });
      return { ...result, error: true, errorMessage, completed: true };
    }

    const handlerResult = await this.questionHandler('AskUserQuestion', {
      questions: [question],
    });

    if (handlerResult.behavior === 'deny') {
      const state = this.sessions.get(sessionId);
      this.eventBus?.emit('session.workflow.failed', {
        sessionId,
        storyId: state?.context.storyId,
        error: handlerResult.message,
        turn: state?.turn ?? 0,
      });
      return {
        ...result,
        error: true,
        errorMessage: handlerResult.message,
        completed: true,
      };
    }

    const updated = handlerResult.updatedInput as Record<string, unknown>;
    const answersField = updated.answers as Record<string, string> | undefined;
    const answer = answersField?.[question] || 'C';

    const next = await this.continueInternal(sessionId, answer, autoReplyDepth + 1);
    return {
      completed: next.completed,
      output: `${result.output}\n${next.output}`,
      tokensUsed: (result.tokensUsed ?? 0) + (next.tokensUsed ?? 0) || undefined,
      durationMs: result.durationMs + next.durationMs,
      ...(next.error ? { error: true, errorMessage: next.errorMessage } : {}),
    };
  }

  private async runTurn(params: {
    sessionId: string;
    args: string[];
    cwd: string;
    startTime: number;
    isFirstTurn: boolean;
    context: BMADSessionContext;
  }): Promise<SessionTurnResult> {
    const { sessionId, args, cwd, startTime, isFirstTurn, context } = params;
    try {
      const stdout = await this.spawnClaude(args, cwd);
      const durationMs = Date.now() - startTime;
      const parsed = this.parseEnvelope(stdout);

      let state = this.sessions.get(sessionId);
      if (isFirstTurn) {
        if (!parsed.sessionId) {
          throw new Error(
            'ClaudeResumeSessionAdapter: failed to capture session_id from claude CLI JSON envelope (cannot bind --resume for subsequent turns)',
          );
        }
        state = {
          cliSessionId: parsed.sessionId,
          context,
          turn: 0,
          startedAt: startTime,
        };
        this.sessions.set(sessionId, state);
      }
      if (!state) {
        throw new Error(`Session state missing for ${sessionId}`);
      }
      state.turn += 1;

      const output = parsed.result ?? stdout;
      const completed =
        this.detectCompletion(output, parsed.stopReason) && !this.detectQuestion(output);

      this.eventBus?.emit('session.turn.completed', {
        sessionId,
        turn: state.turn,
        durationMs,
        tokensUsed: parsed.tokensUsed,
      });

      if (completed) {
        this.eventBus?.emit('session.workflow.completed', {
          sessionId,
          storyId: context.storyId,
          totalTurns: state.turn,
          totalDurationMs: Date.now() - state.startedAt,
        });
      }

      return {
        completed,
        output,
        ...(parsed.tokensUsed !== undefined && { tokensUsed: parsed.tokensUsed }),
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.eventBus?.emit('session.workflow.failed', {
        sessionId,
        storyId: context.storyId,
        error: errorMessage,
        turn: this.sessions.get(sessionId)?.turn ?? 0,
      });

      return {
        completed: true,
        output: '',
        error: true,
        errorMessage,
        durationMs,
      };
    }
  }

  private buildInitialPrompt(command: string, context: BMADSessionContext): string {
    const slug = command.replace(/^\//, '').trim();
    const attempted: string[] = [];

    // Lookup 1: .claude/skills/<slug>/workflow.md
    const skillPath = join(context.projectPath, '.claude', 'skills', slug, 'workflow.md');
    attempted.push(skillPath);
    if (existsSync(skillPath)) {
      try {
        const body = readFileSync(skillPath, 'utf-8');
        return `${body}\n\n---\n\n${command}`;
      } catch {
        // fall through
      }
    }

    // Lookup 2: _bmad/bmm/workflows/**/<slug>/workflow.md (first match wins).
    const workflowsRoot = join(context.projectPath, '_bmad', 'bmm', 'workflows');
    attempted.push(workflowsRoot);
    const found = this.findWorkflowMd(workflowsRoot, slug);
    if (found) {
      try {
        const body = readFileSync(found, 'utf-8');
        return `${body}\n\n---\n\n${command}`;
      } catch {
        // fall through
      }
    }

    this.eventBus?.emit('bmad.resume.workflow_not_loaded', {
      command,
      slug,
      attempted,
      storyId: context.storyId,
    });
    return command;
  }

  /** Recursive walk: find first `<slug>/workflow.md` under `root`. Returns absolute path or null. */
  private findWorkflowMd(root: string, slug: string, depth = 0): string | null {
    if (depth > 6) return null; // safety bound
    if (!existsSync(root)) return null;
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      return null;
    }
    for (const entry of entries) {
      const full = join(root, entry);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      if (entry === slug) {
        const candidate = join(full, 'workflow.md');
        if (existsSync(candidate)) return candidate;
      }
      const nested = this.findWorkflowMd(full, slug, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  private parseEnvelope(stdout: string): {
    sessionId?: string;
    result?: string;
    stopReason?: string;
    tokensUsed?: number;
  } {
    try {
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      const usage = parsed.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      const tokensUsed = usage ? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) : undefined;
      return {
        sessionId: typeof parsed.session_id === 'string' ? parsed.session_id : undefined,
        result: typeof parsed.result === 'string' ? parsed.result : undefined,
        stopReason: typeof parsed.stop_reason === 'string' ? parsed.stop_reason : undefined,
        ...(tokensUsed !== undefined && { tokensUsed }),
      };
    } catch {
      return {};
    }
  }

  /** Heuristic question detection — see AC4. Returns the question text or null. */
  detectQuestion(output: string): string | null {
    const lines = output.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const last = lines[lines.length - 1]!.trim();
    if (last.endsWith('?')) return last;
    if (/\b(continue|proceed|confirm|approve|y\/n|\[Y\/n\]|\[y\/N\])\b/i.test(last)) {
      return last;
    }
    return null;
  }

  /** Heuristic completion detection — see AC4. */
  detectCompletion(output: string, stopReason?: string): boolean {
    const lines = output.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const last = lines.length > 0 ? lines[lines.length - 1]!.trim() : '';
    if (/\b(workflow complete|done|finished|story.*ready[- ]for[- ]review)\b/i.test(last)) {
      return true;
    }
    if (stopReason === 'end_turn') return true;
    return false;
  }

  private spawnClaude(args: string[], cwd: string): Promise<string> {
    // TODO(post-EA9): consider extracting shared CLI runner with ClaudeCliAdapter
    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let forceTimer: ReturnType<typeof setTimeout> | undefined;

      const child = this.spawner('claude', args, {
        cwd: cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      const cleanup = () => {
        clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        if (forceTimer) clearTimeout(forceTimer);
      };

      const timer = setTimeout(() => {
        if (!settled) {
          timedOut = true;
          child.kill('SIGTERM');
          killTimer = setTimeout(() => {
            if (!settled) {
              child.kill('SIGKILL');
              forceTimer = setTimeout(() => {
                if (!settled) {
                  settled = true;
                  cleanup();
                  reject(new BMADTimeoutError(this.timeoutMs));
                }
              }, 2_000);
            }
          }, this.gracefulShutdownMs);
        }
      }, this.timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`Claude CLI spawn error: ${error.message}`));
        }
      });

      child.on('close', (code: number | null) => {
        if (!settled) {
          settled = true;
          cleanup();
          if (timedOut) {
            reject(new BMADTimeoutError(this.timeoutMs));
          } else if (code === 0) {
            resolve(stdout);
          } else {
            reject(new Error(`Claude CLI exited with code ${code}: ${stderr || stdout}`));
          }
        }
      });
    });
  }
}
