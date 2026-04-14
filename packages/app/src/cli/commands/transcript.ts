import { writeFile } from 'node:fs/promises';
import { ExchangeHistoryReader, SessionTranscriptGenerator } from '@cop1/sprint-core';

export interface TranscriptOptions {
  out?: string;
}

export async function transcriptCommand(
  sessionId: string,
  options: TranscriptOptions = {},
): Promise<void> {
  if (!sessionId) {
    console.error('Usage: cop1 transcript <session-id> [--out <path>]');
    process.exitCode = 1;
    return;
  }

  const projectPath = process.cwd();
  const reader = new ExchangeHistoryReader(projectPath);
  const generator = new SessionTranscriptGenerator(reader);

  let markdown: string;
  try {
    markdown = await generator.generate(sessionId);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('No transcript data')) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
    console.error('Failed to generate transcript:', err);
    process.exitCode = 2;
    return;
  }

  if (options.out) {
    await writeFile(options.out, markdown, 'utf-8');
    console.log(`Transcript written to ${options.out}`);
    return;
  }
  console.log(markdown);
}
