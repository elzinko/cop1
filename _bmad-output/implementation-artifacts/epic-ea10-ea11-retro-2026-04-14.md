# Retrospective — Epics EA10 (Supervisor Orchestrator) + EA11 (Orchestrator Foundation)

**Date:** 2026-04-14
**Scope:** Combined retrospective — EA11 (Sprint 12, 8 stories) + EA10 (Sprint 13, 9 stories) — closes V1-light MVP DoD
**Facilitator:** Bob (Scrum Master)
**Participants:** Alice (PO), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), elzinko (Project Lead)
**Previous Retrospective:** `epic-ea9-retro-2026-04-08.md` (EA9: Multi-Turn BMAD Interaction)

---

## Epic Summary

| Metric | Value |
|---|---|
| Stories | **17/17** done (100%) |
| Sprints | 2 (Sprint 12 + Sprint 13) |
| Tests added | ~140 new (cumulative ~850) |
| Regressions | 0 |
| ADRs produced | 2 (ADR-013 ~525 lines, ADR-014 ~1097 lines) |
| SCPs intermédiaires | 2 (2026-04-11 restructuring + 2026-04-14 readiness fixes) |
| Validation critical issues (C1–C4) | 4 detected pre-kickoff, all resolved via Option A |
| Production incidents | 0 |
| V1-light MVP DoD | ✅ **Closed** (automatiser 1 epic + transcript + step-by-step) |

### Stories Delivered — EA11 (Sprint 12)

| Story | Title |
|---|---|
| EA11-S1 | Deprecate legacy cop1 agents (Dev/Reviewer/QA/PM) + Step classes |
| EA11-S2 | Deprecate `workflow.useBMAD=false` legacy path (warning once-per-instance) |
| EA11-S3 | Extract technical services (WorktreeService, HistoryService, StepByStepController) — co-located |
| EA11-S4 | ADR-013 Orchestrator vs SprintRunner separation — committed |
| EA11-S5 | ADR-014 Supervisor Tool Interface — answers Q1–Q6, 1097 lines |
| EA11-S6 | SupervisorContext bootstrap loader (PRD + architecture + metadata) |
| EA11-S7 | Session transcript generator + `cop1 transcript <id>` CLI |
| EA11-S8 | 3-tracks file-based refactor (ExchangeHistoryWriter + MetricsWriter + Reader + GitignoreBootstrap) |

### Stories Delivered — EA10 (Sprint 13)

| Story | Title |
|---|---|
| EA10-S1 | SupervisorPlaybookLoader (markdown parser) |
| EA10-S2 | Playbook format specification + reference fixture |
| EA10-S3 | cop1 minimal supervisor playbook |
| EA10-S4 | OrchestratorService main loop (inter-command, 1-epic scope) |
| EA10-S5 | `--step-by-step` inter-command mode (TTY + COP1_APPROVAL_FILE + CI no-op) |
| EA10-S6 | CLI `cop1 orchestrator run --epic <id>` |
| EA10-S7 | Multi-agent advisory via in-process MCP (ADR-014 §4.2) — 6-tool catalog + re-entrance guard cap 3 |
| EA10-S8 | Multi-step resolution loop (confidence-gated consult→synthesize) |
| EA10-S9 | E2E integration test — Plan B fixture (local scripted runner) |

---

## Previous Retrospective Follow-Through (EA9 Retro, 2026-04-08)

| EA9 Engagement | Status in EA10/EA11 | Evidence |
|---|---|---|
| A1 — Real SDK integration spike mandatory | ✅ **APPLIED** | EA10-S7 Task 0 spike validated `createSdkMcpServer` before impl — zero runtime surprises |
| A2 — Fix TS carry-over errors (`Cop1Config.budget`, TS6310) | ⏳ **IN PROGRESS** | Not called out in EA10/EA11 reviews |
| A3 — Enrich SupervisorContext (PRD/archi/rules) | ✅ **DONE** | EA11-S6 `SupervisorContextLoader` loads PRD + architecture + projectMetadata |
| D1 HIGH — SupervisorContext stubbed | ✅ **RESOLVED** | EA11-S6 delivered |
| D3 LOW — BMADCommandStep 500-char truncate | ⏳ Carry-forward | Not addressed, impact reduced |
| D4 MED — StoryContextBuilder tech stack injection | ⏳ Carry-forward | Not addressed |
| D6 LOW — AbortController not exposed | ⏳ Carry-forward | Not addressed (V1.1) |

**Success signal:** The "real spike before SDK integration" rule (EA9 A1) paid off dramatically. `createSdkMcpServer` (ADR-014 §4.2) went through zero critical bugs, compared to EA9-S1 where 7 HIGH/CRITICAL were caught in code review.

---

## What Went Well

### 1. 100% Delivery Across 17 Stories
Both epics hit 17/17 on plan. Zero regressions despite the scope (2 ADRs, 140 tests, ~950–1350 LOC on EA11-S8 alone). The team validated the "wrap-don't-modify" discipline: EA10-S8 wraps EA9's `SupervisorService` without breaking a single pre-existing test.

### 2. In-Process MCP Integration Landed Clean
EA10-S7's `createSdkMcpServer` integration (ADR-014 §4.2) is the most novel piece of the V1-light architecture. Task 0 spike validated the SDK 0.1.77 behavior before implementation; 3-layer architecture enforced portability (core / SDK wrapper / future standalone); re-entrance guard (cap 3) shipped as designed. No runtime surprises.

### 3. Pre-Kickoff Validation Pass Caught 4 Critical Issues
The validation report (`validation-report-ea10-ea11-2026-04-14.md`) flagged 4 structural risks (C1–C4) **before** Sprint 13 started. All resolved via Option A (co-locate, minimal structural churn). This is a new discipline compared to EA9 where bugs surfaced only in code review.

### 4. ADRs as Load-Bearing Decisions
ADR-013 (Orchestrator vs SprintRunner separation) and ADR-014 (Supervisor Tool Interface) were written *before* implementation, not retrofitted. EA11-S4/S5 verified them explicitly. All downstream stories referenced them authoritatively — no architectural drift detected.

### 5. 3-Tracks Persistence Architecture Shipped
EA11-S8 (medium-large, 950–1350 LOC) delivered on-time despite the capacity flag. Atomic writes (tmp + rename), deterministic sort (startedAt + path), 2 KB body truncation — the primitives are correct for replay, audit, and future KPI dashboards.

### 6. Dogfooding Validated the Direction
**Major retro signal.** During Sprint 12–13, elzinko independently built a prompt-level orchestrator (manual "super-prompt" chaining `/bmad-bmm-dev-story` → `qa-automate` → `code-review` across all ready stories, with commit discipline and session logging) because the pain of relaunching sprints manually was real. This is exactly what EA10's `OrchestratorService` codifies programmatically. **The user discovered the need by using the product — before the product shipped.**

---

## What Didn't Go Well

### 1. Product Management + Sprint Relaunching Was the Real Pain Point
elzinko's verbatim: *"en dehors du dev, j'ai galéré à gérer le produit et relancer le sprint."* The dev side ran smoothly (17/17, 0 regressions). The friction was in **piloting the loop**: deciding what to work on, relaunching, monitoring, resuming. This is precisely the gap EA10 addresses — but elzinko had to hack a prompt to survive the build cycle itself. Tells us the feature is load-bearing the moment it ships.

### 2. EA10-S9 Closed DoD via Plan B, Not the Real Cobaye
EA10-S9 (E2E integration test) fell back to a **local scripted fixture + InMemorySessionAdapter** because EA6 (acceptance test harness / cobaye project) slipped. Trade-off:
- ✅ Orchestrator skeleton validated (states, events, JSONL logging)
- ⚠️ Real BMAD execution on a real fake project is **not yet proven**
- ⚠️ First contact with a real project = production, not test

The V1-light DoD is technically closed, but the "1 epic automated" claim rests on stubbed responses. Mitigation: migration marker present in the test, ready to swap when EA6 ready.

### 3. `commit_anchor` (EA10-S7) Returns a Stub
No real git commits happen via the supervisor tool catalog. elzinko's hack **mandates** 1-commit-per-story with conventional format, explicit paths, Co-Authored-By signature, and pre-commit fail-safe. None of that is wired yet. This becomes the #1 V1.1 priority.

### 4. `BMADCommandRunner` (EA10-S6) Is a Stub
Real `SprintRunner` integration was punted. The CLI subcommand works end-to-end against scripted input, not against a live BMAD pipeline. Related to Plan B problem above.

### 5. Session Log Format Gap vs User's Manual Practice
Track 2 markdown (EA11-S8) captures per-exchange markdown in `.cop1/history/`. elzinko's hack produces a **richer structured session log** per story in `_bmad-output/implementation-artifacts/sessions/<storyKey>-session.md` with sections: entry context, shell commands + return codes, file modifications, questions verbatim + decision method (deterministic/LLM/user), decisions with rationale, blockers + root cause, gate results, commit hash. Today's Track 2 is a strict subset.

### 6. Minor Debt Accumulated
- `SessionTranscriptGenerator` in `sprint-core` (circular dep workaround, documented)
- `MetricsWriter` fire-and-forget (non-transactional — best-effort)
- Legacy `buildLegacySteps()` still routable (warning only, no deletion)
- JSDoc `@deprecated` templates use backticks instead of `{@link}` (functionally equivalent)

---

## Key Patterns

### Pattern 1 — Pre-Kickoff Validation Catches Structural Risk Cheaply
Running a validation pass over all 17 stories *before* Sprint 12 kicked off flagged 4 critical issues (feature placement, ADR leaks, EA6 dependency) that would have cost real time mid-sprint. Option A "co-locate, minimal churn" resolved all 4. **This discipline should become standard for large epics.**

### Pattern 2 — Wrap-Don't-Modify Preserves Test Integrity
EA10-S8 wrapping `SupervisorService` (EA9) with consult→synthesize phases kept all pre-existing tests green. Zero regression. Pattern replicable for any EA9-based extension in V1.1.

### Pattern 3 — Task 0 Spike Is a Proven Defense
EA10-S7 spike on `createSdkMcpServer` before implementation → zero runtime surprises. Same pattern saved ADR-014's architecture from a potentially expensive late reversal. **The EA9 A1 rule is now load-bearing and effective.**

### Pattern 4 — Co-locate Before Extract
EA11-S3 (extract technical services) and C1/C2 fixes (history + supervisor placement) all chose co-location inside existing features (`dev-agent/`, `bmad-orchestration/`, `workflow/`) over creating new feature modules. Smaller blast radius, zero import churn across 19+ consumers.

### Pattern 5 — User Usage Pre-Validates the Product
elzinko's manual hack independently converged on the `OrchestratorService` pattern. When user behavior and product design agree before contact, the design is correct. This is a repeatable signal.

---

## Key Insights

1. **The real V1-light pain was not dev — it was pilot loop.** The dev cycle is working (0 regressions, 100% delivery, rich code review). What slowed elzinko was sprint relaunching and product management. The supervisor orchestrator directly attacks this, so the EA10/EA11 investment is correctly targeted. The question is whether the **current** EA10 is usable enough, or whether the user's hack reveals V1.1 gaps that block daily dogfooding.

2. **Dogfooding produced a spec.** elzinko's super-prompt is a concrete V1.1 requirements document, not a workaround. The commit discipline (1-story = 1-commit, conventional format, explicit paths, Co-Authored-By, fail-safe hook handling, explicit no-push) and session log structure (chronological, horodated, sectioned, story-referenced, File List-integrated) are **product requirements**, not nice-to-haves.

3. **The ADR-014 in-process MCP choice is validated.** The 3-layer architecture (pure core → SDK wrapper → future standalone) paid off immediately: EA10-S7 could stub `commit_anchor` without corrupting the supervisor contract. V1.1 can wire real git without architectural rework.

4. **Pre-kickoff validation is cheaper than mid-sprint discovery.** The 2026-04-14 validation pass took minutes and saved days. Institutionalize.

5. **Plan B patterns should be standard risk mitigation.** EA10-S9 Plan B (local fixture instead of EA6 cobaye) kept the DoD on track despite upstream slippage. Pattern: every integration story with external dependency should ship with a Plan B fallback. Cost: small. Value: unblocks DoD closure.

---

## Readiness Assessment

| Dimension | Status | Detail |
|---|---|---|
| Testing & Quality | **GOOD with caveat** | ~850 tests, 0 regressions. Plan B on E2E = orchestrator skeleton tested, real BMAD pipeline not yet exercised on real project |
| Deployment | **N/A (internal)** | CLI subcommand exists; not packaged for external distribution (EA8 scope) |
| Stakeholder Acceptance | **PARTIAL** | elzinko's dogfooding via hack confirms direction; real end-to-end use pending |
| Technical Health | **GOOD** | Clean hexagonal, 2 ADRs in sync, co-location discipline held, 3-tracks persistence sound |
| Unresolved Blockers | **0 BLOCKERS for V1-light** | DoD closed; V1.1 gaps identified but not blocking |

**Verdict:** V1-light MVP DoD is **closed on paper**. The skeleton is correct and tested. The **usable-for-dogfooding** threshold is not yet met — elzinko's hack reveals what's missing (commit discipline, richer session log, story↔session wiring). These are V1.1 scope.

---

## Significant Discovery

### User hack as V1.1 specification (post-V1-light)

elzinko's manual super-prompt is not a workaround — it's **the** V1.1 requirements document surfaced by usage before code. Gap analysis vs current EA10:

| Requirement (from hack) | EA10 current state | Gap severity |
|---|---|---|
| Playbook sequence `dev-story → qa-automate → code-review` | EA10-S3 playbook + EA10-S4 loop | ✅ Match |
| Auto-decide minor scope (naming, placement) | EA10-S7 LLM supervisor + EA10-S8 confidence gate | ✅ Match |
| Stop conditions (irrecoverable / irreversible / done) | EA10-S8 escalation path `AbortRun` | ✅ Match |
| No check-ins while backlog ready-for-dev | OrchestratorService loop (EA10-S4) | ✅ Match |
| **1 story = 1 commit, conventional format, Co-Authored-By, explicit paths, no-amend on hook fail, no-push** | `commit_anchor` returns stub (EA10-S7) | 🔴 **HIGH gap** |
| **Structured session log per story (chronological, horodated, sectioned)** | Track 2 markdown per-exchange, subset of required structure | 🟡 **MEDIUM gap** |
| **Session log referenced in story Debug Log References + File List + same commit** | Transcript lives separately, no story wiring | 🔴 **HIGH gap** |

**Epic Update Required:** No rollback of EA10. Add V1.1 stories to close the 3 gaps above before heavy dogfooding.

---

## Action Items

### V1.1 Priorities (from user hack analysis)

| # | Action | Owner | Priority | Success Criteria |
|---|---|---|---|---|
| 1 | Implement real `commit_anchor` replacing EA10-S7 stub — 1-commit-per-story with conventional format, explicit paths from File List, Co-Authored-By signature, fail-safe hook handling (no `--amend`, no `--no-verify`), no auto-push | Charlie (Dev) | **HIGH** | Single `cop1 orchestrator run` produces N commits for N stories, each passing pre-commit hook, with consistent metadata |
| 2 | Extend Track 2 markdown format to capture: shell commands + return codes + stderr excerpts (tronqués 500 chars), decision method (deterministic/LLM/user), root causes for blockers, gate results per story | Charlie (Dev) | **HIGH** | Session log is superset of elzinko's current hack output |
| 3 | Wire session log into story: reference `./sessions/<storyKey>-session.md` in `### Debug Log References`, add to File List, include in story commit | Charlie (Dev) | **MEDIUM** | Story file after orchestrator run has session log linked and committed in same commit |

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|---|---|---|
| 4 | Institutionalize pre-kickoff validation pass for any epic with >5 stories or structural refactoring | Bob (SM) | Added to team DoD + runbook; next epic kickoff includes validation report |
| 5 | Mandate Plan B fallback for any story with external upstream dependency | Bob (SM) | iamthelaw rule candidate R9 proposed |
| 6 | Replace Plan B on EA10-S9 with real EA6 cobaye when EA6 lands | Dana (QA) | EA10-S9 test switched to EA6 fixture; migration marker removed |

### Technical Debt (carry-forward + new)

| # | Item | Priority | Owner | Note |
|---|---|---|---|---|
| D7 | `BMADCommandRunner` stub (EA10-S6) — real SprintRunner wiring | MEDIUM | Charlie | Needed for real dogfooding |
| D8 | `SessionTranscriptGenerator` in `sprint-core` (circular dep) | LOW | Backlog | Documented, functional |
| D9 | `MetricsWriter` fire-and-forget non-transactional | LOW | Backlog | Acceptable for V1-light |
| D10 | Legacy `buildLegacySteps()` path still routable | LOW | Backlog | Warning emitted; delete after V1.1 stable |
| D1–D6 from EA9 | TS carry-overs, StoryContextBuilder, 500-char truncate, abort support | Carry-forward | Charlie | Progressive cleanup |

### Team Agreements

- Pre-kickoff validation pass is mandatory for epics >5 stories or with structural impact.
- Plan B fallback expected for external upstream dependencies.
- User dogfooding output (prompts, hacks, scripts) is treated as product input, not noise.

---

## Next Epic Preview

**Status:** No next epic committed. V1-light DoD closed. Decision point for elzinko.

### Open Options (for future planning)

1. **V1.1 Supervisor Hardening** (recommended) — close the 3 gaps from user hack before broader dogfooding. Touches EA10-S7 (`commit_anchor` real), EA11-S8/S7 (Track 2 extension + story wiring). Estimated 3–5 stories.
2. **EA6 — Acceptance Test Harness** — replace EA10-S9 Plan B with real cobaye. Important for regression guard, less important for user value.
3. **EA8 — Distribution & Dogfooding** — package CLI, pre-flight checks, PR creation via `gh`. Accelerates user dogfooding but builds on a supervisor that hasn't absorbed the hack lessons yet.
4. **V1.1 iamthelaw / Budget (EA7, EA2-S3..S6)** — governance layer. Useful once dogfooding is real.

**Team recommendation:** V1.1 Supervisor Hardening first (close hack gaps), then EA8 (package for real usage), then EA6 (regression harness). Not a locked decision — elzinko to choose.

---

## Open Questions (deferred — not blocking retro closure)

1. **Re-entrance cap 3** (EA10-S7) — is depth 3 correct? Real workflows may nest deeper.
2. **MCP tool catalog expansion** (6 tools) — include iamthelaw agent integration (ADR-014 §5.5) in V1.1?
3. **Playbook versioning/lifecycle** — singleton `supervisor-playbook.md` sufficient, or multi/versioned?
4. **Architect session on ADR-014?** — elzinko to decide if the novelty of in-process MCP warrants a dedicated review before V1.1 stories build on it.
5. **EA6 timing** — when to land the real cobaye fixture and retire Plan B marker?

---

## Commitments Summary

- **Action Items:** 6 (3 HIGH V1.1 supervisor hardening, 3 process improvements)
- **Technical Debt Items:** 4 new + 6 carry-forward
- **Team Agreements:** 3
- **Critical Path Items:** 0 for V1-light closure; V1.1 hardening recommended before heavy dogfooding
- **Significant Discovery:** User hack as V1.1 specification

---

## iamthelaw Rule Candidates (from EA10/EA11 lessons)

| # | Rule | Source |
|---|---|---|
| R9 | Stories with external upstream dependencies MUST include a Plan B fallback in AC | EA10-S9 Plan B success |
| R10 | Epics >5 stories or with structural impact MUST have a pre-kickoff validation pass | 2026-04-14 validation report catching C1–C4 |
| R11 | User dogfooding artifacts (prompts, scripts, hacks) during build cycles are product input — capture in retro | elzinko's super-prompt revealing V1.1 spec |
| R12 | ADR-referenced stories MUST have ACs refreshed with concrete mechanism before dev pick-up | C3 (EA10-S7 abstraction leak) pre-fix |

---

## Next Steps (for elzinko)

1. **Review this retro** and confirm the V1.1 gap analysis matches your experience
2. **Test EA10** as-is via `cop1 orchestrator run --epic <id>` on a light use case — confirm the 3 gaps are real friction or theoretical
3. **Decide next epic priority** between V1.1 hardening / EA6 / EA8 / governance
4. **Optional:** schedule architect session on ADR-014 if the hardening work will make heavy use of the MCP tool catalog
5. **Mark EA10 + EA11 retros as done** in sprint-status.yaml (done by this workflow)

---

Bob (Scrum Master): « Excellent cycle, elzinko. 17/17 stories, V1-light fermé, et ton usage réel a révélé le cahier de charges V1.1 avant qu'on y touche. Rare et précieux. »

Alice (PO): « La meilleure rétro est celle où le produit a été pré-validé par le besoin. C'est ce qui s'est passé ici. »

Charlie (Senior Dev): « Le commit discipline gap est évident maintenant qu'on le voit. On aurait pu le louper sans le hack. »

Dana (QA): « Plan B EA10-S9 : rappel que le pragmatisme bat l'idéalisme quand le DoD est en jeu. »

— **Fin de la rétrospective EA10+EA11** —
