# Story EA5.2: BMAD customize.yaml Setup

Status: ready-for-dev

## Story

As a Developer,
I want a `cop1 init-bmad-bridge` CLI command that configures BMAD agents to load iamthelaw sidecar rules,
so that BMAD agents automatically see cop1 governance rules when they activate.

## Acceptance Criteria

1. `cop1 init-bmad-bridge` CLI command generates `_bmad/_config/agents/{dev,qa,sm}.customize.yaml` with `critical_actions` loading sidecar
2. Generated customize.yaml uses APPEND semantics — base BMAD agent prompts preserved intact, only sidecar loading added
3. Command is idempotent — running twice does not duplicate `critical_actions` entries

## Tasks / Subtasks

- [ ] Task 1: CLI command registration (AC: #1)
  - [ ] Add `init-bmad-bridge` command to cop1 CLI (in `packages/app/`)
  - [ ] Follow existing CLI command patterns (e.g., `cop1 init`, `cop1 sprint`)
- [ ] Task 2: customize.yaml generation (AC: #1, #2)
  - [ ] Read existing customize.yaml files for target agents (bmm-dev, bmm-qa, bmm-sm)
  - [ ] Add `critical_actions` entry: load sidecar at `_bmad/_memory/iamthelaw-sidecar/rules.md`
  - [ ] Format: `critical_actions: ["At activation, read and internalize all rules from {project-root}/_bmad/_memory/iamthelaw-sidecar/rules.md. These are mandatory governance rules that override defaults."]`
  - [ ] Preserve all existing customize.yaml content (persona, memories, menu, etc.)
- [ ] Task 3: Idempotency (AC: #3)
  - [ ] Before adding critical_action, check if sidecar reference already exists
  - [ ] If already present, skip without error
  - [ ] Parse YAML, check `critical_actions` array for existing sidecar entry
- [ ] Task 4: Tests
  - [ ] Test: fresh customize.yaml -> sidecar action added
  - [ ] Test: existing sidecar action -> no duplicate
  - [ ] Test: customize.yaml with other content -> content preserved
  - [ ] Test: missing customize.yaml -> created with sidecar action

## Dev Notes

### Architecture Patterns

- **CLI commands**: Check how `cop1 init` and other commands are registered. Likely in `packages/app/src/` with a command pattern.
- **customize.yaml format**: See existing files at `_bmad/_config/agents/bmm-dev.customize.yaml`. Structure:
  ```yaml
  agent:
    metadata:
      name: ""
  persona:
    role: ""
  critical_actions: []   # <-- This is where sidecar loading goes
  memories: []
  menu: []
  ```
- **BMAD APPEND semantics**: `critical_actions` in customize.yaml are APPENDED to the base agent's actions. They don't replace anything. This is safe.
- **Target agents**: bmm-dev (Barry), bmm-qa, bmm-sm — the agents that will execute BMAD commands via cop1 orchestration.

### YAML Handling

Use a YAML parser that preserves comments and structure. The customize.yaml files have comments explaining each field. Consider using `yaml` npm package with `keepComment: true` option, or simple string manipulation if YAML library not available.

### Project Structure Notes

- CLI command: `packages/app/src/features/cli/` or wherever existing commands live
- Target files: `_bmad/_config/agents/bmm-dev.customize.yaml`, `bmm-qa.customize.yaml`, `bmm-sm.customize.yaml`
- TypeScript strict, `.js` extensions, kebab-case files

### References

- [Source: _bmad/_config/agents/bmm-dev.customize.yaml — target file]
- [Source: _bmad/_config/agents/bmm-qa.customize.yaml — target file]
- [Source: _bmad/_config/agents/bmm-sm.customize.yaml — target file]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA5 — EA5-S2]
- [Source: _bmad-output/planning-artifacts/phase-a-course-correction-brief.md#EA5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
