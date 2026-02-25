import { type ChildProcess, spawn } from 'node:child_process';
import type { EventBus } from '@cop1/shared-kernel';
import { BMADTimeoutError } from '../domain/errors/BMADTimeoutError.js';
import type { BMADCommandPort, BMADCommandResult } from '../domain/ports/BMADCommandPort.js';

export interface ClaudeCliAdapterOptions {
  timeoutMs?: number;
  /** Grace period after SIGTERM before sending SIGKILL (default 10_000ms) */
  gracefulShutdownMs?: number;
}

export type ProcessSpawner = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: ['pipe', 'pipe', 'pipe'] },
) => ChildProcess;

const defaultSpawner: ProcessSpawner = (cmd, args, opts) => spawn(cmd, args, opts);

export class ClaudeCliAdapter implements BMADCommandPort {
  private readonly eventBus?: EventBus;
  private readonly defaultTimeoutMs: number;
  private readonly gracefulShutdownMs: number;
  private readonly spawner: ProcessSpawner;

  constructor(eventBus?: EventBus, options?: ClaudeCliAdapterOptions, spawner?: ProcessSpawner) {
    this.eventBus = eventBus;
    this.defaultTimeoutMs = options?.timeoutMs ?? 300_000;
    this.gracefulShutdownMs = options?.gracefulShutdownMs ?? 10_000;
    this.spawner = spawner ?? defaultSpawner;
  }

  async execute(command: string, context: Record<string, string>): Promise<BMADCommandResult> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(command, context);

    this.eventBus?.emit('llm.call.started', {
      model: 'claude-cli',
      agentType: 'bmad',
      promptLength: prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const output = await this.runProcess(prompt, context.projectPath);
      const durationMs = Date.now() - startTime;
      const tokensUsed = this.parseTokenCount(output);

      this.eventBus?.emit('llm.call.completed', {
        model: 'claude-cli',
        agentType: 'bmad',
        promptLength: prompt.length,
        responseLength: output.length,
        durationMs,
        tokenCount: tokensUsed ?? 0,
      });

      return {
        success: true,
        output,
        durationMs,
        ...(tokensUsed !== undefined && { tokensUsed }),
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      const reason = error instanceof BMADTimeoutError ? 'timeout' : 'error';
      const retryable = this.isRetryableError(error);

      this.eventBus?.emit('llm.call.failed', {
        model: 'claude-cli',
        agentType: 'bmad',
        promptLength: prompt.length,
        durationMs,
        reason,
        error: message,
      });

      return { success: false, output: message, durationMs, retryable };
    }
  }

  buildPrompt(command: string, context: Record<string, string>): string {
    const contextBlock = Object.entries(context)
      .filter(([key]) => key !== 'projectPath')
      .map(([key, value]) => `${key}:\n${value}`)
      .join('\n\n');

    if (contextBlock) {
      return `${command}\n\n${contextBlock}`;
    }
    return command;
  }

  private parseTokenCount(output: string): number | undefined {
    try {
      const parsed = JSON.parse(output);
      if (typeof parsed === 'object' && parsed !== null && 'usage' in parsed) {
        const usage = parsed.usage as { input_tokens?: number; output_tokens?: number };
        return (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
      }
    } catch {
      // Output is not JSON or doesn't contain usage
    }
    return undefined;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof BMADTimeoutError) return true;
    if (error instanceof Error) {
      // Spawn errors (e.g., ENOENT — binary not found) are permanent
      if (error.message.includes('spawn error')) return false;
      // Crash exit codes (SIGINT, SIGKILL, SIGSEGV, SIGABRT, SIGTERM) are transient
      if (/exited with code (?:130|137|139|134|143)\b/.test(error.message)) return true;
    }
    return false;
  }

  private runProcess(prompt: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let forceTimer: ReturnType<typeof setTimeout> | undefined;

      const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits'];

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

          // Schedule SIGKILL if process doesn't respond to SIGTERM
          killTimer = setTimeout(() => {
            if (!settled) {
              child.kill('SIGKILL');
              // Force-settle if process ignores SIGKILL too
              forceTimer = setTimeout(() => {
                if (!settled) {
                  settled = true;
                  cleanup();
                  reject(new BMADTimeoutError(this.defaultTimeoutMs));
                }
              }, 2_000);
            }
          }, this.gracefulShutdownMs);
        }
      }, this.defaultTimeoutMs);

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
            reject(new BMADTimeoutError(this.defaultTimeoutMs));
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
