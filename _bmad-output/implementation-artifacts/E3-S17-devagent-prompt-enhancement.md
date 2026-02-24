# Story E3.S17: DevAgent Prompt Enhancement

Status: ready-for-dev

## Story

As a Developer,
I want the DevAgent's prompt to include project context (tech stack, conventions) and structured story sections,
so that the LLM generates TypeScript code targeting the correct packages and following project conventions.

## Acceptance Criteria

1. `buildDevPrompt()` includes project context: tech stack (TypeScript strict NodeNext, pnpm monorepo, Vitest, Biome, hexagonal architecture), and conventions (kebab-case files, PascalCase classes, `.js` extensions in ESM imports)
2. `buildDevPrompt()` structures the story content into clear LLM-friendly sections: "Acceptance Criteria", "Tasks/Subtasks", "Dev Notes" — extracted from markdown rather than raw dump
3. On a story with ACs and dev notes, the LLM generates TypeScript code targeting the correct files/packages (not a generic React component) — verified manually on 1 test story

## Tasks / Subtasks

- [ ] Add `extractMarkdownSection(content, heading)` helper
  - [ ] File: `packages/sprint-core/src/features/dev-agent/domain/DevPromptTemplate.ts`
  - [ ] Parse `## Heading` blocks from the story markdown
  - [ ] Return the content between two `##` headings (or until EOF)

- [ ] Add project context section to `buildDevPrompt()`
  - [ ] File: `packages/sprint-core/src/features/dev-agent/domain/DevPromptTemplate.ts`
  - [ ] Add a `## Project Context` block with:
    - TypeScript strict mode with NodeNext module resolution
    - pnpm monorepo (8 packages: shared-kernel, observability, llm-intelligence, quality-intelligence, sprint-core, ceremony-engine, app, web)
    - Vitest for testing, Biome for linting
    - Feature-first hexagonal architecture (domain/application/infrastructure layers)
    - Conventions: kebab-case file names, PascalCase classes, `.js` extensions in ESM imports
    - Conventional commits (feat:, fix:, chore:)

- [ ] Structure story content into LLM-friendly sections
  - [ ] Extract "Acceptance Criteria" section from markdown
  - [ ] Extract "Tasks / Subtasks" section from markdown
  - [ ] Extract "Dev Notes" section from markdown
  - [ ] Present each in a clearly labelled block instead of raw dump

- [ ] Improve the `## Instructions` section
  - [ ] Be specific about output expectations: which package to target, file naming conventions, test expectations
  - [ ] Include expected file format (```file:path/to/file.ts blocks)
  - [ ] Include commit message format reminder

- [ ] Tests unitaires
  - [ ] Test `extractMarkdownSection()` with various markdown structures
  - [ ] Test `buildDevPrompt()` includes project context section
  - [ ] Test `buildDevPrompt()` structures story sections correctly
  - [ ] Test with story content that has ACs, tasks, dev notes — verify structured extraction
  - [ ] Test with minimal story content (no sections) — graceful fallback to raw content

## Dev Notes

- The current `buildDevPrompt()` (14 lines) takes `snapshotContent` and dumps it as-is under "## Story Snapshot". Enhancement strategy:
  1. Add a `## Project Context` section with tech stack, conventions, architecture patterns
  2. Parse the markdown story to extract specific sections (AC, Tasks, Dev Notes) and present them in structured blocks
  3. Improve the `## Instructions` section to be more specific about output expectations (which package to target, file naming conventions, test expectations)
- A helper function `extractMarkdownSection(content, heading)` can parse `## Heading` blocks from the story markdown
- The project context can be hardcoded for MVP (cop1-specific) or read from `cop1.config.yaml` later
- Consider including the existing file tree structure of the target package so the LLM knows what files already exist
- **Current prompt template** (for reference):
  ```typescript
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
  ```
