---
workflow: check-implementation-readiness
date: 2026-04-14
project: cop1
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
assessor: Claude Opus 4.6 (PM+SM persona)
overall_status: NEEDS WORK (pending SCP 2026-04-14 application)
readiness_after_scp_application: READY
filesIncluded:
  prd: _bmad-output/planning-artifacts/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  architecture_adrs:
    - _bmad-output/planning-artifacts/adr-010-iamthelaw-integration-consultation.md
    - _bmad-output/planning-artifacts/adr-011-cop1-distribution-and-autonomous-orchestration.md
    - _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md
    - _bmad-output/planning-artifacts/adr-013-orchestrator-sprintrunner-separation.md
    - _bmad-output/planning-artifacts/adr-014-supervisor-tool-interface.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux: _bmad-output/planning-artifacts/ux-design-brief.md
  recent_change_context:
    - _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-11.md
    - _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-11-ea11-s8.md
    - _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-14-readiness-fixes.md
  previous_readiness_report: _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-13.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-04-14
**Project:** cop1

## Step 1 — Document Discovery

### Inventaire

| Type | Fichier | Taille | Dernière modif |
|---|---|---|---|
| PRD | `prd.md` | 70 Ko | 2026-04-14 |
| Architecture | `architecture.md` | 72 Ko | 2026-04-08 |
| ADR-010 | `adr-010-iamthelaw-integration-consultation.md` | 32 Ko | 2026-03-11 |
| ADR-011 | `adr-011-cop1-distribution-and-autonomous-orchestration.md` | 21 Ko | 2026-03-16 |
| ADR-012 | `adr-012-multi-turn-bmad-interaction.md` | 38 Ko | 2026-03-19 |
| ADR-013 | `adr-013-orchestrator-sprintrunner-separation.md` | 34 Ko | 2026-04-13 |
| ADR-014 | `adr-014-supervisor-tool-interface.md` | 58 Ko | 2026-04-11 |
| Epics | `epics.md` | 161 Ko | 2026-04-11 |
| UX | `ux-design-brief.md` | 11 Ko | 2026-02-23 |

### Contexte de changement récent (à prendre en compte pour l'évaluation)
- SCP 2026-04-11 (principal) + SCP 2026-04-11 EA11-S8 → ajout EA11, restructuration EA10
- SCP 2026-04-14 readiness-fixes → corrections issues du rapport 2026-04-13

### Conflits / lacunes
- ❌ Aucun doublon whole+sharded
- ❌ Aucun document requis manquant
- ℹ️ Rapport readiness précédent (2026-04-13) conservé pour comparaison des deltas

_Document inventory confirmé par l'utilisateur._

---

## Step 2 — PRD Analysis

**Source :** `_bmad-output/planning-artifacts/prd.md` (812 lignes, modifié 2026-04-14 post-SCP readiness-fixes) — lu intégralement.

### Functional Requirements

FRs totaux déclarés : **FR1 → FR144** avec **7 IDs fusionnés** lors du passage Occam Razor (2026-02-23) : FR124, FR127, FR128, FR132, FR133, FR134, FR136.
→ **117 FRs actifs** (FR52b inclus comme complément de FR52).

Découpage par Capability Area (selon PRD §Functional Requirements) :

| Capability Area | FRs |
|---|---|
| CA1 — Backlog Management | FR1-FR5, FR63-FR69, FR71, FR80 (17 FRs) |
| CA2 — Agent Orchestration | FR6-FR12, FR41-FR44, FR49, FR83-FR84, FR116-FR119, FR140-FR141 (21 FRs) |
| CA3 — LLM Infrastructure | FR13-FR17, FR47, FR52, FR52b, FR120, FR121 (10 FRs) |
| CA4 — Resource Management | FR18-FR21 (4 FRs) |
| CA5 — Code Production & Git | FR22-FR26, FR48, FR122, FR123, FR137, FR138 (10 FRs) |
| CA6 — Monitoring & Reporting | FR27-FR31, FR53, FR55, FR58, FR70, FR125, FR126, FR129, FR135, FR139 (15 FRs) |
| CA7 — Agile Ceremony Engine | FR45, FR46, FR50, FR51, FR54, FR79, FR81, FR82, FR85, FR86, FR87 (11 FRs) |
| CA8 — Configuration & Rules | FR32-FR35, FR56-FR62 (11 FRs) |
| CA9 — BMAD Interface & Versioning | FR72-FR78 (7 FRs) |
| CA10 — Developer Control | FR36-FR40, FR142-FR144 (8 FRs) |
| CA12 — LLM Provisioning & Docker *(added SCP 2026-04-14)* | FR88-FR92 (5 FRs) |
| CA13 — Quality Intelligence *(added SCP 2026-04-14)* | FR93-FR101 (9 FRs) |
| CA14 — Continuous Improvement *(added SCP 2026-04-14)* | FR102-FR108 (7 FRs) |
| CA15 — Day Sprint & Time-Boxing *(added SCP 2026-04-14)* | FR109-FR115 (7 FRs) |
| CA16 — Demo Agent & Visual Reporting *(renumbered from CA12)* | FR130, FR131 (2 FRs) |

**Note :** CA11 (Team Self-Improvement) n'apparaît pas comme header explicite dans le PRD — FR87 est référencé "CA11" dans la Coverage Map mais est physiquement documenté sous CA7 Agile Ceremony Engine. À flagger pour cohérence documentaire.

**FR Coverage Map (PRD §703-757) :** fournit le mapping FR → Capability Area → Epic → Phase pour l'intégralité des FRs actifs. Utile comme base de traçabilité pour le step 3 (Epic Coverage Validation).

### Non-Functional Requirements

NFRs totaux : **NFR1 → NFR34**, répartis en 7 catégories :

| Catégorie | NFRs |
|---|---|
| Performance | NFR1-NFR4 (4) |
| Security & Privacy | NFR5-NFR8, NFR28 (5) |
| Reliability & Resilience | NFR9-NFR12 (4) |
| Resource Management (M3 Max nuit) | NFR13-NFR16 (4) |
| Observability | NFR17-NFR20, NFR26, NFR27, NFR33, NFR34 (8) |
| Maintainability | NFR21-NFR24, NFR29-NFR32 (8) |
| *(ajouts récents)* | NFR25 présent ? — à vérifier |

**⚠️ Gap à investiguer en step 5 :** NFR25 est mentionné dans l'editHistory (`+8 NFRs (NFR25-NFR32)` — 2026-02-23) mais absent de la numérotation visible du PRD (sections Performance à Maintainability). Possible fusion ou oubli de ré-numérotation à valider.

### Additional Requirements / Constraints

Contraintes domaine et intégration (PRD §Domain-Specific Requirements) :
- **Hardware cible :** MacBook Pro M3 Max 64GB (~56GB RAM nuit disponibles)
- **Seuil suspension RAM :** 75% (≈48GB) — ramp-up progressif NFR14 par paliers de +10% / 15 min
- **Fichiers protégés :** `.env`, `pnpm-workspace.yaml`, configs racine — non modifiables par agents
- **Timeout tâche agent :** 30 min default, configurable
- **Git worktrees obligatoires** : isolation par story
- **Pre-commit obligatoire :** `pnpm typecheck && pnpm test`
- **Setup requis :** Docker Desktop (Ollama + LiteLLM), `.env` Anthropic, `pnpm install && pnpm dev`, `cop1.config.yaml`

### PRD Completeness Assessment (Initial)

**Points forts :**
- FR Coverage Map (section dédiée ajoutée 2026-04-14) — traçabilité FR ↔ Epic ↔ Phase explicite
- Dates et décisions SCP tracées en editHistory (frontmatter)
- Journey Requirements Summary mappe capacités ↔ journeys
- 3 tiers MVP explicites (Tier 1 circuit minimum / Tier 2 sécurité / Tier 3 observabilité)
- Sprint Roadmap FRs par horizon clairement découpé (Sprint 7 / 8-9 / 10+ / Growth)

**Points d'attention (à creuser en steps 3-5) :**
- 28 FRs importés verbatim depuis epics.md le 2026-04-14 (CA12/13/14/15) — vérifier qualité de l'import et absence de divergence sémantique avec les epics sources
- CA11 "Team Self-Improvement" référencée dans la Coverage Map mais sans header dédié dans le corps du PRD
- NFR25 cité dans l'editHistory mais non retrouvé en numérotation — gap ou fusion à documenter
- FR116 listé dans CA2 et cité comme "déjà couvert en CA2" dans CA15 — OK mais Coverage Map trace bien FR116 à CA2
- Phase tags NFR hors scope de l'édition 2026-04-14 (SCP §4.1.2/4.4 à traiter séparément) — risque cohérence à mentionner
- Re-tagging 2026-04-14 : FR121 MVP→E5-S13, FR125/126/129/135/139 MVP→Sprint 10+ — à vérifier alignement dans epics.md

---

## Step 3 — Epic Coverage Validation

**Source :** `_bmad-output/planning-artifacts/epics.md` (2585 lignes, modifié 2026-04-11) — lu structurellement (frontmatter, FR Coverage Map, epic list, stories).

### Epic inventory

**Original epics (E1-E12) :** 12 epics couvrant FR1-FR116 per épics coverage map (claim `116/116 — 100%`).
**Phase A pivot (EA1-EA5) :** BMAD command orchestration, budget, dashboard, auto-retro, sidecar sync.
**Post-pivot additions (EA6-EA11) :** acceptance harness (EA6), iamthelaw module (EA7), distribution/dogfooding (EA8), multi-turn BMAD (EA9), supervisor orchestrator (EA10 — 9 stories), orchestrator foundation (EA11 — 8 stories).

**Coverage map claim dans epics.md (L362-L399) :** `FR1-FR116 — 116/116 couverts à 100%`. **Stale** : le PRD va jusqu'à FR144 et la coverage map de l'epics n'a pas été mise à jour pour intégrer les FRs ajoutés post-2026-02-13.

### Coverage Matrix (delta PRD FR117-FR144 vs epics.md)

| FR | PRD tag | Expected Epic (PRD Coverage Map) | Actual in epics.md | Status |
|---|---|---|---|---|
| FR1-FR87 | MVP | E1-E12 | ✅ mapped in epics.md FR Coverage Map | ✅ Covered |
| FR88-FR92 | MVP Tier 1 / Phase 2 | E6 | ✅ E6-S1..S4 explicit FRs | ✅ Covered |
| FR93-FR101 | MVP Tier 2 / Phase 2 | E10 | ✅ E10 list mentions 9 FRs (`FR93-100`, `FR101 — E1/E10`) | ✅ Covered |
| FR102-FR108 | MVP Tier 2 / Phase 2 | E12 / E11 | ✅ epics.md maps `FR102-108 → E12/E11` | ✅ Covered |
| FR109-FR115 | Phase 2 Day Copilot | E3 / E7 / E11 | ✅ listed in CA15 epics inventory; E7-S5 covers FR110 | ✅ Covered |
| FR116 | MVP Tier 1 | E3 | ✅ E3-S15 explicit | ✅ Covered |
| **FR117** | Sprint 10+ | **Preview env epic (à créer)** | ❌ No preview-env epic exists in epics.md | ❌ **MISSING EPIC** |
| **FR118** | Sprint 10+ | Preview env epic | ❌ No preview-env epic | ❌ **MISSING EPIC** |
| FR119 | Growth | Growth (DemoAgent) | ❌ No DemoAgent epic | ⚠️ Deferred (Growth) — traceable gap |
| FR120 | Phase 2 | E5 (MCP per-agent) | ⚠️ E5-S5 covers FR47 (MCP registry) but FR120 per-agent config non-explicit | ⚠️ **Partial** |
| **FR121** | MVP (backend) | **E5-S13** (nouveau, SCP 2026-04-14 §7.2) | ❌ **E5-S13 n'existe pas encore dans epics.md** (SCP pas encore appliquée) | ❌ **MISSING STORY** |
| FR122 | Sprint 10+ | Preview env epic | ❌ | ❌ **MISSING EPIC** |
| FR123 | Growth | Growth | ❌ | ⚠️ Deferred (Growth) |
| FR125 | Sprint 10+ (re-tagged) | EA3 Dashboard | ✅ EA3-S3..S5 KPI/Budget views | ✅ Covered (re-tagged) |
| FR126 | Sprint 10+ | EA3 Dashboard | ⚠️ EA3-S2 Sprint Replay UI approche ; "pipeline view temps réel" non-explicite en AC | ⚠️ **Partial** |
| FR129 | Sprint 10+ | EA3 Dashboard | ⚠️ EA3-S1 Sprint Replay Engine (historique) proche ; navigation multi-sprints pas explicite | ⚠️ **Partial** |
| FR130-FR131 | Growth | Growth (DemoAgent) | ❌ Pas d'epic DemoAgent | ⚠️ Deferred (Growth) |
| FR135 | Sprint 10+ | EA3 Dashboard (APIs) | ⚠️ EA3 dépend d'APIs `/api/sprint/{id}/replay` ; endpoints KPIs/SonarQube non-listés | ⚠️ **Partial** |
| FR137 | Sprint 7 | EA1 (prompt enrichment) | ✅ EA1-S6 (Story context preparation) | ✅ Covered |
| FR138 | Sprint 10+ | EA1 (BMAD #yolo) | ⚠️ Implicite dans orientation EA1 ; pas de story dédiée | ⚠️ **Partial** |
| FR139 | Sprint 10+ | EA3 Dashboard (cold-start) | ❌ Non-explicite dans ACs EA3 | ⚠️ **Partial** |
| FR140 | Sprint 10+ | Preview env epic | ❌ | ❌ **MISSING EPIC** |
| FR141 | Growth | Preview env epic | ❌ | ⚠️ Deferred (Growth) |
| FR142-FR144 | MVP | EA2 (Claude budget) | ✅ EA2-S1..S6 (TokenBudget, alerts, CLI, CloudUsagePort) | ✅ Covered |

### NFR Coverage

**Revendiqué dans epics.md :** NFR1-NFR24 seulement (cf. §Requirements Inventory, frontmatter `totalNFRs: 24`).
**PRD actuel :** NFR1-NFR34.

**Gap NFRs :** NFR26, NFR27, NFR28, NFR29, NFR30, NFR31, NFR32, NFR33, NFR34 — **9 NFRs** listés dans la SCP 2026-04-14 §4.4.1 comme à mapper → **patchs 7.3/7.4 non encore appliqués dans epics.md** (vérifié : 0 occurrence NFR26-34 dans le fichier).

**Note :** NFR25 est absent à la fois de la numérotation visible du PRD ET d'epics.md → probable oubli ou fusion historique non tracée.

### Missing Coverage — Critical

#### ❌ Critical — MVP gap (FR121)

**FR121** (MCP audit logging) : tagué MVP backend dans le PRD (Coverage Map L743 : "CA3 MCP audit logging | **E5-S13** (nouveau — SCP 2026-04-14) | MVP (backend)"), mais la story E5-S13 **n'a pas encore été créée dans epics.md**.
- **Impact :** NFR28 (audit de chaque appel MCP) est non-implémentable → violation de la politique d'isolation MCP (NFR8) sans traçabilité.
- **Recommandation :** appliquer patchs §7.2a/7.2b de la SCP 2026-04-14 dans epics.md (étape 3 du routing §5.2 de la SCP).

#### ❌ Critical — Preview Environment epic manquant (FR117, FR118, FR122, FR140)

4 FRs du PRD pointent vers un "Preview env epic (à créer)" qui **n'existe pas** dans epics.md. Tag Sprint 10+, donc non-bloquant MVP, mais le dépôt d'un epic est requis pour que la traçabilité soit complète avant implémentation.
- **Impact :** pas de plan d'implémentation pour les features preview-env ; risque d'oubli au moment de la planification Sprint 10+.
- **Recommandation :** créer un epic (ex. `E13 — Preview Environment`) regroupant FR117, FR118, FR122, FR140 + NFR29, NFR31 avant d'entrer dans Sprint 10+.

#### ⚠️ High — Partial coverage Sprint 10+ dashboard (FR120, FR126, FR129, FR135, FR138, FR139)

EA3 existe mais ses ACs ne couvrent pas explicitement :
- Pipeline view temps réel (FR126) — distinct du Sprint Replay Engine
- Navigation historique multi-sprints (FR129)
- Endpoints API backend spécifiques (FR135)
- Cold-start handling (FR139)
- BMAD #yolo expérimentation (FR138)
- MCP per-agent config Phase 2 (FR120)

**Recommandation :** soit enrichir EA3 d'ACs supplémentaires lors du re-grooming Sprint 10+, soit les conserver comme stories différées explicites dans un sous-tag "EA3 Phase 2".

#### ⚠️ High — Epics.md désynchronisés avec SCP 2026-04-14 (B, C, D)

Le SCP 2026-04-14 approuvé aujourd'hui propose 3 autres changements structurels non encore appliqués :
- **Décision B** : casser dep circulaire EA4 ↔ EA5 (L900 encore `Dependencies: E9 (iamthelaw rules), EA4 (retro-to-rules loop)`)
- **Décision C** : reframe EA11 "Orchestrator Foundation" → "Session Transcripts & Orchestrator Platform" (L1134 encore ancien titre)
- **Décision D** : mapping NFR26-34 + NFR34 cross-cutting DoD (aucune occurrence NFR26-34 dans epics.md)

**Impact :** EA4 et EA5 restent mutuellement bloqués (dep circulaire), EA11 conserve son framing "purely technical" critiqué par le rapport 2026-04-13, 9 NFRs non-traçables au niveau epic.

### Coverage Statistics

- **Total FRs actifs dans PRD :** 117 (FR1-FR144 avec 7 fusionnés)
- **FRs couverts sans réserve :** ≈ 95 (FR1-FR116 + FR88-FR92 + FR93-FR101 + FR102-FR108 + FR109-FR115 + FR116 + FR125 + FR137 + FR142-144)
- **FRs couverture partielle :** 6 (FR120, FR126, FR129, FR135, FR138, FR139)
- **FRs non-couverts (MISSING epic/story) :** 5 (FR117, FR118, FR121, FR122, FR140)
- **FRs explicitement différés Growth (acceptable) :** 5 (FR119, FR123, FR130, FR131, FR141)
- **Taux de couverture effective :** ≈ **86 %** (FRs couverts sans réserve / total FRs actifs hors Growth différé)

- **Total NFRs dans PRD :** 34 (dont NFR25 introuvable)
- **NFRs tracés dans epics.md :** 24 (NFR1-NFR24)
- **NFRs manquants dans epics :** 9 (NFR26-34) — 26 %
- **Taux de couverture NFR :** **70 %**

### Résumé Step 3

✅ **Fort :** FR1-FR116 + Phase A (EA1-EA5) correctement couverts ; FR142-144 (Budget Claude) complètement tracés via EA2.

❌ **Bloquant MVP :** FR121 (MCP audit) — story E5-S13 non créée.
❌ **Bloquant Sprint 10+ planning :** 4 FRs preview-env sans epic cible.
⚠️ **Désalignement critique :** PRD updaté 2026-04-14, epics.md non-updaté (patchs SCP 2026-04-14 §7 non appliqués).
⚠️ **NFR gap :** 9 NFRs (NFR26-34) non-tracés dans epics.md.

---

## Step 4 — UX Alignment

**Source :** `_bmad-output/planning-artifacts/ux-design-brief.md` (270 lignes, daté 2026-02-22, non modifié depuis).

### UX Document Status

✅ **Found** — UX brief existe et décrit 6 vues (Sprint Overview, Sprint Replay, Scrum Metrics, Budget View, Agent Performance, Ceremony Reports).

### UX ↔ PRD Alignment

| Vue UX | FRs PRD correspondants | Couverture |
|---|---|---|
| Sprint Overview | FR27, FR58, FR70 | ✅ |
| Sprint Replay | FR27, FR55, FR129 | ✅ (pipeline view FR126 non-explicite, rebaptisée "timeline") |
| Scrum Metrics | FR53, FR70, FR115 | ✅ (burndown/burnup présents) |
| Budget View | FR142, FR143, FR144 | ✅ |
| Agent Performance | FR27 (partiel) | ✅ (Phase A = BMAD command metrics) |
| Ceremony Reports | FR54 | ✅ |

**Vues UX non-spécifiées pour FRs récents / Phase 2 :**

| FR / Capability | Statut UX |
|---|---|
| FR30 (décisions agents par story) | ❌ non-couvert |
| FR99 (Quality Dashboard per-agent) | ❌ non-couvert (CA13 ajoutée post-UX brief) |
| FR102-FR108 (Continuous Improvement Review UI) | ❌ non-couvert (CA14 ajoutée post-UX brief) |
| FR111-FR115 (Day Sprint / Time-Boxing UI) | ❌ non-couvert (CA15 ajoutée post-UX brief) |
| FR88-FR90 (LLM Provisioning Web UI, E6-S4) | ❌ non-couvert |
| FR125 (SonarQube widget) | ❌ non-couvert |
| FR126 (Pipeline view par story distinct du Replay) | ⚠️ partiellement (timeline ≠ pipeline) |
| FR139 (Cold-start dashboard) | ❌ non-couvert |

### UX ↔ Architecture Alignment

| UX requirement | Architecture support |
|---|---|
| SSE `/events` stream | ✅ EventBus + SSE endpoint (EA3-S1 sprint replay) |
| REST API `/api/sprint/*` | ✅ EA3-S1 (`GET /api/sprint/{id}/replay`), plus endpoints futurs Sprint 10+ |
| Dark theme, React 18 + Vite | ✅ déjà en place (web package) |
| NFR1 <500ms UI actions | ✅ PRD §Performance — NFR1 respecté |
| NFR19 délai SSE <5s | ✅ cohérent avec dataflow UX §5 |
| NFR33 API REST KPIs <500ms | ⚠️ non tracé pour endpoints Phase 2 Web UI |

### Alignment Issues

1. ❌ **Stale epic reference** — UX brief pointe `E16 — Enhanced Dashboard & Sprint Replay` mais l'epic E16 a été fusionné dans EA3 (epics.md L32 : `E16 (Dashboard Enrichi) | Merged into EA3 | Enhanced with UX preview`). Mentionné par la SCP 2026-04-14 §5.5 comme "trivial fix, bundle with next UX workflow pass".
2. ⚠️ **UX antérieur à CA12-CA15** — le brief date du 2026-02-22, les capability areas 12/13/14/15 ont été ajoutées dans le PRD le 2026-04-14. 4 capability areas nouvelles (LLM Provisioning, Quality Intelligence, Continuous Improvement, Day Sprint Mode) n'ont pas de vue UX correspondante.
3. ⚠️ **FRs sans spec UX mais PRD-taggés Phase 2 Web UI** — FR88, FR90, FR99, FR102-FR108, FR111-FR115 (≥ 11 FRs) sont tagués "Phase 2 Web UI" dans le PRD mais sans couverture UX brief.
4. ℹ️ **Sidestep explicit :** SCP 2026-04-14 §5.5 décision E "UX specs for dashboard gaps" est **explicitement différée** — user strategy = "automate via CLI first, frontend later". Donc les gaps UX ci-dessus sont **acknowledged and deferred**, pas bloquants pour le plan actuel.

### Warnings

⚠️ **WARNING-UX1 :** UX brief désaligné avec le scope PRD actuel (PRD +4 CAs, +28 FRs ajoutés 2026-04-14). Non-bloquant V1-light (frontend différé), mais doit être remis à jour avant tout sprint "frontend horizon" (Sprint 10+ ou Phase 2).

⚠️ **WARNING-UX2 :** Référence epic stale (E16 → EA3). À corriger lors du prochain passage UX workflow.

ℹ️ **INFO-UX3 :** Les FRs UI-only (FR125, FR126, FR129, FR135, FR139) re-tagués Sprint 10+ par SCP 2026-04-14 restent cohérents avec le déferral explicite du frontend. Pas de spec UX à produire tant que le `frontend horizon` n'est pas rouvert.

---

## Step 5 — Epic Quality Review

### Approach

Application rigoureuse des standards `create-epics-and-stories` : user value, indépendance epic, forward dependencies, sizing stories, critères d'acceptation, starter template, brownfield/greenfield.

### 🔴 Critical Violations

#### CRIT-1 — EA4 ↔ EA5 Circular Dependency (non résolu)

- **Où :** `epics.md` L873 (EA4 `Dependencies: EA1, EA5, E9, E12`) ↔ L900 (EA5 `Dependencies: E9 (iamthelaw rules), EA4 (retro-to-rules loop)`)
- **Règle violée :** "Epic N cannot require Epic N+1 to work"
- **Diagnostic :** SCP 2026-04-14 décision B propose le fix (retirer EA4 de EA5, clarifier EA4 "one-way consumer" de EA5) mais **le patch n'a pas été appliqué dans epics.md**. EA4 et EA5 restent mutuellement bloqués.
- **Recommandation :** appliquer le diff §4.2 de la SCP 2026-04-14 dans epics.md L873 + L900 + ajout note EA5-S3 (EventBus listener sur rule changes, quelle que soit l'origine). Effort : ~4 line edits + 1 note.

#### CRIT-2 — EA11 Technical Epic (non résolu)

- **Où :** `epics.md` L1134 titre "Orchestrator Foundation" + L1140 user value "Before I can automate BMAD for 1 epic, I need solid foundations: dead code clearly deprecated..."
- **Règle violée :** "Epics deliver user value (not technical milestones)"
- **Diagnostic :** Le user value formule des prérequis techniques ("deprecated classes", "extracted services", "ADRs", "readable transcripts of multi-turn sessions") plutôt que des capacités observables. SCP 2026-04-14 décision C propose un reframe centré sur l'artéfact visible (transcript markdown + history committable) mais **non encore appliqué**.
- **Recommandation :** appliquer patches §4.3.1-§4.3.2 de la SCP 2026-04-14 (rewrite header, rename titre "Session Transcripts & Orchestrator Platform", absorber S1/S2 en "housekeeping"). Effort : ~25 line edits.

#### CRIT-3 — Technical Stories Disguised as User Stories

Stories dont la formulation est purement technique, sans delivery user-visible :
- **EA11-S1** (Deprecate legacy cop1 agent classes — `@deprecated` JSDoc)
- **EA11-S2** (Deprecate `workflow.useBMAD=false` path — runtime warning)
- **E3-S16** (Wire Real Agents in SprintRunner — remplacer stubs)
- **E3-S17** (DevAgent Prompt Enhancement — enrichir `buildDevPrompt()`)
- **E5-S9** (LLMGateway Event Emission — injecter EventBus)
- **E5-S10** (LoggerBridge LLM Event Tracking)
- **E5-S11** (TokensPerSecMonitor Wiring)

- **Règle violée :** "Setup all models/Create login UI — not a USER story"
- **Diagnostic :** SCP 2026-04-14 §5.5 acknowledge "acknowledge as housekeeping, don't rename now, revisit post-V1-light". **Décision de scope acceptée par l'utilisateur** mais reste un red flag documentaire.
- **Recommandation :** minimum, annoter chaque story technique avec un tag explicite `[housekeeping]` ou `[tech-debt]` pour que les retros et stakeholder reports puissent les filtrer. Effort : ~7 line edits.

### 🟠 Major Issues

#### MAJ-1 — Oversized Epics

Epics dépassant la règle typique "5-9 stories par epic" :

| Epic | Stories | Note |
|---|---|---|
| E3 Sprint Engine Core | **18** (S1-S18) | **2× oversize** — mélange checkpoint, git, scheduler, time-boxing, simulate mode, prompt enhancement, PM wiring |
| E11 Monitoring & Reporting | **13** (S1-S13) | **1.5× oversize** — mix SSE, journal, burndown, time-to-completion, improvement history |
| E5 LLM Infrastructure | **12** (S1-S12, +S13 post-SCP = 13) | Oversize — mélange routing, MCP, super-saiyan, monitor, event emission |
| E2 Backlog Management | 11 | Borderline |
| EA10 Supervisor Orchestrator | 9 | OK sizing mais 8 dépendances inter-stories |
| EA11 Orchestrator Foundation | 8 | OK sizing mais 5 stories en dépendance séquentielle (S5 → S8 → S7) |

- **Règle violée :** sizing recommandé 5-9 stories, focus SRP par epic
- **Diagnostic :** SCP 2026-04-14 §5.5 "Oversized epics E3 (18 stories), E11 (13), E5 (13 after this SCP) — splitting is a pure bookkeeping exercise. Defer until the next quarterly replan." **Acknowledged and deferred** par l'utilisateur.
- **Recommandation :** pour V1.1+ replan, envisager le split :
  - E3 → E3a Sprint Engine + E3b Git & Worktree + E3c Time-Boxing
  - E11 → E11a Monitoring + E11b Reporting + E11c KPIs
  - E5 → E5a LLM Routing + E5b MCP Access + E5c Observability LLM
- Non-bloquant V1-light.

#### MAJ-2 — NFR Coverage Gap (9 NFRs non-tracés dans epics.md)

NFR26, NFR27, NFR28, NFR29, NFR30, NFR31, NFR32, NFR33, NFR34 listés dans le PRD mais absents d'epics.md.
- SCP 2026-04-14 décision D + patch §7.3/§7.4 résout, mais **non encore appliqué** (0 occurrence NFR26-34 dans epics.md).
- **Impact :** NFR28 (MCP audit) dépend de la création de E5-S13 (CRIT-4 ci-dessous). NFR34 (test strategy per feature type) doit être ajouté comme cross-cutting DoD.
- **Recommandation :** appliquer patches §7.3 (inventory table) + §7.4 (NFR34 cross-cutting note) d'epics.md. Effort : ~40 lines insérées.

#### MAJ-3 — CRIT-4 composite : FR121 MVP Gap (E5-S13 non créé)

Identifié en step 3 (coverage), réitéré ici : MVP backend FR121 + NFR28 sans story. SCP 2026-04-14 §4.1.3 + §7.2a + §7.2b proposent la story complète avec ACs détaillés — **non encore appliqué**. Bloquant MVP si E5-S13 n'est pas inséré avant l'implémentation.

#### MAJ-4 — Missing Preview Environment Epic

Identifié en step 3 : FR117, FR118, FR122, FR140 pointent vers un epic "à créer". Tag Sprint 10+, non-bloquant MVP, mais aucun plan d'implémentation structuré. NFR29 et NFR31 rattachés au même epic manquant.
- **Recommandation :** créer un epic "E13 — Preview Environment" (ou équivalent) avec ≥ 4 stories (worktree lifecycle, build guard, health-check, port allocation, cleanup) avant l'ouverture du Sprint 10+ horizon.

#### MAJ-5 — Heavy Dependency Chain EA10 → EA11 → EA9

EA10 (Supervisor Orchestrator) dépend de **toutes les 8 stories EA11 + EA9 complet + EA6**. EA11-S7 (transcript) dépend de EA11-S8 (3-tracks refactor) qui dépend de EA11-S5 (ADR-014). Si EA11-S5 glisse, toute la chaîne glisse.
- **Règle violée partielle :** "Stories must be independently completable"
- **Diagnostic :** compromis architectural acceptable car EA11-S5 est une architect session **prioritaire** (Critical path noté dans epics.md L1161). SCP 2026-04-11 a créé EA11 précisément pour découper cette dépendance complexe.
- **Recommandation :** maintenir EA11-S5 comme gate explicite Sprint 12, avec deadline avant démarrage EA10-S4/S7/S8.

### 🟡 Minor Concerns

- **MIN-1 Stale coverage claim** : `epics.md` L399 revendique "116/116 FRs — 100%". Le PRD actuel compte 117 FRs actifs (FR1-FR144 avec 7 fusionnés). Après SCP 2026-04-14, les FRs 117-144 sont mappés dans le PRD Coverage Map (§PRD L703) mais pas dans epics.md. **Recommandation :** actualiser le tableau L365-L397 d'epics.md.
- **MIN-2 Naming convention E vs EA** : inconsistance cosmétique. SCP 2026-04-14 §5.5 : "no action. Conventions are established, cost of renaming > benefit." Acknowledged.
- **MIN-3 UX brief stale reference E16** : identifié en step 4. Bundle avec prochain passage UX workflow. Non-bloquant.
- **MIN-4 E1-S1 crée tous les packages upfront** : "Monorepo setup — packages vides (shared-kernel, observability, llm-intelligence, quality-intelligence, sprint-core, ceremony-engine, app, web)". Violation technique de "create when needed" mais pragmatique pour monorepo greenfield pnpm. Acceptable.
- **MIN-5 Documentation split** : stories listées en abrégé dans `## Epic List` (L405) puis détaillées avec ACs dans `## Step 3 — Stories Backlog Priorisé` (L1330) et `## Phase A — Stories Backlog` (L2240). Risque de drift entre les deux sections. Acceptable mais à surveiller.
- **MIN-6 Sprint 12 parallélise EA6 et EA11** : coupling potentiel si les deux epics touchent aux mêmes services. Risk tolerance acceptable pour un MVP.

### Best Practices Compliance Checklist (synthèse)

| Critère | Statut |
|---|---|
| Epic delivers user value | ⚠️ EA11 échoue (CRIT-2) ; EA6, E10, les autres OK |
| Epic can function independently | ❌ EA4 ↔ EA5 circular (CRIT-1) ; EA10 chaîne EA11+EA9+EA6 lourde (MAJ-5) |
| Stories appropriately sized | ⚠️ E3/E11/E5 oversize (MAJ-1) |
| No forward dependencies | ❌ EA4 → EA5 et EA5 → EA4 (CRIT-1) |
| Database tables created when needed | N/A (pas de DB, ADR-001 YAML+JSONL) |
| Clear acceptance criteria | ⚠️ Stories Epic List souvent sans ACs détaillés ; section Backlog Priorisé compense partiellement |
| Traceability to FRs maintained | ⚠️ PRD ↔ epics désynchronisés (step 3) |
| Starter template / Greenfield setup | ✅ E1-S1 monorepo setup, E1-S3 config, `cop1 init` pour projets cibles |

### Summary

**Critical (🔴) :** 3 violations — CRIT-1 (circular EA4/EA5), CRIT-2 (EA11 technical), CRIT-3 (7 stories techniques, acknowledged).
**Major (🟠) :** 5 issues — MAJ-1 (oversized), MAJ-2 (NFR gap), MAJ-3 (FR121 story gap), MAJ-4 (preview env epic missing), MAJ-5 (dep chain).
**Minor (🟡) :** 6 concerns.

**Observation clé :** la SCP 2026-04-14 **résout CRIT-1, CRIT-2, MAJ-2, MAJ-3** via les patches §4.2/§4.3/§7.2/§7.3/§7.4. Ces patches sont prêts mais **non encore appliqués** dans epics.md. Appliquer la SCP transforme le score readiness de **"NEEDS WORK"** à **"READY"** en ~1-2 h d'édition documentaire.

---

## Summary and Recommendations

### Overall Readiness Status

**État actuel (2026-04-14, avant application SCP) : NEEDS WORK**
**État projeté (après application SCP 2026-04-14 §4.2/§4.3/§7.2/§7.3/§7.4) : READY**

**Delta depuis le rapport 2026-04-13 :**
- ✅ PRD synchronisé (CA12-CA15 ajoutées, FR Coverage Map créée, 5 FRs re-tagués Sprint 10+) — fait aujourd'hui
- ❌ epics.md **non-synchronisé** — les patches §7.2/§7.3/§7.4 et les décisions B/C/D de la SCP restent à appliquer

### Critical Issues Requiring Immediate Action

| # | Issue | Source | Fix ready? | Effort |
|---|---|---|---|---|
| **CRIT-1** | Dep circulaire EA4 ↔ EA5 | epics.md L873, L900 | ✅ SCP §4.2 | ~4 lines |
| **CRIT-2** | EA11 "technical epic" (no user value) | epics.md L1134-L1140 | ✅ SCP §4.3 | ~25 lines |
| **CRIT-4 / MAJ-3** | FR121 MVP gap — story E5-S13 manquante | epics.md §Epic 5 | ✅ SCP §7.2a + §7.2b | ~35 lines |
| **MAJ-2** | 9 NFRs (NFR26-34) non-tracés | epics.md §NFR Inventory | ✅ SCP §7.3 + §7.4 | ~40 lines |
| **MAJ-4** | Preview Environment epic manquant (FR117, FR118, FR122, FR140 + NFR29, NFR31) | Absent d'epics.md | ❌ À concevoir (hors SCP) | Nouveau epic, ~1 j effort |

**Non-critique mais à noter :**
- CRIT-3 (7 stories techniques) — **acknowledged** par SCP §5.5, décision de scope acceptée
- MAJ-1 (oversized epics E3/E5/E11) — **deferred** par SCP §5.5 au prochain replan trimestriel
- MAJ-5 (chaîne EA10→EA11→EA9) — compromis architectural validé via SCP 2026-04-11

### Recommended Next Steps

**Séquence immédiate (1-2 h, 0 code) :**
1. **Appliquer la SCP 2026-04-14 §4.2** — fix dep circulaire EA4/EA5 (edit epics.md L873 + L900 + ajout note sous EA5-S3)
2. **Appliquer la SCP 2026-04-14 §4.3** — reframe EA11 "Session Transcripts & Orchestrator Platform" (epics.md L1134-L1165)
3. **Appliquer la SCP 2026-04-14 §7.2a + §7.2b** — insérer E5-S13 MCP Audit Logging (summary + detailed block avec ACs) et mettre à jour la ligne `FRs couvertes` de E5
4. **Appliquer la SCP 2026-04-14 §7.3 + §7.4** — inventaire NFR26-34 + NFR34 cross-cutting DoD dans epics.md (après L230)
5. **Vérification automatique** (depuis la SCP §7.5) :
   ```
   grep -cE 'E5-S13|NFR2[6-9]|NFR3[0-4]|FR121' _bmad-output/planning-artifacts/epics.md
   # Attendu : ≥ 12 matches
   ```
6. **Mettre à jour le FR Coverage Map d'epics.md** (L365-L399) pour refléter FR117-FR144 et pour aligner le total (`116/116` → `117 actifs + delta`)
7. **Rédiger E5-S13 en story BMAD dédiée** via `/bmad-bmm-story-draft` (étape 5 du routing SCP §5.2)
8. **Re-run** `/bmad-bmm-check-implementation-readiness` pour confirmer transition "NEEDS WORK" → "READY"

**Séquence court terme (avant Sprint 10+, ~1 j) :**
9. **Concevoir "E13 — Preview Environment" epic** regroupant FR117, FR118, FR122, FR140, FR141 (Growth) + NFR29, NFR31 avec ≥ 4 stories (lifecycle, build guard, health-check, cleanup)
10. **Corriger référence stale UX brief E16 → EA3** (trivial, bundle avec prochain UX workflow pass)

**Séquence quarterly replan (V1.1+) :**
11. **Split oversized epics** E3 (18 stories), E11 (13), E5 (13) en 2-3 epics ciblés
12. **Annoter stories techniques** `[housekeeping]` ou `[tech-debt]` pour filtrage retro/stakeholder (EA11-S1/S2, E3-S16/S17, E5-S9/S10/S11)
13. **Ouvrir "frontend horizon"** : UX brief refresh avec vues couvrant CA12-CA15 (LLM Provisioning UI, Quality Dashboard per-agent, Continuous Improvement Review UI, Time-Boxing UI)

### Confidence Assessment

- **Traceability :** ⚠️ 86 % FR coverage + 70 % NFR coverage dans epics.md → **90+ % après application SCP**
- **Architectural soundness :** ✅ ADR-013 et ADR-014 produits (EA11-S4 et EA11-S5) ; hexagonal respecté ; ports clairement définis
- **Execution risk :** 🟢 LOW — toutes les gaps critiques sont artefact-alignment, pas de dette code-level
- **Timeline impact :** ZERO sur Sprint 12 ; Sprint 13 (EA10) débloqué une fois patches SCP appliqués

### Final Note

Cette évaluation a identifié **14 issues** réparties en **3 catégories** : 3 critiques (🔴), 5 majeures (🟠), 6 mineures (🟡).

**Point capital :** la SCP 2026-04-14 (approuvée et en partie appliquée sur le PRD aujourd'hui) constitue un plan de résolution complet pour les 4 issues les plus bloquantes (CRIT-1, CRIT-2, CRIT-4/MAJ-3, MAJ-2). L'effort résiduel pour atteindre "READY" est **~1-2 h d'édition documentaire epics.md**, sans impact code.

La seule nouvelle dette identifiée par ce rapport et non couverte par la SCP est **MAJ-4 (Preview Environment epic manquant)** — non-bloquant MVP car tag Sprint 10+, mais à concevoir avant l'ouverture de cet horizon.

Le projet est dans une trajectoire saine : le SCP cycle réactif (2026-04-13 rapport → 2026-04-14 SCP + PRD fix → 2026-04-14 rapport suivant) démontre une gouvernance de plan bien rodée.

---

**Assessor :** Claude Opus 4.6 (PM + SM persona)
**Date :** 2026-04-14
**Report file :** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-14.md`
**Previous report :** `implementation-readiness-report-2026-04-13.md` (comparison baseline)
**Related SCP :** `sprint-change-proposal-2026-04-14-readiness-fixes.md`










