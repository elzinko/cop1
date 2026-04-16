import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type PlaybookBudgets,
  type PlaybookCommand,
  type PlaybookPhase,
  PlaybookValidationError,
  type SupervisorPlaybook,
} from '../domain/SupervisorPlaybook.js';

export interface SupervisorPlaybookLoaderOptions {
  /**
   * Absolute path to the directory containing BMAD slash-command markdown files.
   * Defaults to `{projectRoot}/.claude/commands`.
   */
  commandsDir?: string;
  /**
   * Project root used to resolve the default commandsDir. Required when
   * commandsDir is not provided.
   */
  projectRoot?: string;
}

/**
 * Parses a `supervisor-playbook.md`:
 *   - H2 sections → phases (scrum directives — name + optional intent prose)
 *   - Ordered lists under each H2 → optional command enumeration (deprecated
 *     per EA12-S3 A5 pivot; kept for backwards compat)
 *   - Preamble → version, help pointer, optional sections + optional budgets
 *
 * Rejects preamble `commands:` or `allowed_commands:` top-level keys (A5 pivot).
 * When a phase has no commands, the consumer (`OrchestratorService`) falls
 * back to `defaultCommandsForPhase(phase.name)` from sprint-core.
 */
export class SupervisorPlaybookLoader {
  constructor(private readonly options: SupervisorPlaybookLoaderOptions = {}) {}

  async load(path: string): Promise<SupervisorPlaybook> {
    const raw = await readFile(path, 'utf-8');
    const parsed = this.parse(raw);
    await this.validateCommands(parsed);
    return parsed;
  }

  private parse(raw: string): SupervisorPlaybook {
    const lines = raw.split(/\r?\n/);
    let i = 0;

    // Walk until first H2; everything before is the preamble.
    let firstH2 = lines.findIndex((l) => /^##\s/.test(l));
    if (firstH2 === -1) firstH2 = lines.length;
    const preamble = lines.slice(0, firstH2);

    // AC1 (EA12-S3 / A5 pivot) — reject top-level `commands:` / `allowed_commands:`
    // preamble keys. These are not part of the playbook schema.
    this.rejectForbiddenPreambleKeys(preamble);

    const version = this.extractSimple(preamble, /^BMAD version:\s*(.+)$/);
    const helpRef = this.extractSimple(preamble, /^help:\s*(\/.+)$/);
    const worktree = this.extractSection(preamble, /^Worktree hooks?:\s*(.*)$/i);
    const stepByStep = this.extractSection(preamble, /^Step[- ]by[- ]step hooks?:\s*(.*)$/i);
    const decisionPolicy = this.extractSection(preamble, /^Decision policy:\s*(.*)$/i);
    const epicRestrictions = this.extractSection(preamble, /^Epic\/story restrictions?:\s*(.*)$/i);
    const budgets = this.extractBudgets(preamble);

    // Phases.
    const phases: PlaybookPhase[] = [];
    i = firstH2;
    while (i < lines.length) {
      const h2Match = lines[i]?.match(/^##\s+(.+)$/);
      if (!h2Match) {
        i++;
        continue;
      }
      const phaseName = h2Match[1]?.trim() ?? '';
      const commands: PlaybookCommand[] = [];
      const proseLines: string[] = [];
      i++;
      while (i < lines.length && !/^##\s/.test(lines[i] ?? '')) {
        const line = lines[i] ?? '';
        const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (olMatch) {
          const content = olMatch[1]?.trim() ?? '';
          const commandMatch = content.match(/`?(\/[a-z0-9-]+(?:[:.][a-z0-9-]+)*)`?/i);
          const command = commandMatch?.[1];
          if (commandMatch && command) {
            commands.push({
              command,
              note: content.replace(commandMatch[0] ?? '', '').trim() || undefined,
            });
          }
        } else if (line.trim().length > 0) {
          proseLines.push(line);
        }
        i++;
      }
      const phase: PlaybookPhase = { name: phaseName };
      if (commands.length > 0) phase.commands = commands;
      const prose = proseLines.join('\n').trim();
      if (prose.length > 0) phase.intent = prose;
      phases.push(phase);
    }

    if (phases.length === 0) {
      throw new PlaybookValidationError('Playbook has no H2 phases');
    }

    return {
      version: version ?? 'unknown',
      helpRef: helpRef ?? '/bmad-help',
      phases,
      epicRestrictions: epicRestrictions ? { raw: epicRestrictions } : undefined,
      hooks: { worktree, stepByStep },
      decisionPolicy: decisionPolicy,
      budgets,
    };
  }

  private rejectForbiddenPreambleKeys(preamble: string[]): void {
    for (const line of preamble) {
      const m = line.match(/^(commands|allowed_commands)\s*:/i);
      if (m) {
        throw new PlaybookValidationError(
          `Playbook preamble key "${m[1]}" is not allowed — command enumeration was removed in EA12-S3 (A5 pivot). Phase-level ordered lists remain supported for backwards compat.`,
        );
      }
    }
  }

  private extractBudgets(preamble: string[]): PlaybookBudgets | undefined {
    const tokens = this.extractNumber(preamble, /^max_tokens_per_night:\s*([0-9_]+)$/);
    const depth = this.extractNumber(preamble, /^max_reentrance_depth:\s*([0-9_]+)$/);
    if (tokens === undefined && depth === undefined) return undefined;
    const budgets: PlaybookBudgets = {};
    if (tokens !== undefined) budgets.max_tokens_per_night = tokens;
    if (depth !== undefined) budgets.max_reentrance_depth = depth;
    return budgets;
  }

  private extractNumber(preamble: string[], pattern: RegExp): number | undefined {
    for (const line of preamble) {
      const m = line.match(pattern);
      if (m) {
        const raw = m[1]?.replace(/_/g, '');
        if (!raw) continue;
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
      }
    }
    return undefined;
  }

  private extractSimple(preamble: string[], pattern: RegExp): string | undefined {
    for (const line of preamble) {
      const m = line.match(pattern);
      if (m) return m[1]?.trim();
    }
    return undefined;
  }

  private extractSection(preamble: string[], pattern: RegExp): string | undefined {
    for (const line of preamble) {
      const m = line.match(pattern);
      if (m) return m[1]?.trim() || line.trim();
    }
    return undefined;
  }

  private async validateCommands(playbook: SupervisorPlaybook): Promise<void> {
    const known = await this.discoverCommands();
    for (const phase of playbook.phases) {
      if (!phase.commands) continue;
      for (const cmd of phase.commands) {
        if (!known.has(cmd.command)) {
          throw new PlaybookValidationError(
            `Unknown BMAD command: ${cmd.command} (phase "${phase.name}")`,
            cmd.command,
          );
        }
      }
    }
  }

  private async discoverCommands(): Promise<Set<string>> {
    const dir =
      this.options.commandsDir ??
      (this.options.projectRoot
        ? join(this.options.projectRoot, '.claude', 'commands')
        : join(process.cwd(), '.claude', 'commands'));
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return new Set();
    }
    return new Set(
      entries.filter((f) => f.endsWith('.md')).map((f) => `/${f.replace(/\.md$/, '')}`),
    );
  }
}
