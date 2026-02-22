/**
 * Extracts a markdown section by heading (## level).
 * Returns the content between the target heading and the next ## heading (or EOF).
 * Returns empty string if heading is not found.
 */
export function extractMarkdownSection(content: string, heading: string): string {
  const lines = content.split('\n');
  const normalizedHeading = heading.toLowerCase().trim();
  let capturing = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.match(/^##\s+/) && !line.match(/^###/)) {
      if (capturing) break;
      const lineHeading = line
        .replace(/^##\s+/, '')
        .toLowerCase()
        .trim();
      if (lineHeading === normalizedHeading) {
        capturing = true;
      }
    } else if (capturing) {
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

const PROJECT_CONTEXT = `## Project Context

This is a TypeScript strict mode project using NodeNext module resolution.
- **Monorepo**: pnpm workspaces with 8 packages: shared-kernel, observability, llm-intelligence, quality-intelligence, sprint-core, ceremony-engine, app, web
- **Testing**: Vitest
- **Linting**: Biome
- **Architecture**: Feature-first hexagonal (domain/ → application/ → infrastructure/ layers)
- **Conventions**:
  - File names: kebab-case (e.g., \`DevPromptTemplate.ts\`)
  - Classes/Types: PascalCase (e.g., \`class DevAgent\`)
  - ESM imports MUST use \`.js\` extensions (e.g., \`from '../domain/StepResult.js'\`)
  - Conventional commits: feat:, fix:, chore:, refactor:, test:`;

export function buildDevPrompt(storyId: string, snapshotContent: string): string {
  const ac = extractMarkdownSection(snapshotContent, 'Acceptance Criteria');
  const tasks = extractMarkdownSection(snapshotContent, 'Tasks / Subtasks');
  const devNotes = extractMarkdownSection(snapshotContent, 'Dev Notes');

  const hasStructuredContent = ac || tasks || devNotes;

  const storySection = hasStructuredContent
    ? [
        ac ? `## Acceptance Criteria\n${ac}` : '',
        tasks ? `## Tasks / Subtasks\n${tasks}` : '',
        devNotes ? `## Dev Notes\n${devNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : `## Story Content\n${snapshotContent}`;

  return `You are a senior developer working on story ${storyId}.

${PROJECT_CONTEXT}

${storySection}

## Instructions
- Implement the story requirements above, targeting the correct package in the monorepo
- Follow the project conventions: kebab-case files, PascalCase classes, \`.js\` extensions in ESM imports
- Output your response as a list of file operations in this exact format:

\`\`\`file:path/to/file.ts
// file content here
\`\`\`

- Include unit tests (Vitest) for new code in a corresponding \`__tests__/\` directory
- Use conventional commit message format and suggest a commit message at the end:

COMMIT: feat(${storyId}): description of changes`;
}

export interface FileOperation {
  path: string;
  content: string;
}

export function parseLLMResponse(response: string): {
  files: FileOperation[];
  commitMessage: string;
} {
  const files: FileOperation[] = [];

  const fileRegex = /```file:(.+?)\n([\s\S]*?)```/g;
  let match = fileRegex.exec(response);
  while (match) {
    const path = match[1]?.trim();
    const content = match[2] ?? '';
    if (path) {
      files.push({ path, content });
    }
    match = fileRegex.exec(response);
  }

  const commitMatch = response.match(/COMMIT:\s*(.+)/);
  const commitMessage = commitMatch?.[1]?.trim() ?? `feat(${Date.now()}): auto-generated code`;

  return { files, commitMessage };
}
