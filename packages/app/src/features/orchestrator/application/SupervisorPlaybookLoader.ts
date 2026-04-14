import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
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
 * Parses a `supervisor-playbook.md` per the EA10-S2 spec:
 *   - H2 sections → phases
 *   - Ordered lists under each H2 → commands
 *   - Preamble → version, help pointer, optional sections
 *
 * Validates that each extracted command exists in `.claude/commands/`.
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

    const version = this.extractSimple(preamble, /^BMAD version:\s*(.+)$/);
    const helpRef = this.extractSimple(preamble, /^help:\s*(\/.+)$/);
    const worktree = this.extractSection(preamble, /^Worktree hooks?:\s*(.*)$/i);
    const stepByStep = this.extractSection(preamble, /^Step[- ]by[- ]step hooks?:\s*(.*)$/i);
    const decisionPolicy = this.extractSection(preamble, /^Decision policy:\s*(.*)$/i);
    const epicRestrictions = this.extractSection(preamble, /^Epic\/story restrictions?:\s*(.*)$/i);

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
      i++;
      while (i < lines.length && !/^##\s/.test(lines[i] ?? '')) {
        const line = lines[i] ?? '';
        const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (olMatch) {
          const content = olMatch[1]?.trim() ?? '';
          const commandMatch = content.match(/`?(\/[a-z0-9-]+(?:[:.][a-z0-9-]+)*)`?/i);
          if (commandMatch) {
            commands.push({
              command: commandMatch[1],
              note: content.replace(commandMatch[0], '').trim() || undefined,
            });
          }
        }
        i++;
      }
      if (commands.length === 0) {
        throw new PlaybookValidationError(
          `Phase "${phaseName}" has no ordered-list commands`,
          undefined,
          firstH2,
        );
      }
      phases.push({ name: phaseName, commands });
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
    };
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
