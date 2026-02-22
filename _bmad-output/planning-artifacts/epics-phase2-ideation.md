---
status: 'draft'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/adr-007-bmad-cop1-iamthelaw-integration.md'
workflowType: 'ideation-epics'
project_name: 'cop1'
user_name: 'elzinko'
date: '2026-02-22'
phase: 'Phase 2+ — Intelligence, Autonomie, Observabilité'
newFRs: 32
---

# cop1 / Morpheus — Epic Breakdown Phase 2+

## Overview

Ce document formalise les epics issus de l'idéation Phase 2+ de cop1. Ces epics étendent les capacités du système au-delà du MVP (Epics 1-12) pour apporter : composition intelligente de prompts, gestion budgétaire cloud, laboratoire d'agents, dashboard enrichi, workflow Scrum complet, mode interactif, module BMAD iamthelaw, et amélioration continue système.

Toutes les décisions architecturales respectent l'ADR-007 (architecture 2 couches BMAD/cop1/iamthelaw).

---

## New Functional Requirements (Phase 2+)

**CA16 — Prompt Composition & BMAD Context Bridge (6 FRs)**
- FR117 : Le System compose les prompts agents à partir de 4 agrégats : template de base (versionné), project-context.md (BMAD), règles iamthelaw (YAML), et mémoire agent (lessons learned)
- FR118 : Le PromptComposer injecte automatiquement les règles iamthelaw pertinentes (globales + spécifiques agent) dans le prompt de chaque agent avant exécution
- FR119 : Le System lit `_bmad-output/project-context.md` et l'injecte comme contexte projet dans tous les prompts agents d'implémentation
- FR120 : Le System synchronise les règles iamthelaw validées vers `_bmad/_memory/iamthelaw-sidecar/rules.md` pour que les agents BMAD interactifs en bénéficient
- FR121 : Le Developer peut choisir un template de prompt par type d'agent (templates versionnés, extensibles)
- FR122 : Le System maintient une mémoire par agent (erreurs fréquentes, patterns préférés, feedback reviews) persistée dans `.cop1/agent-memory/`

**CA17 — Token Budget & Cloud Escalade (7 FRs)**
- FR123 : Le Developer peut configurer des limites de tokens par sprint, par agent, par session, et hebdomadaire cloud dans `cop1.config.yaml`
- FR124 : Le TokenBudgetService vérifie le budget restant AVANT chaque appel LLM cloud et refuse l'appel si le budget est épuisé
- FR125 : Le System émet des alertes budget à des seuils configurables (défaut : 50% log, 80% notification, 95% pause_and_ask) via EventBus
- FR126 : Le System peut interroger l'API usage du provider cloud (Claude) pour connaître la consommation et le quota restant de la session/semaine
- FR127 : Le Developer peut forcer un sprint à utiliser exclusivement le cloud (`force_provider: cloud`) ou le local (`force_provider: local`) avec un modèle spécifique
- FR128 : L'escalade vers le cloud vérifie le budget restant et choisit le modèle cloud le moins coûteux capable de la tâche
- FR129 : Le System optimise la consommation en fonction du quota hebdomadaire restant (répartition intelligente sur les sprints restants de la semaine)

**CA18 — Agent Lab & Scoring System (6 FRs)**
- FR130 : Le System note chaque exécution d'agent avec un score multi-critères : qualité code (40%), tests passent (20%), respect AC (20%), efficience tokens (10%), temps (10%)
- FR131 : Le System peut exécuter un Lab Mode : une story de test est exécutée avec N modèles différents pour comparer les scores
- FR132 : À l'installation, le System profile le hardware de l'utilisateur (RAM, CPU, modèles supportés) et recommande les modèles optimaux par type d'agent
- FR133 : Le System implémente une dégradation progressive des modèles : partant du cloud (référence 100%), descendant vers le local, notant chaque palier, s'arrêtant quand le score chute sous un seuil configurable
- FR134 : Le scoring distingue les notes cloud (référence) et les notes locales (dépendantes du hardware) pour chaque agent
- FR135 : Le Developer peut consulter les scores par agent, par modèle, et par type de tâche via le dashboard

**CA19 — Dashboard Enrichi & Sprint Replay (5 FRs)**
- FR136 : Le Developer peut visualiser un Sprint Replay pas-à-pas avec une timeline interactive depuis les events JSONL (play/pause/step forward/step back)
- FR137 : Le Developer peut consulter les comptes-rendus de cérémonies agiles (planning, rétro, review) avec les actions prises et leur statut
- FR138 : Le Dashboard affiche les métriques Scrum (burndown, burnup, vélocité) avec historique multi-sprints
- FR139 : Le Dashboard affiche la consommation budget (tokens locaux vs cloud, alertes actives, projection fin de sprint)
- FR140 : Le Dashboard affiche les scores Agent Performance (notation par agent, taux rejet, tokens consommés, temps moyen)

**CA20 — Workflow Scrum Complet (4 FRs)**
- FR141 : Le System applique un gate DoR automatique avant `cop1 sprint run` : seules les stories validées par DORValidator peuvent entrer dans le sprint
- FR142 : Quand un agent atteint le maximum de rejets sur une story, il l'abandonne proprement (status: blocked), passe à la story suivante, et le sujet est enregistré pour la rétro
- FR143 : Le Developer peut configurer le pipeline d'agents via un fichier YAML (ordre des steps, steps optionnels, steps conditionnels)
- FR144 : Le System peut exécuter une rétrospective automatisée post-sprint qui analyse les métriques, propose des règles iamthelaw, et alimente la mémoire agent

**CA21 — Mode Interactif & Notifications (4 FRs)**
- FR145 : Le Developer peut mettre en pause un sprint en cours, inspecter l'état, modifier des paramètres (modèle, limites), et reprendre l'exécution
- FR146 : Le Developer peut poser des questions au ManagerAgent pendant une pause et recevoir des recommandations
- FR147 : Le System peut envoyer des notifications Telegram contenant un résumé d'événement et un lien vers le dashboard
- FR148 : Le Developer peut configurer les types d'événements déclenchant une notification (blocage, budget alert, sprint terminé, cérémonie terminée)

---

## Epic List (Phase 2+)

---

### Epic 13 — Prompt Composer & BMAD Context Bridge

**User Value :** "Les agents produisent du code respectant les conventions du projet et les règles de l'équipe — et s'améliorent sprint après sprint."

**FRs couvertes :** FR117, FR118, FR119, FR120, FR121, FR122

**Package principal :** `@cop1/sprint-core` (feature prompt-composer) + `@cop1/app` (sync sidecar)

**Dépendances :** E3 (DevAgent), E9 (iamthelaw)

**Réf. Architecture :** ADR-007 (composition prompts, zones lecture/écriture, sidecar BMAD)

**Stories :**

- **E13-S1** : PromptComposer Service — service qui compose un prompt final à partir de 4 agrégats (template, project-context, rules, memory, story). Interface `PromptComposer` avec méthode `compose()`. Injecté dans DevAgent, ReviewerAgent via port. (FR117)
- **E13-S2** : Project Context Loader — lire `_bmad-output/project-context.md` au démarrage du sprint et l'injecter comme agrégat dans le PromptComposer. Cache avec invalidation sur modification fichier. (FR119)
- **E13-S3** : Rules Injection — le PromptComposer charge les règles iamthelaw (globales + spécifiques agent) via IamTheLawLoader et les formate en section markdown pour injection dans le prompt. (FR118)
- **E13-S4** : Agent Memory Service — persistance `.cop1/agent-memory/{agent-name}.jsonl` des lessons learned : motifs de rejet récurrents, patterns préférés, feedback reviews. Injecté comme agrégat dans le PromptComposer. (FR122)
- **E13-S5** : Prompt Templates — templates versionnés par type d'agent (dev-template-v1.md, reviewer-template-v1.md). Stockés dans `packages/sprint-core/src/features/prompt-composer/templates/`. Sélectionnables via config. (FR121)
- **E13-S6** : BMAD Sidecar Sync — après chaque rétro auto ou application de règle, synchroniser `.cop1/rules/active-rules.yaml` vers `_bmad/_memory/iamthelaw-sidecar/rules.md` (format LLM-friendly). (FR120)
- **E13-S7** : Customize.yaml Setup — configurer `_bmad/_config/agents/bmm-dev.customize.yaml`, `bmm-sm.customize.yaml`, `bmm-qa.customize.yaml` avec critical_actions chargeant le sidecar. Commande `cop1 init-bmad-bridge`. (FR120)

**Definition of Done :**
- PromptComposer produit un prompt contenant les 4 agrégats (test : mock des 4 sources → prompt contient les sections attendues)
- DevAgent utilisant PromptComposer a un taux de rejet reviewer < 30% sur stories de test (vs > 60% sans)
- Sidecar sync : modification règle cop1 → `rules.md` mis à jour en < 5s
- Aucun fichier `_bmad/bmm/` ou `_bmad/core/` modifié (test d'intégrité)

---

### Epic 14 — Token Budget & Cloud Escalade

**User Value :** "Je contrôle les coûts cloud et je ne brûle jamais plus de tokens que prévu — le système optimise automatiquement."

**FRs couvertes :** FR123, FR124, FR125, FR126, FR127, FR128, FR129

**Package principal :** `@cop1/llm-intelligence` (feature token-budget) + `@cop1/app` (config)

**Dépendances :** E5 (LLM Gateway), E7 (Resource Management)

**Stories :**

- **E14-S1** : TokenBudgetService — service qui maintient les compteurs de tokens par sprint/agent/session. Écoute `llm.call.completed` via EventBus. Persistance dans `.cop1/budget-{date}.yaml`. (FR123)
- **E14-S2** : Budget Config — section `budget:` dans `cop1.config.yaml` avec `sprint_max_tokens`, `cloud_weekly_limit`, `per_agent_limits`, `alerts` (seuils + actions). Validation Zod. (FR123)
- **E14-S3** : Pre-Call Budget Check — modifier LLMGateway pour vérifier le budget restant AVANT chaque appel cloud. Si budget épuisé → reject avec `BudgetExhaustedError`. (FR124)
- **E14-S4** : Budget Alert System — module indépendant écoutant les events `llm.call.completed`, agrégeant la consommation, émettant `budget.warning` / `budget.exceeded` à chaque seuil. (FR125)
- **E14-S5** : Cloud Usage API Adapter — adapter pour interroger l'API usage Claude (consommation session/semaine, quota restant). Port `CloudUsagePort` + `ClaudeUsageAdapter`. (FR126)
- **E14-S6** : Force Provider Config — config sous `llm_routing:` : `force_provider: cloud|local|auto` + `force_model: claude-opus-4-6`. Le LLMRouter respecte cette config en override. Surchargeables par sprint via CLI `--force-provider cloud`. (FR127)
- **E14-S7** : Smart Escalade — l'AdaptiveLLMService vérifie le budget avant escalade, choisit le modèle cloud le moins coûteux capable. Si budget insuffisant → rester en local et logger. (FR128)
- **E14-S8** : Weekly Optimization — service qui répartit le budget cloud restant sur les sprints restants de la semaine. Ajuste les limites par sprint dynamiquement. (FR129)

**Definition of Done :**
- Sprint avec budget 1000 tokens : le LLMGateway refuse l'appel cloud quand le compteur atteint 1000 (test avec mock)
- Alertes émises à 50%, 80%, 95% du budget (test EventBus)
- `force_provider: cloud` → tous les appels passent par Claude (test config)
- Budget épuisé + local échoue → StepResult `blocked` avec message explicite (pas de crash)

---

### Epic 15 — Agent Lab & Scoring System

**User Value :** "Je sais quel modèle est optimal pour chaque agent sur ma machine — et la qualité est mesurée objectivement."

**FRs couvertes :** FR130, FR131, FR132, FR133, FR134, FR135

**Package principal :** `@cop1/sprint-core` (feature agent-scoring) + `@cop1/llm-intelligence` (feature hardware-profiler)

**Dépendances :** E3 (Agents), E5 (LLM Gateway), E14 (Budget)

**Stories :**

- **E15-S1** : AgentScoringService — score multi-critères par exécution d'agent : qualité code (40%), tests (20%), AC (20%), efficience tokens (10%), temps (10%). Persistance `.cop1/scores/`. (FR130)
- **E15-S2** : Score Aggregator — agrégation des scores par agent, par modèle, par sprint. Calcul tendances (amélioration/régression). (FR130)
- **E15-S3** : Hardware Profiler — à l'installation (`cop1 init`), profiler RAM disponible, CPU cores, GPU si applicable. Déterminer les modèles Ollama exécutables. Recommandations stockées dans `.cop1/hardware-profile.yaml`. (FR132)
- **E15-S4** : Lab Mode — commande `cop1 lab run --story E1-S1 --models mistral:7b,llama3:8b,claude-haiku`. Exécute la story avec chaque modèle, collecte les scores, génère un rapport comparatif. (FR131)
- **E15-S5** : Progressive Degradation — partant du cloud (score 100%), descendre progressivement vers des modèles locaux, noter chaque palier. S'arrêter quand le score chute sous `min_acceptable_score` (configurable). (FR133)
- **E15-S6** : Cloud vs Local Score Distinction — les scores sont catégorisés : `cloud_reference_score` (absolu) et `local_score` (relatif au hardware). Le Lab affiche les deux. (FR134)
- **E15-S7** : Score Dashboard Integration — vue scores dans le dashboard : par agent, par modèle, par type de tâche. Graphiques d'évolution. (FR135)

**Definition of Done :**
- Lab mode exécute une story avec 2 modèles → rapport comparatif avec scores détaillés (test avec mocks LLM)
- Hardware profiler retourne RAM/CPU/modèles supportés (test sur machine réelle)
- Dégradation progressive : 3 modèles testés → classement par score (test avec mocks)
- Scores persistés et requêtables par agent/modèle/sprint

---

### Epic 16 — Dashboard Enrichi & Sprint Replay

**User Value :** "Je vois tout ce qui s'est passé pendant un sprint — en temps réel ou en replay pas-à-pas."

**FRs couvertes :** FR136, FR137, FR138, FR139, FR140

**Package principal :** `@cop1/web` + `@cop1/app` (API routes)

**Dépendances :** E11 (Monitoring & Web UI), E14 (Budget), E15 (Scoring)

**Prérequis UX :** Lancer `/bmad-bmm-create-ux-design` avant l'implémentation pour produire les mockups.

**Stories :**

- **E16-S1** : Sprint Replay Engine — parser les events JSONL et construire une timeline chronologique. API REST `GET /api/sprint/{id}/replay` retournant les events paginés. (FR136)
- **E16-S2** : Sprint Replay UI — composant React avec timeline interactive : play/pause/step forward/step back. Clic sur event → détail (prompt, réponse, score si disponible). (FR136)
- **E16-S3** : Ceremony Reports View — page listant les comptes-rendus de cérémonies (`.cop1/ceremonies/`), avec actions prises et leur statut (pending/done/rejected). (FR137)
- **E16-S4** : Scrum Metrics View — burndown/burnup interactifs avec historique multi-sprints. Utilise BurndownCalculator et VelocityProjector existants. Sélecteur de sprint. (FR138)
- **E16-S5** : Budget View — consommation tokens local vs cloud en temps réel. Alertes actives. Projection fin de sprint. Graphique d'utilisation. (FR139)
- **E16-S6** : Agent Performance View — score par agent (AgentScoringService), taux de rejet, tokens consommés, temps moyen. Comparaison entre sprints. (FR140)

**Definition of Done :**
- Sprint Replay affiche les events d'un sprint JSONL en timeline navigable (test avec fichier JSONL de référence)
- Burndown/Burnup affichent les données de BurndownCalculator (test avec données mock)
- Budget view affiche consommation correcte (test avec TokenBudgetService mock)
- Toutes les vues répondent en < 500ms (NFR1)

---

### Epic 17 — Workflow Scrum Complet

**User Value :** "Le sprint respecte la méthode Scrum — avec gate DoR, abandon intelligent, pipeline configurable, et rétro automatisée."

**FRs couvertes :** FR141, FR142, FR143, FR144

**Package principal :** `@cop1/sprint-core` + `@cop1/ceremony-engine`

**Dépendances :** E3 (Sprint Engine), E8 (Ceremony Engine), E9 (iamthelaw), E13 (Prompt Composer)

**Stories :**

- **E17-S1** : DoR Gate — avant `cop1 sprint run`, le SprintRunner exécute DORValidator sur chaque story candidate. Les stories non-DoR sont exclues avec un log explicatif. Le Developer peut override avec `--skip-dor`. (FR141)
- **E17-S2** : Smart Story Abandonment — quand ReviewerAgent atteint maxRejections, la story passe en `blocked` (pas `failed`). Le SprintRunner passe à la story suivante. L'abandon est enregistré dans `.cop1/sprint-log` avec la raison pour traitement en rétro. (FR142)
- **E17-S3** : Configurable Pipeline — fichier `cop1.config.yaml` section `pipeline:` définissant l'ordre des steps, steps optionnels (skip_if_local: true), steps conditionnels (run_if: qa_failed). Le WorkflowEngine lit cette config. (FR143)
- **E17-S4** : Auto Retrospective — après la fin du sprint, le SprintRunner lance automatiquement une rétro : analyse des métriques (KPIsDashboardService), identification des stories bloquées, proposition de règles iamthelaw via AutoRuleSuggestionService, alimentation de la mémoire agent. Communication via RetroOutput protocol (ADR-006 : ceremony-engine → sprint-core via port/adapter, pas de dépendance directe). (FR144)
- **E17-S5** : Retro Output to Memory — les outputs de la rétro auto alimentent : (1) l'AgentMemoryService (E13-S4), (2) les propositions de règles iamthelaw (E9-S4), (3) le sidecar BMAD (E13-S6). Les données transitent via un RetroOutputPort défini dans sprint-core, implémenté par un adapter dans ceremony-engine (conformité ADR-006). Boucle fermée d'amélioration. (FR144)

**Definition of Done :**
- Story non-DoR exclue du sprint avec log (test avec DORValidator mock retournant `passed: false`)
- Story bloquée après 3 rejets → sprint continue avec la story suivante (test workflow)
- Pipeline config : step optionnel désactivé → step sauté sans erreur (test config)
- Rétro auto produit ≥1 proposition de règle après un sprint avec des rejets (test métriques mock)

---

### Epic 18 — Mode Interactif & Notifications

**User Value :** "Je peux intervenir à tout moment pendant un sprint et je reçois les alertes importantes sur Telegram."

**FRs couvertes :** FR145, FR146, FR147, FR148

**Package principal :** `@cop1/app` (feature interactive-mode + feature telegram)

**Dépendances :** E3 (Sprint Engine), E7 (Suspension), E14 (Budget)

**Stories :**

- **E18-S1** : Sprint Pause/Resume interactif — commande `cop1 sprint pause` met en pause proprement (fin du step en cours). `cop1 sprint resume` reprend. Pendant la pause, l'état complet est consultable. (FR145)
- **E18-S2** : Interactive Inspector — pendant une pause, `cop1 sprint inspect` affiche : story en cours, step actif, budget consommé, scores, derniers logs. Permet de modifier config à chaud. (FR145)
- **E18-S3** : Manager Query — pendant une pause, `cop1 sprint ask "question"` envoie la question au ManagerAgent (LLM puissant) avec le contexte du sprint. Retourne une recommandation. (FR146)
- **E18-S4** : Telegram Bot — bot Telegram qui écoute les events cop1 via EventBus et envoie des messages formatés. Chaque message contient un résumé + lien deep-link vers le dashboard. (FR147)
- **E18-S5** : Notification Config — section `notifications:` dans `cop1.config.yaml` : `telegram_bot_token`, `telegram_chat_id`, `notify_on: [blocage, budget_alert, sprint_complete, ceremony_complete]`. (FR148)

**Definition of Done :**
- `cop1 sprint pause` → step en cours se termine → état `paused` (test workflow)
- `cop1 sprint resume` → reprise depuis le checkpoint (test checkpoint)
- `cop1 sprint ask` → réponse du ManagerAgent avec contexte sprint (test avec LLM mock)
- Telegram bot envoie un message quand `story.blocked` est émis (test avec Telegram API mock)

---

### Epic 19 — Module iamthelaw BMAD (Option C — Futur)

**User Value :** "Les règles iamthelaw sont un module BMAD installable — réutilisable sur d'autres projets, partageable en marketplace."

**FRs couvertes :** Aucune nouvelle FR — encapsule les concepts de règles évolutives (E9) dans un module BMAD

**Package principal :** Module BMAD externe (npm: `bmad-iamthelaw`)

**Dépendances :** E13 (Sidecar sync stable), E9 (iamthelaw mature)

**Note :** Cet epic est prévu pour quand l'Option B (sidecar) sera stable et que le système de règles aura prouvé sa valeur sur plusieurs sprints.

**Stories :**

- **E19-S1** : Module Brief — utiliser `/bmad-agent-bmb-module-builder` pour créer le brief du module iamthelaw (type: extension BMM). Définir l'agent Judge, les workflows, la vision.
- **E19-S2** : Module Scaffold — créer la structure du module : `module.yaml`, agents/judge/, workflows/rule-management/, workflows/rule-check/, workflows/rule-retrospective/.
- **E19-S3** : Judge Agent — persona "The Judge", spécialisé dans l'application et l'évolution des règles. Menu : [MR] Manage Rules, [RC] Rule Check, [RR] Rule Review.
- **E19-S4** : Rule Check Workflow — workflow intégré phase 4 BMM (sequence 42, après dev-story). Vérifie le code contre les règles actives. Rapport de conformité.
- **E19-S5** : Rule Retrospective Workflow — workflow intégré phase 4 BMM (sequence 58, avant retro). Analyse l'efficacité des règles, propose des ajustements.
- **E19-S6** : npm Publish — publier le module en npm (`bmad-iamthelaw`), installable via `npx bmad-method install --custom-content bmad-iamthelaw`.
- **E19-S7** : cop1 Module Reader — cop1 peut lire les fichiers du module iamthelaw BMAD (rules, config) pour enrichir ses propres prompts. Pont bidirectionnel module ↔ cop1.

**Definition of Done :**
- Module installable via `npx bmad-method install` (test sur projet vierge)
- Judge agent accessible via `/bmad-iamthelaw-manage-rules` (test dans Claude Code)
- Rule Check apparaît dans le phase sequence BMM entre dev-story et code-review
- Module survit à une mise à jour BMAD (`npx bmad-method install --modules bmm` → module iamthelaw toujours présent)

---

### Epic 20 — CoachAgent & Amélioration Continue Système

**User Value :** "Un agent observe le système de l'extérieur et propose des optimisations basées sur les données — pas sur l'intuition."

**FRs couvertes :** Extension de FR87, FR97, FR98 + intégration E15 (scoring)

**Package principal :** `@cop1/sprint-core` (feature coach-agent) + `@cop1/ceremony-engine`

**Dépendances :** E12 (Continuous Improvement), E15 (Scoring), E17 (Rétro auto)

**Stories :**

- **E20-S1** : CoachAgent Service — agent systémique (hors équipe scrum) qui analyse les données cross-sprints : scores agents, taux de rejet, consommation tokens, vélocité, règles les plus violées. (FR87)
- **E20-S2** : Trend Analysis — détection de tendances : régression qualité, amélioration vélocité, modèle sous-performant. Alertes si dégradation significative (> 20% sur 3 sprints). (FR97)
- **E20-S3** : Model Optimization Proposals — le CoachAgent propose des changements de modèle basés sur les scores Lab : "Le DevAgent score 85% avec llama3:8b vs 60% avec mistral:7b, recommandation : upgrade." (FR97, FR130)
- **E20-S4** : Rule Effectiveness Analysis — analyse quelles règles iamthelaw sont les plus impactantes (corrélation règle ajoutée → taux rejet diminué) et lesquelles sont obsolètes (jamais déclenchées). (FR98)
- **E20-S5** : Coach Report — rapport markdown généré automatiquement après N sprints (configurable), avec recommandations priorisées. Stocké dans `.cop1/coach-reports/`. Consultable via dashboard. (FR87)
- **E20-S6** : Sprint Test Integration — exécuter des sprints de test d'intégration avec la configuration actuelle, analyser les résultats, proposer des améliorations de configuration (params globaux + params agents + pipeline). (FR87)

**Definition of Done :**
- CoachAgent analyse 3 sprints et détecte une régression de vélocité (test avec métriques mock)
- Proposition de changement de modèle basée sur les scores Lab (test avec scores mock)
- Rapport Coach contient des recommandations priorisées avec données de support
- Analyse d'efficacité des règles : règle jamais déclenchée → recommandation de suppression

---

## Sprint Ordering (Phase 2+)

### Sprint 8 — Fondations Phase 2

> Objectif : Prompts enrichis et gate DoR. Le code produit par les agents respecte enfin les conventions du projet.

- E13-S1, E13-S2, E13-S3, E13-S5 (PromptComposer MVP : template + project-context + rules)
- E17-S1 (DoR Gate)

### Sprint 9 — Budget & Mémoire

> Objectif : Les agents apprennent de leurs erreurs, le budget cloud est contrôlé, les stories sont abandonnées intelligemment.

- E13-S4, E13-S6 (Agent Memory + Sidecar Sync)
- E14-S1, E14-S2, E14-S3 (TokenBudgetService + config + pre-call check)
- E14-S4, E14-S5 (Budget Alerts + Cloud Usage API)
- E17-S2 (Smart Abandonment)

### Sprint 10 — Rétro Auto & Scoring

> Objectif : La boucle d'amélioration se ferme. Rétro automatique, scoring objectif, début dashboard.

- E17-S4, E17-S5 (Auto Retro + Retro Output to Memory — boucle fermée)
- E15-S1, E15-S2 (AgentScoringService + Aggregator)
- E16-S1, E16-S2 (Sprint Replay Engine + UI)
- **Prérequis :** UX Design (lancer `/bmad-bmm-create-ux-design` avant ce sprint)

### Sprint 11 — Dashboard Complet & Lab

> Objectif : Dashboard complet, lab mode opérationnel, escalade cloud intelligente.

- E16-S3, E16-S4, E16-S5, E16-S6 (Ceremony Reports + Scrum Metrics + Budget View + Agent Performance)
- E15-S3, E15-S4, E15-S5 (Hardware Profiler + Lab Mode + Degradation)
- E14-S6, E14-S7, E14-S8 (Force Provider + Smart Escalade + Weekly Optimization)

### Sprint 12 — Mode Interactif & Pipeline

> Objectif : Le Developer peut intervenir à tout moment. Pipeline configurable. Notifications Telegram.

- E18-S1, E18-S2, E18-S3 (Pause/Resume + Inspector + Manager Query)
- E18-S4, E18-S5 (Telegram Bot + Notification Config)
- E17-S3 (Configurable Pipeline)
- E13-S7 (Customize.yaml Setup)
- E15-S6, E15-S7 (Score Cloud/Local Distinction + Score Dashboard Integration)

### Sprint 13 — CoachAgent

> Objectif : Le système s'observe lui-même et propose des optimisations data-driven.

- E20-S1, E20-S2, E20-S3 (CoachAgent + Trends + Model Proposals)
- E20-S4, E20-S5 (Rule Effectiveness + Coach Report)

### Sprint 14+ — Module BMAD & Marketplace

> Objectif : iamthelaw devient un module BMAD réutilisable.

- E19 complet (Module iamthelaw BMAD)
- E20-S6 (Sprint Test Integration)

---

## Dependencies Graph (Phase 2+)

```
E13 (Prompt Composer) ─── fondation, dépend de E3 + E9
  ├── E17 (Scrum) ────── needs E13 for retro auto
  └── E19 (Module) ───── needs E13 for sidecar + E9 for rules

E14 (Budget) ─── dépend de E5 + E7
  └── E15 (Lab) ──────── needs E14 for cost awareness

E15 (Scoring) ─── dépend de E3 + E5 + E14
  ├── E16 (Dashboard) ── needs E15 for score display
  └── E20 (Coach) ────── needs E15 for trend analysis

E16 (Dashboard) ─── dépend de E11 + E14 + E15

E17 (Scrum) ─── dépend de E3 + E8 + E9 + E13
  └── E20 (Coach) ────── needs E17 for retro data

E18 (Interactive) ─── dépend de E3 + E7 + E14

E19 (Module) ─── dépend de E13 + E9 (mature)
E20 (Coach) ──── dépend de E12 + E15 + E17
```

---

## Summary

| Epic | Nom | Stories | Points estimés | Phase |
|------|-----|---------|---------------|-------|
| E13 | Prompt Composer & BMAD Context Bridge | 7 | 24 | Sprint 8-9 |
| E14 | Token Budget & Cloud Escalade | 8 | 29 | Sprint 9-11 |
| E15 | Agent Lab & Scoring System | 7 | 26 | Sprint 10-11 |
| E16 | Dashboard Enrichi & Sprint Replay | 6 | 24 | Sprint 10-11 |
| E17 | Workflow Scrum Complet | 5 | 21 | Sprint 8-12 |
| E18 | Mode Interactif & Notifications | 5 | 21 | Sprint 12 |
| E19 | Module iamthelaw BMAD | 7 | 26 | Sprint 14+ |
| E20 | CoachAgent & Amélioration Système | 6 | 24 | Sprint 13 |
| **Total** | | **51 stories** | **195 pts** | Sprint 8-14+ |
