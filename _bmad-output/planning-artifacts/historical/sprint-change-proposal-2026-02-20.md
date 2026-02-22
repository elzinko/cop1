# Sprint Change Proposal — Sprint 7 Critical Gaps (Remaining)

**Date:** 2026-02-20
**Author:** elzinko (via Correct Course workflow)
**Status:** Approved
**Scope:** Minor — Direct implementation by dev team
**Feature Brief:** `features/sprint-8-gaps.md`

---

## 1. Issue Summary

**Problem:** The cop1 end-to-end pipeline works (`cop1 sprint run --simulate` calls Ollama, DevAgent generates code, ReviewerAgent reviews, QAAgent checks, metrics display in real-time), but the quality of generated code is poor due to weak LLM prompting, and the PM agent step is a no-op stub.

**Triage of original brief (4 gaps):**

| Gap | Original Status | Current Status | Action |
|-----|----------------|----------------|--------|
| Gap 1: DevAgent Prompt | No story content | Content loaded but prompt template too basic | **Stories needed** |
| Gap 2: QA Agent | Stub | Real QAAgent implemented (pnpm test + biome) | Already fixed |
| Gap 3: LoggerBridge | Not wired | LoggerBridge + StructuredLogger wired in SprintRunner | Already fixed |
| Gap 4: PM Agent | Stub | PMAgentStep still a stub, PMAgent class exists but unwired | **Story needed** |

**Remaining gaps requiring stories: Gap 1 (prompt quality) and Gap 4 (PM wiring)**

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Details |
|------|--------|---------|
| **E3 — Sprint Engine Core** | Modified | Add 2 new stories (E3-S17, E3-S18) |
| All others | None | No changes needed |

### Artifact Conflicts

- **PRD:** No conflict. FR6 (sequential workflow), FR11 (PM agent questions) supported.
- **Architecture:** No conflict. Changes are internal to DevAgent prompt template and PMAgent wiring.
- **UI/UX:** N/A

### Technical Impact

- `DevPromptTemplate.buildDevPrompt()` — enhanced with project context and structured extraction
- `PMAgentStep` replaced by real `PMAgentWorkflowStep` in SprintRunner composition
- All backward compatible — no interface changes

---

## 3. Recommended Approach

**Path:** Direct Adjustment — add 2 stories in E3

**Rationale:**
- Gap 1 is the highest-impact change: a well-structured prompt with tech stack context transforms code quality
- Gap 4 completes the Dev→Reviewer→QA→PM pipeline end-to-end
- Both changes are isolated to sprint-core and app packages
- No architectural changes needed

**Effort:** Low (8 Fibonacci points total)
**Risk:** Low
**Timeline Impact:** None

---

## 4. Detailed Change Proposals

### Story: [E3-S17] DevAgent Prompt Enhancement
> **5 pts** | Must Have | Blocked by: E3-S5

**Package:** `@cop1/sprint-core`

- **AC1:** `buildDevPrompt()` includes project context: tech stack (TypeScript strict NodeNext, pnpm monorepo, Vitest, Biome, hexagonal architecture), and conventions (kebab-case files, PascalCase classes, `.js` extensions in ESM imports)
- **AC2:** `buildDevPrompt()` structures the story content into clear LLM-friendly sections: "Acceptance Criteria", "Tasks/Subtasks", "Dev Notes" — extracted from markdown rather than raw dump
- **AC3:** On a story with ACs and dev notes, the LLM generates TypeScript code targeting the correct files/packages (not a generic React component) — verified manually on 1 test story

**Files:**
- `packages/sprint-core/src/features/dev-agent/domain/DevPromptTemplate.ts` — refactor `buildDevPrompt()` to extract/structure sections and add tech context

**Dev Notes:**
- The current `buildDevPrompt()` (14 lines) takes `snapshotContent` and dumps it as-is under "## Story Snapshot". Enhancement strategy:
  1. Add a `## Project Context` section with tech stack, conventions, architecture patterns
  2. Parse the markdown story to extract specific sections (AC, Tasks, Dev Notes) and present them in structured blocks
  3. Improve the `## Instructions` section to be more specific about output expectations (which package to target, file naming conventions, test expectations)
- A helper function `extractMarkdownSection(content, heading)` can parse `## Heading` blocks from the story markdown
- The project context can be hardcoded for MVP (cop1-specific) or read from `cop1.config.yaml` later
- Consider including the existing file tree structure of the target package so the LLM knows what files already exist

---

### Story: [E3-S18] PM Agent Wiring
> **3 pts** | Should Have | Blocked by: E3-S17

**Package:** `@cop1/sprint-core` + `@cop1/app`

- **AC1:** `PMAgentStep` is replaced by a real `PMAgentWorkflowStep` implementing `WorkflowStep`. It receives `context.storyContent` and validates that acceptance criteria have been addressed by the generated code — producing a markdown validation report.
- **AC2:** If PM agent cannot validate (no storyContent, or LLM unavailable), it returns `{ status: 'ok' }` with a warning — never blocks the pipeline on the PM step in MVP.

**Files:**
- `packages/sprint-core/src/features/pm-agent/application/PMAgentWorkflowStep.ts` — new file, implements `WorkflowStep`
- `packages/app/src/composition/SprintRunner.ts` — replace `new PMAgentStep()` with `new PMAgentWorkflowStep()`

**Dev Notes:**
- Two implementation options for AC validation:
  - **Option A (LLM-based):** Send the story ACs + generated code summary to the LLM and ask "Were these ACs addressed?" — requires LLMGateway injection, richer output
  - **Option B (Heuristic):** Parse ACs from story content and check if generated file names/content match expected patterns — simpler, no LLM dependency
  - **Recommendation:** Start with Option B for MVP reliability. Option A can be added later when prompt quality (E3-S17) is proven.
- The existing `PMAgent` class (`backlogHealthReport()`, `estimateEffort()`) serves a different purpose (backlog analysis). The new `PMAgentWorkflowStep` is about post-implementation validation — different responsibility, different class.
- The step MUST be graceful: never fail the pipeline. In MVP, PM validation is informational, not blocking.

---

## 5. Implementation Handoff

### Scope Classification: Minor

Direct implementation by dev team. No backlog reorganization needed.

### Sprint Ordering Update

Add to current sprint (Sprint 7):

```
### Sprint 7 — Quality Improvements
- E3-S17 (DevAgent Prompt Enhancement) — CRITICAL
- E3-S18 (PM Agent Wiring) — after E3-S17
```

### Dependency Graph

```
E3-S17 (Prompt Enhancement) ──> E3-S18 (PM Agent Wiring)
```

E3-S18 depends on E3-S17 because PM validation of ACs requires the same story content parsing capabilities.

### Success Criteria

- After `cop1 sprint run --simulate` on a story with detailed ACs and dev notes, the DevAgent generates TypeScript code targeting the correct package and following project conventions
- The PM step produces a validation report (or gracefully skips)
- All existing tests continue to pass

### Points Summary

| Story | Points | Priority |
|-------|--------|----------|
| E3-S17 | 5 | Must Have |
| E3-S18 | 3 | Should Have |
| **Total** | **8** | |

### Note: Related Observation

ReviewerAgent has a similar weak-prompt issue (`"Quality report for ${context.storyId}"` — no actual code diff or story context). This is not in scope for this proposal but should be addressed in a future sprint for meaningful code reviews.
