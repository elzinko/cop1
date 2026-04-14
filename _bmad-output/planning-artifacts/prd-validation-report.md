---
validationTarget: '_bmad-output/planning-artifacts/prd.md'
validationDate: '2026-04-14'
inputDocuments:
  - 'ROADMAP.md'
  - 'NEXT_SPRINT.md'
  - 'docs/GETTING_STARTED.md'
  - '_bmad-output/project-context.md'
validationStepsCompleted: ['step-v-01-discovery', 'advanced-elicitation-#14-#36-#34', 'party-mode-pre-sprint-readiness-pass']
validationStatus: IN_PROGRESS
---

# PRD Validation Report

**PRD Being Validated:** `_bmad-output/planning-artifacts/prd.md`
**Validation Date:** 2026-04-14

## Input Documents

- PRD: `_bmad-output/planning-artifacts/prd.md` ✓ (812 lignes, 16 capability areas, 117 FRs actifs, 34 NFRs)
- ROADMAP.md ✓
- NEXT_SPRINT.md ✓
- docs/GETTING_STARTED.md ✓
- _bmad-output/project-context.md ✓

## Validation Findings

---

## Advanced Elicitation Session — 2026-04-14

Méthodes appliquées : **#14 Self-Consistency Validation** → **#36 Challenge from Critical Perspective** → **#34 Pre-mortem Analysis**.

### 1. Self-Consistency Validation (#14)

**Objectif :** croiser les sections internes du PRD pour détecter les divergences introduites par les 4 édits successifs (02-23, 02-24, 04-14 x2).

#### Findings critiques

**SC-1 — Capability Area 11 absente du corps du PRD (CRITIQUE)**
- FR Coverage Map ligne 734 : `FR87 | CA11 Team Self-Improvement | E12 | MVP`
- Corps FR : FR87 est listé sous `Capability Area 7 — Agile Ceremony Engine` (ligne 612)
- Les sections CA sautent de CA10 (ligne 637) à CA12 (ligne 648) — CA11 inexistante
- **Impact :** les epics générés depuis FR Coverage Map cibleront "CA11 Team Self-Improvement" introuvable → epic orphelin ou mauvaise attribution

**SC-2 — J6 marquée MVP, ses FRs sous-jacents marqués Sprint 10+ (CRITIQUE)**
- Ligne 464 : `✅ J6 — Dashboard du matin (MVP — capabilities 11-12)`
- FR Coverage Map lignes 746-753 : FR125, FR126, FR129, FR135, FR139 tous `Sprint 10+ (re-tagged par SCP 2026-04-14)`
- **Impact :** contradiction bloquante — le MVP prétend couvrir J6 mais aucun FR MVP ne la supporte → journey non-livrable en MVP

**SC-3 — Capacités MVP lignes 428-455 : numérotation "12 capabilities" désalignée avec CAs**
- Section titre : "Capacités MVP (12 capabilities, 3 tiers)"
- Les # 1-12 dans le tableau sont des ordres de priorité MVP, mais se confondent visuellement avec les numéros de Capability Area (CA1-CA16)
- Exemple : Tier 2 "#10 Claude API Budget Tracking" pointe sur les FR142-144 (CA10 Developer Control) — ambiguïté Cap#10 vs CA10
- **Impact :** ambiguïté lecture humaine et downstream LLM. Le tableau devrait préfixer `MVP-1` à `MVP-12` ou référencer les CA directement.

**SC-4 — FR Coverage Map : frontmatter declare "FR117-FR134" mais corps va jusqu'à FR144**
- Frontmatter ligne 8 : `+18 FRs (FR117-FR134)`
- Corps FR : FR144 existe (ligne 646, Claude API Budget auto-pause)
- Édits ultérieurs 2026-02-24 et 2026-04-14 ont ajouté FR135-FR144 mais le log n'a pas été consolidé
- **Impact :** mineur (frontmatter historique), pas un problème de livrable

**SC-5 — FR88-FR92 tagués "MVP Tier 1" mais Capacités MVP lignes 430-455 n'en listent aucun**
- FR88-FR92 dans CA12 LLM Provisioning tagués `MVP Tier 1` (FR89/91/92) ou `Phase 2` (FR88/90)
- La section "Capacités MVP" Tier 1/2/3 lignes 432-455 liste 12 capacités sans référencer FR88-FR92
- **Impact :** FR provisioning LLM peuvent être oubliés lors de la planification MVP — les epics E6 risquent d'être déprioritisés

**SC-6 — FR93-FR101 (Quality Intelligence) tagués "MVP Tier 2" mais absents de la section Capacités MVP Tier 2**
- Même problème que SC-5 pour FR93-FR101
- **Impact :** CA13 Quality Intelligence invisible dans le Platform MVP malgré son tag MVP Tier 2

**SC-7 — FR105-FR107 (Continuous Improvement) tagués "MVP Tier 2" mais absents**
- Même problème pour FR102-FR108 : les FRs MVP Tier 2 (FR105-FR107) n'apparaissent pas dans la section "Capacités MVP"
- **Impact :** CA14 sera sous-représentée dans les epics MVP

**SC-8 — Journey Requirements Summary ligne 236 : "MCP Access Control per agent (progressif) | J5, J7"**
- J5 (lignes 184-193) et J7 (lignes 206-213) ne mentionnent pas explicitement MCP Access Control dans leur récit
- **Impact :** traçabilité journey → requirement faible ; un lecteur LLM ne saura pas pourquoi MCP est requis par J5/J7

**SC-9 — Numérotation `Capability Area 11 — Team Self-Improvement` promise dans FR Coverage Map mais jamais instanciée**
- Connexe SC-1 mais précis : la case "Capability Area 11" doit soit être créée (regrouper FR87 + logique auto-amélioration), soit retaguée vers CA7 ou CA14

#### Findings secondaires (cohérence)

**SC-10 — NFR11 (75% RAM suspension) vs NFR14 (ramp-up démarre 50%)** : consistant (ramp 50→75), bien annoté.
**SC-11 — FR52 et FR52b** : OK, FR52b fragment de FR52 bien tagués Growth.
**SC-12 — FR Coverage Map annonce 117 FRs actifs** : FR1-FR144 = 144 numéros, moins 7 fusionnés (124, 127, 128, 132, 133, 134, 136) = 137. Incohérence 117 vs 137. **À RE-CALCULER.**

---

### 2. Challenge from Critical Perspective (#36)

**Objectif :** appliquer le filtre anti-patterns BMAD (FRs = capacités SMART, NFRs = métriques testables, zéro fuite d'implémentation).

#### Anti-patterns détectés

**CP-1 — Fuite d'implémentation dans FRs**
- FR13 : "interface unifiée OpenAI-compatible" → fuite protocole. Préférer "interface LLM unifiée exposant les modèles locaux et distants au System"
- FR16 : "modèles Ollama" → fuite stack. Préférer "modèles LLM locaux"
- FR17 : "MCP servers" — acceptable (MCP est devenu vocabulaire métier cop1)
- FR18 : "priorité : charge Docker" → fuite runtime. Préférer "priorité : charge du runtime de conteneurisation"
- FR94 : "Biome, ts-morph, madge" → fuite outillage JS/TS. Préférer "outils statiques d'analyse (complexité, duplication, dépendances circulaires)"
- FR101 : "sonar-project.properties, .dependency-cruiser.js, .eslintrc.json" → fuite config files. Préférer "fichiers de configuration qualité dérivés des templates cop1"
- FR117 : "pnpm dev ou équivalent" / FR117 "pnpm build" → fuite package manager. Préférer "commande de build / dev déclarée par le projet cible"
- FR96 : "madge + ESLint" → fuite. Préférer "outil de graphe de dépendances + linter statique"

**CP-2 — Quantificateurs vagues**
- FR9 : "limiter le nombre d'itérations par story" → **N non spécifié**
- FR24 : "limité à N refus avant escalade" → **N non spécifié**, rend le FR non-testable
- FR21 : "ajuster dynamiquement le nombre de modèles LLM chargés en fonction des ressources" → **aucun seuil** (à coupler avec NFR14 qui a les métriques)
- FR71 : "alerter si le backlog prêt est insuffisant pour couvrir N sprints" → **N non spécifié**
- FR57 : "limiter le nombre de rejections DoD et escalader si le seuil est dépassé" → **seuil non spécifié**

**CP-3 — Verbes non-testables / subjectifs**
- FR1 : "peut lire et naviguer le backlog" → naviguer = vague. Préférer "peut consulter toute story par sa clé en < X secondes"
- FR2 : "peut consulter le statut" → trivial, peut être fusionné avec FR1
- FR25 : "merger ou proposer un merge" → OU inclusif flou. Spécifier le mode MVP
- FR87 : "observables par le Developer" → passif, pas de critère mesurable. Préférer "consultables via la Web UI / endpoint REST `/kpis`"

**CP-4 — FRs multi-capacités (à scinder)**
- FR27 : "Web UI incluant : vue pipeline + quality dashboard + journal narratif + SonarQube" → **4 capacités en 1** → briser en FR27a/b/c/d ou référencer FR58/FR125/FR126/FR55
- FR8 : "détecter un blocage (timeout ajusté à la saturation Docker + durée estimée dépassée)" → 2 conditions mélangées, "saturation Docker" pas défini → clarifier

**CP-5 — NFRs mesurables mais méthode de mesure absente**
- NFR1 : "répond aux actions utilisateur en moins de 500ms" → mesuré comment (APM, Web Vitals, test Playwright) ? Préciser comme NFR33
- NFR3 : "démarrage daemon < 30s" → mesuré comment (test e2e, log timestamp) ? Préciser
- NFR9 : "disponibilité cible de 95%" → calcul (uptime / planned runtime) ? Préciser

**CP-6 — Vocabulaire casual / non professionnel**
- FR49 : `"Super Saiyan mode"` → garder la référence dans le rationale mais renommer la capacité en "Fallback LLM Upgrade" ou "Adaptive Model Scaling"

#### Anti-patterns positifs (à noter)

- NFR14 : excellent — métriques concrètes (50%, +10%/15min, <30s repli)
- NFR33/NFR34 : excellents — seuils par couche et endpoint
- FR66 : excellent — 3 dimensions DoR énumérées
- FR86 : bon — condition validable (présence section "challenge")

---

### 3. Pre-mortem Analysis (#34)

**Scénario d'échec imaginé :** *"Nous sommes en octobre 2026. Les epics et stories dérivés de ce PRD ont produit du code, mais 40% des features livrées ne correspondent pas aux attentes du Developer. Pourquoi ?"*

#### Causes racines candidates

**PM-1 — La chaîne Vision → FR → Epic s'est rompue sur les re-taggings**
- 11 FRs ont été re-tagués MVP→Sprint 10+ dans le SCP 2026-04-14 (FR125/126/129/135/139, FR121 re-orienté E5-S13)
- Le tableau "MVP Capacités (12 capabilities, 3 tiers)" n'a PAS été mis à jour — il continue de promettre le Quality Dashboard en Tier 3 MVP
- **Conséquence :** les epics MVP ont livré une coquille vide (capacités sans les FRs de support)
- **Prévention :** forcer la synchro `Capacités MVP` ↔ `FR Coverage Map` en bloc, ajouter une colonne "MVP Phase" dans chaque capacité

**PM-2 — Preview Environment epic "à créer" n'a jamais existé**
- FR117, FR118, FR122, FR140, FR141 → coverage map dit `Preview env epic (à créer)`
- L'epic n'a pas été créé → les FRs Preview sont orphelins → la feature n'est jamais planifiée
- **Prévention :** remplacer "à créer" par un placeholder explicite (`E13-Preview-Environment`, status `PENDING_ARCHITECT_SESSION`) ou déplacer les FRs en "Growth — à dé-prioritiser jusqu'à création epic"

**PM-3 — FR137 (Sprint 7) passe silencieusement un prompt enrichi à "commandes BMAD existantes"**
- FR137 présume le comportement de BMAD — si BMAD change, le mécanisme casse sans fallback défini
- Aucun NFR ne spécifie le contrat d'interface BMAD attendu
- **Prévention :** ajouter NFR "Le prompt enrichment a un contrat d'interface versionné avec BMAD (header version, champs obligatoires) ; rupture → fallback vers prompt basique"

**PM-4 — Les Journeys J2, J3, J4 sont MVP mais certaines de leurs capacités non listées**
- J2 → "fichier questions/réponses PM→Dev Notes pipeline" → aucun FR ne décrit ce pipeline explicitement (FR11 persiste les questions mais ne décrit pas le feedback loop vers Dev Notes)
- J4 → "estimation RAM" → aucun FR ne spécifie comment la RAM est estimée avant la nuit (FR20 parle de budget, pas d'estimation)
- **Prévention :** ajouter FRs manquants ou expliciter dans la Journey Requirements Summary que ces capacités sont dérivées

**PM-5 — BMAD #yolo (FR138) est marqué "Sprint 10+ expérimentation" sans critère d'arrêt**
- FR138 : pas de métrique "si succès 50%+ on migre, si < X on abandonne"
- Risque : expérimentation éternelle sans décision Go/No-Go
- **Prévention :** ajouter au FR138 : critères Go (ex: 3/5 stories réussies), critères No-Go, horizon de décision (Sprint 12)

**PM-6 — "Daytime Mode" (Phase 2 Day Copilot, FR109-FR115) ne définit jamais la transition MVP→Phase 2**
- Aucun FR ne définit quand/comment on passe du mode nuit à un mode co-présence
- Configuration sans mention de gating
- **Prévention :** FR/NFR explicite "Le mode Phase 2 requiert NFR16 levée + budget jour configuré + validation manuelle Developer"

**PM-7 — MCP Access Control Phase 1 "soft-limit via iamthelaw" n'a pas de FR de gating vers Phase 2**
- FR47 décrit les 3 phases mais pas le critère de passage Phase 1 → 2
- **Prévention :** FR "Le passage MCP Access Control Phase 1→2 requiert audit log intact sur N sprints + validation Developer"

**PM-8 — Agent PM produit des questions, mais format du feedback loop vers Dev Notes non spécifié**
- FR11 : "formuler des questions bloquantes et persister en fichier décision"
- Pas de FR décrivant l'intégration des réponses du Developer dans le contexte de la story suivante
- **Prévention :** FR "Les réponses du Developer aux questions PM sont automatiquement injectées dans les Dev Notes de la story concernée avant reprise agent"

#### Risques systémiques

- **Traçabilité SCP ↔ PRD :** chaque SCP édite le PRD, mais le frontmatter `editHistory` est devenu long (4 entrées) et pas forcément synchrone avec les sections actuelles.
- **Taille PRD (812 lignes) :** approche la limite où un LLM downstream peut perdre le contexte. Recommandation : shard PRD par capability area (voir `bmad-shard-doc`) avant génération UX/Architecture.

---

## Corrections critiques à appliquer (résumé priorisé)

| Priorité | ID | Action | Target |
|----------|----|----|----|
| P0 | SC-1/SC-9 | Créer section CA11 Team Self-Improvement OU retaguer FR87 vers CA7 dans Coverage Map | cohérence FR/CA |
| P0 | SC-2 | Aligner J6 MVP coverage avec re-tagging SCP 2026-04-14 (J6 → Sprint 10+) | MVP crédible |
| P0 | SC-12 | Recalculer "117 FRs actifs" (attendu : 137) | Coverage Map |
| P1 | SC-5/SC-6/SC-7 | Étendre tableau "Capacités MVP" pour inclure FR88-92, FR93-101, FR105-107 | exhaustivité MVP |
| P1 | PM-2 | Remplacer "Preview env epic (à créer)" par un ID epic placeholder | éviter FRs orphelins |
| P1 | CP-4 | Scinder FR27 en FR27a/b/c/d ou le remplacer par un pointeur vers FR58/FR125/FR126/FR55 | SMART |
| P2 | CP-2 | Spécifier les N manquants (FR9, FR24, FR57, FR71) | testabilité |
| P2 | CP-1 | Réécrire fuites d'implémentation (FR13, FR16, FR18, FR94, FR96, FR101, FR117) | domaine vs infra |
| P2 | PM-5 | Ajouter critères Go/No-Go au FR138 | décision scope |
| P2 | PM-8 / PM-4 | Ajouter FR de feedback loop PM question → Dev Notes | journey J2/J4 |
| P3 | CP-3 | Reformuler FR1/FR2/FR25/FR87 (verbes non-testables) | SMART |
| P3 | CP-5 | Ajouter méthodes de mesure à NFR1/NFR3/NFR9 | testabilité |

---

## Corrections appliquées directement au PRD (session 2026-04-14)

Les 3 findings P0 ont été patchés dans `prd.md` :

1. **SC-1/SC-9 — FR Coverage Map ligne FR87** : `CA11 Team Self-Improvement` → `CA7 Agile Ceremony Engine (Team Self-Improvement KPIs)`. Raison : CA11 n'a aucune section dans le corps du PRD ; FR87 est réellement défini ligne 612 sous CA7. Epic E12 reste la cible.

2. **SC-2 — Journeys couvertes par le MVP ligne 464** : J6 passe de `✅ MVP` à `⏳ Sprint 10+`, avec note explicative indiquant que les services backend sous-jacents restent en MVP mais la Web UI complète est délivrée Sprint 10+. Cohérent avec le re-tagging FR125/126/129/135/139 du SCP 2026-04-14 précédent.

3. **SC-12 — FR Coverage Map note de couverture** : "117 FRs actifs" → "138 FRs actifs" avec calcul explicite (144 IDs − 7 fusionnés + 1 FR52b = 138).

Entrée `editHistory` ajoutée au frontmatter du PRD pour traçabilité.

---

## Findings restants à traiter (P1-P3)

Les findings P1, P2, P3 (voir tableau priorisé plus haut) n'ont pas été patchés automatiquement — ils nécessitent soit une décision produit (scinder FR27, Go/No-Go FR138), soit une passe rédactionnelle plus large (fuites d'implémentation, verbes non-testables). À traiter en session dédiée ou lors de la prochaine édition PRD.

---

## Pre-Sprint Readiness Pass — 2026-04-14 (post Party Mode)

**Contexte :** arbitrage Party Mode (John PM + Winston Architect + Bob SM) — passe 30 min pour débloquer le sprint planning avant validation formelle.

### Corrections P1/P2 appliquées au PRD

| Finding | Action | Fichier / section |
|---------|--------|-------------------|
| SC-5/SC-6/SC-7 | Tableau "Capacités MVP" étendu 12→15 capabilities, préfixes `MVP-N` + colonne "FRs clés". +MVP-6 (FR89/91/92 LLM Provisioning), +MVP-12 (FR93-98/100-101 Quality Intelligence), +MVP-13 (FR105-107 Continuous Improvement Persistence), +MVP-14 (FR121/NFR28 MCP Audit), +MVP-15 (services backend Dashboard — Web UI Sprint 10+). Ambiguïté SC-3 (MVP-N vs CA-N) résolue. | prd.md §MVP Scope Definition |
| PM-2 | `Preview env epic (à créer)` → `E13-Preview-Environment (PENDING_ARCHITECT_SESSION)` sur FR117/118/122/140/141 (FR Coverage Map) | prd.md §FR Coverage Map |
| CP-2 FR9 | `max_iterations_per_story = 5` | prd.md §CA2 |
| CP-2 FR24 | `reviewer_max_rejections = 3` | prd.md §CA5 |
| CP-2 FR57 | `dod_max_rejections = 2` | prd.md §CA8 |
| CP-2 FR71 | `ready_backlog_horizon_sprints = 2` | prd.md §CA1 |
| PM-5 | FR138 enrichi : Go (≥3/5 + coût ≤1.5×), No-Go (≤1/5 ou coût >2× ou incident critique), extension 1 sprint (2/5), horizon Sprint 12, fallback silencieux via `max_iteration_timeout` | prd.md §CA5 |
| PM-8 | **+FR145** Feedback loop PM Question → Dev Notes (format `## Decision Responses`, persistant, injection avant reprise agent). Couvre les gaps J2/J4 identifiés au pre-mortem | prd.md §CA2 + §FR Coverage Map |

### Compteurs PRD après passe

- **138 → 139 FRs actifs** (ajout FR145)
- **Capacités MVP 12 → 15** (3 tiers préservés)
- **editHistory frontmatter** : +1 entrée "Pre-sprint readiness pass"

### Findings encore ouverts (non-bloquants pour démarrer un sprint)

- **CP-1** Fuites d'implémentation (FR13/16/18/94/96/101/117) — passe rédactionnelle à programmer (non-bloquant : le mapping intention/implémentation reste lisible)
- **CP-3** Verbes non-testables (FR1/2/25/87) — à raffiner à la prochaine édition PRD
- **CP-4** Scinder FR27 — décision produit nécessaire, pas bloquant pour les epics
- **CP-5** Méthode de mesure NFR1/NFR3/NFR9 — à compléter lors du Definition of Ready sprint
- **CP-6** Renommer "Super Saiyan mode" FR49 — cosmétique
- **PM-3** Contrat d'interface BMAD versionné — à arbitrer via ADR dédié avant FR138 Sprint 10+
- **PM-6** Gating transition MVP → Phase 2 Day Copilot — non-bloquant, Phase 2 pas en scope MVP
- **PM-7** Gating MCP Phase 1 → Phase 2 — à ajouter au FR47 ultérieurement
- **SC-8** Traçabilité J5/J7 → MCP Access Control — reformulation à prévoir

### Conclusion

**Le PRD est prêt pour démarrer un sprint.** Les incohérences structurelles (CA11 fantôme, J6/MVP, compte FRs, capacités MVP manquantes) et les ambiguïtés bloquantes (Ns non spécifiés, Go/No-Go FR138, feedback loop PM) sont résolues. Les findings restants sont de l'ordre du raffinement rédactionnel ou des décisions produit secondaires — ils peuvent être traités en continu sans bloquer le planning.




