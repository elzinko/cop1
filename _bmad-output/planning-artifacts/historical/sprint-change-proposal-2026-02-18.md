# Sprint Change Proposal — Real Sprint Execution in Worktree + LLM Agent Wiring

**Date:** 2026-02-18
**Author:** elzinko (via Correct Course workflow)
**Change Scope:** Moderate
**Status:** Approved
**Supersedes:** Previous sprint-change-proposal-2026-02-18 (simulate mode — now evolved)

---

## Section 1: Issue Summary

### Problem Statement

The vision for `--simulate` has evolved: it is no longer a simulation but a **real sprint execution in an isolated git worktree**, with the same LLM agents as a normal run. The only difference: **no auto-merge** at the end — the developer inspects the worktree, validates, then merges manually.

This reveals a deeper issue: **the SprintRunner currently uses stub WorkflowSteps** that do nothing (100ms sleep → `{ status: 'ok' }`). The real agents (DevAgent with CodeGeneratorPort, ReviewerAgent with ReviewerPort) exist but are **not wired** to the LLM infrastructure (OllamaAdapter, LLMGateway, LLMRouter). There are also no concrete adapter implementations bridging the agent ports to the LLM gateway.

### Discovery Context

All 92 stories from Sprints 0-5 are implemented (394 tests passing). The architecture is clean: ports define what agents need (CodeGeneratorPort, ReviewerPort), infrastructure provides LLM access (OllamaAdapter, LLMGateway, LLMRouter), but the **composition root (SprintRunner) still uses stubs** instead of real agent implementations.

### Evidence

- `DevAgentStep.ts` (line 8-10): `async run() { await setTimeout(100); return { status: 'ok' }; }`
- `ReviewerAgentStep.ts`: identical stub
- `SprintRunner.ts` (lines 93-98): instantiates `new DevAgentStep()` — stub, not real `DevAgent`
- `CodeGeneratorPort`: interface only, no LLM-backed implementation exists
- `ReviewerPort`: interface only, no LLM-backed implementation exists
- `cop1.config.yaml`: file does not exist — ConfigLoader falls back to Zod defaults (empty llm_routing)

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Details |
|------|--------|---------|
| **Epic 3 — Sprint Engine Core** | **Modified** | Re-groom E3-S15 (worktree mode, not simulation) |
| **Epic 5 — LLM Infrastructure** | **Modified** | Add 1 story: LLM adapters for agent ports |
| **Epic 1 — Foundation** | **Modified** | Add 1 story: cop1.config.yaml for M3 Max |
| **New cross-cutting** | **Added** | 1 story: Wire real agents in SprintRunner composition root |

### Story Impact

**Re-groomed:**
- **E3-S15** — Complete rewrite: from "simulate mode" to "worktree execution mode with real agents, no auto-merge"

**New Stories:**
- **E5-S8** — LLM Agent Adapters: Create `LLMCodeGenerator` (implements CodeGeneratorPort) and `LLMReviewer` (implements ReviewerPort) using LLMGateway
- **E1-S6** — cop1.config.yaml for M3 Max: Create the config file with Ollama LLM routing for MacBook Pro M3 Max 64GB
- **E3-S16** — Wire Real Agents in SprintRunner: Replace stubs with real DevAgent + ReviewerAgent, inject LLM adapters via composition root

### Artifact Conflicts

| Artifact | Conflict | Action Needed |
|----------|----------|---------------|
| **PRD** | FR116 exists but needs rewording | Update FR116 to reflect real execution, not simulation |
| **Epics** | E3-S15 backlog entry exists but outdated | Complete rewrite of E3-S15 |
| **Epics** | Missing entries | Add E5-S8, E1-S6, E3-S16 |
| **Story file** | E3-S15 story file outdated | Rewrite story file |

### Technical Impact

- **New adapter files:** `LLMCodeGenerator.ts` (implements CodeGeneratorPort), `LLMReviewer.ts` (implements ReviewerPort)
- **Modified files:** `SprintRunner.ts` (composition root), `sprint-run.ts` (CLI --simulate flag)
- **New file:** `cop1.config.yaml` at project root
- **No new packages, no new dependencies**

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

4 stories total: 1 re-groomed (E3-S15) + 3 new (E5-S8, E1-S6, E3-S16).

### Rationale

1. **All building blocks exist** — OllamaAdapter, LLMGateway, LLMRouter, DevAgent, ReviewerAgent, WorktreeManager are all implemented and tested
2. **The gap is pure wiring** — creating adapter implementations for ports + updating the composition root
3. **Low risk** — hexagonal architecture means plugging in adapters is the intended extension point
4. **High value** — transforms cop1 from "sprint runner with stubs" to "real autonomous sprint execution"

### Effort & Timeline

| Story | Effort | Risk |
|-------|--------|------|
| E1-S6 (config) | 2 pts | Low |
| E5-S8 (LLM adapters) | 5 pts | Low |
| E3-S16 (wire SprintRunner) | 5 pts | Medium |
| E3-S15 (worktree mode) | 5 pts | Low |
| **Total** | **17 pts** | **Low-Medium** |

### Implementation Order (dependencies)

```
E1-S6 (config) ──────────┐
                          ├──→ E3-S16 (wire SprintRunner) ──→ E3-S15 (worktree mode)
E5-S8 (LLM adapters) ────┘
```

E1-S6 and E5-S8 can be done in parallel. E3-S16 depends on both. E3-S15 depends on E3-S16.

---

## Section 4: Detailed Change Proposals

### Change 1: Update FR116 in PRD

```
Document: prd.md
Section: Functional Requirements > Capability Area 2 — Agent Orchestration

OLD:
- FR116 : Le Developer peut exécuter un sprint en mode simulation (--simulate) dans un workspace isolé (.worktree/) — l'exécution complète (transitions, quality gates, checkpoints, events) se déroule sans modifier l'état réel du projet (.cop1/)

NEW:
- FR116 : Le Developer peut exécuter un sprint en mode worktree (--simulate) dans un git worktree isolé — les vrais agents LLM (DevAgent, ReviewerAgent) s'exécutent sur les stories, produisent du code réel, sans auto-merge. Le développeur inspecte le worktree et merge manuellement.

Rationale: Vision evolved from simulation to real execution in isolated worktree.
```

### Change 2: Re-groom E3-S15 in Epics Document

```
Document: epics.md
Section: Epic 3 stories list + backlog entry

OLD:
- **E3-S15** : Sprint Simulate Mode — `cop1 sprint run --simulate` exécute un sprint complet dans un workspace isolé `.worktree/` sans modifier `.cop1/` (FR116)

NEW:
- **E3-S15** : Worktree Execution Mode — `cop1 sprint run --simulate` exécute un sprint réel dans un git worktree isolé avec vrais agents LLM, sans auto-merge — le développeur inspecte et merge manuellement (FR116)

Rationale: Feature fundamentally changed from simulation to real isolated execution.
```

### Change 3: Add E5-S8 to Epic 5

```
Document: epics.md
Section: Epic 5 stories

NEW ENTRY in list:
- **E5-S8** : LLM Agent Adapters — `LLMCodeGenerator` implémente `CodeGeneratorPort` et `LLMReviewer` implémente `ReviewerPort` via LLMGateway + OllamaAdapter

NEW BACKLOG ENTRY:

#### [E5-S8] LLM Agent Adapters
> **5 pts** | Must Have | Bloqué par : E5-S1

- **AC1** : `LLMCodeGenerator` implémente `CodeGeneratorPort.generate(prompt)` en appelant `LLMGateway.completeForAgent('dev', prompt)`, collectant le stream complet, et retournant la réponse string
- **AC2** : `LLMReviewer` implémente `ReviewerPort.review(qualityReport)` en appelant `LLMGateway.completeForAgent('reviewer', qualityReport)`, parsant la réponse en `ReviewResult { verdict, comments }`
- **AC3** : Les deux adapters sont testés avec un `LLMProvider` mock retournant des réponses prédéfinies — aucune dépendance Ollama réelle dans les tests unitaires

Rationale: Bridge between agent ports and LLM infrastructure — the missing link.
```

### Change 4: Add E1-S6 to Epic 1

```
Document: epics.md
Section: Epic 1 stories

NEW ENTRY in list:
- **E1-S6** : cop1.config.yaml for M3 Max — fichier de configuration avec routing LLM Ollama pour MacBook Pro M3 Max 64GB

NEW BACKLOG ENTRY:

#### [E1-S6] cop1.config.yaml for M3 Max
> **2 pts** | Must Have | Bloqué par : E1-S3

- **AC1** : `cop1.config.yaml` existe à la racine du projet avec `llm_routing: { default: "llama3.2", dev: "llama3.2", reviewer: "llama3.2" }` — ConfigLoader le charge sans erreur de validation
- **AC2** : Les budgets RAM sont configurés pour M3 Max 64GB : `ram_budget_night_gb: 48`, `ram_budget_day_gb: 20`, `git.auto_merge: false`

Rationale: Required for LLMRouter to route agent commands to Ollama models.
```

### Change 5: Add E3-S16 to Epic 3

```
Document: epics.md
Section: Epic 3 stories

NEW ENTRY in list:
- **E3-S16** : Wire Real Agents in SprintRunner — remplacer les stubs DevAgentStep/ReviewerAgentStep par les vrais DevAgent/ReviewerAgent injectés avec LLMCodeGenerator/LLMReviewer via OllamaAdapter + LLMGateway + LLMRouter

NEW BACKLOG ENTRY:

#### [E3-S16] Wire Real Agents in SprintRunner
> **5 pts** | Must Have | Bloqué par : E5-S8, E1-S6

- **AC1** : `SprintRunner` instancie `OllamaAdapter`, `LLMGateway`, `LLMRouter`, puis crée `DevAgent(new LLMCodeGenerator(gateway))` et `ReviewerAgent(new LLMReviewer(gateway))` au lieu des stubs — vérifié par inspection du code
- **AC2** : `cop1 sprint run --dry-run` continue de fonctionner (aucun appel LLM en dry-run)
- **AC3** : `cop1 sprint run --filter "E3-S15"` sur une story de test appelle réellement Ollama, le DevAgent génère du code dans un worktree, le ReviewerAgent émet un verdict — les événements workflow sont émis sur l'EventBus

Rationale: Replace stubs with real implementations — the composition root is the only file that changes.
```

### Change 6: Rewrite E3-S15 Story File

Complete rewrite of `E3-S15-sprint-simulate-mode.md` (see story file content below).

### Change 7: Update FR Coverage Map

```
Document: epics.md
Section: FR Coverage Map

(FR116 already mapped to E3, no change needed — still mapped to E3)
```

---

## Section 5: Implementation Handoff

### Change Scope Classification: Moderate

4 stories across 3 epics, but all changes are **wiring/composition** — no new architectural patterns, no new packages.

### Handoff

| Recipient | Responsibility |
|-----------|---------------|
| **Development team** | Implement E1-S6, E5-S8, E3-S16, E3-S15 in dependency order |

### Implementation Order

1. **E1-S6** + **E5-S8** (parallel) — config file + LLM adapters
2. **E3-S16** — wire real agents in SprintRunner
3. **E3-S15** — add `--simulate` worktree mode

### Success Criteria

- `cop1 sprint run --simulate --filter "E3-S15"` runs a real sprint in an isolated git worktree with Ollama-backed agents
- DevAgent generates real code via Ollama LLM
- ReviewerAgent provides real code review verdict via Ollama LLM
- No auto-merge occurs — worktree preserved for manual inspection
- All existing 394 tests continue to pass
- Ollama must be running locally with a model pulled (e.g., `llama3.2`)
