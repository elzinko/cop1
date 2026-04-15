---
date: 2026-04-15
author: elzinko (with Claude as architect/SM)
trigger: adversarial-review-v1.1-architecture-2026-04-15
mode: batch
scope_classification: Moderate (architecture amendments + backlog items)
supersedes: none
related_scps:
  - sprint-change-proposal-2026-04-14-readiness-fixes.md
  - sprint-change-proposal-2026-04-11.md
related_adrs:
  - adr-014-supervisor-tool-interface.md (amended §3.3, §5.7)
  - adr-013-orchestrator-sprintrunner-separation.md
decisions:
  - A1: simplify_budget_single_cap
  - A2: recovery_e2e_test_story
  - A3: layer_separation_core_extraction
  - A4: reentrance_guard_configurable
  - A5: playbook_scrum_directives_pivot
  - A6: status_discipline_no_file_coupling
  - A7: aspirational_features_audit
  - A8: bmad_version_pin_exit_paths
  - B1: commit_anchor_prerequisite
  - B2: slasl_sha_strategy_open
---

# Sprint Change Proposal — Adversarial Review Integration (2026-04-15)

## 1. Issue Summary

An **adversarial review** of the V1.1 architecture (produced 2026-04-15, same day as the architect session) flagged 10 issues in the newly written V1.1 amendments and the underlying ADR-014 sections. elzinko validated 8 arbitrages (A1-A8) and 2 prerequisite notes (B1-B2). This SCP integrates those arbitrages into the planning artifacts.

**Discovery context:** The adversarial review was conducted immediately after the V1.1 architect session (D1-D4 decisions in `architecture.md`). The reviewer examined ADR-014 (immutable, Accepted 2026-04-11) and the V1.1 amendments for internal consistency, testability, and alignment with elzinko's "moins on a besoin de gerer, mieux c'est" principle.

**Key finding:** Two V1.1 decisions (D2 command mapping, D3 write discipline) are **pivoted** — not patched. The adversarial review revealed they over-engineered the BMAD integration surface. The new stance is radical simplification: the supervisor discovers BMAD autonomously (no command map), and cop1 has zero file-level coupling to BMAD state (no read, no write).

---

## 2. Impact Analysis

### 2.1 Artifact Impact

| Artifact | Impact |
|---|---|
| `architecture.md` §V1.1 Amendments | **D1**: add "Exit paths" subsection (A8). **D2**: full rewrite → "Playbook Scrum-Directives" (A5 pivot). **D3**: full rewrite → "Status Discipline — BMAD workflow-gated" (A6 pivot). **D4**: add `commit_anchor` prerequisite note (B1) + SHA strategy open question (B2). New subsection "V1.1 Amendments Follow-ups" for A1/A2/A3/A4/A7. |
| `adr-014-supervisor-tool-interface.md` | Append "Amendment 2026-04-15" section: A1 (§3.3 budget simplification), A4 (§5.7 structured error), forward-references to architecture.md for the rest. ADR body unchanged (immutable). |
| `PlaybookSchemaV2` (code, future) | Remove `commands:` and `allowed_commands` fields. Playbook = scrum directives prose only. |
| `BmadStatusReader` (code, future) | Deprecated and to be removed from runtime. |
| `toolCatalog.ts` (code, future) | A1: `remaining_budget` fail-fast. A4: structured error return for reentrance cap. A3: extract `*Core.ts` files (non-blocking). |

### 2.2 Epic Impact

No epic added, removed, or resequenced. Two new V1.1 backlog stories proposed:
- **Recovery E2E test** (A2) — hard prerequisite for V1.1 "dogfooding unassisted" sign-off.
- **Layer separation contract tests** (A3) — non-blocking, backlog.

### 2.3 Technical Impact

- **No code changes in this SCP.** All changes are planning-artifact amendments.
- **Downstream code impact (V1.1 stories):** removal of `BmadStatusReader`, simplification of `PlaybookSchemaV2`, budget model refactoring, reentrance guard structured return. All scoped to future V1.1 stories.

---

## 3. Recommended Approach

**Path chosen: Direct Adjustment — amend architecture.md + append ADR-014 amendment.**

The changes are two pivots (A5, A6 = simplification), six architectural notes (A1-A4, A7-A8), and two prerequisite clarifications (B1-B2). No rollback needed. No MVP scope change.

**Effort:** ~2 hours of document editing. 0 code impact in this SCP.
**Risk:** LOW. The pivots (A5/A6) simplify the architecture — they remove complexity rather than adding it. The prerequisite notes (B1/B2) make implicit dependencies explicit.

---

## 4. Detailed Decisions

### A1 — Simplify budget (ADR-014 §3.3 amendment)

Remove the 3-cap structure (`max_turns_per_workflow`, `max_tokens_per_session`, `max_duration_per_workflow_seconds`). Replace with a single per-night cap `max_tokens_per_night` (default 2,000,000). Rely on native SDK compaction.

**Code impact (V1.1):** In `toolCatalog.ts:132`, `remaining_budget` tool must fail-fast if `budgetProvider` is absent — no `Number.POSITIVE_INFINITY` fallback.

### A2 — Recovery E2E test gap (ADR-014 §3.5)

Strategy A (SDK `resume: session_id`) was never tested E2E because EA10-S9 closed via `InMemorySessionAdapter` Plan B. New V1.1 story: "Recovery E2E test with real AgentSdkSessionAdapter" — hard prerequisite for V1.1 "dogfooding unassisted" sign-off.

### A3 — Layer separation (ADR-014 §4.3)

`toolCatalog.ts:60-135` mixes Layer 1 business logic with Layer 2a SDK wrapping. Plan: extract `*Core.ts` files, add contract test invoking Core with arbitrary `workingDir`. Non-blocking for sprint; V1.1 backlog story.

### A4 — Re-entrance guard (ADR-014 §5.7 amendment)

Keep `cap=3` but make configurable via `budgets.max_reentrance_depth` in playbook frontmatter. Replace `throw new Error(...)` at `toolCatalog.ts:81` with structured return `{ error: 'reentrance_cap', escalation_required: true, depth, max }`. Add Track 3 event type `reentrance.cap_hit` to the catalogue.

### A5 — PIVOT: Playbook format (overrides D2)

**Rejected:** the D2 `commands:` map approach.

**New rule:**
- Playbook markdown body = scrum posture directives only (cycle shape, escalation policy, mission).
- Playbook must NOT enumerate BMAD slash commands. Remove `commands:` and `allowed_commands` from `PlaybookSchemaV2`.
- Supervisor discovers BMAD commands autonomously via `/bmad-help`, slash-completion, and reading `_bmad/bmm/**`.
- cop1 declares explicitly ONLY its own tool catalogue (non-BMAD MCP tools).
- `PipelineStepFactory.ts` hardcodes move into supervisor's system prompt as scrum guidance; `invoke_bmad_command` accepts any BMAD command string at runtime.
- Test fixtures relaxed: no literal assertions on BMAD command names.

### A6 — PIVOT: Status discipline (overrides D3)

**Rejected:** D3's partial stance (no write but read allowed).

**New rule:**
- cop1 must NEVER readfile/grep `sprint-status.yaml` or any BMAD artefact at runtime.
- Supervisor queries status via native `/bmad-bmm-sprint-status` workflow and interprets output.
- Invocation is event-driven (after workflows that change status), not polling.
- cop1 writes its own state into `.cop1/orchestrator-state.yaml` via internal API.
- `BmadStatusReader` is deprecated and to be removed from runtime.
- **Test invariant:** `grep -r "sprint-status.yaml" packages/**/src/**/*.ts` returns zero results (except deprecated file references in SCP docs).

### A7 — Aspirational features audit

- `burndown/` and `velocity-projector/`: keep if hookable to future cop1 commands consuming `/bmad-bmm-sprint-status` output. Mark "pending wire" in V1.1 backlog.
- `kpis-dashboard/`: zero functional consumer (barrel re-export only). Decision: **delete** unless a concrete cop1 CLI/API path is identified by sprint planning. Opened for deletion in V1.1 backlog.

### A8 — BMAD version pin exit paths (extends D1)

Three exit paths from 6.0.0-Beta.8 pin:
- **Path A (upstream bugfix):** e.g. 6.0.0-Beta.9, auto-authorized within V1.1 window. Requires smoke-test on fixture EA6 before merge.
- **Path B (fork patch):** in `_bmad-method-distribution/` (or equivalent), tolerated up to 14 days. Documented as explicit tech debt with "BMAD upstream version expected" annotation.
- **Path C (freeze to stable 5.x):** only via dedicated SCP (not default).
- **SLA:** if 6.0.0-Beta.8 has a blocking bug unfixed upstream in 14d, Path B triggers by default and a V1.1 story is opened.

### B1 — commit_anchor prerequisite

`toolCatalog.ts:122-128` is a stub (`{ committed: false, note: "V1-light stub" }`). Real `commit_anchor` implementation is a hard prerequisite for D4 (SessionLogAggregator / SLASL). Must land in the same PR or a PR preceding D4. Recorded as V1.1 priority #1.

### B2 — SLASL SHA strategy

D4's post-commit SHA patching strategy (amend vs 2-pass) is left open — to be tranched at `commit_anchor` implementation time. Noted as open question in architecture.md D4 section.

---

## 5. Implementation Handoff

### 5.1 Scope Classification

**Moderate.** Touches architecture.md (planning doc) and ADR-014 (append-only amendment). Creates V1.1 backlog items. No code, no sprint disruption.

### 5.2 Artifacts Modified (this SCP)

| Artifact | Action |
|---|---|
| `architecture.md` §V1.1 Amendments | D1 extended (A8), D2 rewritten (A5), D3 rewritten (A6), D4 extended (B1/B2), new Follow-ups section (A1-A4, A7) |
| `adr-014-supervisor-tool-interface.md` | Amendment appended (A1, A4, forward-refs) |
| This SCP | Created |

### 5.3 V1.1 Backlog Items Created

| # | Story | Priority | Prerequisite? |
|---|---|---|---|
| 1 | Recovery E2E test (A2) | HIGH | Yes — blocks "dogfooding unassisted" |
| 2 | commit_anchor real implementation (B1) | #1 | Yes — blocks D4 SessionLogAggregator |
| 3 | Layer separation `*Core.ts` extraction (A3) | MEDIUM | No |
| 4 | burndown/velocity-projector wiring (A7) | LOW | No |
| 5 | kpis-dashboard audit/delete (A7) | LOW | No |
| 6 | Budget simplification implementation (A1) | MEDIUM | No |
| 7 | Reentrance guard structured error (A4) | MEDIUM | No |
| 8 | BmadStatusReader removal (A6) | HIGH | No, but part of A6 pivot |
| 9 | PlaybookSchemaV2 cleanup — remove commands/allowed_commands (A5) | HIGH | No, but part of A5 pivot |

### 5.4 Success Criteria

1. `architecture.md` V1.1 amendments reflect all 10 arbitrages accurately.
2. ADR-014 amendment section is append-only and does not modify the ADR body.
3. Memory files (`feedback_supervisor_autonomy.md`) remain consistent with the pivots.
4. V1.1 backlog items are traceable from this SCP.

---

## 6. Approval

**Pre-approved** — elzinko validated all 8 arbitrages during the adversarial review session (2026-04-15). This SCP is the formalization of those validated decisions. No further approval loop required.
