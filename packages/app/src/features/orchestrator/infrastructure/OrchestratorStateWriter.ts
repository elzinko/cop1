import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';

/**
 * EA12-S4 / AC4 — cop1-owned operational state.
 *
 * cop1 writes its own run state (current story, phase, blockers) into
 * `.cop1/orchestrator-state.yaml` via this small internal API. This file
 * is cop1-owned; BMAD's own sprint-status file is read-only from cop1's
 * perspective (and only through the BMAD-command adapter in the target
 * architecture).
 */
export interface OrchestratorState {
  currentStory?: string;
  currentPhase?: string;
  blockers?: string[];
  updatedAt?: string;
}

const COP1_STATE_FILE = '.cop1/orchestrator-state.yaml';

export class OrchestratorStateWriter {
  private readonly filePath: string;

  constructor(projectPath: string) {
    this.filePath = join(projectPath, COP1_STATE_FILE);
  }

  read(): OrchestratorState {
    if (!existsSync(this.filePath)) return {};
    const content = readFileSync(this.filePath, 'utf-8');
    const data = parse(content) as OrchestratorState | null;
    return data ?? {};
  }

  update(patch: Partial<OrchestratorState>): OrchestratorState {
    const existing = this.read();
    const next: OrchestratorState = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, stringify(next), 'utf-8');
    return next;
  }
}
