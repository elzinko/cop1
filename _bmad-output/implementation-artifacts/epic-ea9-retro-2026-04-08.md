# Retrospective - Epic EA9: Multi-Turn BMAD Interaction (ADR-012)

**Date:** 2026-04-08
**Scope:** Epic EA9 (Sprint 11) — Multi-Turn BMAD Interaction
**Facilitator:** Bob (Scrum Master)
**Participants:** Alice (PO), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), elzinko (Project Lead)

**Previous Retrospective:** `epic-ea1-retro-2026-03-07.md` (EA1: BMAD Command Orchestration)

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories | 6/6 (100%) |
| Sprints | 1 (Sprint 11) |
| Tests added | +135 (from ~575 → ~710) |
| Regressions | 0 |
| HIGH/CRITICAL bugs found in review | 7 (all fixed) |
| MEDIUM bugs found in review | 14 (all fixed) |
| LOW bugs deferred | 5 |
| Technical debt items | 6 |
| Production incidents | 0 |
| Legacy step classes deleted | 3 (BMADDevStoryStep, BMADReviewStep, BMADQAStep) |
| New hexagonal ports | 2 (BMADSessionPort, SupervisorLLMPort) |
| New adapters | 4 (AgentSdkSessionAdapter, AgentSdkSupervisorAdapter, ClaudeResumeSessionAdapter, InMemorySessionAdapter) |

### Stories Delivered

| Story | Title | Key Delivery | Story File |
|-------|-------|-------------|------------|
| EA9-S1 | BMADSessionPort + AgentSdkSessionAdapter | Multi-turn session port + Agent SDK adapter with `canUseTool` interception | EA9-S1.md |
| EA9-S2 | SupervisorLLMPort + AgentSdkSupervisorAdapter | Supervisor LLM port + prompt builder + error types | EA9-S2.md |
| EA9-S3 | SupervisorService + Session Logging & History | 3-level response orchestration + SessionLogger + SessionHistoryReader | EA9-S3.md |
| EA9-S4 | BMADSessionStep | Configurable WorkflowStep with retry/budget/follow-up semantics | EA9-S4.md |
| EA9-S5 | PipelineStepFactory migration | Composition root rewiring + legacy step deletion + E2E integration test | EA9-S5.md |
| EA9-S6 | ClaudeResumeSessionAdapter (fallback) | V0 CLI fallback via `claude --resume`, heuristic question detection, env-var opt-in | EA9-S6.md |

---

## Previous Retrospective Follow-Through (EA1 Retro)

### Immediate Actions

| # | Action | Status | Evidence |
|---|--------|--------|----------|
| 1 | Create team DoD — markdown with EA1-derived rules | ⏳ IN PROGRESS | iamthelaw rules R1-R5 proposed but no sidecar file yet |
| 2 | Fix YamlStatusStore path → `_bmad-output/implementation-artifacts/` | ✅ COMPLETED | EA2-S0b ADR-009 BmadStatusReader refactoring done |
| 3 | Update epic-ea1 status → done | ✅ COMPLETED | `epic-ea1: done` in sprint-status.yaml |
| 4 | Create iamthelaw sidecar with initial DoD rules | ⏳ IN PROGRESS | EA2-S0c consultation done; EA7 planned for Sprint 14-15 |

### Technical Debt Items

| # | Item | Status | Note |
|---|------|--------|------|
| D1 | BMADCommandStep truncates error output to 500 chars | CARRIED FORWARD | Not addressed; less relevant now that BMADSessionStep replaces the step classes |
| D2 | StoryContextBuilder doesn't inject tech stack/conventions | CARRIED FORWARD | EA9-S4 Dev Notes explicitly stubs `projectContext`/`architectureRules` to empty strings |
| D3 | SprintRunner has no dev→review feedback loop | CARRIED FORWARD | EA10 OrchestratorService may address this at the orchestration level |
| D4 | sprint-status.yaml ownership | ✅ RESOLVED | ADR-009 BmadStatusReader refactoring (EA2-S0b) |
| D5 | Pre-existing TS6310 warnings | CARRIED FORWARD | Still present; new `Cop1Config.budget` carry-overs documented in EA9-S4/S5 |

### Lessons Applied

| Lesson from EA1 | Applied in EA9? |
|-----------------|-----------------|
| "Integration tests at boundaries are more valuable than more unit tests" | YES — EA9-S5 bmad-pipeline-e2e.test.ts tests full pipeline with InMemory adapters |
| "Boundary bugs escape unit tests" | YES — EA9-S1 code review caught CRITICAL session resume bug (F1) |
| "Code review as safety net" | YES — 100% of stories had review fixes, 7 HIGH/CRITICAL caught |
| "Barrel exports must be verified" | YES — Every story updated barrel exports, no missed exports |
| "Every story must have a story file" | YES — All 6 stories have complete story files with Dev Agent Records |

---

## What Went Well

### 1. 100% Delivery — 6/6 Stories in a Single Sprint
All 6 stories delivered in Sprint 11. The epic went from backlog to fully complete within one sprint — a significant acceleration compared to EA1 which took 3 sprints for 8 stories. This validates the team's growing velocity with the BMAD workflow pipeline.

### 2. ADR-012 Architecture Executed Faithfully
The hexagonal architecture from ADR-012 was implemented precisely as designed:
- `BMADSessionPort` / `SupervisorLLMPort` ports in `domain/ports/`
- Agent SDK adapters in `infrastructure/`
- `SupervisorService` in `application/`
- Composition root in `sprint-run.ts`
- The V0 fallback (`ClaudeResumeSessionAdapter`) proved the port abstraction pays rent — two completely different implementations behind one interface.

### 3. Code Review Quality — 21 Issues Found Across 6 Stories
Every story had substantive review findings. Particularly notable:
- **EA9-S1 F1 (CRITICAL):** Session resume was broken — adapter passed a local UUID instead of the SDK's `session_id`. Would have been a showstopper at runtime.
- **EA9-S4 H1:** Adapter-thrown exceptions bypassed the retry loop entirely. Fixed to flow through retry classification.
- **EA9-S5 M3:** `AgentSdkSupervisorAdapter` constructor parameter made optional with lazy SDK import, removing 40 lines from the composition root.

Code review continues to be the most impactful quality gate, consistent with EA1's findings.

### 4. Clean Legacy Deletion — 3 Steps + 3 Test Files Removed
EA9-S5 honored the promise from EA9-S4 Dev Notes: "EA9-S5 will delete `BMADDevStoryStep`/`BMADReviewStep`/`BMADQAStep`, at which point the duplication evaporates." The deletion was clean — grep confirms zero remaining references in the codebase. The `BMADSessionStep` pattern (one configurable class, three instances) is strictly superior.

### 5. Story Dev Notes — Exceptional Detail
EA9 story files contain the most detailed Dev Notes in the project's history. Each story includes:
- Architecture context diagrams
- Dependency chains with file paths
- Testing strategy with specific mock patterns
- Open questions resolved during implementation
- Code review findings with severity and fix descriptions

This documentation will be invaluable for EA10 which directly depends on EA9's components.

### 6. Agent SDK Integration — First Real External Dependency
`@anthropic-ai/claude-agent-sdk@0.1.77` was successfully integrated with:
- Lazy dynamic imports to avoid top-level coupling
- Injectable `queryFn` / `SupervisorQueryFunction` for testability
- `settingSources: ['project']` for BMAD skill discovery
- Proper `allowedTools` vs `tools` distinction documented

---

## What Didn't Go Well

### 1. CRITICAL Bug in EA9-S1 — Session Resume Fundamentally Broken
The single most impactful bug: `continueSession()` passed a locally generated UUID as the `resume` option, but the SDK expects its own internal `session_id`. This means **multi-turn sessions would have silently started new conversations instead of resuming**. The fix required a `Map<adapterSessionId, sdkSessionId>` to track the mapping.

**Root cause:** The Agent SDK's `session_id` handling is not well-documented. The story recommended a spike ("30-minute spike before implementation") but either it wasn't done or it didn't test the resume flow specifically.

### 2. `SupervisorContext` Enrichment Stubbed Out
EA9-S4 stubs `projectContext`, `architectureRules`, and `iamtheLawRules` to empty strings in `SupervisorContext`. This means the LLM supervisor currently makes decisions with only `storyContent` — no architectural guidance, no project conventions, no iamthelaw rules. For simple continuation prompts (handled deterministically), this doesn't matter. For complex questions, the LLM is flying blind.

### 3. Pre-existing TypeScript Errors Accumulated
Multiple pre-existing TS errors carry forward across EA9:
- `Cop1Config.budget` shape drift in test fixtures
- `TS6310` project reference warnings
- `SessionHandle` import typing in `BMADSessionStep.ts:200`

EA9-S5 partially addressed this (adding `budget` fields to test configs), but the carry-forward pattern suggests these are becoming normalized rather than being fixed.

### 4. No Real Agent SDK Test
All 710 tests use mocks/stubs. No test actually calls the Agent SDK. The `AgentSdkSessionAdapter` and `AgentSdkSupervisorAdapter` are tested against mock `queryFn` implementations. EA9-S1's Dev Notes recommended a spike to validate SDK behavior assumptions — some of those assumptions were proven wrong during code review (F1, F2, F3).

### 5. Heuristic Question Detection (EA9-S6) Is Acknowledged Fragile
The `ClaudeResumeSessionAdapter`'s `detectQuestion()` and `detectCompletion()` are text-based heuristics documented as fragile. The `maxAutoReplies` safety cap is a band-aid. ADR-012 §3 Option A explicitly calls out this limitation. The V0 fallback exists for prudence, but anyone using it in production will hit false positives/negatives.

---

## Key Patterns

### Pattern 1: Session Resume Bugs — SDK Assumptions Were Wrong
EA9-S1's CRITICAL bug (F1) and HIGH bug (F2: default handler missing "C" answers, F3: `tools` option used preset instead of explicit list) all stem from incorrect assumptions about the Agent SDK's behavior. The SDK documentation was insufficient, and mocked tests validated the wrong contract. This echoes EA1's "boundary bugs escape unit tests" pattern — now applied to an external dependency.

### Pattern 2: Two-Step Wiring Pattern Is Error-Prone
EA9-S4 introduced a "two-step `setWorkflowContext`" pattern — call once before `startSession()` (without sessionId), call again after (with the real sessionId). Code review (M1) found the second call happened BEFORE the first-turn error check, producing spurious log-correlation. This bidirectional wiring is a complexity smell that may need simplification.

### Pattern 3: Lazy SDK Imports for Testability
Both `AgentSdkSessionAdapter` and `AgentSdkSupervisorAdapter` use lazy dynamic imports of `@anthropic-ai/claude-agent-sdk` to avoid forcing consumers to install the SDK. This pattern was applied to `sprint-run.ts` as well (with `@ts-expect-error`), then simplified in code review (EA9-S5 M3) by giving `AgentSdkSupervisorAdapter` a static `loadSdkQuery()` method. This is a proven pattern for optional heavy dependencies.

### Pattern 4: Duplication-Then-Delete Strategy Works
EA9-S4 deliberately duplicated retry/budget/event logic from `BMADCommandStep` into `BMADSessionStep`, with an explicit promise to delete the legacy classes in EA9-S5. This strategy worked cleanly — no shared base class extracted prematurely, no coupling introduced, and the deletion was surgical.

---

## Key Insights

1. **External SDK integration requires a real spike, not just documentation reading.** EA9-S1's CRITICAL bug proves that mocking an SDK you haven't actually tested is dangerous. Future stories integrating external SDKs should mandate a real integration spike with the actual library before writing production code.

2. **The SupervisorService 3-level pattern (deterministic → LLM → escalation) is architecturally sound.** The deterministic lookup table handles the majority of BMAD workflow questions (continuation prompts, YOLO, confirmations) without any LLM cost. The LLM fallback handles edge cases. The escalation path provides a safety valve. This pattern is reusable beyond BMAD.

3. **Deleting code is the best refactoring.** EA9-S5 deleted 3 classes + 3 test files, replacing them with one configurable class. The codebase is simpler, the public API surface is smaller, and the behavior is identical. The courage to delete comes from good test coverage and the hexagonal port abstraction.

4. **The V0 fallback (ClaudeResumeSessionAdapter) validates the hexagonal architecture.** Two completely different BMADSessionPort implementations — one using the Agent SDK in-process, one spawning CLI processes — both work through the same `BMADSessionStep`. This is the textbook hexagonal port payoff.

5. **Code review findings are getting MORE sophisticated over time.** EA1 found missing exports and wrong defaults. EA9 found broken session resume, incorrect SDK option semantics, and race conditions in wiring order. The team is catching subtler bugs.

---

## Readiness Assessment

| Dimension | Status | Detail |
|-----------|--------|--------|
| Testing & Quality | GOOD | 710 tests, 0 regressions, comprehensive unit + integration coverage. No real SDK test. |
| Deployment | N/A | Infrastructure epic — consumed by EA10 OrchestratorService |
| Stakeholder Acceptance | PARTIAL | elzinko still cannot test the product end-to-end (same EA1 concern) |
| Technical Health | GOOD | Clean hexagonal architecture, well-documented story files, 6 manageable debt items |
| Unresolved Blockers | 0 BLOCKERS | All prerequisite work for EA10 is complete |

**Verdict:** Epic EA9 is **feature-complete, well-tested, and well-documented**. The multi-turn BMAD interaction system is architecturally sound and ready to be consumed by EA10's OrchestratorService. The primary gap is the lack of real Agent SDK testing — this will be naturally validated when the first real BMAD workflow runs through the pipeline.

---

## Next Epic Preview — EA10: Supervisor Orchestrator (Sprint 13)

EA10 builds directly on EA9's infrastructure to deliver the V1 DoD "autonomous sprint":

- 6 stories planned (EA10-S1 through EA10-S6)
- **Direct dependencies on EA9:**
  - `BMADSessionPort` (EA9-S1) — OrchestratorService drives sessions
  - `SupervisorService` (EA9-S3) — intra-session question handling
  - `SupervisorLLMPort` (EA9-S2) — auto-decision policies
- **Also depends on EA6** (Acceptance Test Harness, Sprint 12) for EA10-S6 integration test
- **Risk #1:** EA10-S3 (Auto-decision policies) — LLM-judge for plan validation, elicitation selection. Mitigation: standalone harness with hand-labeled outputs before integration.
- **Risk #2:** Playbook format drift toward custom DSL. Hard rule: use BMAD `workflow.xml` if markdown is insufficient.
- **Gap:** EA6 must be delivered in Sprint 12 before EA10 starts in Sprint 13.

**Readiness:** EA9 prerequisites are fully met. The main risk is EA6 (Sprint 12) landing on time for EA10-S6.

---

## Action Items

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|------------------|
| 1 | Mandate real SDK integration spike for any story integrating a new external dependency | Bob (SM) | Added to team DoD as rule R6 |
| 2 | Fix pre-existing TypeScript carry-over errors (`Cop1Config.budget`, `TS6310`) — normalize the test fixture budget shape across all packages | Charlie (Dev) | `pnpm typecheck` clean across `@cop1/sprint-core` and `@cop1/app` |
| 3 | Enrich `SupervisorContext` with real content (project-context.md, architecture.md, iamthelaw rules) | Charlie (Dev) | `projectContext`, `architectureRules`, `iamtheLawRules` populated from actual files before LLM supervisor call |

### Technical Debt

| # | Item | Priority | Owner | Note |
|---|------|----------|-------|------|
| D1 | SupervisorContext enrichment stubbed to empty strings | HIGH | Charlie | Blocks effective LLM supervisor decisions |
| D2 | `TODO(post-EA9): factor out shared CLI runner` between `ClaudeCliAdapter` and `ClaudeResumeSessionAdapter` | LOW | Backlog | Deliberate duplication for V0 |
| D3 | `BMADCommandStep` truncates error output to 500 chars (carried from EA1) | LOW | Backlog | Less impactful now |
| D4 | StoryContextBuilder doesn't inject tech stack/conventions (carried from EA1) | MEDIUM | Charlie | Related to D1 |
| D5 | Pre-existing TS6310 warnings + `Cop1Config.budget` shape drift | MEDIUM | Charlie | Normalized in some tests but not all |
| D6 | No abort/cancellation support in `AgentSdkSessionAdapter` (EA9-S1 F9 deferred) | LOW | Backlog | SDK supports `abortController` but adapter doesn't expose it |

### Team Agreements

- Code review findings at HIGH severity or above MUST be fixed before merge — no exceptions.
- Stories integrating external SDKs MUST include a real integration spike as Task 0.
- Pre-existing TypeScript errors should be tracked and progressively resolved, not normalized.

---

## Epic EA10 Preparation Tasks

### Critical Preparation (Before EA10 starts)

| Task | Owner | Note |
|------|-------|------|
| EA6 (Acceptance Test Harness) delivered in Sprint 12 | Team | EA10-S6 depends on this |
| SupervisorContext enrichment (D1) | Charlie | EA10-S3 auto-decision policies need real context |
| ADR-013 draft outline (Orchestrator vs SprintRunner separation) | Winston (Architect) | EA10-S2 AC requires ADR-013 committed before PR merge |

### Parallel Preparation (Can happen during early EA10 stories)

| Task | Owner | Note |
|------|-------|------|
| Hand-label 10-20 BMAD outputs for EA10-S3 LLM-judge validation | Dana (QA) | Risk #1 mitigation |
| Draft initial `supervisor-playbook.md` | Alice (PO) | EA10-S1 parses this; having a real one helps |
| Fix TypeScript carry-over errors | Charlie | Progressive cleanup |

---

## Significant Discovery Alert

No fundamental architectural discoveries that invalidate the EA10 plan. The EA9 implementation confirmed that ADR-012's design is sound:
- The Agent SDK `query()` API works as expected (after the spike issues were resolved in code review)
- The hexagonal port pattern enables clean adapter swapping
- The 3-level supervisor pattern handles the common BMAD question types well

**Epic Update Required:** NO — EA10's plan remains valid. The main preparation need is EA6 delivery and SupervisorContext enrichment.

---

## Commitments Summary

- **Action Items:** 3
- **Technical Debt Items:** 6 (2 HIGH, 2 MEDIUM, 2 LOW)
- **Team Agreements:** 3
- **Critical Preparation Tasks:** 3
- **Parallel Preparation Tasks:** 3
- **Critical Path Items:** 1 (EA6 must land in Sprint 12)

---

## Next Steps

1. **Complete EA6** (Sprint 12) — blocking dependency for EA10-S6
2. **Enrich SupervisorContext** — HIGH priority debt item for EA10-S3 effectiveness
3. **Draft ADR-013 outline** — required by EA10-S2 AC
4. **Hand-label BMAD outputs** for EA10-S3 LLM-judge validation
5. **Begin EA10 planning** when Sprint 12 preparation is complete
6. **Mark `epic-ea9: done`** in sprint-status.yaml

---

## iamthelaw Rule Candidates (from EA9 lessons)

| # | Rule | Source |
|---|------|--------|
| R6 | External SDK integration stories MUST include a real integration spike as Task 0 | EA9-S1 CRITICAL F1 |
| R7 | Two-step wiring patterns must have ordering assertions in unit tests | EA9-S4 M1, M3 |
| R8 | Pre-existing TypeScript errors must not accumulate beyond 5 per package | EA9 carry-forward pattern |
