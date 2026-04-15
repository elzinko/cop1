# Retrospective — Epic EA12 (V1.1 Hardening & Pivots)

**Date:** 2026-04-15
**Scope:** EA12 — Sprint 13 — 7 stories closing adversarial review pivots from SCP 2026-04-15
**Mode:** Automated YOLO (party-mode + 3 adversarial reviews)
**Facilitator:** Bob (Scrum Master)
**Participants:** Alice (PO), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), Frank (Architect), Isabelle (Security/Infra), Mallory (Red Team), Ops (Future Maintainer), elzinko (Project Lead)
**Previous Retrospective:** `epic-ea10-ea11-retro-2026-04-14.md` (EA10+EA11 combined — V1-light MVP DoD closure)

---

## Epic Summary

| Metric | Value |
|---|---|
| Stories | **7/7** done (100%) |
| Sprint | Sprint 13 (first post-V1-light) |
| Source of scope | Adversarial review 2026-04-15 (10 arbitrages: 8 A-items + 2 B-items) |
| Arbitrages closed in EA12 | A1, A2, A4, A5, A6 (partial), A7, B1, B2 |
| Arbitrages deferred | A3 (layer separation contract tests → V1.1 backlog), A8 (exit paths docs) |
| Regressions | 0 |
| Test delta | −11 (from dead-code deletion in S7) — 648 passing (from 659) |
| Pre-existing failures | 9 (unchanged) |
| LOC deleted (aspirational features, status-reader legacy) | net negative — codebase smaller |
| Production incidents | 0 |
| V1.1 "dogfooding unassisted" DoD progress | Major step: real commits + real recovery test + playbook simplification |

### Stories Delivered — EA12 (Sprint 13)

| Story | Title | Arbitrage(s) closed |
|---|---|---|
| EA12-S1 | `commit_anchor` real implementation (GitDriver port + Co-Authored-By + fail-safe) | B1 |
| EA12-S2 | Recovery E2E test with real `AgentSdkSessionAdapter` (retires EA10-S9 sentinel) | A2 |
| EA12-S3 | Playbook pivot — scrum directives only, no command enumeration | A5 |
| EA12-S4 | Status discipline — delete `BmadStatusReader`, introduce `SprintStatusPort` seam | A6 (partial — BMAD adapter deferred) |
| EA12-S5 | Runtime hardening — single budget cap + structured reentrance error + Track 3 event | A1 + A4 |
| EA12-S6 | Track 2 extended format (shell/blocker/gate) + SHA anchoring single-pass | B2 + D4 |
| EA12-S7 | Aspirational features audit — delete `kpis-dashboard`, `burndown`, `velocity-projector` | A7 |

---

## Previous Retrospective Follow-Through (EA10+EA11 Retro, 2026-04-14)

| EA10+EA11 Action Item | Status in EA12 | Evidence |
|---|---|---|
| #1 HIGH — Real `commit_anchor` replacing EA10-S7 stub | ✅ **DONE** | EA12-S1: GitDriver port, conventional format, Co-Authored-By trailer, fail-safe on dirty worktree, no auto-push |
| #2 HIGH — Extend Track 2 markdown (shell + returncodes + decision method + blockers + gates) | ✅ **DONE** | EA12-S6: `SessionInteraction` extended, `#### Shell`/`#### Blocker`/`#### Gate` subsections, stderr truncation 500 chars |
| #3 MEDIUM — Wire session log into story Debug Log References / File List | ⏳ **PARTIAL** | Track 2 frontmatter now carries `session:` + `commit:` SHA. Full story-file wiring (Debug Log References + File List coupling) not yet shipped — V1.1 backlog |
| #4 Process — Pre-kickoff validation for epics >5 stories | ✅ **APPLIED** | EA12 adversarial review (2026-04-15) = pre-kickoff validation; C1–C4 equivalents caught as A1–A8 before implementation |
| #5 Process — Plan B fallback mandated for external-dep stories | ✅ **APPLIED** | EA12-S2 mocked LLM responses + canned SDK messages = Plan B pattern reused (CI-runnable without real API) |
| #6 — Replace Plan B on EA10-S9 with real EA6 cobaye | ❌ **NOT ADDRESSED** | EA6 not scheduled. EA12-S2 partially retires the sentinel by exercising Strategy A with real adapter (different angle) |
| R9 — Plan B rule for external deps | ✅ **Self-applied** | EA12-S2 follows the rule |
| R10 — Pre-kickoff validation rule | ✅ **Self-applied** | SCP 2026-04-15 = validation pass |
| R11 — User artifacts as product input | ✅ **Self-applied** | Entire EA12 scope derives from user-triggered adversarial review |
| R12 — ADR-referenced stories must have ACs refreshed | ✅ **Applied** | ADR-014 §3.3/§5.7 amendment captured in S5 AC wording |

**Success signal:** The two highest-priority carry-over items (commit_anchor + Track 2 extension) shipped in the very next sprint. The user hack → V1.1 spec conversion worked as predicted.

---

## What Went Well

### 1. 100% Delivery on an Adversarial-Driven Sprint
Seven arbitrages from a harsh self-review turned into seven shipped stories in one sprint. Zero regressions. The pattern **adversarial review → SCP → epic → delivery** completed its first closed loop in 24 hours.

### 2. Codebase Gets Smaller, Not Bigger
EA12-S7 deleted three aspirational feature modules (`kpis-dashboard`, `burndown`, `velocity-projector`), losing 11 tests **on purpose** because they covered dead code. EA12-S4 deleted `BmadStatusReader` and its port. Combined with the playbook simplification (S3: no `commands:` map) and budget simplification (S5: 3 caps → 1 cap), the sprint's dominant signature is **subtraction**. Directly operationalizes elzinko's "moins on a besoin de gérer, mieux c'est" principle.

### 3. B1 → B2 Chain Closed Correctly
`commit_anchor` (S1) produces a real SHA; Track 2 writer (S6) writes the SHA into frontmatter **after** the commit — single-pass, no `--amend`, no two-pass. The B2 open question is resolved in the simplest possible way and documented in the session log. Classic "make the dependency explicit, then collapse it" move.

### 4. Recovery E2E Test Finally Exists
EA10-S9 closed V1-light DoD via `InMemorySessionAdapter` Plan B — leaving Strategy A (`resume: session_id`) untested end-to-end. EA12-S2 fixes this with a real `AgentSdkSessionAdapter`, an injected `QueryFunction` (mocked LLM, real SDK lifecycle), and a new `restoreSession(sdkSessionId, context)` API exercising the crash-recovery path. The sentinel grep-trace from EA10-S9 is now linked to EA12-S2 output.

### 5. Port Seam Preserved Under Partial Deferral (S4)
EA12-S4 deleted `BmadStatusReader` and migrated every consumer (SprintRunner, `cop1 sprint-status` CLI, DaemonService, StoriesApiHandler) to a new `SprintStatusPort` in `@cop1/app`. The production `BmadCommandStatusAdapter` (that invokes `/bmad-bmm-sprint-status`) is **deferred**, but the seam exists. YAML adapter used today; switch is a drop-in replacement tomorrow. Partial delivery without architectural debt.

### 6. Structured Errors Over Throws
EA12-S5 replaced `throw new Error('reentrance_cap')` with `{ error: 'reentrance_cap', escalation_required: true, depth, max }`. Plus `remaining_budget` fail-fast `{ error: 'no_budget_provider' }` instead of silent `POSITIVE_INFINITY` fallback. Plus new Track 3 event `reentrance.cap_hit`. Errors are now data the supervisor can reason over — not exceptions to swallow.

### 7. Invariant Test Locks Down the A6 Discipline
EA12-S4 ships `sprint-status-coupling-invariant.test.ts` that greps the runtime for `sprint-status.yaml` references and fails on any unallowlisted hit. Five legitimate references are codified in the allowlist, each with a justification comment. **This turns an architectural rule into an executable contract.** The technique should be replicated.

---

## What Didn't Go Well

### 1. S4 Partial Deferral Masks Real Work
Tasks 1–3 of S4 deliver the port seam + state writer + invariant test. But the actual **runtime behavior is unchanged** from pre-S4: YAML adapter still reads `sprint-status.yaml` directly via DI. The `BmadCommandStatusAdapter` (invoking `/bmad-bmm-sprint-status`) is "V1.1 follow-up". The story is marked `done`, but from a user perspective A6 is not closed — cop1 still has file-level coupling to BMAD state at runtime, just behind a port. The invariant test passes **because the allowlist explicitly allows the YAML adapter.** Allowlists are honest, but the gap is real.

### 2. Recovery Test Uses Mocked LLM
EA12-S2 is a huge step forward (real SDK session lifecycle, real adapter, real `resume` call), but the `QueryFunction` is injected with canned SDK messages. No real Anthropic API call, no real LLM reasoning in the loop. For CI that's correct; for "unassisted dogfooding sign-off" the test is necessary but not sufficient. An additional **real-API smoke test** (opt-in, costs tokens) is still missing.

### 3. Session Log ↔ Story Wiring Not Completed
Previous retro action item #3 MEDIUM ("reference `./sessions/<storyKey>-session.md` in `### Debug Log References`, add to File List, include in story commit"). EA12-S6 threads `session:` and `commit:` into Track 2 frontmatter — one half of the wiring. The other half — **mutating the story markdown file** to embed the backreference and listing the session log in the File List — is not shipped. The hack-spec gap narrows but doesn't close.

### 4. 9 Pre-Existing Test Failures Still Pre-Existing
Carry-forward from EA11. Not EA12 regressions, but they are visible noise in every CI run. No one owned clearing them this sprint. Small rot that compounds if left.

### 5. A3 Layer Separation Contract Tests Skipped
A3 ("extract `*Core.ts` files, add contract test invoking Core with arbitrary `workingDir`") is acknowledged as non-blocking but **not addressed** in EA12. The mixed Layer 1/2a in `toolCatalog.ts:60-135` remains. Small risk today; bigger when a second SDK wrapper (Layer 2b, standalone) is ever attempted.

### 6. A8 "Exit Paths" Documentation Not Produced
Minor but real — the architecture amendment promised an "Exit paths" subsection under D1. Not yet in `architecture.md`.

### 7. Dogfooding Still Not Real
elzinko hasn't yet run `cop1 orchestrator run --epic <id>` against a real project end-to-end after EA12. All confidence comes from tests + code review. The moment of truth — the orchestrator producing a real commit on a real story via a real BMAD invocation — hasn't happened.

---

## Party-Mode Discussion (simulated, 5-voice)

> **Bob (SM):** « Très bon cycle, elzinko. 7/7 stories, zéro régression, et la grande majorité des arbitrages A1–A8 passés en production en moins de 24 h. Mais on a deux stories partielles sous des noms "done" — S4 et S6. Discutons ça honnêtement. »
>
> **Alice (PO):** « S4 me gêne. Le ticket clôt A6 sur le papier, mais le runtime reste identique. On a vendu "zero coupling" et on livre "zero coupling behind a YAML allowlist". L'écart entre le framing et la réalité doit être remonté dans le statut V1.1. »
>
> **Charlie (Senior Dev):** « Je défends S4. Le seam est là. Le switch est mécanique. Si j'avais livré le BmadCommandStatusAdapter ce sprint j'aurais cassé l'invariant grep jusqu'à ce qu'il tourne vraiment — or on n'a pas de `/bmad-bmm-sprint-status` exécutable depuis le runtime encore. Le deferral est techniquement propre. Ce qui est faux, c'est le label "A6 closed". Il faudrait dire "A6 seam done, A6 behavior pending". »
>
> **Dana (QA):** « Mon souci : le test d'invariant passe grâce à une allowlist. C'est honnête — les comments sont clairs — mais quelqu'un qui ajoute un nouveau lecteur YAML copiera le pattern plutôt que passer par le port. Il faudrait un commentaire en tête d'allowlist qui dit "NE PAS étendre cette liste — créer un port". »
>
> **Elena (Junior Dev):** « Moi j'apprends beaucoup de ce sprint. La discipline "supprimer plutôt qu'ajouter" dans S7 — j'ai vraiment vu comment 11 tests qui sautent, c'est une bonne nouvelle quand ils testaient du code mort. »
>
> **Frank (Architect):** « Le pattern adversarial-review → SCP → epic → delivery dans le même cycle, c'est puissant. Mais attention : deux adversarial reviews d'affilée sur la même base sans dogfooding réel entre les deux, on risque le "polissage de gemme sous verre". Il faut maintenant mettre le truc entre les mains d'un vrai epic (réel ou cobaye) avant le prochain round de revue. »
>
> **elzinko (Project Lead):** « D'accord avec Frank. La prochaine étape n'est pas un autre pivot — c'est tourner le bouton. Un vrai `cop1 orchestrator run` sur un epic réel, même petit. Si ça casse, on apprend plus que de 10 arbitrages théoriques. »
>
> **Bob (SM):** « Acté. Je note : la plus grande dette après EA12 n'est plus technique — c'est empirique. On a besoin d'un run réel. »

---

## 🔴 Adversarial Review #1 — The Economist

**Mallory (Red-Team Economist):** « Let's count the cost-to-value ratio honestly. »

### Thesis
> **EA12 is a high-quality "subtract-complexity" sprint. But its direct value-creation is near-zero without a live orchestrator run. Every arbitrage in EA12 was found via another self-review — no new information came from production. The team is paying compound complexity-reduction interest on an untested principal.**

### Evidence
1. **Zero new user-visible features.** S1 replaces a stub with real behavior; S6 enriches a log; S3/S4/S5 simplify. Every other story deletes or restructures. User doesn't gain a single new action.
2. **Test count dropped by 11 (648 vs 659).** Celebrated internally as "deleting dead code" — valid — but also loses 11 units of behavioral verification the system no longer guarantees.
3. **Two retros in a row (EA10+EA11, then EA12) without a real production run between them.** Each discovers "V1.1 gaps" — but both gaps lists are generated by *reviewing* the code, not *using* the tool. Confirmation bias: the reviewer sees what reviewers see.
4. **S4 partial deferral is economic sleight-of-hand.** The expensive part (live BMAD workflow invocation for status) is pushed to "V1.1 follow-up" while the sprint books "A6 closed". The ledger is unbalanced.

### Probe questions
- **Q1:** If you released EA12 tomorrow and a new user tried to run `cop1 orchestrator run --epic <small-real-epic>`, what fraction of the run would succeed unaided?
  → Honest answer: unknown. **That's the problem.**
- **Q2:** What was the marginal cost of EA12 vs. running EA10 against a real epic first? (Sprint-equivalent work + cognitive load of 10 arbitrages.)
  → Probably 70–90% of a full sprint, against a reality-check that would cost << 1 sprint.
- **Q3:** Which arbitrage would have been impossible to discover via a single real run?
  → Possibly A3 (layer separation) and B2 (SHA strategy). Every other item (A1 budget, A4 structured error, A5 playbook, A6 coupling, A7 dead code, A8 exit paths) would likely have surfaced faster under real use.

### Recommendation
- **Before EA13 is scoped:** run `cop1 orchestrator run` on *any* concrete epic (internal, trivial, throwaway) and capture the actual failure modes. Let empirical gaps define EA13 scope — not another review.
- **Gate rule:** no further "Hardening" sprint may be planned without at least one real-run report in the loop.

### Counter-defence (Charlie)
- Sprint 13 was **contracted scope**: SCP 2026-04-15 was approved before sprint start, so the team delivered what was asked.
- The "adversarial review" was not redundant — it landed two real pivots (A5 playbook, A6 coupling) that would have caused expensive rework under real use.
- The subtract-complexity work is **cheaper now than later**: every consumer added to a complex API compounds the cost of removing it.

### Verdict
Partially fair. EA12 was correct given the scope that was approved. The **meta-criticism is sharper than the story-level criticism**: the *decision to scope another review instead of a real run* was the questionable call. Recommendation carries to the planning layer, not the execution layer.

---

## 🔴 Adversarial Review #2 — The Attacker

**Isabelle (Red-Team Infra/Security):** « Give me the invariants; I'll break them. »

### Thesis
> **EA12 added real git commits, real SDK session resume, structured error returns, and an invariant test. Each of these is a new attack surface or trust boundary that wasn't there before. The tests exist; the threat modeling doesn't.**

### Attack traces

#### AT-1: `commit_anchor` commit-message injection
- `commit_anchor` accepts a message string from the supervisor LLM and passes it to `git commit -m "<msg>"`.
- If the LLM emits a message containing `$(rm -rf .)` or `` `cat /etc/passwd` ``, does the `GitDriver` shell out via `/bin/sh -c` or does it `execFile('git', ['commit', '-m', msg])`?
- **Check:** is `GitDriver` implemented with `spawn/execFile` (args array, safe) or `exec` (shell string, unsafe)?
- **Mitigation if unsafe:** switch to args-array invocation; add regex on message shape before invocation.

#### AT-2: Conventional-commit trailer smuggling
- `Co-Authored-By: <supervisor-identity>` is injected. If the caller controls `coAuthoredBy` (e.g., per-playbook), a malicious playbook could set the trailer to `Co-Authored-By: victim@example.com\n\nfixup!: drop tables`.
- `git commit` treats newlines inside a message as separators. Multi-line injection could produce follow-up commit-message segments.
- **Check:** is `deps.coAuthoredBy` validated against `/^[A-Za-z0-9 _.-]+ <[^>]+>$/` and stripped of newlines?

#### AT-3: `AgentSdkSessionAdapter.restoreSession` trust boundary
- New public API `restoreSession(sdkSessionId, context)`. The `sdkSessionId` is external input (from a previous run's persisted state).
- If the persisted state was tampered (swap `sdkSessionId` for another user's), does the adapter validate ownership / workspace binding before resume?
- SDK's `resume: session_id` is a pure trust-the-caller API. The cop1 runtime is the last line of defence.
- **Check:** does `restoreSession` verify the sessionId's project/workspace affinity? Is it namespaced?

#### AT-4: Allowlist drift on invariant test
- S4's grep-invariant passes via an allowlist of 5 files. A contributor can grow the list to 6 with a PR description "just adding one more". Human review may not catch it.
- **Mitigation:** add a second guard — a CI-level grep that fails if the allowlist grows without a linked ADR/SCP.

#### AT-5: Structured reentrance error misinterpreted as success
- `{ error: 'reentrance_cap', escalation_required: true, depth, max }` is a *data* return, not a thrown exception.
- If a supervisor (LLM) receives this and its prompt doesn't surface `error` early, it may pass the object into its decision context and "reason around" the cap. Result: effective cap unenforced.
- **Check:** is there a mandatory pre-supervisor shim that converts `{ error, escalation_required: true }` into a control-flow jump *before* it reaches the LLM?

#### AT-6: Track 2 shell-command storage XSS / log injection
- S6 stores shell commands + stderr into markdown files with truncation at 500 chars. If a command contains `\n#### Fake Section\n` or markdown meta, the generated transcript will render it as a real section.
- **Mitigation:** escape or code-fence the shell + stderr rendering (code blocks in S6 renderer?).

### Hits confirmed / speculative
- **Confirmed surface:** AT-2 and AT-5 are real by the AC wording (multi-line risk in commit trailers, structured error as data). Mitigation effort: small.
- **Needs code inspection:** AT-1, AT-3, AT-4, AT-6.

### Recommendation
Spawn a **V1.1 security hardening mini-pass** — one story, 6 checks — before external dogfooding. Deliverables: (a) `execFile` verified for GitDriver, (b) trailer regex, (c) sessionId affinity check, (d) allowlist drift CI, (e) LLM error-surfacing shim, (f) shell/stderr code-fence rendering.

### Verdict
**High-value lens.** The sprint correctly focused on shipping functionality but implicitly assumed a benign caller environment. With commits and session-resume now real, that assumption needs evidence. A 1-story followup is cheap and closes the threat surface created by EA12.

---

## 🔴 Adversarial Review #3 — The Future Maintainer

**Ops (Future Maintainer, 6 months from now):** « I just got paged. I have no context. Can this codebase tell me what it does? »

### Thesis
> **EA12 improves the architecture but increases the archaeology required to understand why. Half the sprint is deletion and deferral. Git log will tell the "what"; the "why" is scattered across SCP-2026-04-15, ADR-014 amendments, story Dev Notes, and allowlist comments. Onboarding-cost just rose.**

### Symptoms
1. **Invisible deletions.** `kpis-dashboard/`, `burndown/`, `velocity-projector/` are gone. New contributor grepping old planning docs will find references and find nothing. No deprecation stub, no README pointing to the decision.
2. **Allowlist comments as load-bearing documentation.** Five `sprint-status.yaml` references exist, each justified by a comment. These comments are the only explanation for why the invariant is "zero coupling" but the grep matches 5 hits. Miss the comments, misread the invariant.
3. **S4 partial deferral in four places.** Story Dev Notes, Completion Notes, the port-seam diagram (implicit), and the allowlist comments all carry partial information. Merging them mentally is non-trivial.
4. **Playbook format changed (S3).** A contributor who read ADR-014 §5 pre-EA12 will find it describes a `commands:` map that no longer exists. The ADR is marked "Accepted 2026-04-11" — the amendment is in a separate document. If they don't find the amendment, they'll write a regression.
5. **B2 resolution is prose in S6 Dev Notes.** Future migration away from single-pass (if D4 evolves) must re-derive the reasoning from the story file — not the ADR.
6. **Session log references commit SHA but story file doesn't reference session log.** The link is one-way. Starting from the story, you can't find the session. Starting from the session, you can find the story — fine. Starting from the commit, you can find neither.

### Cost to the future maintainer
- **Onboarding a new dev to touch the orchestrator:** probably +30–50% cognitive load post-EA12 vs pre-EA12 for the pivots (S3, S4, S5 touch central types and deleted a subsystem).
- **Resolving an incident in production:** if a `reentrance_cap` fires and the supervisor didn't escalate (AT-5 scenario), the debugger must know (a) what Track 3 is, (b) that the event is `reentrance.cap_hit`, (c) how the structured error propagates. No single doc lays this out.

### Missing artifacts
- [ ] **"What got deleted in Sprint 13 and why"** — one-page changelog aimed at future contributors, with pointers to SCP/ADR.
- [ ] **Architecture diagram refresh** — ADR-014 post-amendment, showing the port seam (S4) and the playbook format pivot (S3).
- [ ] **README at the top of `packages/sprint-core/src/features/`** listing canonical features + deprecated/deleted ones (with grave markers and backlinks).
- [ ] **Runbook entry for `reentrance.cap_hit`** — what it means, how to diagnose, how to clear.
- [ ] **Story↔Session↔Commit triangle doc** — the three IDs, how they link, how to navigate from each.

### Verdict
**Also high-value.** The sprint built real infrastructure but the "shelf-wear" — the deletions, the deferrals, the pivots — demands narrative glue that wasn't produced. This isn't a criticism of speed; it's a flag that the *next* sprint should spend 10–15% of capacity on maintenance-facing narrative. Otherwise the clarity gains from deletions are eroded by the archaeology cost.

---

## Synthesis — Three Adversarial Lenses Converge

All three adversaries land on variations of the same root concern:

> **EA12 did the right work inside a questionable decision to do *another* review instead of a real run. The technical output is high quality; the epistemic output (what do we actually know now?) is thinner than it looks.**

- Economist: no empirical signal was added — compound review debt.
- Attacker: new attack surfaces without a threat model.
- Future Maintainer: narrative glue for the deletions was skipped.

**Common remedy:** the next sprint's first story should be **a real orchestrator run on a real (even trivial) epic**, not another planning artifact.

---

## Key Patterns

### Pattern 1 — Adversarial Review as Sprint Scope Generator
SCP 2026-04-15 → EA12 = 7 arbitrages → 7 stories, same day. Tight feedback loop. **Replicable if (and only if) followed by a real-run sprint to pressure-test the conclusions.**

### Pattern 2 — Seam-First Deferral
EA12-S4 pattern: delete the old class, introduce the port, migrate all consumers, defer the production adapter behind DI. Zero runtime behavior change, full architectural benefit. Pattern works; label it "A6 seam done, A6 behavior pending" to avoid the "closed on paper" trap.

### Pattern 3 — Structured Errors Replace Exceptions
S5: `throw → { error, ... }`. Supervisor-readable, observable via events, testable as data. Rolling forward: every exception thrown into a supervisor boundary should become a structured return.

### Pattern 4 — Subtract-First Hardening
S3 (playbook simplified), S4 (class deleted), S5 (3 caps → 1), S7 (3 modules deleted). Hardening often means **removal** — fewer moving parts, less to misuse. Pattern to reuse in V1.1 and V1.2.

### Pattern 5 — Executable Architectural Contracts
S4's grep-invariant test codifies a rule. Replicate: every "zero X" claim should have a corresponding invariant test + allowlist with justification comments.

---

## Key Insights

1. **EA12 closes the "commit discipline + real SHA" gap from the V1.1 spec.** The product now produces commits indistinguishable (at signature level) from elzinko's hand-written commits. Major milestone.

2. **Two pivots (A5, A6) confirm the "less is more" architectural line.** The supervisor doesn't need a command map — it can discover BMAD. cop1 doesn't need to read BMAD state — it can invoke the BMAD workflow. Both moves cut code *and* coupling.

3. **The honest summary of Sprint 13 is "seam + simplification, behavior pending."** S1, S5, S6, S7 deliver real behavior. S4 delivers the seam only. S2 delivers a critical test without closing real-API coverage. S3 delivers a schema change. Net: solid, but the user-facing delta requires S4's deferred adapter + a real run to feel.

4. **The adversarial review mechanism has now fired twice (2026-04-14 readiness, 2026-04-15 architecture). It is cost-effective only if the third iteration is empirical.** The team has burned two cycles finding issues by reading its own code. The next cycle must find issues by *running* it.

5. **Documentation/narrative debt has crossed a threshold.** Deletions, deferrals, pivots, and amendments have outpaced the architecture document's ability to serve a new contributor. A 10-15% capacity allocation to narrative glue in the next sprint is recommended, not optional.

---

## Readiness Assessment

| Dimension | Status | Detail |
|---|---|---|
| Testing & Quality | **GOOD with caveats** | 648 tests passing, 0 new regressions. 9 pre-existing failures. S2 real adapter but mocked LLM. No real-run empirical coverage post-EA12. |
| Deployment | **N/A (internal)** | CLI subcommand wired; still not packaged (EA8 scope) |
| Stakeholder Acceptance | **PENDING real run** | elzinko has not yet run `cop1 orchestrator run` on a real epic post-EA12. Code review is the only validation channel |
| Technical Health | **IMPROVED** | Smaller codebase. Structured errors. Invariant tests. Port seam preserved under S4 deferral. ADRs amended in-sync |
| Security posture | **NEW SURFACES, UNVALIDATED** | S1 real commits + S2 real resume open attack surfaces (AT-1…AT-6) not yet threat-modeled. Red-team pass recommended |
| Documentation | **BEHIND CODE** | Deletions, deferrals, pivots not yet reflected in a maintainer-facing narrative |
| V1.1 "dogfooding unassisted" DoD | **MAJOR STEP, NOT CLOSED** | commit_anchor ✅, recovery test ✅, playbook/coupling pivots ✅, story↔session wiring ⏳, real-run validation ❌ |

**Verdict:** EA12 is a **high-quality sprint that moved V1.1 readiness from 40% to ~65%**, but the final 35% is **empirical, not architectural** — it requires real use, threat modeling, and narrative catchup.

---

## Significant Discovery

### Discovery 1 — The review loop has saturated without empirical input
Two adversarial reviews in five days, both producing valuable technical output, both operating entirely on the codebase as text. The economic lens (Review #1) and the team's own instinct (elzinko: "tourner le bouton") agree: the next review must come from a real run, not a reader. **Meta-rule candidate: no two consecutive "review-driven" sprints without a "run-driven" sprint between them.**

### Discovery 2 — Partial deferrals need a distinct status label
`done` is too strong for S4. `done-with-deferral` or `seam-done` would have been more honest. The sprint-status vocabulary may need a new value. Candidate: `partial` with a mandatory `deferred:` field in the story frontmatter enumerating what remains. This matters because the invariant ("A6 closed") is referenced elsewhere (retro tracking, SCP completion reports) and propagates the "closed" misperception.

### Discovery 3 — Architecture document has drift from code
ADR-014 is marked Accepted 2026-04-11. SCP 2026-04-15 amends §3.3 and §5.7. EA12 implements the amendments. The ADR body says one thing; the code does another; the SCP is where reconciliation lives. **Working-as-designed** if everyone reads the SCP, but a new contributor reads ADRs. The amendment format (append-only) is correct but the reader experience is fractured.

---

## Action Items

### For the Next Sprint (EA13 or V1.1 Hardening #2 or "Real-Run Shakedown")

| # | Action | Owner | Priority | Success Criteria |
|---|---|---|---|---|
| 1 | **Real orchestrator run on a real epic** (internal trivial epic, even 1 story). Produce a run report capturing: which tools were invoked, what the LLM did, what broke, what commits were produced | elzinko + Charlie | **HIGH (BLOCKER for next review)** | Report file `_bmad-output/implementation-artifacts/real-run-report-<date>.md` committed; at least one real commit produced by orchestrator |
| 2 | **Ship the deferred `BmadCommandStatusAdapter`** (S4 follow-up). Wire `/bmad-bmm-sprint-status` invocation into the SprintStatusPort. Remove the YAML adapter from allowlist | Charlie | **HIGH** | Runtime no longer reads `sprint-status.yaml` directly. Invariant test passes with smaller allowlist |
| 3 | **Security hardening mini-pass** (AT-1 through AT-6). One story, 6 checks, threat-model doc | Isabelle / Charlie | **HIGH** (before external dogfooding) | Checklist shipped + mitigations where hits |
| 4 | **Story↔Session↔Commit triangle wiring** (previous retro #3 MEDIUM, still open). Mutate story file on run completion: Debug Log References + File List + session log in same commit | Charlie | **MEDIUM** | Orchestrator run produces a story commit containing its own session log reference |
| 5 | **Narrative catchup pass.** Delete-log, architecture diagram refresh, runbook for `reentrance.cap_hit`, feature-folder README, Story↔Session↔Commit nav doc | Elena + Frank | **MEDIUM** | 5 artifacts shipped in `docs/` or equivalent |
| 6 | **Real-API smoke test for session recovery** (S2 follow-up). Opt-in, token-budgeted, runs a single turn with real Anthropic call then resumes | Dana | **MEDIUM** | Smoke script committed; docs say when to run |

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|---|---|---|
| 7 | Introduce sprint-status value `partial` with mandatory `deferred:` field to avoid "closed on paper" pattern | Bob (SM) | sprint-status schema updated; S4 retroactively tagged |
| 8 | Rule candidate: no two consecutive review-driven sprints without a run-driven sprint between them | Bob (SM) | iamthelaw rule candidate R13 proposed |
| 9 | Allowlist governance: every invariant allowlist entry must link to ADR/SCP; growing the allowlist requires SCP | Bob (SM) | Doc + lint rule for allowlist files |

### Technical Debt (carry-forward + new from EA12)

| # | Item | Priority | Owner | Note |
|---|---|---|---|---|
| D7 (carry) | `BMADCommandRunner` stub (EA10-S6) — real SprintRunner wiring | MEDIUM | Charlie | Related to AI #2 above |
| D8 (carry) | `SessionTranscriptGenerator` in `sprint-core` (circular dep) | LOW | Backlog | Functional |
| D9 (carry) | `MetricsWriter` fire-and-forget non-transactional | LOW | Backlog | Acceptable |
| D10 (carry) | Legacy `buildLegacySteps()` path still routable | LOW | Backlog | Warning emitted |
| D1–D6 (carry from EA9) | TS carry-overs, etc. | Carry-forward | Charlie | Progressive |
| D11 (new) | 9 pre-existing test failures still not owned | LOW-MED | TBD | Clear before external dogfooding |
| D12 (new) | A3 layer separation contract tests | LOW | Backlog | Non-blocking, quality-of-life |
| D13 (new) | A8 "Exit paths" doc subsection under D1 in architecture.md | LOW | Frank | Paper trail |
| D14 (new) | S4 deferred: `BmadCommandStatusAdapter` production wiring | HIGH | Charlie | See AI #2 |

### Team Agreements

- A partial-deferral must never be labeled `done` without an explicit `deferred:` field in the story frontmatter.
- Every invariant allowlist entry needs a backlink to the SCP/ADR that justifies it.
- No "review-driven" sprint may be chained with another without at least one "run-driven" sprint between them.
- New attack surfaces (commits, session-resume, external commands) must be accompanied by a threat-model checklist before external dogfooding.

---

## Next Epic Preview

**Status:** No next epic committed. EA13 (hypothetical) would be **"Real-Run Shakedown + Security Pass + Narrative Catchup"**.

Recommendation: before committing EA13 scope, run AI #1 (real orchestrator run) and let the failure modes define scope. Hold EA13 planning until the real-run report is on the table.

---

## Open Questions (deferred, not blocking retro closure)

1. **sprint-status vocabulary** — should we introduce `partial` status with `deferred:` field?
2. **ADR amendment format** — inline-amend the ADR or keep separate amendment docs? Current reader experience is fractured.
3. **Allowlist governance** — machine-enforceable (lint) or process-enforceable (PR review)?
4. **Real-API smoke test funding** — token budget for opt-in tests. Who pays, how often, triggered by what?
5. **EA6 cobaye** — still a priority, or does the "real-run shakedown" on an internal epic substitute?

---

## iamthelaw Rule Candidates (from EA12 lessons)

| # | Rule | Source |
|---|---|---|
| R13 | No two consecutive review-driven sprints without a run-driven sprint between them | Sprint 13 meta-criticism (convergent adversarial lenses) |
| R14 | Partial-deferral stories MUST carry a `deferred:` field enumerating what remains; `done` without `deferred:` implies full delivery | S4 "closed on paper" pattern |
| R15 | Every invariant allowlist entry MUST link to the SCP/ADR justifying it; growth requires SCP | S4 allowlist drift risk |
| R16 | New attack surfaces (git commits, session resume, external command execution) MUST ship with a threat-model checklist | S1/S2 new surfaces |
| R17 | Deleted modules MUST leave a deprecation trace (CHANGELOG entry + README backlink) | S7 invisible deletions |
| R18 | Structured-error returns crossing an LLM boundary MUST have a pre-LLM shim converting them into control-flow | S5 AT-5 risk |

---

## Commitments Summary

- **Action Items:** 9 (6 HIGH/MED technical, 3 process)
- **Technical Debt Items:** 4 new + 6 carry-forward
- **Team Agreements:** 4
- **Critical Path Items:** 1 (Real orchestrator run — blocks next review)
- **Significant Discoveries:** 3 (review saturation, partial-done vocabulary, ADR drift)
- **iamthelaw Rule Candidates:** 6 (R13–R18)

---

## Next Steps for elzinko

1. **Review this retro** and confirm the adversarial synthesis matches your reading.
2. **Run `cop1 orchestrator run`** on a trivial real epic before any further planning work.
3. **Decide next-sprint shape** — Real-Run Shakedown vs. EA13 vs. mixed. Consider holding the decision until the run report is available.
4. **Consider the "partial" status** — quick schema change that would make future sprints more honest.
5. **Mark `epic-ea12-retrospective` done** in sprint-status.yaml (handled by this workflow).

---

Bob (SM): « Beau sprint. Discipline de suppression exemplaire. Trois angles adverses convergent vers la même recommandation : maintenant, on tourne le bouton. »

Alice (PO): « Deux pivots livrés (A5 playbook, A6 coupling). C'est du tangible, même si A6 reste en partie derrière un port. »

Charlie (Senior Dev): « Le seam-first pattern tient. Le commit_anchor réel + le SHA single-pass : propres. Reste à exécuter. »

Dana (QA): « Recovery test réel avec adapter réel — un gap V1.1 critique fermé. LLM mocké mais lifecycle réel. Incontournable pour le sign-off dogfooding. »

Mallory (Red Team): « Six surfaces d'attaque ouvertes, zéro menace modélisée. Petit travail, gros ROI — avant dogfooding externe. »

Ops (Future Maintainer): « La documentation n'a pas suivi la démolition. 10–15% capacité narrative next sprint, sinon la clarté des suppressions s'érode. »

elzinko (Project Lead): « Prochaine action : tourner le bouton sur un epic réel, même trivial. »

— **Fin de la rétrospective EA12** —
