import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeCliAdapter, type ProcessSpawner } from '../infrastructure/ClaudeCliAdapter.js';

function createMockSpawner(
  exitCode: number,
  stdout = '',
  stderr = '',
): { spawner: ProcessSpawner; calls: { command: string; args: string[]; cwd: string }[] } {
  const calls: { command: string; args: string[]; cwd: string }[] = [];

  const spawner: ProcessSpawner = (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    const emitter = new EventEmitter();
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();

    const child = emitter as unknown as ChildProcess;
    child.stdout = stdoutEmitter as ChildProcess['stdout'];
    child.stderr = stderrEmitter as ChildProcess['stderr'];
    child.kill = vi.fn().mockReturnValue(true);
    Object.defineProperty(child, 'pid', { value: 12345 });

    setTimeout(() => {
      if (stdout) stdoutEmitter.emit('data', Buffer.from(stdout));
      if (stderr) stderrEmitter.emit('data', Buffer.from(stderr));
      emitter.emit('close', exitCode);
    }, 5);

    return child;
  };

  return { spawner, calls };
}

describe('ClaudeCliAdapter', () => {
  it('returns success when claude CLI exits with code 0', async () => {
    const { spawner } = createMockSpawner(0, 'command output');
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    const result = await adapter.execute('/test-command', { projectPath: '/tmp' });

    expect(result.success).toBe(true);
    expect(result.output).toBe('command output');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns failure when claude CLI exits with non-zero code', async () => {
    const { spawner } = createMockSpawner(1, '', 'some error');
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    const result = await adapter.execute('/test-command', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.output).toContain('Claude CLI exited with code 1');
  });

  it('passes correct args to claude CLI', async () => {
    const { spawner, calls } = createMockSpawner(0, 'ok');
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    await adapter.execute('/bmad-bmm-dev-story', { projectPath: '/my/project' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe('claude');
    expect(calls[0]?.args).toContain('-p');
    expect(calls[0]?.args).toContain('--output-format');
    expect(calls[0]?.args).toContain('json');
    expect(calls[0]?.args).toContain('--permission-mode');
    expect(calls[0]?.args).toContain('acceptEdits');
    expect(calls[0]?.cwd).toBe('/my/project');
  });

  it('emits llm.call.started and llm.call.completed events', async () => {
    const eventBus = new EventBus();
    const events: { type: string; payload: unknown }[] = [];

    eventBus.on('llm.call.started', (payload) => events.push({ type: 'started', payload }));
    eventBus.on('llm.call.completed', (payload) => events.push({ type: 'completed', payload }));

    const { spawner } = createMockSpawner(0, 'output');
    const adapter = new ClaudeCliAdapter(eventBus, undefined, spawner);

    await adapter.execute('/test', { projectPath: '/tmp' });

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('started');
    expect(events[1]?.type).toBe('completed');

    const startPayload = events[0]?.payload as Record<string, unknown>;
    expect(startPayload.model).toBe('claude-cli');
    expect(startPayload.agentType).toBe('bmad');

    const completedPayload = events[1]?.payload as Record<string, unknown>;
    expect(completedPayload.responseLength).toBe(6); // 'output'.length
  });

  it('emits llm.call.failed event on failure', async () => {
    const eventBus = new EventBus();
    const events: string[] = [];

    eventBus.on('llm.call.started', () => events.push('started'));
    eventBus.on('llm.call.failed', () => events.push('failed'));

    const { spawner } = createMockSpawner(1, '', 'error');
    const adapter = new ClaudeCliAdapter(eventBus, undefined, spawner);

    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(events).toContain('started');
    expect(events).toContain('failed');
  });

  it('emits llm.call.failed with reason timeout on timeout', async () => {
    const eventBus = new EventBus();
    let failedPayload: Record<string, unknown> | undefined;

    eventBus.on('llm.call.failed', (payload) => {
      failedPayload = payload as Record<string, unknown>;
    });

    const spawner: ProcessSpawner = () => {
      const emitter = new EventEmitter();
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();

      const child = emitter as unknown as ChildProcess;
      child.stdout = stdoutEmitter as ChildProcess['stdout'];
      child.stderr = stderrEmitter as ChildProcess['stderr'];
      child.kill = vi.fn().mockReturnValue(true);
      Object.defineProperty(child, 'pid', { value: 99 });

      return child;
    };

    const adapter = new ClaudeCliAdapter(
      eventBus,
      { timeoutMs: 30, gracefulShutdownMs: 30 },
      spawner,
    );
    await adapter.execute('/test', { projectPath: '/tmp' });

    expect(failedPayload).toBeDefined();
    expect(failedPayload?.reason).toBe('timeout');
    expect(failedPayload?.model).toBe('claude-cli');
    expect(failedPayload?.agentType).toBe('bmad');
  });

  it('emits llm.call.failed with reason error on non-timeout failures', async () => {
    const eventBus = new EventBus();
    let failedPayload: Record<string, unknown> | undefined;

    eventBus.on('llm.call.failed', (payload) => {
      failedPayload = payload as Record<string, unknown>;
    });

    const { spawner } = createMockSpawner(1, '', 'some error');
    const adapter = new ClaudeCliAdapter(eventBus, undefined, spawner);

    await adapter.execute('/test', { projectPath: '/tmp' });

    expect(failedPayload).toBeDefined();
    expect(failedPayload?.reason).toBe('error');
  });

  it('builds prompt with context entries, excluding projectPath', () => {
    const { spawner } = createMockSpawner(0);
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    const prompt = adapter.buildPrompt('/bmad-bmm-dev-story', {
      projectPath: '/tmp',
      story: '# Story EA1-S1\nSome content',
    });

    expect(prompt).toContain('/bmad-bmm-dev-story');
    expect(prompt).toContain('story:\n# Story EA1-S1\nSome content');
    expect(prompt).not.toContain('projectPath');
  });

  it('returns command only when no extra context', () => {
    const { spawner } = createMockSpawner(0);
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    const prompt = adapter.buildPrompt('/test', { projectPath: '/tmp' });

    expect(prompt).toBe('/test');
  });

  it('handles spawn error gracefully', async () => {
    const spawner: ProcessSpawner = () => {
      const emitter = new EventEmitter();
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();

      const child = emitter as unknown as ChildProcess;
      child.stdout = stdoutEmitter as ChildProcess['stdout'];
      child.stderr = stderrEmitter as ChildProcess['stderr'];
      child.kill = vi.fn().mockReturnValue(true);
      Object.defineProperty(child, 'pid', { value: 0 });

      setTimeout(() => {
        emitter.emit('error', new Error('ENOENT: claude not found'));
      }, 5);

      return child;
    };

    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);
    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.output).toContain('Claude CLI spawn error');
    expect(result.output).toContain('ENOENT');
  });

  it('sets retryable=true on timeout errors', async () => {
    const spawner: ProcessSpawner = () => {
      const emitter = new EventEmitter();
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();

      const child = emitter as unknown as ChildProcess;
      child.stdout = stdoutEmitter as ChildProcess['stdout'];
      child.stderr = stderrEmitter as ChildProcess['stderr'];
      child.kill = vi.fn().mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => emitter.emit('close', null), 5);
        }
        return true;
      });
      Object.defineProperty(child, 'pid', { value: 99 });

      return child;
    };

    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 30 }, spawner);
    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('sets retryable=false on spawn errors (binary not found)', async () => {
    const spawner: ProcessSpawner = () => {
      const emitter = new EventEmitter();
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();

      const child = emitter as unknown as ChildProcess;
      child.stdout = stdoutEmitter as ChildProcess['stdout'];
      child.stderr = stderrEmitter as ChildProcess['stderr'];
      child.kill = vi.fn().mockReturnValue(true);
      Object.defineProperty(child, 'pid', { value: 0 });

      setTimeout(() => {
        emitter.emit('error', new Error('ENOENT: claude not found'));
      }, 5);

      return child;
    };

    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);
    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('sets retryable=true on crash exit codes', async () => {
    const { spawner } = createMockSpawner(137, '', '');
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('leaves retryable undefined on normal non-zero exit (let step decide)', async () => {
    const { spawner } = createMockSpawner(1, '', 'error');
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.retryable).toBeUndefined();
  });

  it('sends SIGTERM then SIGKILL when process does not respond to SIGTERM', async () => {
    let killRef: ReturnType<typeof vi.fn> | undefined;

    const spawner: ProcessSpawner = () => {
      const emitter = new EventEmitter();
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();

      const child = emitter as unknown as ChildProcess;
      child.stdout = stdoutEmitter as ChildProcess['stdout'];
      child.stderr = stderrEmitter as ChildProcess['stderr'];
      killRef = vi.fn().mockReturnValue(true);
      child.kill = killRef;
      Object.defineProperty(child, 'pid', { value: 99 });

      // Never emit close — simulates a completely hanging process
      return child;
    };

    const adapter = new ClaudeCliAdapter(
      undefined,
      { timeoutMs: 30, gracefulShutdownMs: 30 },
      spawner,
    );
    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.output).toContain('timed out');
    expect(killRef).toBeDefined();
    expect(killRef).toHaveBeenCalledWith('SIGTERM');
    expect(killRef).toHaveBeenCalledWith('SIGKILL');
  });

  it('sends only SIGTERM when process closes after graceful signal', async () => {
    let killRef: ReturnType<typeof vi.fn> | undefined;

    const spawner: ProcessSpawner = () => {
      const emitter = new EventEmitter();
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();

      const child = emitter as unknown as ChildProcess;
      child.stdout = stdoutEmitter as ChildProcess['stdout'];
      child.stderr = stderrEmitter as ChildProcess['stderr'];
      killRef = vi.fn().mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          // Process responds to SIGTERM by closing
          setTimeout(() => emitter.emit('close', null), 5);
        }
        return true;
      });
      child.kill = killRef;
      Object.defineProperty(child, 'pid', { value: 99 });

      return child;
    };

    const adapter = new ClaudeCliAdapter(
      undefined,
      { timeoutMs: 30, gracefulShutdownMs: 200 },
      spawner,
    );
    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.output).toContain('timed out');
    expect(killRef).toBeDefined();
    expect(killRef).toHaveBeenCalledWith('SIGTERM');
    expect(killRef).not.toHaveBeenCalledWith('SIGKILL');
  });

  it('returns BMADTimeoutError details in output on timeout', async () => {
    const spawner: ProcessSpawner = () => {
      const emitter = new EventEmitter();
      const stdoutEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();

      const child = emitter as unknown as ChildProcess;
      child.stdout = stdoutEmitter as ChildProcess['stdout'];
      child.stderr = stderrEmitter as ChildProcess['stderr'];
      child.kill = vi.fn().mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => emitter.emit('close', null), 5);
        }
        return true;
      });
      Object.defineProperty(child, 'pid', { value: 99 });

      return child;
    };

    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 50 }, spawner);
    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(false);
    expect(result.output).toContain('timed out after 50ms');
  });

  it('parses token count from JSON output with usage field', async () => {
    const jsonOutput = JSON.stringify({
      result: 'ok',
      usage: { input_tokens: 100, output_tokens: 250 },
    });
    const { spawner } = createMockSpawner(0, jsonOutput);
    const eventBus = new EventBus();
    let tokenCount = 0;

    eventBus.on('llm.call.completed', (payload) => {
      tokenCount = (payload as { tokenCount: number }).tokenCount;
    });

    const adapter = new ClaudeCliAdapter(eventBus, undefined, spawner);
    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBe(350);
    expect(tokenCount).toBe(350);
  });

  it('returns 0 tokens when output is not JSON', async () => {
    const { spawner } = createMockSpawner(0, 'plain text output');
    const adapter = new ClaudeCliAdapter(undefined, undefined, spawner);

    const result = await adapter.execute('/test', { projectPath: '/tmp' });

    expect(result.tokensUsed).toBeUndefined();
  });
});
