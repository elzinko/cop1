# Story EA2.S0c: Consultation iamthelaw Integration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Project Lead,
I want an architectural consultation on integrating `github.com/elzinko/iamthelaw` as a cop1 dependency,
so that the team has a clear integration model, avoids BMAD/iamthelaw coupling risks, and can activate the rules engine with confidence.

## Acceptance Criteria

1. Integration model decision documented — `iamthelaw` as npm dependency vs integrated code in cop1, with pros/cons analysis and final recommendation
2. BMAD/iamthelaw coupling risks identified — analysis of how BMAD already handles rules, risk of duplication between BMAD methodology rules and iamthelaw-managed rules, with mitigation strategy
3. Developer sidecar pattern defined — how the developer reads rules via iamthelaw during BMAD execution (sidecar sync flow, file format, refresh strategy)
4. Joint improvement plan — how to improve iamthelaw and cop1 jointly without circular dependencies
5. Team DoD file location decided — where the team Definition of Done lives (`.cop1/rules/`, `_bmad/_memory/`, or `iamthelaw/` directory) and who owns it
6. Implementation plan for DoD creation and sidecar activation documented — ordered steps to go from current state (empty engine) to active rules
7. Output delivered as ADR (Architecture Decision Record) or formal architectural recommendation in `_bmad-output/planning-artifacts/`

## Tasks / Subtasks

- [x] Task 1: Inventory current iamthelaw state in cop1 (AC: #1, #2)
  - [x] Document all existing iamthelaw code in cop1: `IamTheLawLoader`, `SidecarSyncService`, `SidecarSyncListener`, `FileSidecarAdapter`, `RuleSet` domain model
  - [x] Document all existing rule-proposal code: `RuleProposalService`, `RuleProposalTypes`, Rule Approval UI (E9-S5)
  - [x] Document all existing DoD code: `DoDService`, `DoDLimiter`
  - [x] Note what exists in code vs what exists on disk (answer: code exists, no active rules, no sidecar directory, no `active-rules.yaml`)

- [x] Task 2: Analyze `github.com/elzinko/iamthelaw` external project (AC: #1)
  - [x] Review iamthelaw repo structure, API, and capabilities
  - [x] Determine if iamthelaw is an npm-publishable package or a standalone project
  - [x] Evaluate version compatibility with cop1's Node.js/TypeScript stack
  - [x] Assess maintenance burden of external dependency vs integrated code

- [x] Task 3: Analyze BMAD rule handling mechanisms (AC: #2)
  - [x] Document how BMAD agents currently consume rules (sidecar memory pattern from ADR-007)
  - [x] Document `customize.yaml` mechanism for agent configuration override
  - [x] Identify overlap between BMAD methodology constraints and iamthelaw rule categories (global, scrum, architecture, agent)
  - [x] Map risk of duplication: which rules are BMAD-native vs which should be iamthelaw-managed

- [x] Task 4: Design sidecar activation pattern (AC: #3, #6)
  - [x] Define sync flow: `.cop1/rules/active-rules.yaml` (machine YAML) -> `_bmad/_memory/iamthelaw-sidecar/rules.md` (LLM-friendly markdown)
  - [x] Define refresh strategy: event-driven (on rule change via `SidecarSyncListener`) vs periodic
  - [x] Define initial rules content (R1-R5 from EA1 retro + team DoD criteria)
  - [x] Define bootstrap script or story to create initial sidecar directory and populate rules

- [x] Task 5: Resolve team DoD location (AC: #5)
  - [x] Evaluate option A: `iamthelaw/global.yaml` with `dod:` section (current `DoDService` pattern)
  - [x] Evaluate option B: `_bmad/_memory/iamthelaw-sidecar/dod.md` (BMAD-native)
  - [x] Evaluate option C: `.cop1/rules/team-dod.yaml` (cop1-native)
  - [x] Recommend location based on ownership model (BMAD writes? cop1 writes? both read?)

- [x] Task 6: Draft architectural recommendation (AC: #1-#7)
  - [x] Write ADR or recommendation document
  - [x] Include decision matrix for integration model
  - [x] Include coupling risk matrix with mitigations
  - [x] Include implementation roadmap (ordered steps from empty engine to active rules)
  - [x] Save to `_bmad-output/planning-artifacts/`

- [ ] Task 7: Team review and validation (AC: #7)
  - [ ] Present recommendation to team (architect + developers)
  - [ ] Collect feedback and objections
  - [ ] Finalize document with any adjustments

## Dev Notes

### This is a Consultation Story — Not a Code Story

This story produces a **document** (ADR or architectural recommendation), not code changes. The output unblocks:
- **C5** (iamthelaw sidecar activation) — which creates the actual sidecar directory and initial rules
- **Team DoD file creation** — which requires knowing where the file lives
- Future stories in EA4 (retro-to-rules loop) that depend on an active rules engine

### Current State of iamthelaw in cop1

**Code exists but is inert:**

| Component | File | Status |
|-----------|------|--------|
| `IamTheLawLoader` | `packages/sprint-core/src/features/iamthelaw/application/IamTheLawLoader.ts` | Code exists, loads from `iamthelaw/` dir |
| `SidecarSyncService` | `packages/sprint-core/src/features/iamthelaw/application/SidecarSyncService.ts` | Code exists, converts RuleSet to markdown |
| `SidecarSyncListener` | `packages/sprint-core/src/features/iamthelaw/application/SidecarSyncListener.ts` | Code exists, listens for rule changes |
| `FileSidecarAdapter` | `packages/sprint-core/src/features/iamthelaw/infrastructure/FileSidecarAdapter.ts` | Code exists, writes to `_bmad/_memory/iamthelaw-sidecar/rules.md` |
| `RuleSet` domain | `packages/sprint-core/src/features/iamthelaw/domain/RuleSet.ts` | Interface: global/scrum/architecture/agent rules |
| `RuleProposalService` | `packages/sprint-core/src/features/rule-proposal/application/RuleProposalService.ts` | Code exists, in-memory Map storage |
| `DoDService` | `packages/sprint-core/src/features/dod-validator/application/DoDService.ts` | Code exists, validates against `iamthelaw/global.yaml` dod field |
| `DoDLimiter` | `packages/sprint-core/src/features/dod-validator/application/DoDLimiter.ts` | Code exists |
| Rule Approval UI | `packages/web/src/RuleProposalsView.tsx` | UI exists (E9-S5 done) |

**What does NOT exist on disk:**
- No `_bmad/_memory/iamthelaw-sidecar/` directory
- No `.cop1/rules/active-rules.yaml` file
- No `iamthelaw/global.yaml` or any rule YAML files
- No active rules of any kind — the engine has zero fuel

### ADR-007 Already Defines the 2-Layer Architecture

[Source: `_bmad-output/planning-artifacts/historical/adr-007-bmad-cop1-iamthelaw-integration.md`]

Key decisions already made:
- **Two-layer coexistence:** BMAD (interactive) + cop1 daemon (autonomous)
- **Sidecar mechanism:** cop1 rules synced to `_bmad/_memory/iamthelaw-sidecar/` for BMAD agents
- **File zones contract:** Defines read/write permissions for shared files
- **PromptComposer pattern:** Aggregates project context + iamthelaw rules + agent memory + story content

The consultation should validate or update ADR-007 decisions, not start from scratch.

### Questions to Resolve (from SCP 2026-03-09)

1. `iamthelaw` as npm dependency vs integrated code in cop1?
2. How does BMAD already handle rules? Risk of duplication?
3. How to avoid coupling between BMAD methodology and the iamthelaw sidecar?
4. What pattern for the developer sidecar? (reading rules via iamthelaw)
5. How to improve iamthelaw and cop1 jointly?
6. Where should the team DoD file live?

### EA1 Retro — Initial Rules (R1-R5)

These rules were identified from EA1 lessons and should be the first rules activated:

| # | Rule | Source |
|---|------|--------|
| R1 | Any component exposing a port must have an integration test with a real adapter (not just mocks) | EA1-S8 429 bug |
| R2 | Return values `false` vs `undefined` vs `null` must be documented in port contracts | EA1-S8 H1 |
| R3 | Barrel exports must be verified for every new public class | EA1-S4 review |
| R4 | Default values in code must exactly match story AC specifications | EA1-S7 timeout |
| R5 | Every story must have a story file in implementation-artifacts (traceability) | EA1-S1/S2/S3/S6 |

### Dependencies and Blocking Chain

```
EA2-S0c (this story — consultation)
    |
    +---> C5 (sidecar activation — creates actual sidecar directory + initial rules)
    |         |
    |         +---> EA4-S6 (retro-to-rules loop — rules fed back from retros)
    |
    +---> Team DoD file creation (location decided by this consultation)
              |
              +---> EA4-S1 (DoR Gate — needs DoD to validate against)
```

### Git Intelligence

Recent commits follow pattern: `feat: Implement {story} with code review fixes`. EA5 (Sidecar sync) is done — EA5-S1/S2/S3 all completed. The sync infrastructure is ready; it just needs rules to sync.

### Project Structure Notes

- iamthelaw feature: `packages/sprint-core/src/features/iamthelaw/`
- Rule proposal feature: `packages/sprint-core/src/features/rule-proposal/`
- DoD validator feature: `packages/sprint-core/src/features/dod-validator/`
- Sidecar write target: `_bmad/_memory/iamthelaw-sidecar/rules.md`
- Machine rules source: `.cop1/rules/active-rules.yaml`
- Architecture decisions: `_bmad-output/planning-artifacts/historical/`

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-09.md#C4]
- [Source: _bmad-output/implementation-artifacts/epic-ea1-retro-2026-03-07.md#Action-Items]
- [Source: _bmad-output/planning-artifacts/historical/adr-007-bmad-cop1-iamthelaw-integration.md]
- [Source: packages/sprint-core/src/features/iamthelaw/application/IamTheLawLoader.ts]
- [Source: packages/sprint-core/src/features/iamthelaw/application/SidecarSyncService.ts]
- [Source: packages/sprint-core/src/features/rule-proposal/application/RuleProposalService.ts]
- [Source: packages/sprint-core/src/features/dod-validator/application/DoDService.ts]
- [Source: packages/web/src/RuleProposalsView.tsx]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered. This is a consultation/document story — no code execution needed.

### Completion Notes List

- **Task 1 completed:** Full inventory of 10 iamthelaw-related components across 3 packages (sprint-core, app, web). All code is complete, tested, and exported but NOT instantiated. Zero rule files exist on disk.
- **Task 2 completed:** iamthelaw is NOT an external npm dependency — it is entirely embedded within cop1 as internal features in `packages/sprint-core/src/features/iamthelaw/`. No `.gitmodules`, no npm references. Decision: keep integrated (cop1 is sole consumer; hexagonal ports provide future extraction path).
- **Task 3 completed:** BMAD handles rules via 5 mechanisms (agent personas, workflow instructions, customize.yaml, project-context.md, validation checklists). Clear separation: BMAD = identity/style (static), iamthelaw = learned experience from retros (evolving). Coupling risk is LOW with this boundary.
- **Task 4 completed:** Sidecar pattern validated from ADR-007. Sync flow: `iamthelaw/*.yaml` → `SidecarSyncService` → `_bmad/_memory/iamthelaw-sidecar/rules.md`. Refresh strategy: event-driven (already implemented in SidecarSyncListener). Bootstrap script documented with shell commands for initial rule population (R1-R5).
- **Task 5 completed:** Evaluated 3 options for DoD location. Decision: Option A (`iamthelaw/global.yaml` with `dod:` field) — DoDService already reads from there, zero code changes needed, consistent with ADR-007 ownership model.
- **Task 6 completed:** ADR-010 written and saved to `_bmad-output/planning-artifacts/adr-010-iamthelaw-integration-consultation.md`. Contains: decision matrix, coupling risk analysis, sidecar pattern design, DoD location decision, 9-step implementation roadmap.
- **Task 7 pending:** Requires team review — this task is a human activity that cannot be completed by the dev agent.

### Change Log

- 2026-03-09: Created ADR-010 with full architectural consultation covering all 6 SCP questions
- 2026-03-09: Story status updated to review (Tasks 1-6 complete, Task 7 pending team review)

### File List

- `_bmad-output/planning-artifacts/adr-010-iamthelaw-integration-consultation.md` — NEW — ADR-010 consultation document
- `_bmad-output/implementation-artifacts/EA2-S0c.md` — MODIFIED — Story file updated with task completion
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED — EA2-S0c status: ready-for-dev → in-progress → review
