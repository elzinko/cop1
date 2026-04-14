import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import type { ApprovalResolver } from '@cop1/sprint-core';

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface InterCommandApprovalOptions {
  approvalFile?: string; // COP1_APPROVAL_FILE
  isTTY?: boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  readFileFn?: typeof readFile;
}

/**
 * Factory for an `ApprovalResolver` (from `StepByStepController`) that reads
 * operator decisions from stdin when a TTY is attached, or from a file path
 * pointed to by `COP1_APPROVAL_FILE` otherwise (CI-friendly).
 *
 * The file-based flow polls the file every `POLL_INTERVAL_MS` and looks for
 * one of the tokens `y` / `n` / `abort` on a single line.
 */
export function createInterCommandApprovalResolver(
  options: InterCommandApprovalOptions = {},
): ApprovalResolver {
  const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const approvalFile = options.approvalFile ?? process.env.COP1_APPROVAL_FILE;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const read = options.readFileFn ?? readFile;

  return async ({ phase, label }) => {
    if (approvalFile) {
      return awaitFileToken({ path: approvalFile, now, sleep, read });
    }
    if (isTTY) {
      return awaitTtyAnswer(phase, label);
    }
    // No TTY, no approval file: default to continue (safe for non-interactive tests)
    return 'continue';
  };
}

async function awaitTtyAnswer(
  phase: 'intra' | 'inter',
  label?: string,
): Promise<'continue' | 'skip' | 'abort'> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const prompt = `[step-by-step / ${phase}${label ? ` / ${label}` : ''}] Continue? (y/n/abort): `;
    const answer = (await rl.question(prompt)).trim().toLowerCase();
    if (answer === 'n' || answer === 'skip') return 'skip';
    if (answer === 'abort' || answer === 'a') return 'abort';
    return 'continue';
  } finally {
    rl.close();
  }
}

async function awaitFileToken(params: {
  path: string;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  read: typeof readFile;
}): Promise<'continue' | 'skip' | 'abort'> {
  const deadline = params.now() + POLL_TIMEOUT_MS;
  while (params.now() < deadline) {
    try {
      const raw = (await params.read(params.path, 'utf-8')).trim().toLowerCase();
      if (raw === 'y' || raw === 'continue') return 'continue';
      if (raw === 'n' || raw === 'skip') return 'skip';
      if (raw === 'abort') return 'abort';
    } catch {
      // file not ready yet
    }
    await params.sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `COP1_APPROVAL_FILE ${params.path} not populated within ${Math.round(POLL_TIMEOUT_MS / 1000)}s`,
  );
}

/**
 * Persist a pending-state snapshot so operators can inspect where a
 * step-by-step run paused.
 */
export async function writePendingSnapshot(
  projectRoot: string,
  snapshot: {
    runId: string;
    currentStoryId: string;
    nextCommand: string;
    modeDuringPause: string;
  },
): Promise<void> {
  const path = `${projectRoot}/.cop1/orchestrator-pending.yaml`;
  const body = [
    `run_id: ${JSON.stringify(snapshot.runId)}`,
    `current_story_id: ${JSON.stringify(snapshot.currentStoryId)}`,
    `next_command: ${JSON.stringify(snapshot.nextCommand)}`,
    `mode_during_pause: ${JSON.stringify(snapshot.modeDuringPause)}`,
    `ts: ${JSON.stringify(new Date().toISOString())}`,
    '',
  ].join('\n');
  await writeFile(path, body, 'utf-8');
}
