# Retrospective - Epic EA1: BMAD Command Orchestration

**Date:** 2026-03-07
**Scope:** Epic EA1 (Sprints 8-10) - BMAD Command Orchestration
**Facilitator:** Bob (Scrum Master)
**Participants:** Alice (PO), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), elzinko (Project Lead)

**Previous Retrospective:** `epic-12-retro-2026-02-22.md` (Global Phase 1 review, E1-E12)

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories | 8/8 (100%) |
| Sprints | 3 (Sprint 8, 9, 10) |
| Tests added | +327 (276 -> 603) |
| Regressions | 0 |
| HIGH bugs found in review | 5 (all fixed) |
| Technical debt items | 5 |
| Production incidents | 0 |

### Stories Delivered

| Story | Title | Sprint | Story File |
|-------|-------|--------|------------|
| EA1-S1 | BMADCommandPort + ClaudeCliAdapter | 8 | N/A (pre-BMAD workflow) |
| EA1-S2 | BMADDevStoryStep | 8 | N/A (pre-BMAD workflow) |
| EA1-S3 | BMADReviewStep | 8 | N/A (pre-BMAD workflow) |
| EA1-S4 | BMADQAStep | 9 | EA1-S4.md |
| EA1-S5 | SprintRunner BMAD wiring | 9 | EA1-S5.md |
| EA1-S6 | Story context preparation | 8 | N/A (pre-BMAD workflow) |
| EA1-S7 | Error handling & retry | 9 | EA1-S7.md |
| EA1-S8 | Integration test | 10 | EA1-S8.md |

---

## Previous Retrospective Follow-Through (E1-E12 Retro)

### Process Action Items

| # | Action | Status | Evidence |
|---|--------|--------|----------|
| 1 | Complete BMAD pipeline (EA1-S4, S5, S7) | COMPLETED | EA1 fully done, 8/8 stories |
| 2 | Integrate budget tracking (EA2-S1, S2) | COMPLETED | EA2-S1 and S2 marked done |
| 3 | Wire SprintRunner to BMAD steps (EA1-S5) | COMPLETED | PipelineStepFactory created, config-driven |
| 4 | Sidecar sync BMAD (EA5-S1, S2, S3) | COMPLETED | Epic EA5 fully done |

### Technical Debt Items

| # | Item | Status | Note |
|---|------|--------|------|
| 1 | ReviewerAgent weak prompt | RESOLVED | Replaced by BMADReviewStep |
| 2 | QAAgent stub | RESOLVED | Replaced by BMADQAStep |
| 3 | 4 stories backlog (E9-S5, E10-S9, E11-S10, E12-S6b) | PARTIAL | E9-S5 done, 3 remain backlog |
| 4 | sprint-status.yaml ownership (HIGH) | NOT ADDRESSED | YamlStatusStore still points to `.cop1/` |

### Lessons Applied

| Lesson from E1-E12 | Applied in EA1? |
|---------------------|-----------------|
| "Orchestration > Generation" | YES - EA1 is exactly this: BMAD generates, cop1 orchestrates |
| "Hexagonal architecture pays off at pivot" | YES - adapter swap without domain refactoring |
| "Observability must be early" | YES - EA1-S7 integrates events from start (retry, budget, timeout) |
| "Stay within BMAD's extension framework" | YES - EA5 uses sidecar + customize.yaml |
| "Let BMAD own its artifacts" | PARTIAL - sprint-status ownership still unresolved |

---

## What Went Well

### 1. 100% Delivery — 8/8 Stories Complete
All stories delivered across 3 sprints. BMAD pipeline complete: dev-story, review, QA. Fulfills the Phase A pivot commitment from E1-E12 retro.

### 2. BMADCommandStep Abstract Class Pattern
Established in S1-S3, reused flawlessly in S4. Subclasses only define `name`, `command`, `errorPrefix`. Maximum reusability with minimal boilerplate.

### 3. Test Discipline — +327 Tests, 0 Regressions
Test count grew from 276 to 603 across the epic. Every story maintained zero regressions. Progression: 276 (S4) -> 521 (S5) -> 548 (S7) -> 603 (S8).

### 4. ProcessSpawner Injectable — Architecture Hexagonale Proven Again
The existing `ProcessSpawner` injection point in `ClaudeCliAdapter` was used perfectly in S8 for integration tests. No source code modification needed — just inject a stub. Validates the hexagonal architecture investment.

### 5. PipelineStepFactory — Clean Config-Driven Switching
`workflow.useBMAD: true/false` cleanly switches between BMAD and legacy pipeline. Single responsibility, DI-injected, testable.

### 6. Previous Retro Commitments Honored
4/4 process action items from E1-E12 retro completed. Team accountability demonstrated.

---

## What Didn't Go Well

### 1. Systematic HIGH Bugs in Code Reviews
5 HIGH bugs found across 4 stories — every story had review fixes:
- **S4:** Missing barrel export of BMADQAStep
- **S5:** Event listener leak (duplicate `llm.call.completed` listeners), DI violation (hardcoded `new PipelineStepFactory()`)
- **S7:** Default timeout 600s instead of AC-specified 300s, `spawn error` incorrectly classified as transient
- **S8:** `isRetryableError()` returning `false` instead of `undefined`, preventing 429 retry

**Root cause:** Bugs occur at component boundaries (adapter <-> step contracts). Unit tests with mocks don't catch these because they test each side in isolation.

### 2. sprint-status.yaml Ownership Still Unresolved
Identified as HIGH priority in E1-E12 retro (2026-02-22). File was physically migrated to `_bmad-output/implementation-artifacts/` but `YamlStatusStore` code still points to `.cop1/sprint-status.yaml`. This is a **blocking bug** for real-world execution of `cop1 sprint run`.

### 3. No Real End-to-End Validation
603 tests exist but all use stubs/mocks. Nobody has ever run `cop1 sprint run` with the real BMAD pipeline on a real project. Integration tests use `fake-claude.mjs`, not the actual Claude CLI.

### 4. Missing Story Files for Sprint 8 Work
EA1-S1, S2, S3, S6 were implemented before the BMAD `create-story` workflow was used. No story files exist in implementation-artifacts for these stories — traceability gap.

### 5. Project Lead Cannot Test the Product
elzinko has no way to see cop1 work on a real project. Testing on the cop1 repo itself would be risky. No sandbox or isolated test environment exists.

### 6. iamthelaw Engine Coded but Empty
The rules engine (E9), DoDService, DoDLimiter, AutoRuleSuggestionService all exist in code. But:
- No `_bmad/_memory/iamthelaw-sidecar/` directory exists
- No `.cop1/rules/active-rules.yaml` file exists
- No rules have been defined — the engine has no fuel

---

## Key Patterns

### Pattern 1: Boundary Bugs Escape Unit Tests
5/5 HIGH bugs were at component boundaries. Unit tests mock one side, missing contract mismatches (`false` vs `undefined`, wrong defaults, missing exports). Integration tests with real components catch these.

### Pattern 2: Config Changes Cascade Through Test Fixtures
Adding `workflow.useBMAD` to `Cop1Config` required updating 15 test fixtures across 4 packages. TypeScript strict mode ensures correctness but creates maintenance burden.

### Pattern 3: Abstract Class + Subclass = Productivity
BMADCommandStep pattern made S4 trivial to implement. When the abstraction is right, new features become mechanical.

### Pattern 4: Code Review as Safety Net
100% of stories had fixes from code review. Reviews catch real bugs — the 429 retry bug (S8) would have been a production incident.

---

## Key Insights

1. **Integration tests at boundaries are more valuable than more unit tests** — the pattern from EA1 is clear: test the contract between real components, not mocked interfaces
2. **The product creator must be able to test their own product** — 603 automated tests don't replace human validation. A sandbox test harness is needed.
3. **Governance infrastructure without rules is inert** — iamthelaw + DoD engine exist but have zero active rules. A team DoD and initial ruleset are needed immediately.
4. **Hold yourself accountable to retro commitments** — 4/4 process items done is great, but the HIGH-priority sprint-status ownership was forgotten. Track retro action items explicitly.

---

## Readiness Assessment

| Dimension | Status | Detail |
|-----------|--------|--------|
| Testing & Quality | GOOD | 603 tests, 0 regressions, no real E2E test |
| Deployment | BLOCKED | YamlStatusStore points to wrong path |
| Stakeholder Acceptance | PARTIAL | elzinko cannot test the product |
| Technical Health | GOOD | Clean architecture, solid patterns, 5 manageable debt items |
| Unresolved Blockers | 1 BLOCKER | YamlStatusStore path incorrect |

**Verdict:** Epic EA1 is **feature-complete and well-tested** but not **validated in production**. Acceptable for infrastructure epic — real validation will come when EA2 consumes EA1's events.

---

## Next Epic Preview — EA2: Budget & Consumption Tracking

- 6 stories planned (S1-S2 done, S3-S6 backlog)
- Direct dependency on EA1: `llm.call.completed` events, `BudgetChecker` port
- Readiness: **quasi-ready** pending YamlStatusStore fix and epic-ea1 status update

---

## Action Items

### Immediate Actions (Before Starting EA2)

| # | Action | Owner | Success Criteria |
|---|--------|-------|------------------|
| 1 | Create team DoD — markdown file with EA1-derived rules, loaded by SM at each `create-story` | Bob (SM) | File exists, referenced in SM workflow |
| 2 | Fix YamlStatusStore — point to `_bmad-output/implementation-artifacts/sprint-status.yaml` | Charlie (Dev) | `cop1 sprint run` reads correct file, tests pass |
| 3 | Update epic-ea1 status — `in-progress` -> `done` in sprint-status.yaml | Bob (SM) | Sprint-status reflects reality |
| 4 | Create iamthelaw sidecar — populate `_bmad/_memory/iamthelaw-sidecar/rules.md` with initial DoD rules | Charlie (Dev) | File exists, BMAD agents can see it |

### Team DoD — Initial Rules (from EA1 lessons)

| # | Rule | Source |
|---|------|--------|
| R1 | Any component exposing a port must have an integration test with a real adapter (not just mocks) | EA1-S8 429 bug |
| R2 | Return values `false` vs `undefined` vs `null` must be documented in port contracts | EA1-S8 H1 |
| R3 | Barrel exports must be verified for every new public class | EA1-S4 review |
| R4 | Default values in code must exactly match story AC specifications | EA1-S7 timeout 600->300 |
| R5 | Every story must have a story file in implementation-artifacts (traceability) | EA1-S1/S2/S3/S6 missing |

### Technical Debt

| # | Item | Priority | Owner |
|---|------|----------|-------|
| D1 | BMADCommandStep truncates error output to 500 chars | MEDIUM | Charlie |
| D2 | StoryContextBuilder doesn't inject tech stack/conventions | MEDIUM | Charlie |
| D3 | SprintRunner has no dev->review feedback loop (story fails immediately) | LOW | Future epic |
| D4 | sprint-status.yaml — clarify read/write ownership (cop1 reads, BMAD writes?) | HIGH | Charlie + Winston (Architect) |
| D5 | Pre-existing TS6310 warnings (project references) | LOW | Backlog |

### New Epic to Plan

| # | Epic | Description | Suggested Priority |
|---|------|-------------|-------------------|
| N1 | **cop1 Acceptance Test Harness** | Containerized sandbox with a decoy project containing known epics/stories with planted defects and traps. Allows elzinko to test cop1 in isolation with measurable, comparable results between runs. Serves as acceptance test, living documentation, and regression benchmark. Enriched incrementally as the product evolves. | To discuss — potentially before or parallel to EA3 |

### iamthelaw Rule Candidates (for cop1 product)

| # | Rule | Trigger |
|---|------|---------|
| P1 | Integration test mandatory for adapter<->step interactions | EA1 lesson |
| P2 | Nullish contracts documented in ports | EA1-S8 |
| P3 | Barrel export verified | EA1-S4 |
| P4 | Code defaults = story AC | EA1-S7 |

---

## Architect Consultation Needed — D4 Sprint-Status Ownership

**Context:** YamlStatusStore points to `.cop1/sprint-status.yaml` but real file is in `_bmad-output/implementation-artifacts/sprint-status.yaml`. BMAD workflows read/write from the BMAD path. cop1 uses `.cop1/` for its own artifacts (logs, checkpoints, budget, quality).

**Questions for Winston (Architect):**
1. Read/write ownership — should BMAD be sole source of truth? Should cop1 be read-only?
2. Refactoring scope — simple path change or split into SprintStatusReader + SprintExecutionWriter?
3. Migration impact — YamlStatusStore used in SprintRunner, DaemonService, CLI, integration tests, StoriesApiHandler
4. ADR coverage — does ADR-007/008 cover this, or need a new ADR?

**Process:** Consult Winston first, then run `/bmad-bmm-correct-course` to formalize changes in epics/backlog.

---

## Next Steps

1. **Create team DoD** (immediate — Bob)
2. **Fix YamlStatusStore path** (blocker — Charlie)
3. **Update epic-ea1 status to done** (Bob)
4. **Consult Winston** on D4 sprint-status ownership architecture
5. **Run `/bmad-bmm-correct-course`** to add Test Harness epic + formalize D4 changes
6. **Create EA2 stories** with `/bmad-bmm-create-story` when ready

---

## Retrospective Process Note

This retrospective also identified that the previous retro file (`global-retro-E1-E12-2026-02-22.md`) was not following the `epic-*-retro-*` naming convention, preventing automatic discovery. It was renamed to `epic-12-retro-2026-02-22.md` with a preamble noting the original scope. Future retrospectives should follow the `epic-{id}-retro-{date}.md` convention.
