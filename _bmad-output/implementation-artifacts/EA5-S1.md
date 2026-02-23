# Story EA5.1: Sidecar Sync Service

Status: ready-for-dev

## Story

As a cop1 Orchestrator,
I want a service that syncs iamthelaw rules to BMAD sidecar memory,
so that BMAD agents can see and enforce cop1's governance rules during execution.

## Acceptance Criteria

1. `SidecarSyncService` reads `.cop1/rules/active-rules.yaml` and converts to LLM-friendly markdown at `_bmad/_memory/iamthelaw-sidecar/rules.md`
2. Markdown output organized by rule theme (architecture, team, agent, quality) with clear headings and bullet points
3. Sync is idempotent — running twice with same input produces identical output

## Tasks / Subtasks

- [ ] Task 1: Create SidecarSyncService (AC: #1, #3)
  - [ ] Create `packages/sprint-core/src/features/iamthelaw/application/SidecarSyncService.ts`
  - [ ] Define port interface `SidecarSyncPort` in `domain/ports/`
  - [ ] Read rules from `IamTheLawLoader.loadAll()` (returns `RuleSet` with global, scrum, architecture, agents sections)
  - [ ] Convert `RuleSet` to markdown string with organized sections
  - [ ] Write markdown to `_bmad/_memory/iamthelaw-sidecar/rules.md`
  - [ ] Ensure idempotency: same RuleSet input = same markdown output (deterministic ordering)
- [ ] Task 2: Markdown formatting (AC: #2)
  - [ ] Format with clear headings: `# cop1 Governance Rules`, `## Architecture Rules`, `## Team Rules`, etc.
  - [ ] Each rule as bullet point: `- **{id}**: {description} (source: {source})`
  - [ ] Include timestamp of last sync at top
  - [ ] Keep LLM-friendly: concise, no YAML syntax, natural language
- [ ] Task 3: Directory management
  - [ ] Create `_bmad/_memory/iamthelaw-sidecar/` directory if not exists
  - [ ] Use atomic write pattern (write to .tmp, rename) for crash safety
- [ ] Task 4: Tests
  - [ ] Unit test: mock IamTheLawLoader, verify markdown output format
  - [ ] Test idempotency: call sync twice, compare outputs
  - [ ] Test with empty rules: generates valid markdown with "no rules" message
  - [ ] Test directory creation when missing

## Dev Notes

### Architecture Patterns

- **IamTheLawLoader** (`packages/sprint-core/src/features/iamthelaw/application/IamTheLawLoader.ts`): Reads YAML rule files, returns `RuleSet { global: Rule[], scrum: Rule[], architecture: Rule[], agents: Record<string, Rule[]> }`.
- **Rule interface**: `{ id: string, description: string, source: string }`.
- **BMAD sidecar pattern**: Validated by existing `_bmad/_memory/tech-writer-sidecar/documentation-standards.md`. The sidecar is a markdown file read by BMAD agents at activation time via `critical_actions` in customize.yaml.
- **Hexagonal port**: Create `SidecarSyncPort` interface for testability. Infrastructure adapter handles filesystem I/O.

### BMAD Memory Location

The target path `_bmad/_memory/iamthelaw-sidecar/rules.md` follows BMAD's sidecar convention. The `_bmad/_memory/` directory is tracked in git (project-specific state). The generated `rules.md` should also be tracked — it represents the current governance state visible to BMAD agents.

### Project Structure Notes

- Service: `packages/sprint-core/src/features/iamthelaw/application/SidecarSyncService.ts`
- Port: `packages/sprint-core/src/features/iamthelaw/domain/ports/SidecarSyncPort.ts`
- Adapter: `packages/sprint-core/src/features/iamthelaw/infrastructure/FileSidecarAdapter.ts`
- Test: `packages/sprint-core/src/features/iamthelaw/__tests__/SidecarSyncService.test.ts`
- TypeScript strict, `.js` extensions, kebab-case files

### References

- [Source: packages/sprint-core/src/features/iamthelaw/application/IamTheLawLoader.ts]
- [Source: packages/sprint-core/src/features/iamthelaw/domain/RuleSet.ts]
- [Source: _bmad/_memory/tech-writer-sidecar/documentation-standards.md — sidecar pattern reference]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA5 — EA5-S1]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
