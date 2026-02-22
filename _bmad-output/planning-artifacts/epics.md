---
stepsCompleted: ['step-01-validate-prerequisites', 'step-01b-resolve-sonarqube-config', 'step-02-design-epics', 'step-02b-day-sprint-continuous-improvement', 'step-03-prioritized-stories-backlog']
status: 'complete'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
workflowType: 'create-epics-and-stories'
project_name: 'cop1'
user_name: 'elzinko'
date: '2026-02-13'
totalFRs: 115
totalNFRs: 24
---

# cop1 / Morpheus — Epic Breakdown

## Overview

Ce document décompose les requirements du PRD et de l'Architecture en epics et stories implémentables, respectant les décisions architecturales (Feature First Hexagonal, ADR-001 à ADR-006).

---

## Requirements Inventory

### Functional Requirements

**CA1 — Backlog Management (10 FRs)**
- FR1 : Le Developer peut lire et naviguer le backlog de stories BMAD (markdown)
- FR2 : Le Developer peut consulter le statut de chaque story (backlog / ready-for-dev / in-progress / review / done)
- FR3 : Le System peut sélectionner automatiquement la prochaine story à traiter selon l'ordre de priorité décidé (WSJF ou manuel)
- FR4 : Le Developer peut marquer manuellement une story comme "ready" pour la nuit
- FR5 : Le System peut enrichir une story avec les outputs des agents (Dev Notes, Agent Record, Change Log)
- FR63 : Le PM Agent peut évaluer l'état de santé du backlog et produire un rapport (stories prêtes, en grooming, manquantes pour les prochains sprints)
- FR64 : Le System peut conduire des cérémonies de grooming entre le PM Agent et le Developer pour affiner, compléter, modifier ou annuler des stories
- FR65 : Le PM Agent peut estimer l'effort des stories en points Fibonacci lors du grooming
- FR66 : Le System peut vérifier les critères DoR multi-dimensionnels avant d'accepter une story en sprint : (1) story INVEST-conforme + AC définis + effort estimé + dépendances identifiées, (2) compétences équipe disponibles + charge raisonnable, (3) accès/secrets disponibles + infrastructure prête + pas de dépendance externe bloquante
- FR67 : Le Developer peut consulter un tableau de bord backlog séparé (état idéation/grooming vs sprint actif)
- FR68 : Le PM Agent peut calculer automatiquement un score de priorité (WSJF) pour ordonner le backlog
- FR69 : Le Developer peut ajuster manuellement les priorités du backlog, les ajustements étant conservés entre les sessions
- FR71 : Le System peut alerter si le backlog "prêt" est insuffisant pour couvrir N sprints à venir (seuil configurable)
- FR80 : Le Developer peut configurer les critères DoR applicables au projet (liste extensible)

**CA2 — Agent Orchestration (8 FRs)**
- FR6 : Le System peut lancer un workflow séquentiel d'agents (Dev → Reviewer → QA → PM) sur une story
- FR7 : Le System peut router chaque commande agent vers un LLM différent selon des règles configurables
- FR8 : Le System peut détecter un blocage agent (timeout ajusté à la saturation Docker + durée estimée dépassée) et activer la stratégie adaptative
- FR9 : Le System peut limiter le nombre d'itérations par story pour éviter les boucles infinies
- FR10 : Le System peut arrêter proprement le workflow autonome et reprendre depuis le dernier état stable
- FR11 : Le PM Agent peut formuler des questions bloquantes et les persister en fichier décision sans input humain
- FR12 : Le System peut exécuter des workflows agents pendant une plage horaire programmée (mode nuit)
- FR83 : Le System persiste l'état complet du workflow à chaque transition (story en cours, agent actif, étape, contexte) dans un fichier de checkpoint
- FR84 : Le System peut reprendre un workflow interrompu (crash, redémarrage, arrêt manuel) depuis le dernier checkpoint sans perte de travail

**CA2b — Blocage & Escalade (4 FRs)**
- FR41 : Le Dev Agent peut déclarer un blocage avec un type et une raison (timeout, erreur technique, ambiguïté, dépendance manquante, accès manquant, etc.)
- FR42 : Le PM Agent peut recevoir un blocage déclaré et router vers l'agent compétent (Architect, SM, Developer humain) selon le type de blocage
- FR43 : Le Developer peut résoudre un blocage (réponse, secret/credential, info technique, arbitrage) via la Web UI ou un fichier de réponse
- FR44 : Le System peut définir et configurer les types de blocages et leurs règles d'escalade

**CA3 — LLM Infrastructure (8 FRs)**
- FR13 : Le System peut se connecter à des LLMs locaux (Ollama) via une interface unifiée OpenAI-compatible
- FR14 : Le System peut basculer vers l'API Claude (cloud) pour les tâches complexes
- FR15 : Le Developer peut configurer les règles de routing LLM par type de commande agent
- FR16 : Le System peut télécharger et gérer des modèles Ollama localement
- FR17 : Chaque agent peut se connecter à des MCP servers pour accéder à des outils externes (recherche, APIs, filesystem)
- FR47 : Le System peut gérer les droits d'accès MCP par agent via un service centralisé (isolation des outils par rôle agent)
- FR49 : Le System peut upgrader dynamiquement le LLM d'un agent ("Super Saiyan mode") selon le niveau de difficulté détecté — chaque agent a un LLM par défaut + un LLM de fallback supérieur
- FR52 : Le System peut mesurer le taux tokens/seconde disponible et ajuster la participation des agents aux cérémonies en conséquence

**CA4 — Resource Management (4 FRs)**
- FR18 : Le System peut monitorer en temps réel la RAM et le CPU disponibles (priorité : charge Docker)
- FR19 : Le System peut suspendre un workflow agent quand les ressources descendent sous un seuil configurable
- FR20 : Le System peut maximiser l'utilisation des ressources la nuit selon un budget RAM configurable
- FR21 : Le System peut ajuster dynamiquement le nombre de modèles LLM chargés en fonction des ressources disponibles

**CA5 — Code Production & Git (6 FRs)**
- FR22 : Le Dev Agent peut produire du code sur une branche git isolée (worktree par story) et gérer les conflits en consultant l'historique des commits récents sur main
- FR23 : Le Dev Agent peut créer des commits structurés avec messages conventionnels
- FR24 : Le Reviewer Agent peut analyser le code produit et émettre un verdict (approve / request-changes), limité à N refus avant escalade au Developer
- FR25 : Le System peut merger ou proposer un merge de la branche story vers la branche principale
- FR26 : Le Developer peut consulter et valider manuellement les branches produites avant merge
- FR48 : Le System peut planifier les tâches nocturnes en tenant compte des dépendances entre features pour minimiser les conflits git (sprint planning nocturne)

**CA6 — Monitoring & Reporting (9 FRs)**
- FR27 : Le Developer peut consulter l'état du système en temps réel via une Web UI
- FR28 : Le System peut produire un Morning Report (markdown) résumant la nuit : stories traitées, blocages, résultats
- FR29 : Le System peut logger tous les événements agents en JSON structuré pour debugging
- FR30 : Le Developer peut consulter l'historique des décisions prises par les agents sur chaque story
- FR31 : Le System peut alerter le Developer (notification async) si un blocage critique survient en journée
- FR53 : Le System peut calculer et afficher un burndown pour anticiper les dérives en cours de sprint
- FR55 : Le System produit un journal narratif horodaté de toutes les actions et événements du sprint
- FR58 : Le Developer peut consulter les KPIs du sprint (vélocité, taux blocage, taux rejet DoD, couverture tests) via la Web UI
- FR70 : Le System peut calculer la vélocité de l'équipe (stories livrées / sprint) et projeter la capacité des prochains sprints

**CA7 — Agile Ceremony Engine (10 FRs)**
- FR45 : Le System peut conduire une rétrospective automatisée en fin de session nocturne (multi-agents) sur ce qui s'est bien/mal passé
- FR46 : Le System peut produire un plan d'actions issu de la rétrospective pour améliorer le sprint suivant
- FR50 : Le System peut planifier et exécuter des cérémonies agiles (sprint planning, daily async, retro, review/démo, réunion de blocage, grooming)
- FR51 : Le Scrum Master Agent peut faciliter les cérémonies, équilibrer les temps de parole, et produire un compte-rendu
- FR54 : Après chaque cérémonie, le System produit une synthèse/rapport simple lisible par le Developer
- FR79 : Le Scrum Master Agent dispose d'une base de référence Scrum/Agile consultable pour arbitrer les questions de méthode
- FR81 : Les cérémonies suivent un modèle tour de table séquentiel — Round 1 : chaque agent contribue → Round 2 si divergences : arbitrage → Synthèse finale par le SM Agent
- FR82 : Le Developer peut lire les contributions des agents et répondre de façon asynchrone
- FR85 : Le System implémente le modèle round-table séquentiel pour toutes les cérémonies
- FR86 : Le principe de convergence par diversité de perspectives est une règle d'équipe fondamentale

**CA8 — Configuration & Rules Engine (10 FRs)**
- FR32 : Le Developer peut configurer le système via un fichier `cop1.config.yaml`
- FR33 : Le Developer peut définir des règles métier per-agent via le system `iamthelaw` (YAML rules)
- FR34 : Le Developer peut définir les Definition of Done (DoD) spécifiques au projet
- FR35 : Le System peut valider qu'une story répond aux critères DoD avant de la marquer comme terminée
- FR56 : Le System maintient un ensemble de règles d'équipe (team rules) évolutives, réévaluées à chaque rétrospective
- FR57 : Le System peut limiter le nombre de rejections DoD et escalader au Developer si le seuil est dépassé
- FR59 : L'équipe peut proposer des modifications de règles autonomement, avec approbation implicite ou explicite du Developer
- FR60 : Durant chaque rétrospective, les agents peuvent proposer des modifications à leurs propres règles/compétences
- FR61 : Toute modification de règle agent est soumise à approbation explicite du Developer avant application
- FR62 : Le Developer peut consulter, approuver, modifier ou rejeter les propositions d'évolution des agents via la Web UI

**CA9 — BMAD Interface & Story Versioning (7 FRs)**
- FR72 : Le System peut lire les stories BMAD en lecture seule (jamais de modification directe des fichiers BMAD)
- FR73 : Au démarrage de chaque sprint, le System crée un snapshot versionné des stories sélectionnées
- FR74 : Le System travaille exclusivement sur les snapshots — les fichiers BMAD originaux ne sont jamais modifiés pendant un sprint
- FR75 : En fin de sprint, le System génère un rapport markdown lisible par BMAD listant ce qui a été fait
- FR76 : Avant le sprint planning, le Scrum Master Agent vérifie chaque story candidate contre les critères INVEST
- FR77 : Le System produit un rapport de santé du sprint backlog indiquant quelles stories sont INVEST-conformes
- FR78 : Le System ne peut pas sélectionner une story non-INVEST pour un sprint sans approbation explicite du Developer

**CA10 — Developer Control (5 FRs)**
- FR36 : Le Developer peut démarrer, mettre en pause, et arrêter le daemon cop1
- FR37 : Le Developer peut déclencher manuellement l'exécution d'une story spécifique
- FR38 : Le Developer peut consulter et modifier la configuration LLM routing à chaud
- FR39 : Le Developer peut définir les plages horaires de fonctionnement autonome
- FR40 : Le Developer peut exporter les données de sessions (stories, logs, rapports) pour archivage

**CA11 — Team Self-Improvement (2 FRs)**
- FR87 : Les KPIs de pilotage (vélocité, taux blocage, taux rejet DoD, qualité code) sont observables par le Developer et utilisés par l'équipe pour ses décisions d'auto-amélioration

**CA15 — Day Sprint Mode & Time-Boxing (7 FRs — ajouté 2026-02-13)**
- FR109 : Le Developer peut lancer un sprint à tout moment (jour ou nuit) en définissant une durée finie (ex. 1h, 2h, 4h, 8h) — la session s'arrête proprement à l'échéance même si des stories restent
- FR110 : En mode co-présence (Developer actif sur le poste), le Resource Manager réduit dynamiquement la charge LLM agents selon un budget RAM jour configurable (distinct du budget nuit), pour ne pas perturber le travail du Developer
- FR111 : Le Developer peut modifier le contenu des stories non-`in-progress` dans le backlog depuis la Web UI à tout moment, même pendant un sprint actif
- FR112 : Le Developer peut ouvrir un "débat d'équipe" (team debate) sur n'importe quelle suggestion ou décision depuis la Web UI — SM+PM+Architect Agent contribuent leurs avis en round-table asynchrone, le Developer lit et décide
- FR113 : Le System peut estimer en temps réel le temps nécessaire pour terminer le sprint en cours (time-to-completion) basé sur la vélocité observée, le burndown et le burnup
- FR114 : Le System peut alerter le Developer quand le risque de dépassement de durée du sprint est détecté (stories restantes × temps moyen > temps disponible)
- FR115 : Le Developer peut consulter un burndown et un burnup en temps réel pendant un sprint, avec projection de fin de sprint (estimated completion time)

**CA14 — Continuous Improvement Review (7 FRs — ajouté 2026-02-13)**
- FR102 : Le Developer peut consulter toutes les suggestions d'amélioration continue via une interface de review organisée par type : ArchitectureRuleProposal, TeamRuleProposal, AgentBehaviorProposal, RefactoringStoryProposal, QualityThresholdProposal, ProcessRuleProposal
- FR103 : Pour chaque suggestion, le Developer dispose de trois actions : approuver (yes), rejeter (no), ou ajouter un commentaire pour déclencher une re-analyse par le quorum agile de l'équipe
- FR104 : Quand le Developer ajoute un commentaire, le quorum agile (SM Agent + PM Agent + Architect Agent) re-examine la suggestion en session Round-Table, intègre le commentaire, et produit une position consolidée soumise à nouveau au Developer
- FR105 : Les rapports de rétrospective et toutes les décisions d'amélioration (approuvées, rejetées, en attente) sont stockés de façon persistante et versionnée dans `.cop1/improvement-decisions.jsonl` et `.cop1/retro-reports/` (format markdown + JSONL)
- FR106 : Les suggestions approuvées sont appliquées automatiquement via le `RuleApplicationService` qui route chaque décision vers son handler : iamthelaw YAML API (règles), backlog API (RefactoringStory), quality config API (seuils qualité) — jamais d'édition directe de fichiers par les agents
- FR107 : Le `RuleApplicationService` valide chaque règle à appliquer (schéma, conflits, doublons), l'applique dans le fichier cible, et enregistre l'application dans `iamthelaw/history.jsonl` avec applied_at, applied_by, source_proposal_id, status
- FR108 : Le Developer peut consulter l'historique complet des décisions d'amélioration (date, type, proposition, décision Developer, résultat d'application) via la Web UI

**CA12 — LLM Provisioning & Docker Management (5 FRs)**
- FR88 : Le Developer peut provisionner et déprovisionner des modèles LLM via la Web UI (Ollama REST API + Docker Engine API — compatible Docker Desktop)
- FR89 : Le System peut télécharger un modèle LLM dynamiquement (ollama pull via API HTTP) et l'activer sans redémarrer le daemon
- FR90 : Le Developer peut consulter la liste des modèles LLM disponibles, leur statut (downloading / loaded / stopped) et leur taille
- FR91 : Le sous-système de provisioning LLM est découplé du reste — `ContainerRuntimePort` (lifecycle containers) + `OllamaManagementPort` (gestion modèles) sont des ports indépendants
- FR92 : Le System supporte l'enregistrement de plusieurs LLM providers (local Docker, remote Ollama, Claude API) via `LLMProviderRegistry` — 1 provider actif en MVP, N providers en post-MVP

**CA13 — Quality Intelligence (8 FRs)**
- FR93 : Le System peut mesurer la couverture de tests via Vitest et appliquer des seuils minimum configurables par agent (DevAgent ≥ 80% par défaut)
- FR94 : Le ReviewerAgent peut analyser la qualité du code via des outils statiques (Biome, ts-morph, madge) : complexité cyclomatique, duplication, dépendances circulaires, conformité patterns existants
- FR95 : Chaque règle dans `iamthelaw` peut référencer un ou plusieurs outils de mesure (id outil + seuil + enforced) — la règle est vérifiable automatiquement
- FR96 : Le System peut détecter une dérive architecturale (imports cross-features, dépendances circulaires) via madge + ESLint à chaque commit agent
- FR97 : Le System peut mesurer la qualité des reviews dans le temps (taux d'approbation, taux de rework) pour améliorer le ReviewerAgent
- FR98 : Le System peut mesurer la qualité des rétrospectives (taux d'adoption des règles proposées, taux de complétion des refactoring stories)
- FR99 : Le Developer peut consulter un tableau de bord qualité (métriques par agent, par sprint, évolution) via la Web UI
- FR100 : Les agents peuvent suggérer des créations/modifications/suppressions de règles iamthelaw basées sur les outputs d'outils qualité — soumises à approbation Developer
- FR101 : Le Developer peut initialiser la configuration qualité d'un projet cible via `cop1 init <project-path>` — génère `.cop1/quality/` avec les configs dérivées des templates par défaut de cop1 (sonar-project.properties, .dependency-cruiser.js, .eslintrc.json)

---

### Non-Functional Requirements

**Performance (4)**
- NFR1 : La Web UI répond aux actions utilisateur en moins de 500ms (hors attente LLM)
- NFR2 : Un agent LLM local doit atteindre un minimum de 15 tokens/seconde pour participer à une cérémonie
- NFR3 : Le démarrage du daemon cop1 s'effectue en moins de 30 secondes
- NFR4 : Le Resource Monitor vérifie l'état des ressources en continu avec une latence de mesure < 1 seconde

**Security & Privacy (4)**
- NFR5 : Aucune donnée de code source ni clé API n'est transmise vers un service cloud sans consentement explicite (local-first by design)
- NFR6 : Les clés API sont stockées exclusivement dans `.env` — jamais committées, jamais loggées en clair
- NFR7 : Les conteneurs Docker LLM sont isolés réseau du reste du système
- NFR8 : Les MCP servers sont isolés par rôle agent

**Reliability & Resilience (4)**
- NFR9 : Disponibilité cible de 95% sur la durée de la session sprint configurée (1h à 8h+)
- NFR10 : Tout workflow interrompu est récupérable depuis le dernier checkpoint sans perte de travail
- NFR11 : Seuil de suspension automatique à 75% RAM (≈48GB/64GB) — jamais dépassé sans approbation
- NFR12 : Un agent bloqué depuis plus de `max_iteration_timeout` (défaut 30 min) est automatiquement escaladé

**Resource Management (4)**
- NFR13 : Un agent Resource Monitor surveille les ressources en continu et peut suggérer des ajustements
- NFR14 : La montée en charge RAM suit un profil progressif (ramp-up)
- NFR15 : Les seuils de ressources sont configurables dans `cop1.config.yaml`
- NFR16 : Le mode copilot (assistance temps réel sur le code que le Developer écrit) est hors scope MVP — le day sprint mode (agents autonomes en journée avec co-présence resource management) est dans le scope MVP

**Observability (4)**
- NFR17 : Tous les événements système sont loggés en JSON structuré avec timestamp, agent, story, action, durée
- NFR18 : Le Session Report est généré dans les 5 minutes suivant la fin d'une session sprint (à toute heure — jour ou nuit)
- NFR19 : La Web UI affiche l'état du sprint en temps réel avec un délai maximum de 5 secondes
- NFR20 : Chaque cérémonie produit un compte-rendu markdown dans les 2 minutes suivant sa clôture

**Maintainability (4)**
- NFR21 : L'architecture hexagonale est respectée — zéro dépendance infrastructure dans le domain (vérifiable via lint rule)
- NFR22 : La couverture de tests unitaires du domain package est maintenue ≥ 80%
- NFR23 : Toute règle d'équipe ou règle agent (iamthelaw) est versionnée en YAML lisible par un humain
- NFR24 : La configuration complète permet de recréer un environnement identique sur une autre machine

---

### Additional Requirements (Architecture)

**Setup & Infrastructure (greenfield) :**
- Monorepo pnpm avec 6 packages Feature First Hexagonal : `shared-kernel`, `observability`, `llm-intelligence`, `sprint-core`, `ceremony-engine`, `app` + `web`
- Docker stack Ollama + LiteLLM (docker-compose.yml) à provisionner
- TypeScript strict (NodeNext, noUncheckedIndexedAccess, noUnusedLocals) + biome + vitest
- iamthelaw/ centralisé avec fichiers YAML par agent + history.jsonl

**Contraintes architecturales impactant les stories :**
- ADR-001 : Persistance YAML + JSONL (pas de DB en MVP) — sprint-status.yaml + sprint-log-{date}.jsonl
- ADR-003 : Protocol file-centric — tout agent écrit dans stories/{id}-enriched.md puis callback orchestrateur
- ADR-006 : Feature First Hexagonal — chaque story travaille dans sa feature-dossier sans sortir
- Séquence crash-safe obligatoire : transitioning → transition → transitioned → agent.started
- StoryFileLock TTL obligatoire avant toute écriture dans un fichier story
- Barrel index.ts public par feature — imports internes interdits cross-features

**Règle métier Rétrospective (ajoutée en session architecture) :**
- Toute rétrospective DOIT produire ≥1 ArchitectureRuleProposal et ≥1 RefactoringStoryProposal
- Ces outputs sont soumis à approbation Developer avant application

**Docker Provisioning & Ollama (ajouté en session architecture) :**
- Ollama REST API : GET /api/tags, POST /api/pull, DELETE /api/delete → `OllamaManagementAdapter`
- Docker Engine API : start/stop containers → `DockerDesktopAdapter` implémente `ContainerRuntimePort`
- Setup initial manuel possible — automatisation via API activée progressivement
- `LLMProviderRegistry` : 1 provider local en MVP, N providers distants en post-MVP (scalabilité multi-machines)

**Quality Intelligence — outils TypeScript (ajouté en session architecture) :**
- Biome : lint + format (déjà prévu)
- Vitest : coverage (déjà prévu)
- TypeScript compiler : type check (déjà prévu)
- ts-morph : AST analysis, complexité cyclomatique
- dependency-cruiser : dépendances circulaires, drift architectural
- ESLint + plugins : règles custom, best practices
- SonarQube : quality gate centralisé (local Docker port 9000 par défaut, SonarCloud configurable par projet avec consentement explicite)
- Binding règle ↔ outil dans iamthelaw YAML : `tools: [{id, threshold, enforced}]`
- `QualityGateService` exécuté par l'orchestrateur entre chaque agent (après DevAgent commit ET lors de DoD validation — pas uniquement post-nuit)

**SonarQube Integration Strategy (résolu 2026-02-13) :**
- **Par défaut** : SonarQube local Docker (port 9000), code ne quitte jamais la machine
- **Cloud opt-in** : SonarCloud configurable par projet — nécessite `quality.sonarcloud.consent: true` dans `.cop1/config.yaml` du projet cible (NFR5 compliance)
- **Timing** : scan déclenché par QualityGateService après chaque commit DevAgent + comme étape DoD obligatoire
- **Resource scheduling** : hors scope MVP — SonarQube local tourne en permanence (4GB RAM acceptés, optimisation future)
- **API agents** : ReviewerAgent et QualityGateService consomment uniquement `/api/measures`, `/api/issues`, `/api/qualitygates` — jamais de lecture directe du code source

**Config Files — Architecture per-project (résolu 2026-02-13) :**
- Les fichiers `.dependency-cruiser.js`, `.eslintrc.json`, `sonar-project.properties` ne sont PAS à la racine de cop1
- cop1 contient des **templates** dans `packages/quality-intelligence/templates/` (versionnés avec cop1)
- Sur `cop1 init <project-path>`, cop1 génère `.cop1/quality/` dans le projet cible avec les configs dérivées des templates
- Les agents lisent `{target-project}/.cop1/quality/` — jamais la racine cop1
- Surcharges locales possibles dans `.cop1/quality/` (fichiers édités directement par le Developer)
- Structure runtime per-project :
  ```
  {target-project}/
    .cop1/
      quality/
        sonar-project.properties
        .dependency-cruiser.js
        .eslintrc.json
      config.yaml
      sprint-status.yaml
      stories/
  ```
- cop1 contient ses propres configs de build dans `packages/*/` (séparées des templates projets)

**Day Sprint Mode & Time-Boxing — Architecture (ajouté 2026-02-13) :**

Sprint = session à durée finie, pas une plage horaire fixe nocturne :
- Le Developer choisit la durée au démarrage : `cop1 sprint start --duration 2h`
- Le scheduler arrête proprement le workflow à l'échéance (arrêt après la story en cours, pas en milieu de story)
- Séquences courtes recommandées au démarrage (1h) pour itérer rapidement et tester la stabilité en co-présence

Mode co-présence (day sprint) :
- RAM budget jour < RAM budget nuit (configurable, ex. nuit = 48GB, jour = 20GB par défaut)
- Le Resource Monitor adapte en continu selon la charge réelle du poste Developer
- Les agents "mettent en veille" les modèles LLM non utilisés si la RAM dépasse le budget jour

Burndown / Burnup / Time-to-completion :
- Burndown : stories restantes vs temps écoulé dans la session
- Burnup : points livrés vs engagement sprint
- Time-to-completion = (stories restantes × temps moyen par story estimé sur les dernières sessions)
- Alerte si `time-to-completion > temps restant` → risque de dépassement visible en Web UI

Backlog modifiable pendant sprint :
- Stories `in-progress` : lecture seule (verrouillées pendant le sprint)
- Stories `backlog / ready / review / done` : modifiables librement par le Developer
- Story modifiée pendant un sprint actif → ne sera prise en compte qu'au prochain sprint planning

**Continuous Improvement Review — Architecture (ajouté 2026-02-13) :**

Types de suggestions et leurs handlers d'application :

| Type | Source | Handler | Cible d'application |
|------|--------|---------|---------------------|
| ArchitectureRuleProposal | Rétrospective | `iamthelaw/ArchitectureRuleHandler` | `iamthelaw/architecture.yaml` |
| TeamRuleProposal | Rétrospective / agents | `iamthelaw/TeamRuleHandler` | `iamthelaw/global.yaml` ou `scrum.yaml` |
| AgentBehaviorProposal | Rétrospective / auto-assess | `iamthelaw/AgentRuleHandler` | `iamthelaw/agents/{agent}.yaml` |
| RefactoringStoryProposal | Rétrospective | `BacklogApplicationHandler` | Nouvelle story dans backlog BMAD format |
| QualityThresholdProposal | Quality metrics | `QualityConfigHandler` | `.cop1/quality/` config + iamthelaw binding |
| ProcessRuleProposal | Rétrospective / cérémonies | `iamthelaw/ProcessRuleHandler` | `iamthelaw/scrum.yaml` |

Workflow Developer review :
```
suggestion créée → statut: pending_review
  ↓ Developer : yes  → RuleApplicationService.apply() → statut: applied
  ↓ Developer : no   → statut: rejected (archivé dans improvement-decisions.jsonl)
  ↓ Developer : comment → ImprovementReviewSession → quorum Round-Table (SM+PM+Arch)
                           → position consolidée → retour Developer → yes/no
```

Persistance :
- `.cop1/improvement-decisions.jsonl` : toutes les décisions (pending/applied/rejected) avec full audit trail
- `.cop1/retro-reports/{date}-retro.md` : rapport narratif de chaque rétrospective
- `iamthelaw/history.jsonl` : log d'application des règles (applied_at, applied_by, proposal_id, status)

`RuleApplicationService` est un port dans `@cop1/sprint-core` — pas d'accès direct aux fichiers par les agents.

**Stratégie MVP auto-implémentation :**
- Sprint 0 (manuel) : shared-kernel + observability + llm-routing + sprint-core basique + app daemon
- Sprint 1 (nuit 1 autonome) : DevAgent basique + feature branches + morning report → merge manuel Developer
- Sprint 2 : ReviewerAgent + QualityGate basiques + pre-commit hook obligatoire
- Sprint 3 : ceremony-engine + web UI
- Sprint 4 : docker-provisioning + quality-intelligence complet
- cop1 développe cop1 dès Sprint 1 : isolation via feature branches, merge manuel = filet qualité naturel

**Package final (7 packages) :**
shared-kernel → observability → llm-intelligence → quality-intelligence → sprint-core → ceremony-engine → app + web

---

### FR Coverage Map

| FR | Epic | Statut |
|----|------|--------|
| FR1-5 | E2 | ✅ |
| FR6-12 | E3 | ✅ |
| FR13-17 | E5 | ✅ |
| FR18-21 | E7 | ✅ |
| FR22-26 | E3 | ✅ |
| FR27-31 | E11 | ✅ |
| FR32 | E1 | ✅ |
| FR33-35 | E9 | ✅ |
| FR36-40 | E1 | ✅ |
| FR41-44 | E4 | ✅ |
| FR45-46 | E8 (E12 pour retro outputs) | ✅ |
| FR47 | E5 | ✅ |
| FR48 | E3 | ✅ |
| FR49 | E5 | ✅ |
| FR50-51 | E8 | ✅ |
| FR52 | E5 | ✅ |
| FR53 | E11 | ✅ |
| FR54-55 | E8/E11 | ✅ |
| FR56-62 | E9 | ✅ |
| FR63-69 | E2 | ✅ |
| FR70-71 | E2/E11 | ✅ |
| FR72-78 | E2 | ✅ |
| FR79 | E8 | ✅ |
| FR80 | E2 | ✅ |
| FR81-86 | E8 | ✅ |
| FR87 | E12 | ✅ |
| FR88-92 | E6 | ✅ |
| FR93-100 | E10 | ✅ |
| FR101 | E1/E10 | ✅ |
| FR102-108 | E12/E11 | ✅ |
| FR109-115 | E3/E7/E11 | ✅ |
| FR116 | E3 | ✅ |

**Couverture : 116/116 FRs — 100%**

---

## Epic List

### Epic 1 — Foundation & Project Init

**User Value :** "Je peux installer cop1, initialiser un projet cible, et contrôler le daemon depuis la CLI."

**FRs couvertes :** FR32, FR36, FR37, FR38, FR39, FR40, FR101

**Package principal :** `@cop1/app`

**Dépendances :** Aucune (Epic fondatrice)

**Stories :**

- **E1-S1** : Monorepo setup — pnpm workspace, TypeScript strict NodeNext, biome, vitest, packages vides Feature First Hexagonal (shared-kernel, observability, llm-intelligence, quality-intelligence, sprint-core, ceremony-engine, app, web)
- **E1-S2** : cop1 CLI daemon — commandes `start`, `stop`, `pause`, `resume` + PID file + health check
- **E1-S3** : cop1.config.yaml — chargement, validation, hot-reload à chaud (FR32, FR38, FR39)
- **E1-S4** : `cop1 init <project-path>` — création `.cop1/` runtime dans le projet cible : `config.yaml`, `quality/` avec configs générées depuis templates (FR101)
- **E1-S5** : Export sessions — `cop1 export` produit archive stories/logs/rapports (FR40)
- **E1-S6** : cop1.config.yaml for M3 Max — fichier de configuration avec routing LLM Ollama pour MacBook Pro M3 Max 64GB

**Definition of Done :**
- `pnpm build` succeed en zéro erreur TypeScript
- `pnpm test` ≥ 80% couverture sur les modules créés
- `cop1 start` démarre le daemon en < 30s (NFR3)
- `cop1 init ./mon-projet` génère `.cop1/quality/` avec les 3 fichiers de config
- `cop1.config.yaml` chargé sans erreur de validation ConfigLoader

---

### Epic 2 — Backlog Management & BMAD Interface

**User Value :** "Je peux voir et gérer mon backlog depuis cop1 — les fichiers BMAD ne sont jamais modifiés."

**FRs couvertes :** FR1, FR2, FR3, FR4, FR5, FR63, FR64, FR65, FR66, FR67, FR68, FR69, FR71, FR72, FR73, FR74, FR75, FR76, FR77, FR78, FR80

**Package principal :** `@cop1/sprint-core`

**Dépendances :** E1

**Stories :**

- **E2-S1** : BMAD Reader — lecture YAML/markdown stories en lecture seule, index des stories, navigation (FR1, FR72)
- **E2-S2** : Story Status Tracker — statuts backlog/ready/in-progress/review/done, persistance dans `.cop1/sprint-status.yaml` (FR2)
- **E2-S3** : Story Snapshot — au sprint planning, création snapshots versionnés dans `.cop1/stories/{id}-snapshot.md` (FR73, FR74)
- **E2-S4** : Story Enrichment — append Dev Notes + Agent Record + Change Log dans le snapshot (FR5)
- **E2-S5** : DoR Validator — vérification critères DoR multi-dimensionnels : (1) INVEST + ACs + effort + dépendances, (2) compétences équipe, (3) infra/accès (FR66 → 3 ACs distincts)
- **E2-S6** : INVEST Validator — rapport santé backlog + blocage sélection si non-INVEST sans approbation (FR76, FR77, FR78)
- **E2-S7** : PM Agent — Backlog Health Report + grooming ceremony + estimation Fibonacci (FR63, FR64, FR65)
- **E2-S8** : WSJF Scoring — calcul automatique score priorité + ajustement manuel persisté (FR68, FR69)
- **E2-S9** : Backlog Alerts — seuil configurable "N sprints ahead" + alerte si insuffisant (FR71)
- **E2-S10** : Sprint End Report — rapport markdown lisible BMAD en fin de sprint (FR75)
- **E2-S11** : Backlog Dashboard (Web UI) — tableau de bord état idéation/grooming vs sprint actif (FR67)

**Definition of Done :**
- BMAD source files jamais modifiés (test d'intégrité checksum)
- DoR validation couvre les 3 dimensions (3 tests unitaires distincts)
- PM Agent produit un rapport grooming valide en format markdown

---

### Epic 3 — Sprint Engine Core

**User Value :** "Le système travaille sur mes stories pendant que je dors — avec crash recovery."

**FRs couvertes :** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR22, FR23, FR24, FR25, FR26, FR48, FR83, FR84, FR109, FR111

**Package principal :** `@cop1/sprint-core`

**Dépendances :** E1, E2, E5

**Stories :**

- **E3-S1** : Workflow Engine — orchestration séquentielle Dev→Reviewer→QA→PM, avec QualityGateService entre agents (FR6)
- **E3-S2** : LLM Routing per Command — dispatch commandes vers LLM configuré (FR7) — interface vers E5
- **E3-S3** : Checkpoint System — persistance état complet à chaque transition (crash-safe sequence : reserving→transitioning→transitioned→started) (FR83)
- **E3-S4** : Resume from Checkpoint — reprise workflow depuis dernier état stable (FR10, FR84)
- **E3-S5** : DevAgent — production code sur git worktree isolé `agent/{story-key}-{timestamp}`, commits conventionnels (FR22, FR23)
- **E3-S6** : ReviewerAgent — analyse code produit, verdict approve/request-changes, limite N refus avant escalade (FR24)
- **E3-S7** : StoryFileLock — mutex TTL 10min, atomic write .tmp→rename POSIX (FR8 dependency)
- **E3-S8** : Branch & Merge Management — merge ou PR proposal vers main (FR25, FR26)
- **E3-S9** : Night Mode Scheduler — exécution dans plage horaire configurée, arrêt propre à la fin (FR12, FR39)
- **E3-S10** : Iteration Limiter — max_iterations par story configurable, blocage auto si dépassé (FR9)
- **E3-S11** : Conflict-Aware Sprint Planning — planification nocturne tenant compte des dépendances inter-features (FR48)
- **E3-S12** : PM Decision File — questions bloquantes persistées en fichier sans input humain (FR11)
- **E3-S13** : Time-Boxed Sprint — `cop1 sprint start --duration Xh` démarre une session à durée finie, arrêt propre à l'échéance après la story en cours (FR109)
- **E3-S14** : Backlog Edit Lock — stories `in-progress` en lecture seule pendant un sprint, les autres modifiables librement via Web UI (FR111)
- **E3-S15** : Worktree Execution Mode — `cop1 sprint run --simulate` exécute un sprint réel dans un git worktree isolé avec vrais agents LLM, sans auto-merge — le développeur inspecte et merge manuellement (FR116)
- **E3-S16** : Wire Real Agents in SprintRunner — remplacer les stubs DevAgentStep/ReviewerAgentStep par les vrais DevAgent/ReviewerAgent injectés avec LLMCodeGenerator/LLMReviewer via OllamaAdapter + LLMGateway + LLMRouter
- **E3-S17** : DevAgent Prompt Enhancement — enrichir `buildDevPrompt()` avec contexte projet (tech stack, conventions, architecture) et extraction structurée des sections story (AC, Tasks, Dev Notes)
- **E3-S18** : PM Agent Wiring — remplacer le stub `PMAgentStep` par un vrai `PMAgentWorkflowStep` qui valide les ACs de la story contre le code généré (heuristique MVP, non-bloquant)

**Definition of Done :**
- Un workflow Dev→Reviewer complet s'exécute sans crash sur une story de test
- Crash recovery : kill -9 du daemon → reprise correcte depuis checkpoint au redémarrage
- StoryFileLock : test de contention simultanée (2 writers) → exactement 1 winner
- Sprint 2h : arrêt propre après la story en cours quand `elapsed >= duration` (jamais en milieu de story)
- Story `in-progress` : tentative de modification depuis Web UI → erreur 409 explicite

---

### Epic 4 — Blocage & Escalade

**User Value :** "Quand un agent est bloqué, le système escalade intelligemment — je suis informé sans être spammé."

**FRs couvertes :** FR41, FR42, FR43, FR44

**Package principal :** `@cop1/sprint-core`

**Dépendances :** E3

**Stories :**

- **E4-S1** : BlockageDeclaration — DevAgent peut déclarer un blocage typé (timeout, ambiguïté, dépendance manquante, accès, technique) (FR41)
- **E4-S2** : Escalade Router — PM Agent route le blocage vers l'agent compétent (Architect, SM, Developer) selon type (FR42)
- **E4-S3** : Developer Response Channel — résolution via fichier de réponse `.cop1/decisions/{id}.yaml` (lecture Web UI + CLI) (FR43)
- **E4-S4** : Blocage Config — types et règles d'escalade configurables dans cop1.config.yaml (FR44)

**Definition of Done :**
- 5 types de blocages distincts testés unitairement
- Résolution via fichier YAML reprise par le workflow correctement

---

### Epic 5 — LLM Infrastructure & Routing

**User Value :** "Je peux configurer quel LLM fait quoi — et le système s'adapte si un LLM est lent."

**FRs couvertes :** FR13, FR14, FR15, FR16, FR17, FR47, FR49, FR52

**Package principal :** `@cop1/llm-intelligence`

**Dépendances :** E1

**Stories :**

- **E5-S1** : LLM Gateway — interface unifiée OpenAI-compatible vers Ollama local (FR13)
- **E5-S2** : Claude API Adapter — basculement cloud pour tâches complexes (FR14) — consent NFR5
- **E5-S3** : LLM Routing Config — règles par type de commande agent dans cop1.config.yaml (FR15)
- **E5-S4** : Model Manager — download/activation modèles Ollama sans redémarrer daemon (FR16)
- **E5-S5** : MCP Server Registry — gestion droits d'accès MCP par agent, isolation outils par rôle (FR17, FR47)
- **E5-S6** : Adaptive LLM Escalation — upgrade dynamique LLM agent si difficulté détectée (renommé de "Super Saiyan mode") (FR49)
- **E5-S7** : Tokens/sec Monitor — mesure débit LLM, ajustement participation agents aux cérémonies (FR52)
- **E5-S8** : LLM Agent Adapters — `LLMCodeGenerator` implémente `CodeGeneratorPort` et `LLMReviewer` implémente `ReviewerPort` via LLMGateway + OllamaAdapter
- **E5-S9** : LLMGateway Event Emission — injecter EventBus dans LLMGateway, émettre `llm.call.started` et `llm.call.completed` autour de chaque appel `complete()`/`completeForAgent()` avec model, agentType, promptLength, responseLength, durationMs, tokenCount (FR29, NFR17)
- **E5-S10** : LoggerBridge LLM Event Tracking — ajouter `llm.call.started` et `llm.call.completed` à `TRACKED_EVENTS` pour écriture dans `.cop1/sprint-log-*.jsonl` (FR29, NFR17)
- **E5-S11** : TokensPerSecMonitor Wiring — connecter TokensPerSecMonitor à l'EventBus, souscrire à `llm.call.completed` pour alimenter `record()` automatiquement (FR52)
- **E5-S12** : Ollama Models in Sprint Status — câbler OllamaManagementAdapter dans `cop1 sprint status` pour afficher les modèles Ollama disponibles avec leur taille (FR16, FR90)

**Definition of Done :**
- LLM Gateway répond à une requête Ollama locale en < 2s pour un modèle chargé
- Routing config : changement à chaud testé sans redémarrage daemon
- MCP isolation : agent A ne peut pas accéder aux tools réservés à agent B (test)
- LLMCodeGenerator et LLMReviewer testés avec LLMProvider mock (zéro dépendance Ollama en tests unitaires)
- LLMGateway émet `llm.call.completed` avec model, durationMs, tokenCount après chaque appel (test avec EventBus mock)
- `.cop1/sprint-log-*.jsonl` contient des entrées `llm.call.completed` après un sprint avec agents réels
- `cop1 sprint status` affiche les modèles Ollama disponibles (ou "unavailable" si Ollama down)

---

### Epic 6 — LLM Provisioning & Docker

**User Value :** "Je peux provisionner et gérer les LLMs depuis la Web UI — sans ligne de commande Docker."

**FRs couvertes :** FR88, FR89, FR90, FR91, FR92

**Package principal :** `@cop1/llm-intelligence`

**Dépendances :** E5

**Stories :**

- **E6-S1** : OllamaManagementAdapter — pull/delete/list modèles via Ollama REST API (GET /api/tags, POST /api/pull, DELETE /api/delete) (FR89, FR90)
- **E6-S2** : ContainerRuntimePort — start/stop containers Docker via Docker Engine API (DockerDesktopAdapter) (FR88, FR91)
- **E6-S3** : LLMProviderRegistry — registre providers (local Docker + Claude API), 1 actif en MVP (FR92)
- **E6-S4** : LLM Management UI — Web UI pour provisionner/déprovisionner modèles, voir statuts downloading/loaded/stopped (FR88, FR90)

**Definition of Done :**
- `ollama pull mistral` déclenché depuis Web UI → modèle disponible dans la liste
- ContainerRuntimePort : test avec Docker mock (pas de dépendance Docker Engine en CI)
- LLMProviderRegistry : switch entre 2 providers sans restart

---

### Epic 7 — Resource Management

**User Value :** "cop1 ne consomme jamais plus que la RAM configurée — il s'adapte seul en cours de nuit."

**FRs couvertes :** FR18, FR19, FR20, FR21

**NFRs :** NFR11, NFR13, NFR14, NFR15, NFR16

**Package principal :** `@cop1/shared-kernel` (ResourceMonitor) + `@cop1/app`

**Dépendances :** E1

**Stories :**

- **E7-S1** : Resource Monitor — surveillance RAM/CPU en continu, latence < 1s (FR18, NFR4, NFR13)
- **E7-S2** : Suspension automatique — seuil 75% RAM (48GB), suspension workflow avec état sauvegardé (FR19, NFR11)
- **E7-S3** : Session Ramp-Up — profil progressif de montée en charge, ajustement nb modèles LLM chargés selon budget RAM de la session (FR20, FR21, NFR14)
- **E7-S4** : Resource Config — seuils configurables dans cop1.config.yaml : budget RAM nuit (défaut 48GB) + budget RAM jour (défaut 20GB) (FR19 config, NFR15)
- **E7-S5** : Co-Presence Mode — en day sprint, Resource Monitor détecte la charge du poste Developer (CPU/RAM usage hors cop1) et réduit dynamiquement la charge LLM pour maintenir la fluidité du poste (FR110)

**Definition of Done :**
- Suspension déclenchée quand RAM simulée > 75% (test avec mock)
- Ramp-up : charge 2 modèles → check RAM → charge 3e si disponible (logique testée)
- Co-presence : RAM poste > seuil configuré → agents passent au budget jour automatiquement (test avec mock charge externe)

---

### Epic 8 — Agile Ceremony Engine

**User Value :** "L'équipe d'agents s'auto-organise via des cérémonies Scrum — je peux lire les comptes-rendus le matin."

**FRs couvertes :** FR45, FR46, FR50, FR51, FR54, FR79, FR81, FR82, FR85, FR86

**Package principal :** `@cop1/ceremony-engine`

**Dépendances :** E3, E5

**Stories (1 par type de cérémonie + infrastructure) :**

- **E8-S1** : Round-Table Engine — modèle tour de table séquentiel : Round 1 contributions → Round 2 arbitrage si divergences → Synthèse SM (FR81, FR85)
- **E8-S2** : Scrum Master Agent — facilitation cérémonies, équilibre temps de parole, compte-rendu markdown, base référence Scrum (FR51, FR79)
- **E8-S3** : Sprint Planning Ceremony — sélection stories, capacité équipe, engagement sprint (FR50-Sprint Planning)
- **E8-S4** : Daily Async Ceremony — status check asynchrone par agent, identification blocages (FR50-Daily)
- **E8-S5** : Sprint Review Ceremony — démo stories livrées, feedback, rapport (FR50-Review)
- **E8-S6** : Retrospective Ceremony — analyse sprint passé, plan d'amélioration, outputs obligatoires (FR45, FR46, FR50-Retro)
- **E8-S7** : Grooming Ceremony — affinage stories, estimation effort, validation DoR (FR50-Grooming) — interface vers E2
- **E8-S8** : Developer Async Channel — Developer peut lire contributions agents et répondre de façon asynchrone (FR82)
- **E8-S9** : PlanningDecision Protocol — ceremony-engine retourne des décisions, sprint-core les applique (pas de writes cross-package) (FR50 → ADR-006)
- **E8-S10** : Ceremony Summary Report — rapport simple post-cérémonie en < 2 min (FR54, NFR20)

**Definition of Done :**
- Retrospective produit ≥1 ArchitectureRuleProposal + ≥1 RefactoringStoryProposal (règle métier)
- PlanningDecision protocol : zéro write ceremony-engine → sprint-core (test d'intégrité dépendances)
- Chaque cérémonie produit un compte-rendu markdown horodaté

---

### Epic 9 — Rules Engine & iamthelaw

**User Value :** "Je peux définir les règles de mon équipe et du projet — les agents les respectent et peuvent les faire évoluer."

**FRs couvertes :** FR33, FR34, FR35, FR56, FR57, FR58 (DoD part), FR59, FR60, FR61, FR62, FR95, FR100

**Package principal :** `@cop1/sprint-core` (feature iamthelaw)

**Dépendances :** E1

**Stories :**

- **E9-S1** : iamthelaw Core — chargement rules YAML (global.yaml, scrum.yaml, architecture.yaml, agents/*.yaml) + history.jsonl append-only (FR33, FR56)
- **E9-S2** : DoD Definition & Validation — critères DoD configurables par projet, vérification avant story done (FR34, FR35)
- **E9-S3** : DoD Rejection Limiter — seuil max rejections configurable, escalade au Developer si dépassé (FR57)
- **E9-S4** : Rule Proposal Workflow — agents proposent modifications, soumises à approbation Developer (FR59, FR60, FR61)
- **E9-S5** : Rule Approval UI — Web UI pour consulter/approuver/modifier/rejeter propositions agents (FR62)
- **E9-S6** : Quality Tool Binding — chaque règle iamthelaw peut référencer outil de mesure + seuil + enforced flag (FR95)
- **E9-S7** : Auto-Rule Suggestions — agents suggèrent créations/modifications rules basées sur outputs qualité (FR100)
- **E9-S8** : RuleApplicationService — service port qui route les décisions approuvées vers leurs handlers (ArchitectureRuleHandler, TeamRuleHandler, AgentRuleHandler, BacklogApplicationHandler, QualityConfigHandler, ProcessRuleHandler) — jamais d'écriture directe de fichier par un agent (FR106, FR107)
- **E9-S9** : Application Audit Log — chaque application de règle enregistrée dans `iamthelaw/history.jsonl` avec applied_at, applied_by, source_proposal_id, status (FR107)

**Definition of Done :**
- iamthelaw history.jsonl : ajout règle → entrée ajoutée avec added_at, added_by, source, rationale, status
- Proposition règle → Developer approuve via UI → règle active dans le prochain cycle via RuleApplicationService
- Binding tool : règle avec `enforced: true` bloque le DoD si seuil non atteint
- RuleApplicationService : zéro chemin d'écriture iamthelaw hors du service (test d'intégrité dépendances)

---

### Epic 10 — Quality Intelligence

**User Value :** "Je peux mesurer la qualité du code produit par les agents et voir la tendance sprint après sprint."

**FRs couvertes :** FR93, FR94, FR96, FR97, FR98, FR99, FR101 (init templates)

**Package principal :** `@cop1/quality-intelligence`

**Dépendances :** E1, E3

**Stories :**

- **E10-S1** : Quality Config Templates — templates par défaut (sonar-project.properties, .dependency-cruiser.js, .eslintrc.json) dans `packages/quality-intelligence/templates/`, générés dans `.cop1/quality/` par `cop1 init` (FR101)
- **E10-S2** : Coverage Gate — mesure couverture Vitest, seuils configurables par agent (DevAgent ≥ 80% par défaut) (FR93)
- **E10-S3** : Static Analysis Gate — Biome + dependency-cruiser + ts-morph : complexité cyclomatique, duplication, dépendances circulaires (FR94)
- **E10-S4** : Architectural Drift Detector — détection imports cross-features, dépendances circulaires à chaque commit agent (FR96)
- **E10-S5** : SonarQube Adapter — scan déclenché par QualityGateService, consommation API `/api/measures` + `/api/issues` + `/api/qualitygates` (FR93, FR94)
- **E10-S6** : QualityGateService — orchestré entre chaque agent par sprint-core, exécute la chaîne coverage → static → sonar → decision (FR93-96)
- **E10-S7** : Review Quality Metrics — mesure taux approbation/rework ReviewerAgent dans le temps (FR97)
- **E10-S8** : Retrospective Quality Metrics — taux adoption règles proposées, taux complétion refactoring stories (FR98)
- **E10-S9** : Quality Dashboard (Web UI) — métriques par agent, par sprint, évolution (FR99)

**Definition of Done :**
- QualityGateService bloque le workflow si couverture < seuil configuré
- SonarQube Adapter : test avec SonarQube mock (scan → quality gate FAILED → workflow stoppé)
- Architectural Drift : import cross-feature détecté → commit refusé (test)

---

### Epic 11 — Monitoring, Reporting & Web UI

**User Value :** "Je peux voir en temps réel ce que fait l'équipe la nuit — et lire le Morning Report le matin."

**FRs couvertes :** FR27, FR28, FR29, FR30, FR31, FR53, FR55, FR58, FR67 (shared E2), FR70, FR87, FR113, FR114, FR115

**Package principal :** `@cop1/web` + `@cop1/app` (SSE daemon)

**Dépendances :** E1, E3

**Stories :**

- **E11-S1** : SSE Daemon Stream — daemon émet événements SSE temps réel (ADR-002 : SSE + REST) (FR27, NFR19)
- **E11-S2** : Sprint Dashboard — Web UI temps réel : état sprint, agent actif, story en cours, burndown (FR27, FR53)
- **E11-S3** : Session Report Generator — rapport markdown auto généré en < 5 min après fin de toute session sprint (jour ou nuit) : stories livrées, blocages, métriques, projection (FR28, NFR18)
- **E11-S4** : Structured JSON Logger — tous les événements agents en JSON structuré (timestamp, agent, story, action, durée) (FR29, NFR17)
- **E11-S5** : Decision History — historique décisions agents par story, consultable via Web UI (FR30)
- **E11-S6** : Async Notification — alerte Developer si blocage critique survient (FR31)
- **E11-S7** : Narrative Sprint Journal — journal horodaté narratif de toutes les actions sprint (safeAppend()) (FR55)
- **E11-S8** : KPIs Dashboard — vélocité, taux blocage, taux rejet DoD, couverture tests (FR58, FR87)
- **E11-S9** : Velocity & Capacity Projector — calcul vélocité + projection sprints futurs (FR70)
- **E11-S11** : Burndown & Burnup Temps Réel — graphes burndown (stories restantes vs temps écoulé) + burnup (points livrés vs engagement) actualisés en continu pendant le sprint (FR115)
- **E11-S12** : Time-to-Completion Estimator — estimation temps restant pour terminer le sprint (stories restantes × temps moyen observé), alerte si risque de dépassement détecté (FR113, FR114)
- **E11-S10** : Improvement Decisions History UI — historique complet des décisions d'amélioration (date, type, proposition, décision Developer, résultat d'application) consultable via Web UI (FR108)
- **E11-S13** : SprintFormatter LLM Display — souscrire aux événements `llm.call.completed`, afficher en temps réel le modèle, la durée et les tokens pour chaque appel LLM pendant l'exécution du sprint (FR29, NFR17)

**Definition of Done :**
- Dashboard Web UI affiche état sprint en < 5s délai (NFR19)
- Morning Report généré en < 5 min (NFR18)
- safeAppend() : crash en cours d'append → fichier lisible sans corruption
- SprintFormatter affiche inline `(model duration tokens)` pour chaque step LLM — fallback silencieux si aucun event LLM

---

### Epic 12 — Continuous Improvement Review & Self-Improvement

**User Value :** "Je valide les améliorations une par une, par type — et les règles approuvées s'appliquent automatiquement. Je peux demander à l'équipe de re-analyser avant de décider."

**FRs couvertes :** FR46, FR60, FR87 (shared E11), FR98 (shared E10), FR102, FR103, FR104, FR105, FR106, FR107, FR108, FR112

**Package principal :** `@cop1/ceremony-engine` + `@cop1/web` (UI review) + `@cop1/sprint-core` (RuleApplicationService)

**Dépendances :** E8, E9, E10, E11

**Stories :**

- **E12-S1** : Retrospective Outputs Mandatory — Retrospective DOIT produire ≥1 ArchitectureRuleProposal + ≥1 RefactoringStoryProposal, créés comme suggestions pending_review (FR46)
- **E12-S2** : Agent Self-Assessment — chaque agent évalue ses propres performances et propose modifications de ses règles comme AgentBehaviorProposal (FR60)
- **E12-S3** : Improvement Persistence — toutes les suggestions stockées dans `.cop1/improvement-decisions.jsonl` + rapports retro dans `.cop1/retro-reports/{date}-retro.md` (FR105)
- **E12-S4** : Improvement Review UI — interface Web organisée par type (ArchitectureRule, TeamRule, AgentBehavior, RefactoringStory, QualityThreshold, ProcessRule) avec statut pending/approved/rejected/in-quorum (FR102, FR108)
- **E12-S5** : Developer Review Actions — trois actions disponibles : yes (approve) → déclenche RuleApplicationService, no (reject) → archive avec raison, commentaire → déclenche ImprovementReviewSession (FR103)
- **E12-S6** : Quorum Re-Analysis Session (ImprovementReviewSession) — déclenchée en dehors du sprint actif (matin / inter-sprint) : SM + PM + Architect Agent relisent suggestion + commentaire Developer en Round-Table asynchrone → position consolidée → retour Developer (FR104)
- **E12-S6b** : Team Debate Button — depuis n'importe quelle suggestion dans la Web UI, le Developer peut ouvrir un débat d'équipe (équivalent Party Mode) → même mécanique que ImprovementReviewSession mais déclenchable sur demande ad hoc (FR112)
- **E12-S7** : Rule Auto-Application — décision approved → `RuleApplicationService.apply(type, payload)` → handler approprié → audit log `iamthelaw/history.jsonl` (FR106, FR107)
- **E12-S8** : Improvement KPI Tracking — taux adoption règles proposées + taux complétion refactoring stories sprint après sprint (FR87, FR98)

**Definition of Done :**
- Retrospective sans ArchitectureRuleProposal → workflow bloqué avec erreur explicite
- Developer approve → RuleApplicationService.apply() → règle visible dans iamthelaw YAML + entrée dans history.jsonl
- Developer commente → ImprovementReviewSession lance Round-Table → position consolidée en < 10 min simulé
- improvement-decisions.jsonl : toutes les transitions d'état enregistrées (pending → approved/rejected/in-quorum)
- RefactoringStoryProposal approuvée → story créée dans backlog au format BMAD (BacklogApplicationHandler)
- Zéro écriture iamthelaw hors RuleApplicationService (test isolation)

---

## Sprint Ordering

### Sprint 0 (Manuel — Bootstrap)
- E1 complet (monorepo setup, CLI, cop1 init)
- E5-S1, E5-S2, E5-S3 (LLM Gateway basique)
- E7-S1 (Resource Monitor basique)
- E3-S1 partiel (Workflow Engine stub)

### Sprint 1 (Nuit 1 autonome — cop1 développe cop1)
- E3-S3, E3-S4 (Checkpoint + Resume)
- E3-S5 (DevAgent)
- E2-S1, E2-S2, E2-S3 (BMAD Reader + Snapshot)

### Sprint 2
- E3-S6 (ReviewerAgent)
- E10-S2, E10-S3, E10-S6 (Coverage Gate + Static Analysis + QualityGateService)
- E4 complet (Blocage & Escalade)

### Sprint 3
- E8-S1, E8-S2 (Round-Table Engine + SM Agent)
- E8-S6 (Retrospective)
- E11-S1, E11-S2, E11-S3 (SSE + Dashboard + Morning Report)

### Sprint 4
- E6 complet (LLM Provisioning)
- E10-S5 (SonarQube Adapter)
- E2 complet (Backlog complet)
- E9-S8, E9-S9 (RuleApplicationService + audit log)

### Sprint 5
- E12 complet (Continuous Improvement Review & Self-Improvement)
- E9 complet (iamthelaw complet — proposals + approval UI)
- E11-S10 (Improvement Decisions History UI)

### Sprint 6 — Real Agent Wiring, Worktree Execution & LLM Observability
- E1-S6 (cop1.config.yaml for M3 Max)
- E5-S8 (LLM Agent Adapters — LLMCodeGenerator + LLMReviewer)
- E3-S16 (Wire Real Agents in SprintRunner)
- E3-S15 (Worktree Execution Mode)
- E5-S9 (LLMGateway Event Emission)
- E5-S10 (LoggerBridge LLM Event Tracking)
- E5-S11 (TokensPerSecMonitor Wiring)
- E11-S13 (SprintFormatter LLM Display)
- E5-S12 (Ollama Models in Sprint Status)

### Sprint 7 — Quality Improvements
- E3-S17 (DevAgent Prompt Enhancement) — CRITICAL
- E3-S18 (PM Agent Wiring) — after E3-S17

---

## Step 3 — Stories Backlog Priorisé

> **Convention :** pts = Fibonacci (1,2,3,5,8,13) | Priorité = Must Have / Should Have / Nice to Have
> **ACs** : 2-3 critères d'acceptance testables, précis, orientés comportement observable.

---

### Sprint 0 — Bootstrap Manuel (Developer seul)

> Objectif : monorepo opérationnel, CLI fonctionnel, LLM Gateway basique, Resource Monitor, Workflow Engine stub. Tout est codé à la main par le Developer.

---

#### [E1-S1] Monorepo setup
> **5 pts** | Must Have | Bloque : tout le reste

- **AC1** : `pnpm build` réussit sans erreur TypeScript strict (NodeNext, noUncheckedIndexedAccess) sur les 8 packages (shared-kernel, observability, llm-intelligence, quality-intelligence, sprint-core, ceremony-engine, app, web)
- **AC2** : `pnpm test` lance Vitest sur tous les packages et génère un rapport de couverture LCOV agrégé
- **AC3** : `pnpm lint` (Biome) passe sans warning sur l'ensemble du monorepo

---

#### [E1-S2] cop1 CLI daemon
> **5 pts** | Must Have | Bloqué par : E1-S1

- **AC1** : `cop1 start` démarre le daemon en arrière-plan (PID file dans `.cop1/daemon.pid`), retourne 0 en < 30s (NFR3)
- **AC2** : `cop1 stop` arrête proprement le daemon (SIGTERM → cleanup → exit 0), supprime le PID file
- **AC3** : `cop1 status` retourne `running` ou `stopped` avec le PID, `cop1 health` retourne JSON `{status, uptime, version}`

---

#### [E1-S3] cop1.config.yaml — chargement et hot-reload
> **3 pts** | Must Have | Bloqué par : E1-S1

- **AC1** : Au démarrage, `cop1.config.yaml` est chargé et validé (Zod schema) — erreur explicite si champ obligatoire manquant
- **AC2** : Modification de `cop1.config.yaml` pendant que le daemon tourne → configuration rechargée en < 2s sans redémarrage (FR38)

---

#### [E1-S4] `cop1 init <project-path>`
> **3 pts** | Must Have | Bloqué par : E1-S2

- **AC1** : `cop1 init ./mon-projet` génère `.cop1/quality/` avec `sonar-project.properties`, `.dependency-cruiser.js`, `.eslintrc.json` dérivés des templates de `packages/quality-intelligence/templates/`
- **AC2** : Si `.cop1/` existe déjà, la commande affiche un avertissement et demande confirmation avant d'écraser (pas d'écrasement silencieux)

---

#### [E5-S1] LLM Gateway — interface unifiée Ollama
> **5 pts** | Must Have | Bloqué par : E1-S1

- **AC1** : `LLMGateway.complete(prompt, model)` envoie une requête OpenAI-compatible à Ollama local (port 11434) et retourne la réponse en streaming
- **AC2** : Si Ollama n'est pas disponible, `LLMGateway` lève une `LLMUnavailableError` typée — pas de crash non géré

---

#### [E5-S3] LLM Routing Config
> **3 pts** | Must Have | Bloqué par : E5-S1, E1-S3

- **AC1** : `cop1.config.yaml` accepte une section `llm_routing` avec des règles `{command_type: model_id}` — chaque type de commande agent est routé vers le LLM configuré
- **AC2** : Changement de routing à chaud (hot-reload E1-S3) → la prochaine commande agent utilise le nouveau modèle sans redémarrage

---

#### [E7-S1] Resource Monitor
> **5 pts** | Must Have | Bloqué par : E1-S1

- **AC1** : `ResourceMonitor.snapshot()` retourne `{ramUsedGB, ramTotalGB, ramPercent, cpuPercent}` avec une latence < 1s (NFR4)
- **AC2** : `ResourceMonitor.startPolling(intervalMs)` émet des événements `resource.snapshot` en continu — les tests vérifient que le polling s'arrête proprement sur `stop()`

---

#### [E7-S4] Resource Config
> **2 pts** | Must Have | Bloqué par : E1-S3, E7-S1

- **AC1** : `cop1.config.yaml` accepte `resources.ram_budget_night_gb` (défaut 48) et `resources.ram_budget_day_gb` (défaut 20) — les valeurs sont chargées par ResourceMonitor au démarrage
- **AC2** : Budget invalide (< 4 ou > RAM totale) → erreur de validation au démarrage avec message explicite

---

#### [E3-S1] Workflow Engine — orchestration stub
> **8 pts** | Must Have | Bloqué par : E1-S1, E5-S1, E7-S1

- **AC1** : `WorkflowEngine.run(storyId)` exécute une séquence configurable d'étapes (Dev → Reviewer → QA → PM) et appelle `QualityGateService` entre chaque étape — chaque étape est un stub retournant `{status: 'ok'}` en Sprint 0
- **AC2** : `WorkflowEngine` émet des événements dot-notation à chaque transition : `story.workflow.started`, `story.step.completed`, `story.workflow.completed`
- **AC3** : Un test d'intégration exécute le workflow complet sur une story fictive et vérifie que toutes les étapes sont appelées dans l'ordre

---

### Sprint 1 — Première Session Autonome

> Objectif : DevAgent fonctionnel, BMAD Reader, Checkpoint/Resume, Time-Boxing, Session Report. cop1 commence à développer cop1.

---

#### [E2-S1] BMAD Reader
> **3 pts** | Must Have | Bloqué par : E1-S4

- **AC1** : `BMADReader.listStories(projectPath)` retourne la liste des stories BMAD (fichiers markdown) avec leurs métadonnées (id, title, status, priority) — les fichiers source ne sont jamais modifiés
- **AC2** : Après lecture, un checksum SHA-256 des fichiers BMAD est calculé et stocké — `BMADReader.verifyIntegrity()` lève une erreur si un fichier a été modifié

---

#### [E2-S2] Story Status Tracker
> **3 pts** | Must Have | Bloqué par : E2-S1

- **AC1** : `StoryStatusTracker.setStatus(storyId, status)` persiste le statut dans `.cop1/sprint-status.yaml` avec timestamp — statuts valides : `backlog | ready | in-progress | review | done`
- **AC2** : Transition invalide (ex. `done → in-progress`) lève une `InvalidTransitionError` avec les statuts source et cible indiqués

---

#### [E2-S3] Story Snapshot
> **3 pts** | Must Have | Bloqué par : E2-S1

- **AC1** : `SnapshotService.createSnapshot(storyId)` crée `.cop1/stories/{storyId}-snapshot.md` copie exacte du fichier BMAD source — le snapshot inclut un header `snapshot_at` + `source_checksum`
- **AC2** : Le workflow ne travaille jamais sur le fichier BMAD original mais uniquement sur le snapshot — vérifié par un test qui mock `BMADReader` et vérifie que seul le snapshot est passé aux agents

---

#### [E2-S4] Story Enrichment
> **2 pts** | Must Have | Bloqué par : E2-S3

- **AC1** : `EnrichmentService.append(snapshotId, section, content)` ajoute une section (Dev Notes / Agent Record / Change Log) au snapshot sans écraser le contenu existant (`safeAppend()`)
- **AC2** : `safeAppend()` : crash simulé en cours d'écriture (mock) → le fichier snapshot reste lisible et non corrompu

---

#### [E3-S3] Checkpoint System
> **8 pts** | Must Have | Bloqué par : E3-S1

- **AC1** : À chaque transition de workflow, `CheckpointService.save(state)` écrit atomiquement `.cop1/checkpoint.yaml` (write .tmp → rename POSIX) avec `{storyId, agentName, step, timestamp, context}`
- **AC2** : Séquence crash-safe respectée : `agent.slot.reserved → story.status.transitioning → transition → story.status.transitioned → agent.started` — un test vérifie que chaque flag est écrit avant le suivant

---

#### [E3-S4] Resume from Checkpoint
> **5 pts** | Must Have | Bloqué par : E3-S3

- **AC1** : `WorkflowEngine.resume()` lit `.cop1/checkpoint.yaml` et reprend le workflow à l'étape indiquée sans re-exécuter les étapes précédentes
- **AC2** : Simulation kill -9 du daemon (mock) + redémarrage → `WorkflowEngine.resume()` reprend correctement, aucune story n'est traitée deux fois

---

#### [E3-S5] DevAgent
> **13 pts** | Must Have | Bloqué par : E3-S1, E2-S3, E5-S1

- **AC1** : `DevAgent.run(snapshot)` crée un git worktree isolé `agent/{storyId}-{timestamp}`, produit du code, et crée des commits avec messages conventionnels (`feat:`, `fix:`, `chore:`)
- **AC2** : Le worktree est créé à partir de `HEAD` de la branche principale — `git log` dans le worktree montre l'historique récent de main
- **AC3** : DevAgent ne modifie aucun fichier en dehors de son worktree — vérifié par test d'isolation filesystem

---

#### [E3-S13] Time-Boxed Sprint
> **5 pts** | Must Have | Bloqué par : E3-S1

- **AC1** : `cop1 sprint start --duration 2h` démarre une session et crée `.cop1/session.yaml` avec `{started_at, duration_minutes, deadline}`
- **AC2** : Quand `elapsed >= duration`, le Workflow Engine finit la story en cours et s'arrête proprement — aucune story n'est interrompue en milieu d'exécution
- **AC3** : `cop1 sprint start` sans `--duration` utilise la valeur par défaut de `cop1.config.yaml` (`sprint.default_duration_hours`)

---

#### [E11-S1] SSE Daemon Stream
> **5 pts** | Must Have | Bloqué par : E1-S2

- **AC1** : `GET /events` (SSE) diffuse tous les événements dot-notation du daemon (ex. `story.workflow.started`) avec `data: {eventType, timestamp, payload}` en JSON
- **AC2** : Reconnexion client SSE (déconnexion simulée) → le stream reprend sans perte d'état du daemon

---

#### [E11-S3] Session Report Generator
> **5 pts** | Must Have | Bloqué par : E3-S13, E11-S4

- **AC1** : En fin de session sprint, `SessionReportService.generate()` crée `.cop1/reports/{date}-{time}-session.md` en < 5 min (NFR18) avec : stories livrées, blocages, métriques clés
- **AC2** : Le rapport est généré même si le daemon a crashé (lecture depuis `.cop1/sprint-log-{date}.jsonl`) — aucune perte de rapport sur crash

---

#### [E11-S4] Structured JSON Logger
> **3 pts** | Must Have | Bloqué par : E1-S2

- **AC1** : `Logger.event(type, payload)` appende une ligne JSON dans `.cop1/sprint-log-{date}.jsonl` avec `{timestamp, eventType, agentName, storyId, action, durationMs}` (NFR17)
- **AC2** : `Logger.event()` ne lève jamais d'exception — erreur d'écriture loggée en stderr et ignorée (jamais de crash agent sur log failure)

---

### Sprint 2 — ReviewerAgent, QualityGate, Blocage

> Objectif : cycle Dev→Review fonctionnel avec quality gate, gestion des blocages, StoryFileLock.

---

#### [E3-S7] StoryFileLock
> **3 pts** | Must Have | Bloqué par : E3-S1

- **AC1** : `StoryFileLock.acquire(storyId, ttlMinutes=10)` crée un fichier `.cop1/locks/{storyId}.lock` atomiquement (O_CREAT|O_EXCL) — si le lock existe et n'est pas expiré, retourne `LockConflictError`
- **AC2** : Lock TTL expiré → `acquire()` réussit et écrase le lock périmé — vérifié par test avec horloge mockée

---

#### [E3-S6] ReviewerAgent
> **8 pts** | Must Have | Bloqué par : E3-S5, E3-S7

- **AC1** : `ReviewerAgent.review(worktreeId)` analyse le diff git et retourne `{verdict: 'approve'|'request-changes', comments: string[]}` — le verdict est persisté dans le snapshot (E2-S4)
- **AC2** : Si `request-changes` est émis N fois consécutives (N configurable, défaut 3) → `ReviewerAgent` lève `MaxRejectionsError` et escalade au Developer
- **AC3** : `ReviewerAgent` ne lit pas le code directement — il consomme le résumé produit par les outils qualité (output QualityGateService)

---

#### [E3-S8] Branch & Merge Management
> **5 pts** | Must Have | Bloqué par : E3-S6

- **AC1** : `MergeService.proposeOrMerge(worktreeId, strategy)` crée une PR (fichier `.cop1/merge-proposals/{storyId}.yaml`) ou merge directement selon la config `git.auto_merge`
- **AC2** : `git.auto_merge: false` (défaut) → la branche reste en attente, `cop1 status` indique les branches à merger manuellement

---

#### [E3-S14] Backlog Edit Lock
> **2 pts** | Must Have | Bloqué par : E2-S2

- **AC1** : Story au statut `in-progress` → `PUT /api/stories/{id}` retourne HTTP 409 avec `{error: 'story_locked', reason: 'in-progress'}` — aucune modification possible
- **AC2** : Stories aux autres statuts modifiables librement depuis la Web UI pendant un sprint actif

---

#### [E3-S15] Worktree Execution Mode
> **5 pts** | Must Have | Bloqué par : E3-S16

- **AC1** : `cop1 sprint run --simulate` crée un git worktree isolé via `WorktreeManager`, exécute le sprint complet avec vrais agents LLM (DevAgent via Ollama, ReviewerAgent via Ollama) — le code est réellement généré et commité dans le worktree
- **AC2** : `git.auto_merge: false` est respecté — aucun merge automatique vers main. Le worktree reste intact pour inspection manuelle. `cop1 sprint status` indique les branches worktree en attente de merge.
- **AC3** : Un log d'exécution détaillé est affiché en console : chaque story traitée avec transitions, chaque workflow step avec résultat (code généré, verdict review), résumé final (done/failed/skipped, durée)

---

#### [E3-S16] Wire Real Agents in SprintRunner
> **5 pts** | Must Have | Bloqué par : E5-S8, E1-S6

- **AC1** : `SprintRunner` instancie `OllamaAdapter`, `LLMGateway.withRouter(LLMRouter)`, puis crée `DevAgent(new LLMCodeGenerator(gateway))` et `ReviewerAgent(new LLMReviewer(gateway))` au lieu des stubs — vérifié par inspection du code
- **AC2** : `cop1 sprint run --dry-run` continue de fonctionner sans aucun appel LLM
- **AC3** : `cop1 sprint run --filter "E3-S15"` sur une story de test appelle réellement Ollama — le DevAgent génère du code dans un worktree, le ReviewerAgent émet un verdict — les événements workflow sont émis sur l'EventBus

---

#### [E4-S1] Blocage Declaration
> **3 pts** | Must Have | Bloqué par : E3-S5

- **AC1** : `BlockageService.declare(storyId, type, reason)` crée `.cop1/blocages/{id}.yaml` avec `{id, storyId, type, reason, declaredAt, status: 'open'}` — types valides : `timeout | ambiguity | missing-dependency | missing-access | technical`
- **AC2** : Déclaration d'un blocage → émission événement `story.blocked` sur le SSE stream (E11-S1)

---

#### [E4-S2] Escalade Router
> **5 pts** | Must Have | Bloqué par : E4-S1

- **AC1** : `EscaladeService.route(blocage)` détermine l'agent cible selon le type : `ambiguity → Architect`, `missing-access → Developer`, `technical → SM`, `timeout → PM` — configurable dans `cop1.config.yaml`
- **AC2** : Le routing est testé avec les 5 types de blocage, chacun routant vers l'agent attendu (unit test table-driven)

---

#### [E4-S3] Developer Response Channel
> **3 pts** | Must Have | Bloqué par : E4-S1

- **AC1** : `POST /api/blocages/{id}/resolve` accepte `{response: string}` et crée `.cop1/decisions/{id}.yaml` — le WorkflowEngine détecte le fichier et reprend le workflow sur la story bloquée
- **AC2** : Résolution d'un blocage → statut blocage passe à `resolved`, événement `story.unblocked` émis sur SSE

---

#### [E4-S4] Blocage Config
> **2 pts** | Should Have | Bloqué par : E1-S3, E4-S2

- **AC1** : `cop1.config.yaml` accepte une section `blocage_rules` avec `{type: agent_cible}` — surcharge le routing par défaut de `EscaladeService`
- **AC2** : Règle manquante pour un type → fallback sur `Developer` avec log d'avertissement

---

#### [E10-S2] Coverage Gate
> **5 pts** | Must Have | Bloqué par : E3-S5

- **AC1** : `CoverageGate.check(worktreeId)` lance `vitest run --coverage` dans le worktree et retourne `{passed: boolean, coverage: number, threshold: number}`
- **AC2** : Couverture < seuil configuré (défaut 80%) → `CoverageGate.check()` retourne `passed: false` et `WorkflowEngine` bloque la transition vers Reviewer

---

#### [E10-S3] Static Analysis Gate
> **5 pts** | Must Have | Bloqué par : E3-S5

- **AC1** : `StaticAnalysisGate.check(worktreeId)` exécute Biome + dependency-cruiser et retourne `{passed, violations: [{rule, file, line}]}`
- **AC2** : Import cross-features détecté (violation dependency-cruiser) → `passed: false` avec la violation listée explicitement

---

#### [E10-S6] QualityGateService
> **8 pts** | Must Have | Bloqué par : E10-S2, E10-S3

- **AC1** : `QualityGateService.runAll(worktreeId)` exécute coverage → static → (SonarQube si configuré) dans l'ordre, retourne `{passed, gates: [{name, passed, details}]}`
- **AC2** : Premier gate échoué → les gates suivants ne sont pas exécutés (fail-fast configurable)
- **AC3** : `QualityGateService` est appelé par `WorkflowEngine` entre chaque agent — test d'intégration vérifie que `Reviewer` ne démarre pas si le gate précédent a échoué

---

#### [E7-S2] Suspension automatique
> **3 pts** | Must Have | Bloqué par : E7-S1, E7-S4

- **AC1** : Quand `resourceSnapshot.ramPercent >= 75`, `SuspensionService.suspend()` est appelé — le workflow sauvegarde un checkpoint et s'arrête proprement
- **AC2** : Quand `ramPercent < 70` après suspension, `SuspensionService.resume()` reprend le workflow depuis le checkpoint — vérifié par test avec ResourceMonitor mocké

---

### Sprint 3 — Cérémonies Agiles, Dashboard, Burndown

> Objectif : Round-Table Engine, Scrum Master Agent, Retrospective, Sprint Dashboard temps réel, Burndown/Burnup.

---

#### [E8-S1] Round-Table Engine
> **8 pts** | Must Have | Bloqué par : E5-S1, E3-S1

- **AC1** : `RoundTableEngine.run(topic, participants)` exécute Round 1 (chaque agent contribue séquentiellement), détecte les divergences (score de consensus < seuil), et lance Round 2 si nécessaire
- **AC2** : `RoundTableEngine` retourne `{consensus: boolean, synthesis: string, contributions: [{agent, position}]}` — PlanningDecision protocol : zéro écriture cross-packages dans la round-table elle-même
- **AC3** : Test avec 3 agents mock dont 2 en accord → `consensus: true`, Round 2 non déclenché

---

#### [E8-S2] Scrum Master Agent
> **8 pts** | Must Have | Bloqué par : E8-S1

- **AC1** : `ScrumMasterAgent.facilitate(ceremonyType, context)` ouvre une session Round-Table, équilibre les contributions (chaque agent a un timeout configurable), et produit un compte-rendu markdown
- **AC2** : Le compte-rendu est généré dans `.cop1/retro-reports/` ou `.cop1/ceremonies/` selon le type — produit en < 2 min après clôture (NFR20)

---

#### [E8-S3] Sprint Planning Ceremony
> **5 pts** | Must Have | Bloqué par : E8-S1, E8-S2, E2-S2

- **AC1** : La cérémonie de Sprint Planning sélectionne les stories `ready` selon la capacité estimée (somme points ≤ capacité sprint) et produit un `PlanningDecision` avec la liste des stories engagées
- **AC2** : `PlanningDecision` est retourné à `sprint-core` qui applique le statut `in-progress` — aucune écriture depuis `ceremony-engine` vers `sprint-core` directement

---

#### [E8-S4] Daily Async Ceremony
> **3 pts** | Should Have | Bloqué par : E8-S1, E8-S2

- **AC1** : `DailyAsyncCeremony.run()` demande à chaque agent son status (yesterday / today / blockers) et agrège les réponses dans un compte-rendu markdown horodaté
- **AC2** : Blocages identifiés lors du Daily → `BlockageService.declare()` automatiquement appelé (interface vers E4)

---

#### [E8-S6] Retrospective Ceremony
> **8 pts** | Must Have | Bloqué par : E8-S1, E8-S2, E10-S6

- **AC1** : `RetroCeremony.run()` analyse le sprint passé (logs JSONL, métriques QualityGate) et produit obligatoirement ≥1 `ArchitectureRuleProposal` + ≥1 `RefactoringStoryProposal` — si aucun n'est produit, le workflow lève une `RetroOutputMissingError`
- **AC2** : Les proposals sont persistées dans `.cop1/improvement-decisions.jsonl` avec statut `pending_review` et émises sur SSE (`improvement.suggestion.submitted`)

---

#### [E8-S9] PlanningDecision Protocol
> **3 pts** | Must Have | Bloqué par : E8-S1

- **AC1** : `ceremony-engine` ne dispose d'aucun import direct de `sprint-core` — vérifié par dependency-cruiser : zéro dépendance `ceremony-engine → sprint-core`
- **AC2** : `PlanningDecision` est un type défini dans `shared-kernel` et implémenté dans `ceremony-engine` — `sprint-core` l'applique via son propre `PlanningDecisionApplier`

---

#### [E11-S2] Sprint Dashboard
> **8 pts** | Must Have | Bloqué par : E11-S1

- **AC1** : La Web UI affiche en temps réel (< 5s délai — NFR19) : story en cours, agent actif, étape, durée de la session, stories livrées / restantes
- **AC2** : Connexion SSE perdue → UI affiche un indicateur "reconnecting" et reprend l'affichage automatiquement à la reconnexion

---

#### [E11-S11] Burndown & Burnup Temps Réel
> **5 pts** | Must Have | Bloqué par : E11-S2, E3-S13

- **AC1** : Le Dashboard affiche un burndown (stories restantes vs temps écoulé dans la session) mis à jour à chaque completion de story
- **AC2** : Le burnup (points livrés vs engagement sprint) est calculé depuis `.cop1/sprint-status.yaml` et affiché en temps réel

---

#### [E11-S12] Time-to-Completion Estimator
> **3 pts** | Must Have | Bloqué par : E11-S11

- **AC1** : `TimeEstimator.estimate()` calcule `stories_restantes × temps_moyen_observé_par_story` et retourne `{estimatedRemainingMinutes, deadline, atRisk: boolean}`
- **AC2** : `atRisk: true` quand `estimatedRemainingMinutes > temps_restant_session` → alerte affichée dans la Web UI (badge rouge sur le Dashboard)

---

#### [E7-S3] Session Ramp-Up
> **5 pts** | Should Have | Bloqué par : E7-S1, E7-S4

- **AC1** : Au démarrage d'une session, les modèles LLM sont chargés progressivement : 1 modèle → check RAM → 2e modèle si `ramPercent < budget × 0.7` → etc.
- **AC2** : Ramp-up s'arrête avant le budget configuré — test avec budget 20GB mocké vérifie que le 4e modèle n'est pas chargé si la RAM est déjà à 85% du budget

---

#### [E7-S5] Co-Presence Mode
> **5 pts** | Must Have | Bloqué par : E7-S3

- **AC1** : `ResourceMonitor` mesure `ramUsedByOtherProcesses = ramTotal - ramUsedByCop1 - ramFree` — si > seuil co-présence configurable, le budget RAM actif bascule sur `ram_budget_day_gb`
- **AC2** : Passage co-présence → budget jour → certains modèles LLM déchargés automatiquement — événement `resource.mode_switched` émis sur SSE

---

### Sprint 4 — Backlog Complet, LLM Avancé, Docker, iamthelaw Core

> Objectif : Backlog management complet (DoR, WSJF, PM Agent), LLM avancé (Claude API, MCP, Escalation), Docker provisioning, iamthelaw core + RuleApplicationService.

---

#### [E2-S5] DoR Validator
> **5 pts** | Must Have | Bloqué par : E2-S2, E2-S1

- **AC1** : `DORValidator.validate(snapshot)` vérifie les 3 dimensions (stories INVEST + ACs + effort + dépendances | compétences équipe | infra/accès) et retourne `{passed, dimensions: [{name, passed, missing}]}`
- **AC2** : Story sans estimation Fibonacci → dimension 1 échoue avec `missing: ['effort_estimate']` — la story ne peut pas passer en sprint sans approbation Developer explicite

---

#### [E2-S6] INVEST Validator
> **3 pts** | Must Have | Bloqué par : E2-S1

- **AC1** : `INVESTValidator.check(snapshot)` évalue les 6 critères INVEST et retourne un score + les critères non satisfaits
- **AC2** : Story non-INVEST → `WorkflowEngine` refuse de la sélectionner pour un sprint sans `Developer.explicitApproval: true` dans le snapshot

---

#### [E2-S7] PM Agent
> **8 pts** | Must Have | Bloqué par : E2-S1, E8-S2

- **AC1** : `PMAgent.backlogHealthReport()` produit un rapport markdown listant : stories prêtes, en grooming, manquantes pour les N prochains sprints (N configurable)
- **AC2** : `PMAgent.estimateEffort(storyId)` propose une estimation Fibonacci (1,2,3,5,8,13) avec justification — l'estimation est persistée dans le snapshot via E2-S4

---

#### [E2-S8] WSJF Scoring
> **5 pts** | Should Have | Bloqué par : E2-S7

- **AC1** : `WSJFService.score(story)` calcule `WSJF = (businessValue + timeCriticality + riskReduction) / jobSize` depuis les métadonnées de la story
- **AC2** : Ajustement manuel du score par le Developer persiste dans `.cop1/wsjf-overrides.yaml` et survit aux rechargements de config

---

#### [E2-S9] Backlog Alerts
> **2 pts** | Should Have | Bloqué par : E2-S7

- **AC1** : `BacklogMonitor.checkReadiness()` compare le nombre de stories `ready` avec `config.backlog_min_sprint_coverage` — si insuffisant, émission de `backlog.insufficient_coverage` sur SSE et notification Developer (FR71)

---

#### [E2-S10] Sprint End Report
> **3 pts** | Should Have | Bloqué par : E8-S6, E11-S3

- **AC1** : En fin de sprint, `SprintEndReportService.generate()` crée un rapport markdown lisible par BMAD (FR75) listant stories livrées, vélocité, blocages, résultats QualityGate
- **AC2** : Le rapport est stocké dans `.cop1/sprint-reports/{sprintId}.md` ET disponible via `GET /api/sprint/report` (JSON)

---

#### [E2-S11] Backlog Dashboard UI
> **5 pts** | Should Have | Bloqué par : E11-S2, E2-S7

- **AC1** : La Web UI affiche deux vues distinctes : "Idéation & Grooming" (stories backlog/ready) et "Sprint Actif" (stories in-progress/review/done) — FR67
- **AC2** : Stories triées par score WSJF par défaut, drag-and-drop pour réordonner (override manuel persisté)

---

#### [E5-S2] Claude API Adapter
> **3 pts** | Should Have | Bloqué par : E5-S1

- **AC1** : `ClaudeAPIAdapter` implémente la même interface `LLMProvider` qu'`OllamaAdapter` — le routing config peut pointer n'importe quelle commande vers Claude sans modification du code agent
- **AC2** : Appel Claude API → clé API lue depuis `.env` uniquement, jamais exposée dans les logs (NFR6)

---

#### [E5-S4] Model Manager
> **5 pts** | Should Have | Bloqué par : E5-S1, E6-S1

- **AC1** : `ModelManager.pull(modelId)` déclenche `POST /api/pull` sur Ollama et retourne un stream de progression — l'état `{model, status: downloading|loaded|stopped, sizeGB}` est persisté dans `.cop1/models.yaml`
- **AC2** : `ModelManager.activate(modelId)` charge le modèle en mémoire sans redémarrer le daemon (FR16)

---

#### [E5-S5] MCP Server Registry
> **5 pts** | Should Have | Bloqué par : E5-S1

- **AC1** : `MCPRegistry.getToolsForAgent(agentName)` retourne uniquement les outils autorisés pour cet agent selon la config `mcp_permissions` — `DevAgent` ne peut pas accéder aux tools réservés à `ReviewerAgent`
- **AC2** : Tentative d'accès à un tool non autorisé → `MCPUnauthorizedError` avec le nom de l'agent et du tool (NFR8)

---

#### [E5-S6] Adaptive LLM Escalation
> **5 pts** | Should Have | Bloqué par : E5-S1, E5-S3

- **AC1** : Si `DevAgent` échoue 2 fois consécutives sur la même story, `AdaptiveLLMService.escalate(agentName)` bascule vers le LLM de fallback configuré pour cet agent
- **AC2** : L'escalade est loggée dans le snapshot (`agent_record: escalated_to: {model}`) et dans le Session Report

---

#### [E5-S7] Tokens/sec Monitor
> **3 pts** | Should Have | Bloqué par : E5-S1, E7-S1

- **AC1** : `TokensPerSecMonitor.measure(agentName)` mesure le débit LLM réel sur les 3 dernières requêtes et retourne `{tokensPerSec, meetsMinimum: boolean}` (seuil 15 t/s — NFR2)
- **AC2** : Agent avec `meetsMinimum: false` est exclu automatiquement des cérémonies Round-Table — la décision est loggée sur SSE (`agent.excluded_low_perf`)

---

#### [E6-S1] OllamaManagementAdapter
> **5 pts** | Must Have | Bloqué par : E5-S1

- **AC1** : `OllamaManagementAdapter` implémente `OllamaManagementPort` avec `listModels()`, `pullModel(id)`, `deleteModel(id)` via `GET /api/tags`, `POST /api/pull`, `DELETE /api/delete`
- **AC2** : `pullModel()` retourne un `AsyncIterable<ProgressEvent>` — le streaming de progression est testé avec un mock Ollama

---

#### [E6-S2] ContainerRuntimePort
> **5 pts** | Must Have | Bloqué par : E1-S1

- **AC1** : `DockerDesktopAdapter` implémente `ContainerRuntimePort` avec `startContainer(id)`, `stopContainer(id)`, `getStatus(id)` via Docker Engine API
- **AC2** : Tous les tests de `DockerDesktopAdapter` utilisent un mock Docker Engine — aucune dépendance Docker Engine réelle en CI

---

#### [E6-S3] LLMProviderRegistry
> **3 pts** | Must Have | Bloqué par : E5-S1, E5-S2, E6-S1

- **AC1** : `LLMProviderRegistry.getActive()` retourne le provider actif (1 en MVP) — switch entre 2 providers via `registry.setActive(providerId)` sans redémarrage
- **AC2** : Provider non enregistré → `ProviderNotFoundError` avec la liste des providers disponibles

---

#### [E6-S4] LLM Management UI
> **5 pts** | Should Have | Bloqué par : E11-S2, E6-S1, E6-S2

- **AC1** : La Web UI affiche la liste des modèles Ollama avec statut (`downloading / loaded / stopped`) et taille — boutons Pull / Delete / Load / Unload
- **AC2** : Pull déclenché depuis UI → barre de progression en temps réel via SSE (`model.pull.progress`) — pas de polling

---

#### [E9-S1] iamthelaw Core
> **5 pts** | Must Have | Bloqué par : E1-S1

- **AC1** : `IamTheLawLoader.load(projectPath)` charge les fichiers `global.yaml`, `scrum.yaml`, `architecture.yaml`, `agents/*.yaml` et retourne un `RuleSet` typé — les fichiers manquants sont ignorés avec log d'info
- **AC2** : `IamTheLawLoader.appendHistory(event)` ajoute une entrée dans `iamthelaw/history.jsonl` avec `{id, added_at, added_by, source, rationale, status}` — opération atomique, jamais de corruption

---

#### [E9-S2] DoD Definition & Validation
> **5 pts** | Must Have | Bloqué par : E9-S1

- **AC1** : `DoDService.validate(snapshot, projectPath)` vérifie chaque critère DoD défini dans `iamthelaw/global.yaml` (section `dod`) et retourne `{passed, failedCriteria: string[]}`
- **AC2** : Story non-DoD → statut ne peut pas passer à `done` — `WorkflowEngine` bloque la transition avec les critères non satisfaits listés

---

#### [E9-S3] DoD Rejection Limiter
> **3 pts** | Must Have | Bloqué par : E9-S2

- **AC1** : `DoDLimiter.check(storyId)` compte les rejections DoD sur la story — si `count >= config.dod.max_rejections` (défaut 3), escalade au Developer via `BlockageService.declare()`
- **AC2** : Compteur de rejections persisté dans le snapshot (pas en mémoire) — survit à un crash et redémarrage

---

#### [E9-S8] RuleApplicationService
> **8 pts** | Must Have | Bloqué par : E9-S1, E2-S3

- **AC1** : `RuleApplicationService.apply(proposalType, payload)` route vers le handler correct : `ArchitectureRuleHandler → iamthelaw/architecture.yaml`, `TeamRuleHandler → iamthelaw/global.yaml`, `AgentRuleHandler → iamthelaw/agents/{id}.yaml`, `BacklogApplicationHandler → backlog`, `QualityConfigHandler → .cop1/quality/`
- **AC2** : Validation anti-doublon : règle avec même `id` dans le fichier cible → `DuplicateRuleError` avec l'id existant
- **AC3** : Aucun agent ne peut écrire dans `iamthelaw/` sans passer par `RuleApplicationService` — vérifié par dependency-cruiser : seul `app/rule-application/` a un import vers `IamTheLawWriter`

---

#### [E9-S9] Application Audit Log
> **3 pts** | Must Have | Bloqué par : E9-S8, E9-S1

- **AC1** : Chaque appel `RuleApplicationService.apply()` réussi → entrée dans `iamthelaw/history.jsonl` avec `{applied_at, applied_by, source_proposal_id, proposal_type, target_file, status: applied}`
- **AC2** : Échec d'application → entrée avec `{status: failed, error}` — jamais de perte silencieuse

---

#### [E3-S9] Night/Day Mode Scheduler
> **3 pts** | Must Have | Bloqué par : E3-S13, E7-S5

- **AC1** : `cop1.config.yaml` accepte `schedule.auto_start: [{days, start_time, duration_hours}]` — le daemon démarre automatiquement les sessions planifiées
- **AC2** : Session planifiée pendant une session manuelle déjà en cours → planifiée ignorée avec log d'avertissement

---

#### [E3-S10] Iteration Limiter
> **2 pts** | Must Have | Bloqué par : E3-S1

- **AC1** : `IterationLimiter.check(storyId, agentName)` compte les itérations par agent par story — si `count >= config.max_iterations_per_agent` (défaut 5), lève `MaxIterationsError`
- **AC2** : `MaxIterationsError` → `WorkflowEngine` déclare un blocage de type `technical` via `BlockageService`

---

#### [E3-S11] Conflict-Aware Sprint Planning
> **5 pts** | Should Have | Bloqué par : E8-S3, E2-S7

- **AC1** : `SprintPlannerService.planNocturnal()` regroupe les stories par feature (chemin dans le repo) et les ordonne pour minimiser les conflits git (stories sur la même feature dans des sessions séparées)
- **AC2** : Deux stories modifiant le même fichier → planifiées dans des sessions différentes — test avec 3 stories dont 2 sur le même chemin

---

#### [E3-S12] PM Decision File
> **3 pts** | Should Have | Bloqué par : E3-S5, E4-S3

- **AC1** : `PMAgent.persistQuestion(storyId, question)` crée `.cop1/decisions/{storyId}-pending.yaml` avec `{question, context, asked_at}` — le workflow se met en pause (statut `awaiting-decision`)
- **AC2** : `GET /api/decisions/pending` retourne la liste des questions en attente — visible dans la Web UI

---

#### [E10-S1] Quality Config Templates
> **3 pts** | Must Have | Bloqué par : E1-S4

- **AC1** : `packages/quality-intelligence/templates/` contient les 3 templates (`sonar-project.properties.template`, `.dependency-cruiser.js.template`, `.eslintrc.json.template`) — `cop1 init` les copie dans `.cop1/quality/` en substituant `{{projectKey}}` et `{{projectName}}`
- **AC2** : Après `cop1 init`, les 3 fichiers sont valides et utilisables directement par les outils concernés (dependency-cruiser --config, eslint --config)

---

#### [E10-S4] Architectural Drift Detector
> **5 pts** | Must Have | Bloqué par : E10-S3, E3-S5

- **AC1** : `ArchDriftDetector.check(worktreeId)` exécute dependency-cruiser avec la config `.cop1/quality/.dependency-cruiser.js` et retourne les violations de règles cross-features
- **AC2** : Import `@cop1/sprint-core` depuis `@cop1/ceremony-engine` → violation détectée et `QualityGate` bloque le commit (test avec mock worktree contenant une violation)

---

#### [E10-S5] SonarQube Adapter
> **8 pts** | Should Have | Bloqué par : E10-S1, E3-S5

- **AC1** : `SonarQubeAdapter.scan(worktreeId, projectConfig)` lance le scanner SonarQube et attend la fin de l'analyse — consomme `/api/qualitygates/project_status` pour retourner `{passed: boolean}`
- **AC2** : SonarCloud (`consent: true`) vs local : détecté depuis `.cop1/config.yaml` — aucune donnée de code envoyée vers SonarCloud si `consent: false` ou absent (NFR5)
- **AC3** : SonarQube indisponible (timeout) → gate retourne `{passed: false, error: 'sonar_unavailable'}` — jamais de crash workflow

---

### Sprint 5 — Cérémonies Complètes, Qualité Complète, Self-Improvement

> Objectif : toutes les cérémonies, métriques qualité complètes, Continuous Improvement Review, KPIs.

---

#### [E8-S5] Sprint Review Ceremony
> **3 pts** | Should Have | Bloqué par : E8-S1, E8-S2, E2-S10

- **AC1** : `SprintReviewCeremony.run()` liste les stories livrées, agrège les outputs Dev Notes, et produit un rapport "démo" markdown
- **AC2** : Le rapport inclut les métriques QualityGate par story (coverage, violations, SonarQube status)

---

#### [E8-S7] Grooming Ceremony
> **5 pts** | Should Have | Bloqué par : E8-S1, E8-S2, E2-S5

- **AC1** : `GroomingCeremony.run(storyId)` convoque PM Agent + Architect Agent pour affiner la story, valider le DoR (E2-S5) et proposer une estimation Fibonacci — produit une story enrichie
- **AC2** : Story refusée en grooming (DoR non satisfait) → statut reste `backlog` avec commentaire de blocage explicite

---

#### [E8-S8] Developer Async Channel
> **3 pts** | Should Have | Bloqué par : E11-S1

- **AC1** : `POST /api/ceremonies/{ceremonyId}/respond` permet au Developer d'envoyer une réponse asynchrone pendant ou après une cérémonie — la réponse est injectée dans la prochaine round-table du SM Agent
- **AC2** : La réponse Developer est taguée `{author: 'developer', priority: 'high'}` dans le compte-rendu de cérémonie

---

#### [E8-S10] Ceremony Summary Report
> **2 pts** | Should Have | Bloqué par : E8-S2

- **AC1** : `CeremonySummaryService.generate(ceremonyId)` produit un markdown simple (≤ 1 page) dans les 2 min suivant la clôture (NFR20) — stocké dans `.cop1/ceremonies/{type}-{date}.md`

---

#### [E9-S4] Rule Proposal Workflow
> **5 pts** | Must Have | Bloqué par : E9-S1, E8-S6

- **AC1** : `RuleProposalService.submit(proposalType, payload, proposedBy)` crée une entrée `pending_review` dans `.cop1/improvement-decisions.jsonl` et émet `improvement.suggestion.submitted` sur SSE
- **AC2** : Les proposals sont typées et validées au submit (`ArchitectureRuleProposal` doit avoir `{rule_text, rationale, target_file}`) — payload invalide → `ValidationError` avant persistance

---

#### [E9-S5] Rule Approval UI
> **5 pts** | Must Have | Bloqué par : E12-S4, E9-S8

- **AC1** : La Web UI affiche les suggestions `pending_review` avec actions Yes / No / Debate — cliquer Yes appelle `POST /api/improvement-review/{id}/approve` qui déclenche `RuleApplicationService.apply()`
- **AC2** : Après approbation, le statut de la suggestion passe à `applied` dans la UI en temps réel (via SSE `improvement.rule.applied`)

---

#### [E9-S6] Quality Tool Binding
> **3 pts** | Should Have | Bloqué par : E9-S1, E10-S6

- **AC1** : Format règle iamthelaw accepte `tools: [{id: 'vitest-coverage', threshold: 80, enforced: true}]` — `QualityGateService` lit ce binding et configure le seuil du gate correspondant depuis la règle
- **AC2** : Règle avec `enforced: false` → le gate mesure et rapporte mais ne bloque pas le workflow

---

#### [E9-S7] Auto-Rule Suggestions
> **5 pts** | Nice to Have | Bloqué par : E9-S4, E10-S6

- **AC1** : `RuleSuggestionAgent.analyze(sprintMetrics)` compare les métriques observées aux seuils des règles iamthelaw et propose des ajustements (ex. "coverage stable à 87% sur 3 sprints → proposer seuil à 85%")
- **AC2** : Chaque suggestion auto est taguée `{source: 'auto', confidence: 0.0-1.0}` — le Developer voit la confiance avant d'approuver

---

#### [E10-S7] Review Quality Metrics
> **3 pts** | Should Have | Bloqué par : E3-S6, E11-S4

- **AC1** : `ReviewMetricsService.compute(sprintId)` calcule `{approvalRate, reworkRate, avgIterationsPerStory}` depuis les logs JSONL — persisté dans `.cop1/metrics/review-{sprintId}.json`

---

#### [E10-S8] Retro Quality Metrics
> **3 pts** | Should Have | Bloqué par : E8-S6

- **AC1** : `RetroMetricsService.compute()` calcule `{rulesAdoptionRate, refactoringStoriesCompletionRate}` en comparant proposals soumises vs appliquées vs stories terminées

---

#### [E10-S9] Quality Dashboard UI
> **5 pts** | Should Have | Bloqué par : E11-S2, E10-S2, E10-S3

- **AC1** : La Web UI affiche les métriques qualité par agent (coverage, violations) + évolution par sprint (graphe) — FR99
- **AC2** : Drill-down par story : détail des violations SonarQube + dependency-cruiser disponible en un clic

---

#### [E11-S5] Decision History
> **3 pts** | Should Have | Bloqué par : E11-S2, E3-S5

- **AC1** : `GET /api/stories/{id}/decisions` retourne la liste des décisions agents sur la story (issue de la section Agent Record du snapshot) — consultable en Web UI

---

#### [E11-S6] Async Notification
> **3 pts** | Should Have | Bloqué par : E11-S1

- **AC1** : Blocage critique (type `missing-access` ou `ambiguity`) → `NotificationService.alert(blocage)` émet `story.blocked.critical` sur SSE + crée `.cop1/alerts/{id}.yaml` lu par `cop1 status`

---

#### [E11-S7] Narrative Sprint Journal
> **3 pts** | Should Have | Bloqué par : E11-S4

- **AC1** : `NarrativeJournalService.append(event)` traduit un `NarrativeEvent` en phrase française lisible et l'appende avec horodatage dans `.cop1/sprint-narrative-{date}.md` via `safeAppend()`
- **AC2** : `safeAppend()` ne lève jamais d'exception — le journal est optionnel, un agent ne plante jamais pour un échec de journal

---

#### [E11-S8] KPIs Dashboard
> **5 pts** | Should Have | Bloqué par : E11-S2, E10-S7

- **AC1** : La Web UI affiche : vélocité (points/sprint), taux blocage, taux rejet DoD, couverture tests — historique sur les N derniers sprints
- **AC2** : Les KPIs sont calculés en < 500ms (lecture JSONL + calcul côté daemon) — NFR1

---

#### [E11-S9] Velocity & Capacity Projector
> **3 pts** | Should Have | Bloqué par : E11-S8

- **AC1** : `VelocityService.project(targetPoints)` calcule le nombre de sprints nécessaires pour livrer `targetPoints` points basé sur la vélocité moyenne des N derniers sprints

---

#### [E11-S10] Improvement Decisions History UI
> **5 pts** | Should Have | Bloqué par : E12-S3, E11-S2

- **AC1** : La Web UI affiche l'historique complet de `.cop1/improvement-decisions.jsonl` avec filtres par type / statut / sprint — chaque entrée montre la proposition, la décision Developer, le résultat d'application

---

#### [E12-S1] Retrospective Outputs Mandatory
> **3 pts** | Must Have | Bloqué par : E8-S6

- **AC1** : Retro sans `ArchitectureRuleProposal` → `RetroOutputMissingError` levée, cérémonie non clôturée — le SM Agent relance un Round 2 ciblé pour produire le proposal manquant
- **AC2** : Retro sans `RefactoringStoryProposal` → même comportement

---

#### [E12-S2] Agent Self-Assessment
> **5 pts** | Should Have | Bloqué par : E8-S6, E9-S4

- **AC1** : En fin de sprint, chaque agent produit un `AgentBehaviorProposal` auto-évaluant ses propres performances — `{agent, metric, currentValue, proposedThreshold, rationale}` — soumis via `RuleProposalService`
- **AC2** : L'auto-évaluation est taguée `{source: 'self-assessment'}` — le Developer voit la source dans la UI de review

---

#### [E12-S3] Improvement Persistence
> **3 pts** | Must Have | Bloqué par : E8-S6, E9-S4

- **AC1** : `.cop1/improvement-decisions.jsonl` enregistre chaque transition d'état de suggestion : `pending_review → approved/rejected/in-quorum → applied/rejected` avec `{id, timestamp, action, actor, comment?}`
- **AC2** : `.cop1/retro-reports/{date}-retro.md` contient le compte-rendu narratif de la rétrospective (agenda, contributions, proposals) — format lisible humain

---

#### [E12-S4] Improvement Review UI
> **8 pts** | Must Have | Bloqué par : E11-S2, E12-S3

- **AC1** : La Web UI affiche les suggestions groupées par type (6 onglets : ArchitectureRule, TeamRule, AgentBehavior, RefactoringStory, QualityThreshold, ProcessRule) avec badge count `pending`
- **AC2** : Chaque suggestion affiche : texte de la proposition, agent source, sprint d'origine, rationale — statut visible en couleur (pending=orange, applied=green, rejected=gray)

---

#### [E12-S5] Developer Review Actions
> **5 pts** | Must Have | Bloqué par : E12-S4, E9-S8

- **AC1** : Bouton "Yes" → `POST /api/improvement-review/{id}/approve` → `RuleApplicationService.apply()` → statut `applied` en temps réel dans la UI (SSE)
- **AC2** : Bouton "No" → modal de confirmation avec champ raison (obligatoire) → `POST /api/improvement-review/{id}/reject` → statut `rejected`
- **AC3** : Champ commentaire + bouton "Team Debate" → `POST /api/improvement-review/{id}/debate` → déclenche `ImprovementReviewSession` hors sprint actif

---

#### [E12-S6] Quorum Re-Analysis Session (ImprovementReviewSession)
> **8 pts** | Should Have | Bloqué par : E8-S1, E12-S5

- **AC1** : `ImprovementReviewSession` est déclenchée uniquement hors sprint actif (daemon vérifie `session.status !== 'running'`) — si sprint en cours, mise en file d'attente et déclenchée à la prochaine fin de session
- **AC2** : SM + PM + Architect relisent suggestion + commentaire Developer en Round-Table asynchrone et produisent une `{consolidatedPosition, rationale, changedFrom: original}` — retournée au Developer via SSE + visible en UI

---

#### [E12-S6b] Team Debate Button (Party Mode UI)
> **3 pts** | Should Have | Bloqué par : E12-S6

- **AC1** : Depuis n'importe quelle suggestion dans la Web UI, bouton "Débat d'équipe" disponible → ouvre un modal avec champ commentaire libre → déclenche `ImprovementReviewSession`
- **AC2** : Débat terminé → résultat visible dans la UI avec contributions de chaque agent listées séparément avant la synthèse

---

#### [E12-S7] Rule Auto-Application
> **5 pts** | Must Have | Bloqué par : E9-S8, E12-S5

- **AC1** : `POST /api/improvement-review/{id}/approve` déclenche `RuleApplicationService.apply()` qui écrit dans le fichier cible et ajoute l'entrée dans `iamthelaw/history.jsonl` — tout dans une transaction (rollback si l'écriture history.jsonl échoue)
- **AC2** : `RefactoringStoryProposal` approuvée → `BacklogApplicationHandler.createStory()` génère un fichier story BMAD-compatible dans le dossier backlog du projet cible (`.cop1/stories/proposed/`)

---

#### [E12-S8] Improvement KPI Tracking
> **3 pts** | Should Have | Bloqué par : E12-S7, E10-S8

- **AC1** : `ImprovementKPIService.compute()` retourne `{rulesProposed, rulesApplied, adoptionRate, refactoringStoriesCreated, refactoringStoriesCompleted}` — données affichées dans le KPIs Dashboard (E11-S8)

---

#### [E1-S5] Export Sessions
> **2 pts** | Nice to Have | Bloqué par : E11-S3

- **AC1** : `cop1 export --output ./archive.tar.gz` crée une archive contenant `.cop1/reports/`, `.cop1/sprint-log-*.jsonl`, `.cop1/improvement-decisions.jsonl`, `.cop1/retro-reports/` — sans les clés API ni les worktrees git

---

### Sprint 6 — Real Agent Wiring & Worktree Execution

> Objectif : câbler les vrais agents LLM (Ollama) dans SprintRunner, créer le fichier de config, et activer le mode worktree pour exécution isolée.

---

#### [E1-S6] cop1.config.yaml for M3 Max
> **2 pts** | Must Have | Bloqué par : E1-S3

- **AC1** : `cop1.config.yaml` existe à la racine du projet avec `llm_routing: { default: "llama3.2", dev: "llama3.2", reviewer: "llama3.2" }` — `ConfigLoader.load()` le charge sans erreur de validation
- **AC2** : Les budgets RAM sont configurés pour M3 Max 64GB : `ram_budget_night_gb: 48`, `ram_budget_day_gb: 20`, `git.auto_merge: false`

---

#### [E5-S8] LLM Agent Adapters
> **5 pts** | Must Have | Bloqué par : E5-S1

- **AC1** : `LLMCodeGenerator` implémente `CodeGeneratorPort.generate(prompt)` en appelant `LLMGateway.completeForAgent('dev', prompt)`, collectant le stream complet, et retournant la réponse string
- **AC2** : `LLMReviewer` implémente `ReviewerPort.review(qualityReport)` en appelant `LLMGateway.completeForAgent('reviewer', qualityReport)`, parsant la réponse en `ReviewResult { verdict, comments }`
- **AC3** : Les deux adapters sont testés avec un `LLMProvider` mock retournant des réponses prédéfinies — aucune dépendance Ollama réelle dans les tests unitaires

---

#### [E3-S16] Wire Real Agents in SprintRunner
> **5 pts** | Must Have | Bloqué par : E5-S8, E1-S6

- **AC1** : `SprintRunner` instancie `OllamaAdapter`, `LLMGateway.withRouter(LLMRouter)`, puis crée `DevAgent(new LLMCodeGenerator(gateway))` et `ReviewerAgent(new LLMReviewer(gateway))` au lieu des stubs — vérifié par inspection du code
- **AC2** : `cop1 sprint run --dry-run` continue de fonctionner sans aucun appel LLM
- **AC3** : `cop1 sprint run --filter "E3-S15"` sur une story de test appelle réellement Ollama — le DevAgent génère du code dans un worktree, le ReviewerAgent émet un verdict — les événements workflow sont émis sur l'EventBus

---

#### [E3-S15] Worktree Execution Mode
> **5 pts** | Must Have | Bloqué par : E3-S16

- **AC1** : `cop1 sprint run --simulate` crée un git worktree isolé via `WorktreeManager`, exécute le sprint complet avec vrais agents LLM (DevAgent via Ollama, ReviewerAgent via Ollama) — le code est réellement généré et commité dans le worktree
- **AC2** : `git.auto_merge: false` est respecté — aucun merge automatique vers main. Le worktree reste intact pour inspection manuelle. `cop1 sprint status` indique les branches worktree en attente de merge.
- **AC3** : Un log d'exécution détaillé est affiché en console : chaque story traitée avec transitions, chaque workflow step avec résultat (code généré, verdict review), résumé final (done/failed/skipped, durée)

---

### Sprint 7 — Quality Improvements

> Objectif : améliorer la qualité du code généré par le DevAgent via un prompt enrichi, et câbler le PM Agent pour valider les ACs post-implémentation.

---

#### [E3-S17] DevAgent Prompt Enhancement
> **5 pts** | Must Have | Bloqué par : E3-S5

- **AC1** : `buildDevPrompt()` inclut un contexte projet : tech stack (TypeScript strict NodeNext, pnpm monorepo, Vitest, Biome, architecture hexagonale), et conventions (kebab-case fichiers, PascalCase classes, extensions `.js` dans les imports ESM)
- **AC2** : `buildDevPrompt()` structure le contenu de la story en sections LLM-friendly : « Acceptance Criteria », « Tasks/Subtasks », « Dev Notes » — extraites du markdown plutôt qu'un dump brut
- **AC3** : Sur une story avec ACs et dev notes, le LLM génère du code TypeScript ciblant les bons fichiers/packages (pas un composant React générique) — vérifié manuellement sur 1 story de test

---

#### [E3-S18] PM Agent Wiring
> **3 pts** | Should Have | Bloqué par : E3-S17

- **AC1** : `PMAgentStep` est remplacé par un vrai `PMAgentWorkflowStep` implémentant `WorkflowStep`. Il reçoit `context.storyContent` et valide que les critères d'acceptation ont été adressés par le code généré — produisant un rapport de validation markdown.
- **AC2** : Si le PM agent ne peut pas valider (pas de storyContent, ou LLM indisponible), il retourne `{ status: 'ok' }` avec un warning — ne bloque jamais le pipeline sur le step PM en MVP.

---

## Récapitulatif Backlog

| Sprint | Stories | Points | Cumul |
|--------|---------|--------|-------|
| Sprint 0 | 9 stories | 39 pts | 39 pts |
| Sprint 1 | 11 stories | 53 pts | 92 pts |
| Sprint 2 | 12 stories | 52 pts | 144 pts |
| Sprint 3 | 11 stories | 57 pts | 201 pts |
| Sprint 4 | 23 stories | 99 pts | 300 pts |
| Sprint 5 | 26 stories | 110 pts | 410 pts |
| Sprint 6 | 4 stories | 17 pts | 427 pts |
| Sprint 7 | 2 stories | 8 pts | 435 pts |
| **Total** | **98 stories** | **435 pts** | — |

> **Note :** Les sprints 4 et 5 sont larges — à découper en 2 mini-sprints chacun lors du Sprint Planning (E8-S3). Les stories `Should Have` et `Nice to Have` peuvent être différées selon la vélocité observée.

**Couverture FRs via stories : 116/116 — 100%**
