import { type ChildProcess, spawn } from 'node:child_process';
import type { EventBus } from '@cop1/shared-kernel';
import type { BMADCommandPort, BMADCommandResult } from '../domain/ports/BMADCommandPort.js';

export interface ClaudeCliAdapterOptions {
  timeoutMs?: number;
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
  private readonly spawner: ProcessSpawner;

  constructor(eventBus?: EventBus, options?: ClaudeCliAdapterOptions, spawner?: ProcessSpawner) {
    this.eventBus = eventBus;
    this.defaultTimeoutMs = options?.timeoutMs ?? 600_000;
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

      this.eventBus?.emit('llm.call.completed', {
        model: 'claude-cli',
        agentType: 'bmad',
        promptLength: prompt.length,
        responseLength: 0,
        durationMs,
        tokenCount: 0,
      });

      return { success: false, output: message, durationMs };
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

  private runProcess(prompt: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits'];

      const child = this.spawner('claude', args, {
        cwd: cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill('SIGTERM');
          reject(new Error(`Claude CLI timed out after ${this.defaultTimeoutMs}ms`));
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
          clearTimeout(timer);
          reject(new Error(`Claude CLI spawn error: ${error.message}`));
        }
      });

      child.on('close', (code: number | null) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(new Error(`Claude CLI exited with code ${code}: ${stderr || stdout}`));
          }
        }
      });
    });
  }
}
