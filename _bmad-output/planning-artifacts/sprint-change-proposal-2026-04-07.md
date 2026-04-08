# Sprint Change Proposal — EA10 Supervisor Orchestrator

- **Date**: 2026-04-07
- **Author**: elzinko (facilitated by BMad SM)
- **Status**: Draft — pending approval
- **Mode**: Incremental

---

## Section 1 — Issue Summary

**Problème identifié**
cop1 ne dispose d'aucune fonction de transition d'état au niveau **commandes BMAD**. `SprintRunner` orchestre bien les *steps internes cop1* (`BMADDevStoryStep → BMADReviewStep → ...`) mais l'enchaînement des commandes BMAD elles-mêmes (`sprint-planning → create-story → dev-story → code-review → retrospective`, bouclé sur N stories d'un sprint) reste piloté manuellement par un humain depuis Claude Code.

Conséquence : les ambitions de cop1 — exécuter un sprint complet sans intervention humaine — ne sont pas atteignables avec le scope actuellement planifié, peu importe combien d'epics restantes (EA3-EA8) sont livrées.

**Contexte de découverte**
Identifié à la clôture d'EA9 (Sprint 11, 2026-04-07). EA9 a livré `BMADSessionPort`, `SupervisorLLMPort` et `SupervisorService`, qui résolvent le problème **intra-session** (répondre automatiquement aux `AskUserQuestion` qu'un agent BMAD pose pendant l'exécution d'**une** commande). EA9 ne traite pas le problème **inter-commandes** : qui décide qu'après `dev-story` il faut lancer `code-review` puis `retrospective` ? Qui itère sur les stories du sprint ?

L'epic EA8-S6 ("Agent superviseur — V2/Future") était un placeholder créé pour capturer cette intention sans la spécifier. Le travail sur EA9 a révélé que (a) la complexité réelle est celle d'une epic complète (~6 stories) et (b) la criticité est V1, pas V2, car aucune autre epic restante ne couvre cette fonction.

**Évidence concrète**
- Sprint-status.yaml : aucune entrée "Orchestrator", "Playbook", "CommandSequencer" dans EA1-EA9.
- `SupervisorService` (EA9-S3) : périmètre documenté = "answer questions during a single BMAD command session" — pas de boucle inter-commandes.
- EA8-S6 : 1 ligne de description, pas de stories enfants, pas d'AC — preuve que l'intention n'avait jamais été mise au format spec.
- Mode opératoire actuel d'un sprint : un humain lance manuellement `bmad sprint-planning`, puis pour chaque story `bmad create-story` → `bmad dev-story` → `bmad code-review`, puis `bmad retrospective` en fin d'epic. Soit ~4 invocations × N stories + 2 par sprint. À chaque invocation l'humain doit décider du plan, choisir des elicitations, et confirmer.

**Pourquoi maintenant (et pas plus tard)**
EA9 vient de livrer le pré-requis technique : sessions BMAD pilotables programmatiquement via `BMADSessionPort`. C'est la première fois que cop1 a tout en main pour construire l'orchestrateur. Repousser après EA6/EA7/EA8 = continuer 4 sprints supplémentaires en mode manuel et prendre le risque que les autres epics soient designées sans tenir compte de l'existence d'un orchestrateur (couplages oubliés).

**Zone de risque principale identifiée dès le départ**
La complexité réelle d'EA10 ne réside pas dans la boucle de séquencement (mécaniquement simple) mais dans les **politiques de décision automatique** : quand BMAD propose un plan, comment juger qu'on peut le valider sans humain ? Quand BMAD propose 8 elicitations, sur quels critères en choisir 3 ? Si ces policies sont faibles, l'orchestrateur produit des sprints divergents de l'intention. Tout effort de design devra prioriser cette zone (cf. EA10-S3 dans le découpage).

---

## Section 2 — Impact Analysis

### 2.1 Epic Impact

| Epic | Status | Impact | Action |
|---|---|---|---|
| **EA8** Distribution & Dogfooding | backlog (S13-14) | EA8-S6 "Agent superviseur (V2/Future)" devient redondant | Supprimer EA8-S6 ; note "subsumé par EA10" |
| **EA9** Multi-Turn BMAD Interaction | in-progress | Aucun ; EA10 consomme `BMADSessionPort` + `SupervisorService` | Documenter EA10 comme consumer dans la retro EA9 |
| **EA6** Acceptance Test Harness | backlog (S12) | EA10-S6 sera premier client du harness | Mentionner EA10-S6 comme cible dans EA6 |
| **EA3** Enhanced Dashboard | backlog (S16→S17) | Devra exposer états orchestrateur | Note "intégration EA10" dans description |
| **EA4** Auto-Retro | backlog (S17→S18) | Sera déclenchée par orchestrateur | Dépendance souple `EA4 ← EA10` |
| **EA7** iamthelaw BMAD module | backlog (S14-15→S15-16) | Aucun | RAS |
| **EA1, EA2, EA5** | done | Aucun | RAS |

**Nouvelle epic EA10 — Supervisor Orchestrator**

| Story | Title | Size | Dépendances |
|---|---|---|---|
| EA10-S1 | SupervisorPlaybookLoader (parser markdown) | S | — |
| EA10-S2 | OrchestratorService (boucle principale) | M | EA10-S1, EA9-S1, EA9-S3 |
| EA10-S3 | Auto-decision policies (plan + elicitations + validation) | **L** | EA10-S2, EA9-S2 |
| EA10-S4 | Mode `--step-by-step` (pause/resume) | S | EA10-S2 |
| EA10-S5 | CLI `cop1 orchestrator run` + `--abort-on-escalation` | S | EA10-S2, EA10-S4 |
| EA10-S6 | Integration test end-to-end | M | EA10-S1..S5, EA6 |

EA10-S3 = risque #1.

### 2.2 Story Impact

- **EA8-S6** : retiré du sprint-status.yaml et de epics.md (marqué `subsumed-by: EA10`).
- **EA9-S3** : description amendée pour clarifier "intra-session uniquement" (optionnel, traité dans la retro EA9).
- Aucune autre story existante modifiée.

### 2.3 Artifact Conflicts

| Artifact | Action |
|---|---|
| `epics.md` | Ajouter EA10 complet ; retirer EA8-S6 |
| `sprint-status.yaml` | Ajouter EA10-S1..S6 ; retirer EA8-S6 ; resequencer EA8/EA7/EA3/EA4 |
| `architecture.md` | Section "Supervisor Orchestrator (EA10)" + ADR-013 (Orchestrator vs SprintRunner) |
| `project-context.md` | 1 paragraphe : EA10 = brique débloquant le DoD "sprint autonome" |
| PRD / UI/UX / CI-CD | RAS ou impact mineur traité dans EA10-S5 |

### 2.4 Technical Impact

- **Localisation** : démarrer comme feature dans `packages/app/src/features/orchestrator/` (cohérent avec `daemon`, `bmad-bridge`). Extraction vers package séparé seulement si réutilisation prouvée. Décision = ADR-013.
- **Format playbook** : markdown standard (H2 = phases, listes = commandes). **Pas de DSL custom** — si plus de pouvoir expressif est nécessaire, basculer vers `_bmad/core/tasks/workflow.xml` plutôt que d'inventer (cf. pre-mortem #2).
- **Logging** : nouveau niveau `auto-decision` dans `.cop1/sprint-log-*.jsonl` (extension de E11-S4).
- **Kill-switch** : `--step-by-step` et `--abort-on-escalation` obligatoires *avant* premier run nocturne. EA10-S4/S5 ne peuvent pas être déprioritisés.
- **Bug BMADReader** : risque retiré par construction (l'orchestrateur passe par BMADSessionPort, pas par lecture statique).
- **SprintRunner coexistence** : l'orchestrateur **appelle** `SprintRunner` (qui pilote les steps internes par story) plutôt que de le remplacer. À trancher définitivement dans ADR-013.

### 2.5 Resequencing

| Sprint | Avant | Après |
|---|---|---|
| S11 | EA9 | EA9 (inchangé) |
| S12 | EA6 | EA6 (inchangé) |
| **S13** | EA8 (start) | **EA10 (NOUVEAU)** |
| S14-15 | EA8 / EA7 | EA8 (sans S6) |
| S15-16 | EA7 / EA3 | EA7 |
| S17 | EA4 | EA3 |
| S18 | — | EA4 |

Coût : +1 sprint sur l'horizon V1. Bénéfice : DoD "sprint autonome" devient atteignable, epics aval designées en connaissance de l'orchestrateur.

---

## Section 3 — Recommended Approach

**Option sélectionnée** : **Option 4 — Hybrid** (nouvelle epic EA10 + resequencing).

Évaluation des alternatives :
- **Direct Adjustment (étendre EA8-S6)** : non viable, mélange orchestration et dogfooding dans une même epic.
- **Rollback** : non pertinent, EA9 est correct et nécessaire — il faut compléter, pas défaire.
- **PRD MVP Review** : incohérent avec l'intention, réduire le scope = abandonner le DoD "sprint autonome".

Justification :
1. Cohérence architecturale : une epic = une préoccupation (orchestration inter-commandes BMAD).
2. Débloque le DoD V1 "sprint autonome".
3. Timing technique optimal : EA9 vient de livrer les pré-requis.
4. Coût acceptable : +1 sprint pour la fonctionnalité la plus différenciante.
5. Risques identifiés et mitigés dès le départ (EA10-S3 auto-decision policies = risque #1).

Effort : ~6 stories, 1 sprint (dont 1 L). Risque : Medium. Timeline impact : +1 sprint (V1 close S18 au lieu de S17).

**DoD epic EA10** :
1. Un fichier `supervisor-playbook.md` à la racine décrit la séquence canonique.
2. L'orchestrateur exécute `create-story → dev-story → code-review → retrospective` de bout en bout sur au moins une story fixture du projet cobaye EA6 (pas une run cop1-on-cop1) sans intervention humaine.
3. Tous les choix automatiques loggés dans `.cop1/sprint-log-*.jsonl` avec événements `auto-decision` structurés.
4. Mode `--step-by-step` (transition-level) disponible.
5. Mode `--abort-on-escalation` stoppe proprement sur escalation SupervisorService.
6. ADR-013 documente la séparation Orchestrator / SprintRunner et la décision sur le format playbook.

---

## Section 4 — Detailed Change Proposals

### Patch 1 — `epics.md` : retirer EA8-S6 et marquer subsumed

Ligne 1017 :
```diff
- - **EA8-S6** : Agent superviseur (V2/Future) — Future
+ - ~~**EA8-S6** : Agent superviseur (V2/Future)~~ — **subsumed by EA10** (SCP 2026-04-07)
```

Ligne 1187 (section Future) :
```diff
- - EA8-S6 (Agent superviseur V2) — requires mature supervisor data
+ (EA8-S6 retiré — voir EA10 Supervisor Orchestrator, SCP 2026-04-07)
```

### Patch 1bis — `epics.md` : amender EA8-S5 (disambiguation avec EA10-S4)

Ligne 1016 :
```diff
- - **EA8-S5** : Mode step-by-step (--step-by-step flag) — Sprint 14
+ - **EA8-S5** : Mode step-by-step intra-command (pause between internal pipeline steps inside one BMAD command — complements the inter-command pause of EA10-S4) — Sprint 15
```

Ligne 1024 (DoD EA8) :
```diff
- - --step-by-step flag pauses SprintRunner before each pipeline step for human validation
+ - --step-by-step flag pauses SprintRunner before each internal pipeline step (intra-command); complements EA10-S4 which pauses between BMAD commands (inter-command)
```

### Patch 2 — `epics.md` : nouvelle section Epic EA10

Insérer après ligne 1068 (entre fin EA9 et "## Sprint Ordering") :

```markdown
### Epic EA10 — Supervisor Orchestrator

> Added 2026-04-07 — Sprint Change Proposal approved. Subsumes the placeholder EA8-S6. BLOCKING for V1 DoD "autonomous sprint": no other planned epic provides inter-command BMAD orchestration.

**User Value:** "cop1 executes a complete sprint end-to-end (sprint-planning → for each story: create-story → dev-story → code-review → retrospective) without human intervention, driven by an editable markdown playbook."

**Technical approach:**
- New feature module `packages/app/src/features/orchestrator/`
- `SupervisorPlaybookLoader` parses a markdown playbook (`supervisor-playbook.md`) describing the canonical BMAD command sequence
- `OrchestratorService` is the main loop: reads playbook, drives BMAD sessions sequentially via `BMADSessionPort` (EA9-S1), reuses `SupervisorService` (EA9-S3) for intra-session question handling
- Auto-decision policies (plan validation, elicitation selection, response validation) backed by `SupervisorLLMPort` (EA9-S2)
- Modes `--step-by-step` (transition-level pause between BMAD commands) and `--abort-on-escalation` (clean stop on supervisor escalation)
- All automatic decisions logged with structured event level `auto-decision` in `.cop1/sprint-log-*.jsonl`
- ADR-013 documents Orchestrator vs SprintRunner separation and the playbook format decision

**Package principal:** `@cop1/app` (feature `orchestrator`)

**Dependencies:** EA9 complete (BMADSessionPort, SupervisorService, SupervisorLLMPort), EA6 (acceptance test harness for EA10-S6)

**Stories:**

- **EA10-S1** : SupervisorPlaybookLoader — Markdown parser for `supervisor-playbook.md`. H2 sections = phases, ordered lists = commands. Validates references to BMAD commands. Unit tests with sample playbooks. (Sprint 13, Small)
- **EA10-S2** : OrchestratorService — Main loop reading playbook and driving BMAD sessions sequentially via `BMADSessionPort`. Wires `SupervisorService` for intra-session questions. State persistence to `sprint-status.yaml` on each transition. Unit tests with mocked session port. **AC: ADR-013 drafted and committed before PR is merged.** Depends: EA10-S1, EA9-S1, EA9-S3. (Sprint 13, Medium)
- **EA10-S3** : Auto-decision policies — Plan validation policy (single-plan auto-validate), elicitation selection policy (LLM picks top-3 most relevant via `SupervisorLLMPort`), response validation policy. Structured `auto-decision` log events with inputs/outputs/justification. **Risk #1 story** — mitigation: build a standalone LLM-judge harness (input: plan proposal or elicitation list; output: decision + justification), validated against 10-20 hand-labeled BMAD outputs, before wiring into OrchestratorService. Depends: EA10-S2, EA9-S2. (Sprint 13, Large)
- **EA10-S4** : Mode `--step-by-step` — Transition-level pause between BMAD commands (distinct from the EA8-S5 intra-command step-level pause to be delivered in Sprint 15). Persists pending state, allows manual approval. Depends: EA10-S2. (Sprint 13, Small)
- **EA10-S5** : CLI `cop1 orchestrator run` — New CLI entrypoint with flags `--playbook <path>`, `--step-by-step`, `--abort-on-escalation`. Wires composition root. Depends: EA10-S2, EA10-S4. (Sprint 13, Small)
- **EA10-S6** : Integration test end-to-end — Runs the orchestrator on at least one fixture story from the EA6 cobaye project (not a cop1-on-cop1 run, to avoid circular fragility during EA10 bring-up) from `create-story` through `retrospective` without human intervention. Uses EA6 acceptance test harness as the test runner. Validates DoD criterion #2. Depends: EA10-S1..S5, EA6. (Sprint 13, Medium)

**Definition of Done:**
- A `supervisor-playbook.md` file at the project root describes the canonical BMAD command sequence
- The orchestrator executes `create-story → dev-story → code-review → retrospective` end-to-end on **at least one fixture story from the EA6 cobaye project** without human intervention (validated via EA10-S6)
- All automatic decisions (plan, elicitations, response validation) are logged in `.cop1/sprint-log-*.jsonl` with structured `auto-decision` events including inputs, outputs, and LLM justification
- `--step-by-step` mode pauses the orchestrator before each transition for manual validation
- `--abort-on-escalation` mode: when `SupervisorService` raises an escalation, the orchestrator stops cleanly, persists state, and notifies
- ADR-013 documents Orchestrator vs SprintRunner separation and the playbook format decision (markdown standard, no custom DSL — fall back to BMAD `workflow.xml` if more expressive power is needed)

**ADR Reference:** ADR-013 (to be drafted during EA10-S2)

**Risks identified upfront:**
1. **Auto-decision policies (EA10-S3)** = risk #1. Mitigation: standalone LLM-judge prototype before integration, mandatory `--step-by-step` testing in CI before nightly runs.
2. **Playbook format drift** toward custom DSL. Mitigation: hard rule "if more expressive power is needed, switch to BMAD workflow.xml format, do not extend the markdown parser".
3. **Fragile e2e test**: EA10-S6 must run on an EA6 fixture story. Mitigation: EA6 harness must be delivered before EA10 starts (dependency resolved by Sprint 12 → Sprint 13 sequencing).

---
```

### Patch 3 — `epics.md` : Sprint Ordering resequencing (Sprint 13 → Sprint 18)

Remplacer le bloc Sprint 13 à Sprint 17 (lignes 1157-1183) par :

```markdown
### Sprint 13 — Supervisor Orchestrator (SCP 2026-04-07, BLOCKING V1 DoD)
- EA10-S1 (SupervisorPlaybookLoader)
- EA10-S2 (OrchestratorService) — after S1
- EA10-S3 (Auto-decision policies) — after S2, **L story, risk #1**
- EA10-S4 (Mode --step-by-step inter-command) — after S2
- EA10-S5 (CLI cop1 orchestrator run) — after S4
- EA10-S6 (Integration test end-to-end) — after S5, depends on EA6
- **Goal:** Autonomous BMAD command sequencing — V1 DoD "autonomous sprint" unblocked

### Sprint 14 — Distribution & Dogfooding Start
- EA8-S1 (Pre-flight checks)
- EA8-S2 (Worktree → PR creation flow)
- EA8-S3 (Module BMAD cop1-method scaffold)
- **Goal:** cop1 installable on any project, PR creation from worktree

### Sprint 15 — Distribution Finish + Initial Rules
- EA8-S4 (Graceful shutdown + checkpoint)
- EA8-S5 (Mode step-by-step intra-command — complements EA10-S4)
- EA7-S7 (Create initial rules R1-R5 + sidecar activation)
- **Goal:** Robust dogfooding mode + governance baseline

### Sprint 16 — iamthelaw Module + Budget
- EA7-S1 to EA7-S6 (iamthelaw BMAD module complete)
- EA2-S3, EA2-S4, EA2-S5 (Budget alerts + pre-call check + CLI)
- **Goal:** Full rule governance + budget observability

### Sprint 17 — Enhanced Dashboard
- EA3-S1..S7 (Replay + Overview + Scrum Metrics + Budget + Ceremonies + UX Preview)
- **Prerequisite:** UX design with Sally + integration with EA10 orchestrator state

### Sprint 18 — Auto-Retro & Scrum Loop
- EA4-S1..S6 (DoR Gate + Smart abandonment + BMAD retro + rules loop)
- **Goal:** Autonomous sprint-to-retro loop, closed improvement cycle, V1 complete
```

### Patch 4 — `sprint-status.yaml` : retirer EA8-S6, ajouter EA10

Ligne 304 :
```diff
-  EA8-S6: backlog    # Agent superviseur (V2/Future) — Future
+  # EA8-S6 removed — subsumed by EA10 (SCP 2026-04-07)
```

Insérer après ligne 317 (fin EA9 block) :
```yaml

  # --- Epic EA10 — Supervisor Orchestrator (Sprint 13) ---
  # Added 2026-04-07 — Sprint Change Proposal approved
  # Subsumes EA8-S6. BLOCKING for V1 DoD "autonomous sprint".
  epic-ea10: backlog
  EA10-S1: backlog   # SupervisorPlaybookLoader (markdown parser) — Sprint 13
  EA10-S2: backlog   # OrchestratorService (main loop) — Sprint 13 (depends: EA10-S1, EA9-S1, EA9-S3)
  EA10-S3: backlog   # Auto-decision policies — Sprint 13 (depends: EA10-S2, EA9-S2) — RISK #1
  EA10-S4: backlog   # Mode --step-by-step inter-command — Sprint 13 (depends: EA10-S2)
  EA10-S5: backlog   # CLI cop1 orchestrator run — Sprint 13 (depends: EA10-S2, EA10-S4)
  EA10-S6: backlog   # Integration test end-to-end on EA6 cobaye fixture — Sprint 13 (depends: EA10-S1..S5, EA6)
  epic-ea10-retrospective: optional
```

### Patch 5 — `architecture.md` : annoncer ADR-013

Ancre identifiée : insérer un stub après ligne 1121 (fin ADR-012, avant "### Structure de packages complète" ligne 1122) :

```markdown
### ADR-013 — Supervisor Orchestrator vs SprintRunner Separation (EA10)

> Status: **Draft stub** — full content to be written during EA10-S2 (Sprint 13). Placeholder created 2026-04-07 by SCP.

**Context:** EA10 introduces a new `OrchestratorService` that drives inter-command BMAD sequencing (create-story → dev-story → code-review → retrospective) from a markdown playbook. This raises the question of how it relates to the existing `SprintRunner`, which orchestrates intra-command pipeline steps (BMADSessionStep, etc.).

**Decision (to be finalized in EA10-S2):** The `OrchestratorService` **calls** `SprintRunner` for each BMAD command rather than replacing it. Playbook format = markdown standard; if more expressive power becomes necessary, switch to BMAD `workflow.xml` format rather than extending the markdown parser.

**Consequences:** TBD during EA10-S2.
```

### Patch 6 — `project-context.md` : 1 paragraphe sur EA10

Insérer dans la section Roadmap (localisation exacte à identifier au moment de l'application) :

```markdown
**EA10 — Supervisor Orchestrator (Sprint 13, ajouté SCP 2026-04-07)** : Brique débloquant le DoD V1 "sprint autonome". L'orchestrateur pilote la séquence des commandes BMAD à partir d'un playbook markdown éditable, en s'appuyant sur les sessions multi-tour livrées par EA9. Subsume le placeholder EA8-S6.
```

---

## Section 5 — Implementation Handoff

**Scope classification** : **Moderate** — nouvelle epic + resequencing de 5 sprints, pas de refonte PRD/architecture fondamentale. Nécessite coordination SM/PO, pas d'escalation PM/Architecte.

**Handoff recipients** :
1. **Scrum Master (SM)** : application des patches 1, 1bis, 2, 3, 4 (epics.md et sprint-status.yaml) dans la même commit. Re-communiquer le resequencing à l'équipe.
2. **Architect (ou SM acting)** : application du patch 5 (architecture.md stub ADR-013). Contenu détaillé différé à EA10-S2.
3. **PM (ou elzinko acting)** : application du patch 6 (project-context.md).
4. **Dev team** : au démarrage de Sprint 13, première action = EA10-S1 (SupervisorPlaybookLoader), puis chaîne séquentielle. EA10-S3 doit commencer par la construction du LLM-judge harness isolé avant wiring.

**Deliverables** :
- [ ] `sprint-change-proposal-2026-04-07.md` (ce document) finalisé et committé
- [ ] Patches 1, 1bis, 2, 3 appliqués à `epics.md`
- [ ] Patch 4 appliqué à `sprint-status.yaml`
- [ ] Patch 5 appliqué à `architecture.md`
- [ ] Patch 6 appliqué à `project-context.md`
- [ ] Commit unique contenant tous les patches avec message référençant la SCP
- [ ] Verification : `grep "Sprint 13" epics.md sprint-status.yaml` doit confirmer cohérence EA10

**Success criteria (epic EA10)** :
- DoD epic EA10 (6 critères ci-dessus) satisfait à la clôture de Sprint 13
- ADR-013 committé avant fin EA10-S2
- Integration test EA10-S6 vert sur story fixture EA6

**Next steps post-approval** :
1. Appliquer les patches 1 à 6 au repo (Edit tools)
2. Afficher un récap final avec liste des fichiers modifiés
3. Proposer un commit message et attendre le GO utilisateur avant de commiter

