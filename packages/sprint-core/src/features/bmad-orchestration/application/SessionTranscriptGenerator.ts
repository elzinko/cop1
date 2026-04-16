import type {
  ExchangeFile,
  ExchangeHistoryReader,
} from '../infrastructure/ExchangeHistoryReader.js';

const MAX_TOOL_IO_BYTES = 2048;

/**
 * Composes a session-level human-readable markdown transcript from Track 2
 * exchange files (EA11-S8). Consumed by `cop1 transcript <session-id>` CLI.
 *
 * Output is deterministic: sorted by `started_at` then by file path. No
 * wall-clock timestamps are injected beyond what the source front-matter
 * already contains.
 *
 * Story: EA11-S7. Placed here (`sprint-core`) rather than the original
 * `@cop1/observability` location to avoid introducing a `sprint-core →
 * observability → sprint-core` package-level circular dependency — the story
 * file location was aspirational; co-location with the reader keeps imports
 * clean. Documented in the validation report.
 */
export class SessionTranscriptGenerator {
  constructor(private readonly reader: ExchangeHistoryReader) {}

  async generate(sessionId: string): Promise<string> {
    const files = await this.reader.bySession(sessionId);
    if (files.length === 0) {
      throw new Error(`No transcript data for session ${sessionId}`);
    }
    return this.compose(sessionId, files);
  }

  private compose(sessionId: string, files: ExchangeFile[]): string {
    const sorted = [...files].sort(
      (a, b) =>
        a.frontMatter.startedAt.localeCompare(b.frontMatter.startedAt) ||
        a.path.localeCompare(b.path),
    );

    const firstFile = sorted[0];
    const lastFile = sorted[sorted.length - 1];
    if (!firstFile || !lastFile) {
      throw new Error(`Unreachable: session ${sessionId} has empty sorted list after guard`);
    }
    const first = firstFile.frontMatter;
    const last = lastFile.frontMatter;

    const header = [
      `# Session transcript — ${sessionId}`,
      '',
      `- **Story:** ${first.storyId}`,
      `- **Sprint:** ${first.sprintId}`,
      `- **Started:** ${first.startedAt}`,
      `- **Ended:** ${last.endedAt}`,
      `- **Commands:** ${sorted.map((f) => f.frontMatter.command).join(', ')}`,
      `- **Outcome:** ${last.status}`,
      '',
    ].join('\n');

    const sections = sorted.map((f) => this.renderSection(f));
    const footer = ['', '## Source files', '', ...sorted.map((f) => `- \`${f.path}\``), ''].join(
      '\n',
    );

    return `${header}\n${sections.join('\n\n')}${footer}`;
  }

  private renderSection(f: ExchangeFile): string {
    const { frontMatter, body } = f;
    const truncatedBody = this.truncate(body, f.path);
    return [
      `## ${frontMatter.command} (${frontMatter.startedAt})`,
      '',
      `*Turns: ${frontMatter.supervisorTurns} • Status: ${frontMatter.status}*`,
      '',
      truncatedBody.trimEnd(),
    ].join('\n');
  }

  private truncate(raw: string, sourcePath: string): string {
    if (Buffer.byteLength(raw, 'utf-8') <= MAX_TOOL_IO_BYTES) return raw;
    const truncated = raw.slice(0, MAX_TOOL_IO_BYTES);
    return `${truncated}\n\n… [truncated, full content in \`${sourcePath}\`]`;
  }
}
