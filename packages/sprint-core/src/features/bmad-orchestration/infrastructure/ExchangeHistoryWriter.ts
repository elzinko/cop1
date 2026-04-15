import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExchangeRecord } from '../domain/HistoryRecords.js';

const FRONTMATTER_ESCAPE_SENTINEL = '<!-- cop1:body-start -->';

/**
 * Writes Track 2 exchange markdown files per ADR-014 §8.5.
 *
 * Path: `.cop1/history/{sprintId}/{storyId}/{timestamp}-{command}.md`.
 * Front-matter (YAML) carries the session metadata; body is the chronological
 * Q/A + tool invocations + system events.
 *
 * Writes are atomic (tmp file + rename) so partial content never lands on disk.
 */
export class ExchangeHistoryWriter {
  constructor(private readonly projectRoot: string) {}

  async write(record: ExchangeRecord): Promise<string> {
    const { frontMatter, interactions } = record;
    const safeCommand = frontMatter.command.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestampSlug = frontMatter.startedAt.replace(/[:.]/g, '-');
    const dir = join(
      this.projectRoot,
      '.cop1',
      'history',
      frontMatter.sprintId,
      frontMatter.storyId,
    );
    const filename = `${timestampSlug}-${safeCommand}.md`;
    const finalPath = join(dir, filename);
    const tmpPath = `${finalPath}.tmp`;

    await mkdir(dir, { recursive: true });

    const body = this.renderBody(interactions);
    const content = this.renderFrontMatter(frontMatter) + body;
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, finalPath);
    return finalPath;
  }

  /**
   * Ensure body content that accidentally begins with `---` on a bare line does
   * not break front-matter parsing: prefix with a sentinel comment.
   */
  private renderFrontMatter(fm: import('../domain/HistoryRecords.js').ExchangeFrontMatter): string {
    const yaml = [
      '---',
      `session_id: ${JSON.stringify(fm.sessionId)}`,
      `story_id: ${JSON.stringify(fm.storyId)}`,
      `sprint_id: ${JSON.stringify(fm.sprintId)}`,
      `command: ${JSON.stringify(fm.command)}`,
      `started_at: ${JSON.stringify(fm.startedAt)}`,
      `ended_at: ${JSON.stringify(fm.endedAt)}`,
      `supervisor_turns: ${fm.supervisorTurns}`,
      `status: ${fm.status}`,
    ];
    // EA12-S6: optional commit SHA (from commit_anchor).
    if (fm.commit) yaml.push(`commit: ${JSON.stringify(fm.commit)}`);
    yaml.push('---', FRONTMATTER_ESCAPE_SENTINEL, '');
    return `${yaml.join('\n')}\n`;
  }

  private renderBody(
    interactions: import('../application/SessionLogger.js').SessionInteraction[],
  ): string {
    if (interactions.length === 0) {
      return '_No interactions recorded._\n';
    }
    const lines: string[] = [];
    for (const it of interactions) {
      lines.push(`### turn ${it.turn} — ${it.role} (${it.analysis.method})`);
      lines.push('');
      lines.push(`*${it.timestamp}*`);
      lines.push('');
      lines.push('```');
      lines.push(it.content);
      lines.push('```');
      lines.push('');
      // EA12-S6 — structured subsections when present.
      if (it.shellCommand) {
        const sc = it.shellCommand;
        lines.push('#### Shell');
        lines.push('');
        if (sc.ts) lines.push(`*${sc.ts}*`);
        if (sc.cwd) lines.push(`_cwd: \`${sc.cwd}\`_`);
        lines.push('');
        lines.push(`\`$ ${sc.command}\``);
        lines.push('');
        lines.push(`*return code:* \`${sc.returnCode}\``);
        if (sc.stderr) {
          const truncated = sc.stderr.length > 500 ? `${sc.stderr.slice(0, 497)}...` : sc.stderr;
          lines.push('');
          lines.push('```');
          lines.push(truncated);
          lines.push('```');
        }
        lines.push('');
      }
      if (it.blocker) {
        lines.push('#### Blocker');
        lines.push('');
        lines.push(`**reason:** ${it.blocker.reason}`);
        if (it.blocker.detail) lines.push(`**detail:** ${it.blocker.detail}`);
        lines.push('');
      }
      if (it.gateResult) {
        const gr = it.gateResult;
        lines.push('#### Gate');
        lines.push('');
        lines.push(`**${gr.name}:** ${gr.pass ? 'PASS' : 'FAIL'}`);
        if (gr.detail) lines.push(gr.detail);
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  /**
   * Sentinel marker used between front-matter and body to make body content
   * starting with `---` unambiguous for future parsers.
   */
  static readonly bodyStartMarker = FRONTMATTER_ESCAPE_SENTINEL;
}
