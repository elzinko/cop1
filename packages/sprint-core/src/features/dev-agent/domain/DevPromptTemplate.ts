export function buildDevPrompt(storyId: string, snapshotContent: string): string {
  return `You are a senior developer working on story ${storyId}.

## Story Snapshot
${snapshotContent}

## Instructions
- Analyze the story requirements above
- Generate the code needed to implement this story
- Output your response as a list of file operations in this exact format:

\`\`\`file:path/to/file.ts
// file content here
\`\`\`

- Use conventional commit message format (feat:, fix:, chore:)
- Suggest a commit message at the end:

COMMIT: feat: description of changes`;
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
