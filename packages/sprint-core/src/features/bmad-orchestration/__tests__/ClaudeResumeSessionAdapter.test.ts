import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import {
  ClaudeResumeSessionAdapter,
  type ProcessSpawner,
} from '../infrastructure/ClaudeResumeSessionAdapter.js';

interface SpawnScript {
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
  /** When true, never emits 'close' (used for timeout test). */
  hang?: boolean;
  /** When set, emits an 'error' instead of 'close'. */
  error?: Error;
}

function createScriptedSpawner(scripts: SpawnScript[]): {
  spawner: ProcessSpawner;
  calls: { args: string[]; cwd: string }[];
} {
  const calls: { args: string[]; cwd: string }[] = [];
  let i = 0;
  const spawner: ProcessSpawner = (_command, args, options) => {
    calls.push({ args, cwd: options.cwd });
    const script = scripts[i++] ?? scripts[scripts.length - 1]!;
    const emitter = new EventEmitter();
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();
    const child = emitter as unknown as ChildProcess;
    child.stdout = stdoutEmitter as ChildProcess['stdout'];
    child.stderr = stderrEmitter as ChildProcess['stderr'];
    child.kill = vi.fn().mockImplementation((signal: string) => {
      if (signal === 'SIGTERM' && !script.hang) {
        setTimeout(() => emitter.emit('close', null), 1);
      }
      return true;
    });
    Object.defineProperty(child, 'pid', { value: 12345 });

    if (script.error) {
      setTimeout(() => emitter.emit('error', script.error), 2);
    } else if (!script.hang) {
      setTimeout(() => {
        if (script.stdout) stdoutEmitter.emit('data', Buffer.from(script.stdout));
        if (script.stderr) stderrEmitter.emit('data', Buffer.from(script.stderr));
        emitter.emit('close', script.exitCode);
      }, 2);
    }
    return child;
  };
  return { spawner, calls };
}

const okEnvelope = (sessionId: string, result: string, stopReason = 'end_turn') =>
  JSON.stringify({
    session_id: sessionId,
    result,
    stop_reason: stopReason,
    usage: { input_tokens: 10, output_tokens: 20 },
  });

describe('ClaudeResumeSessionAdapter', () => {
  it('startSession spawns claude -p with correct args, captures session_id, returns first turn', async () => {
    const { spawner, calls } = createScriptedSpawner([
      { exitCode: 0, stdout: okEnvelope('cli-sess-1', 'hello world') },
    ]);
    const adapter = new ClaudeResumeSessionAdapter(undefined, undefined, spawner);

    const handle = await adapter.startSession('/bmad-bmm-dev-story', { projectPath: '/tmp' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toContain('-p');
    expect(calls[0]?.args).toContain('--output-format');
    expect(calls[0]?.args).toContain('json');
    expect(calls[0]?.args).toContain('--permission-mode');
    expect(calls[0]?.args).toContain('acceptEdits');
    expect(calls[0]?.cwd).toBe('/tmp');
    expect(handle.sessionId).toBeTruthy();
    expect(handle.firstTurn.output).toBe('hello world');
    expect(handle.firstTurn.tokensUsed).toBe(30);
    expect(handle.firstTurn.completed).toBe(true);
  });

  it('emits session.started then session.turn.completed', async () => {
    const { spawner } = createScriptedSpawner([
      { exitCode: 0, stdout: okEnvelope('cli-sess-2', 'ok') },
    ]);
    const eventBus = new EventBus();
    const events: string[] = [];
    eventBus.on('session.started', () => events.push('started'));
    eventBus.on('session.turn.completed', () => events.push('turn.completed'));
    eventBus.on('session.workflow.completed', () => events.push('workflow.completed'));

    const adapter = new ClaudeResumeSessionAdapter(eventBus, undefined, spawner);
    await adapter.startSession('/test', { projectPath: '/tmp' });

    expect(events[0]).toBe('started');
    expect(events).toContain('turn.completed');
    expect(events).toContain('workflow.completed');
  });

  it('continueSession spawns claude --resume with mapped cliSessionId', async () => {
    const { spawner, calls } = createScriptedSpawner([
      { exitCode: 0, stdout: okEnvelope('cli-sess-3', 'first') },
      { exitCode: 0, stdout: okEnvelope('cli-sess-3', 'second') },
    ]);
    const adapter = new ClaudeResumeSessionAdapter(undefined, undefined, spawner);

    const handle = await adapter.startSession('/test', { projectPath: '/tmp' });
    const next = await adapter.continueSession(handle.sessionId, 'C');

    expect(calls).toHaveLength(2);
    expect(calls[1]?.args[0]).toBe('--resume');
    expect(calls[1]?.args[1]).toBe('cli-sess-3');
    expect(calls[1]?.args).toContain('-p');
    expect(next.output).toBe('second');
  });

  it('continueSession with unknown sessionId throws', async () => {
    const { spawner } = createScriptedSpawner([{ exitCode: 0, stdout: '{}' }]);
    const adapter = new ClaudeResumeSessionAdapter(undefined, undefined, spawner);
    await expect(adapter.continueSession('nope', 'msg')).rejects.toThrow(/Unknown sessionId/);
  });

  it('detectQuestion heuristic table', () => {
    const adapter = new ClaudeResumeSessionAdapter();
    expect(adapter.detectQuestion('Should I proceed?')).toBe('Should I proceed?');
    expect(adapter.detectQuestion('All done.')).toBeNull();
    expect(adapter.detectQuestion('Confirm deployment [Y/n]')).toBe('Confirm deployment [Y/n]');
    expect(adapter.detectQuestion('Continue with the next file')).toBe(
      'Continue with the next file',
    );
    expect(adapter.detectQuestion('Generated 5 files.')).toBeNull();
  });

  it('detectCompletion heuristic — keywords on last non-empty line', () => {
    const adapter = new ClaudeResumeSessionAdapter();
    expect(adapter.detectCompletion('workflow complete')).toBe(true);
    expect(adapter.detectCompletion('All done')).toBe(true);
    expect(adapter.detectCompletion('Story ready-for-review')).toBe(true);
    expect(adapter.detectCompletion('Story ready for review')).toBe(true);
    expect(adapter.detectCompletion('finished')).toBe(true);
    expect(adapter.detectCompletion('Generated 5 files.')).toBe(false);
    expect(adapter.detectCompletion('')).toBe(false);
  });

  it('detectCompletion heuristic — stop_reason end_turn', () => {
    const adapter = new ClaudeResumeSessionAdapter();
    expect(adapter.detectCompletion('any text', 'end_turn')).toBe(true);
    expect(adapter.detectCompletion('any text', 'tool_use')).toBe(false);
    expect(adapter.detectCompletion('any text', undefined)).toBe(false);
  });

  it('startSession returns error when CLI envelope omits session_id', async () => {
    const { spawner } = createScriptedSpawner([
      { exitCode: 0, stdout: JSON.stringify({ result: 'oops', stop_reason: 'end_turn' }) },
    ]);
    const adapter = new ClaudeResumeSessionAdapter(undefined, undefined, spawner);
    const handle = await adapter.startSession('/test', { projectPath: '/tmp' });
    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toMatch(/failed to capture session_id/);
  });

  it('caps recursion at maxAutoReplies when heuristic loops', async () => {
    // Every turn returns a question — recursion should hit cap.
    const loopingEnvelope = JSON.stringify({
      session_id: 'cli-loop',
      result: 'Should I proceed?',
      stop_reason: 'tool_use',
    });
    const scripts: SpawnScript[] = Array.from({ length: 10 }, () => ({
      exitCode: 0,
      stdout: loopingEnvelope,
    }));
    const { spawner } = createScriptedSpawner(scripts);

    const handler = vi.fn().mockResolvedValue({
      behavior: 'allow',
      updatedInput: { answers: { 'Should I proceed?': 'C' } },
    });

    const adapter = new ClaudeResumeSessionAdapter(
      undefined,
      { maxAutoReplies: 3, questionHandler: handler },
      spawner,
    );

    const handle = await adapter.startSession('/test', { projectPath: '/tmp' });
    // startSession returns first turn which itself isn't auto-replied (auto-reply
    // recursion lives in continueSession). Trigger continueSession to exercise it.
    const result = await adapter.continueSession(handle.sessionId, 'C');

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('maxAutoReplies exceeded');
  });

  it('returns error when questionHandler denies', async () => {
    const questionEnv = JSON.stringify({
      session_id: 'cli-d',
      result: 'Confirm deployment?',
      stop_reason: 'tool_use',
    });
    const { spawner } = createScriptedSpawner([
      { exitCode: 0, stdout: okEnvelope('cli-d', 'starting...', 'tool_use') },
      { exitCode: 0, stdout: questionEnv },
    ]);

    const handler = vi.fn().mockResolvedValue({ behavior: 'deny', message: 'escalate' });

    const eventBus = new EventBus();
    const failed: unknown[] = [];
    eventBus.on('session.workflow.failed', (p) => failed.push(p));

    const adapter = new ClaudeResumeSessionAdapter(eventBus, { questionHandler: handler }, spawner);
    const handle = await adapter.startSession('/test', { projectPath: '/tmp' });
    const result = await adapter.continueSession(handle.sessionId, 'C');

    expect(result.error).toBe(true);
    expect(result.errorMessage).toBe('escalate');
    expect(result.completed).toBe(true);
    expect(failed.length).toBeGreaterThan(0);
  });

  it('timeout path returns error result with timeout message', async () => {
    const { spawner } = createScriptedSpawner([{ exitCode: null, hang: true }]);
    const adapter = new ClaudeResumeSessionAdapter(
      undefined,
      { timeoutMs: 30, gracefulShutdownMs: 10 },
      spawner,
    );
    const handle = await adapter.startSession('/test', { projectPath: '/tmp' });
    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toMatch(/timed out/i);
  });

  it('spawn error path returns error result containing "spawn error"', async () => {
    const { spawner } = createScriptedSpawner([
      { exitCode: null, error: new Error('ENOENT: claude not found') },
    ]);
    const adapter = new ClaudeResumeSessionAdapter(undefined, undefined, spawner);
    const handle = await adapter.startSession('/test', { projectPath: '/tmp' });
    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toContain('spawn error');
    expect(handle.firstTurn.errorMessage).toContain('ENOENT');
  });
});
