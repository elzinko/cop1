---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
status: 'complete'
completedAt: '2026-02-13'
lastEdited: '2026-02-24'
editHistory:
  - date: '2026-02-23'
    changes: 'Added 5 features: Quality Dashboard Web UI, Sprint Workflow Execution Visibility, Worktree Preview Environment, Demo Agent with Playwright, MCP Access Control per Agent. +18 FRs (FR117-FR134), +8 NFRs (NFR25-NFR32), +1 CA (CA12 Demo Agent), +2 User Journeys (J6, J7), modified FR27/FR32/FR47/FR58/FR116/NFR8.'
  - date: '2026-02-23'
    changes: 'ADR: FR117 build guard+lifecycle, FR118 cleanup, FR120 Phase 2, +FR135 API REST, NFR32 clarified. Self-Consistency: fix FR86 dup, 10→12 caps, Growth tags, J6/J7 coverage, +NFR33. Pre-mortem: +FR137-141, SonarQube docker-compose. Occam Razor: merged FRs (-7 FRs, -1 NFR), Growth tags, CA12 condensed. Round Table: FR138 refined, +dependency chain, cop1=BMAD orchestrator, +NFR34 test strategy, CA11→CA7. War Room: MVP caps restructured in 3 tiers, +Sprint Roadmap section (FRs by horizon), BMAD pivot clarified as progressive (Sprint 7: LLMGateway enriched → Sprint 10+: BMAD #yolo experiment → Growth: full migration if proven), FR138 tagged Sprint 10+.'
  - date: '2026-02-24'
    changes: 'Post-validation edit (16 changes): +FR142-144 (Cap #10 Budget Tracking), cleaned 14 implementation leakage occurrences (MCPRegistry→service contrôle accès MCP, StructuredLogger→service logging, BrowserAutomationPort→contrat métier, EventBus→bus événements, LLMGateway→passerelle LLM, domain package→couche domaine, JSONL→logs structurés), SMART fixes (FR86 testable challenge, FR59 auto-approval 48h, FR48 file-overlap zero-conflict, FR52 split metric+ceremony), NFR metrics (NFR13 intervals+thresholds, NFR14 ramp-up 50%→+10%/15min, NFR34 coverage per layer), Journey Req Summary +7 entries + Telegram Growth tag + Cap #10, Preview Env classification clarified.'
inputDocuments:
  - 'ROADMAP.md'
  - 'NEXT_SPRINT.md'
  - 'docs/GETTING_STARTED.md'
  - '_bmad-output/project-context.md'
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 0
projectDocsCount: 4
classification:
  projectType: 'developer_tool+saas_platform'
  domain: 'ai_orchestration_developer_productivity'
  complexity: 'medium_high'
  projectContext: 'brownfield'
  targetUser: 'solo_developer_multi_agent'
  prdScope: 'epics_1_2_3'
---

# Product Requirements Document — Morpheus / cop1

**Author:** elzinko
**Date:** 2026-02-11

---

## Executive Summary

**Morpheus** est un système d'orchestration d'agents IA autonomes qui travaillent sur un backlog de développement pendant que son propriétaire dort. Nom de code : *"pendant que tu rêves, le code se construit."*

**Différenciateurs clés :**
- **LLM-per-command routing** : chaque rôle agent cible un LLM différent (local ou cloud), contrairement aux outils existants qui fixent 1 LLM par session
- **Sleep-Time Computing** : exploite les 56Go RAM nocturnes d'un M3 Max pour des équipes d'agents parallèles
- **Agile Agentic System** : implémentation autonome et auto-améliorante de la méthode Scrum — cérémonies, rétrospectives, team rules évolutives
- **BMAD-compatible** : lecture du backlog BMAD en lecture seule, enrichissement via fichiers markdown, jamais de modification des sources BMAD
- **Full-Pipeline Visibility** : visibilité complète du pipeline d'exécution des agents en temps réel via Web UI — pipeline view, quality dashboard, et démo visuelle automatisée

**Scope PRD :** Épics 1-3 + extensions Monitoring/Reporting (CA6), Preview Environment, Demo Agent, MCP Access Control. Projet brownfield — MVP existant à étendre.

---

## Success Criteria

### User Success

- Le système prend les tâches du `BACKLOG.md` (ou format BMAD) dans l'ordre de priorité et les implémente sans intervention humaine
- Chaque matin, un **rapport de nuit** est disponible : tâches complétées, bloquées, alternatives effectuées, questions pour la journée
- L'utilisateur peut **valider ou merger le travail en < 30 min** après une nuit d'exécution
- Le système ne sature pas la machine — les agents tournent selon les ressources disponibles (RAM/CPU/GPU)
- L'agent PM prépare activement la prochaine session : il liste les **décisions à prendre le soir** avant de dormir
- Le développeur peut suivre en temps réel le pipeline d'exécution (Dev → Reviewer → QA → PM) de chaque story via la Web UI, avec statuts, durées, et commandes en cours
- Le développeur dispose d'un quality dashboard Web UI affichant les KPIs par sprint avec tendances et intégration SonarQube

### Business Success

- Réduction continue du backlog sans intervention constante
- Coût LLM maîtrisé : LLMs locaux pour les tâches répétitives, Claude Code (terminal) uniquement pour déblocage ou raisonnement complexe
- Zéro coût supplémentaire au démarrage — exploite l'infrastructure Claude Code existante
- Chaque session nocturne produit **au minimum une contribution commitée** (code, analyse ou documentation)

### Technical Success

- BMAD command orchestration via `BMADCommandPort` Strategy pattern (LocalCliAdapter → future ContainerAdapter/RemoteAdapter) *(Phase A pivot)*
- Orchestration multi-LLM avec gestion des ressources machine (pas de swap, pas d'OOM) *(Phase B)*
- Stratégie adaptative implémentée et configurable : dev → grooming → archi → research → test 2 options
- Intégration **Telegram** pour communication async (envoi de message si blocage critique en journée)
- Comportement fail-safe la nuit : si bloqué sans réponse → pivot automatique vers activité alternative
- Agent PM capable d'anticiper les blocages et de **préparer des questions structurées** pour l'utilisateur
- Chaque commande peut cibler un **LLM différent** — le routing LLM est au niveau de la commande, pas de la session
- Preview environment : après le commit DevAgent, un environnement de preview (pnpm dev ou équivalent) est accessible aux agents downstream (Reviewer, QA, DemoAgent)
- MCP Access Control progressif : Phase 1 accès complet soft-limit, Phase 2 per-agent config, Phase 3 proxy + audit

### Measurable Outcomes

- ≥ 1 commit utile par nuit d'exécution (code, refacto, ou rapport d'analyse)
- Agent PM produit une liste de **≥ 3 décisions/questions** à valider avant chaque session nocturne
- Temps de review du travail nocturne ≤ 30 min le matin
- Nuit d'exécution complète sans intervention humaine dans ≥ 70% des cas
- Quality dashboard accessible en < 2 clics depuis la Web UI avec données à jour du sprint courant
- Pipeline view met à jour le statut de chaque step en < 5 secondes (latence SSE)
- DemoAgent produit un rapport visuel (markdown + screenshots) pour ≥ 80% des stories ayant passé le QA

---

## Product Scope

### Key Product Decisions (from discovery)

- **Continu, pas que nocturne** : les agents tournent selon les ressources dispo à n'importe quel moment — nuit, journée, week-end
- **Agent Feature Manager** : workflow autonome sur demande — validation DoR → ouverture feature → suivi statut GitHub → merge post-validation
- **Git Worktrees** : gestion des branches parallèles sans conflit (aspect technique, backlog Growth)
- **Dashboard Agile** : visibilité "qui fait quoi, qui attend qui" — post-MVP
- **Rules per-agent** : via `iamthelaw` pattern — s'appuyer sur `@cop1/rules-engine` existant, ne pas réinventer
- **lifefindsaway écarté** : doublon avec BMAD pour la partie PM/workflow
- **Séparation des phases** : chaque phase d'exécution clairement délimitée (planning → dev → review → merge)
- **cop1 = orchestrateur progressif vers BMAD** : **Sprint 7** — les agents cop1 existants (DevAgent, ReviewerAgent via LLMGateway) restent en place, enrichis par les prompts (project-context, DoD, story content). **Sprint 10+** — expérimenter BMAD `#yolo` mode sur 1 commande (`dev-story`) en parallèle des agents actuels, comparer la qualité. **Growth** — si résultats probants, migration complète vers commandes BMAD autonomes. Les workflows TEA (`bmad_tea_automate`, `bmad_tea_test-review`) sont utilisables dès maintenant pour augmenter la qualité des tests
- **Preview Environment** : Option B (démo post-dev) en première phase Growth, Option A (env au démarrage worktree) en Growth avancé
- **DemoAgent** : nouvel agent dans le pipeline, après QA, utilisant Playwright MCP pour screenshots et rapports visuels
- **MCP Access Control** : approche progressive en 3 phases — full access MVP, per-agent config Phase 2, proxy audit Phase 3

### MVP — Ce qui doit fonctionner pour que ça ait de la valeur

- **Backlog management** : lecture de `BACKLOG.md` ou format BMAD (`sprint-status.yaml` + stories)
- **Autonomous mode multi-agents** : workflow séquentiel d'agents cop1 communicants (dev → reviewer → qa → pm) via LLMGateway, enrichis par les prompts BMAD (project-context, DoD, story content). Migration progressive vers commandes BMAD autonomes (#yolo) après validation
- **LLM-per-command routing** : chaque commande type `/dev-story`, `/code-review`, `/qa` cible un LLM configuré — contrairement à Claude Code qui reste sur 1 LLM fixe par session
- **Stratégie adaptative niveau 1** : dev → si bloqué → archi/refacto/analyse
- **Rapport morning** : fichier markdown généré chaque nuit avec résumé d'exécution
- **Agent PM** : lit le backlog, prépare les questions du soir, anticipe les blocages
- **Claude Code bridge** : capacité à lancer `claude` en sous-process pour les tâches dépassant les LLMs locaux
- **Resource guard** : ne pas lancer plus d'agents que la RAM disponible le permet

## User Journeys

### Journey 1 — "La Nuit Morpheus" (Happy Path nocturne)

*Thomas, 23h30. Il ferme son laptop. Le backlog a 8 stories ready-for-dev.*

Thomas ouvre cop1, vérifie que le `sprint-status.yaml` est à jour et que les stories ont leurs Dev Notes. Il configure le mode autonome (resource budget : 6GB RAM max), et active la nuit. Un Telegram confirme : *"Morpheus activé. 3 stories en queue. Bonne nuit."*

À 3h, l'agent PM orchestre : agent Dev (Llama 3.2 local) prend la story `1-1-backlog-ui`, implémente, commit sur `feat/1-1-backlog-ui`. Agent Reviewer (Mistral local) passe dessus, note 2 points mineurs, renvoie au Dev. Deuxième itération, PR propre. Story suivante.

À 7h, Thomas reçoit : *"Nuit terminée. 2 stories done, 1 en review. 1 bloquée (décision archi). Rapport dispo."*

Il ouvre `morning-report-2026-02-12.md`, prend 20 min, merge 2 PR, note la décision à prendre.

**Requirements :** configuration mode nuit, resource guard, orchestration séquentielle dev→reviewer, rapport morning, Telegram start/end/block, gestion statut BMAD.

---

### Journey 2 — "Le Café du Matin" (Review & Feedback Loop)

*Thomas, 7h15. Café en main. Ouvre le rapport.*

Le `morning-report.md` est structuré en 3 sections : ✅ Fait / ⚠️ Bloqué / 💡 Propositions. Thomas voit que l'agent a généré `feature-proposal-dark-mode-backlog.md` pendant un temps mort. Pertinent — il l'ajoute au backlog en `ideation`.

Il review la PR `feat/1-1-backlog-ui` en 15 min — architecture hexagonale respectée, tests OK, conventions TS propres. Merge.

Il répond aux questions de l'agent PM dans `pm-questions-2026-02-12.md` en 5 min. Ces réponses enrichissent les Dev Notes de la prochaine story.

**Requirements :** rapport morning structuré, feature proposals async, fichier questions/réponses PM→Dev Notes pipeline, interface review rapide (lien vers PR).

---

### Journey 3 — "Le Blocage Nocturne" (Fail-Safe)

*2h du matin. L'agent Dev est bloqué : 2 approches pour le LLM gateway, aucune évidente.*

L'agent PM envoie un Telegram : *"Bloqué story 3-2 : option A vs option B. Critique. Tu réponds ?"* — Silence. Thomas dort.

L'agent PM applique la stratégie adaptative : marque `3-2` en `blocked`, crée `decision-3-2-llm-gateway-options.md` (pros/cons des 2 options), pivote. L'agent Architect analyse le codebase → produit `archi-review-llm-gateway.md`. L'agent Dev attaque une story non-bloquée (`1-3-task-filters`).

À 7h, Thomas voit : la décision documentée + rapport archi complet + 1 story avancée. Il répond à la décision en 2 min.

**Requirements :** stratégie adaptative de pivot, fichier décision structuré, story blocking mechanism, travail archi/analyse en fallback.

---

### Journey 4 — "L'Agent PM Prépare la Nuit" (Operations — daytime)

*Thomas, 18h. Avant de dîner.*

L'agent PM a tourné en arrière-plan toute la journée (sur les ressources dispo). Il a analysé le backlog, vérifié les dépendances, identifié 3 questions bloquantes. Il génère `tonight-prep-2026-02-12.md` : *"3 stories prêtes. Story 2-1 nécessite décision auth. RAM estimée : 4.2GB. Budget OK."*

Thomas répond en 5 min. Le PM enrichit les Dev Notes, met à jour le sprint-status.

**Requirements :** agent PM background (daytime), analyse dépendances inter-stories, estimation RAM, rapport préparation nocturne, interface réponse rapide aux questions PM.

---

### Journey 5 — "Feature on Demand" (Agent Feature Manager, journée)

*Thomas, midi. Il veut lancer l'implémentation d'une feature sans toucher au code.*

Il tape `/feature start 2-3-auth-system`. L'agent Feature Manager valide la DoR (Dev Notes complètes ? Story estimée ? Dépendances résolues ?), ouvre une branche via git worktree (pas de conflit avec le travail en cours), assigne l'agent Dev avec le bon LLM, et notifie Thomas quand la PR est prête pour review.

Thomas peut continuer à travailler sur autre chose pendant que la feature avance. L'agent Feature Manager lance le preview environment dans le worktree. Le ReviewerAgent et le QAAgent peuvent consulter l'application en cours d'exécution via l'URL preview avant de valider.

**Requirements :** agent Feature Manager, DoR validation automatique, git worktrees pour branches parallèles, assignment automatique agent+LLM, notification PR ready, preview URL accessible aux agents downstream.

---

### Journey 6 — "Le Dashboard du Matin" (Visual Sprint Review)

*Thomas, 7h20. Il ouvre la Web UI cop1 avant même le rapport.*

Thomas voit le quality dashboard : KPIs du sprint en cours avec tendances (vélocité en hausse, taux blocage en baisse). Il clique sur une story et voit la pipeline view : Dev ok (12min, Mistral 7B, 3200 tokens) → Reviewer ok (4min) → QA ok → PM done. Il repère une story failed au step Reviewer, clique pour voir le détail. Il consulte l'onglet SonarQube : 0 bugs, 2 code smells mineurs. Le rapport visuel du DemoAgent montre des screenshots de la feature backlog-ui.

**Requirements :** quality dashboard Web UI, pipeline view par story, intégration SonarQube display, demo agent screenshots, historique d'exécution consultable.

---

### Journey 7 — "La Démo Automatique" (Visual Sprint Report)

*Sprint terminé. Thomas veut voir ce que les agents ont produit visuellement.*

Le DemoAgent a tourné après le QA sur chaque story. Le System avait lancé le preview environment (pnpm dev dans le worktree) après le commit DevAgent. Le DemoAgent a utilisé Playwright MCP pour naviguer les pages clefs et prendre des screenshots. Thomas ouvre `.cop1/demos/sprint-12/` : un rapport markdown avec images montrant le avant/après de chaque feature. Il l'utilise pour sa sprint review avec le stakeholder (lui-même).

**Requirements :** preview environment post-dev, DemoAgent Playwright, screenshot storage, visual sprint report markdown.

---

### Journey Requirements Summary

| Capability | Journeys |
|---|---|
| Mode autonome configurable (resources, story selection) | J1, J4 |
| Orchestration séquentielle multi-agents (dev→reviewer→qa) | J1, J5 |
| Notification Telegram (start/end/block) *(Growth)* | J1, J3 |
| Rapport morning structuré (fait/bloqué/propositions) | J1, J2 |
| Feature proposals async (temps mort) | J2 |
| Pipeline questions PM → réponses → Dev Notes | J2, J4 |
| Stratégie adaptative de pivot (dev→archi→research) | J3 |
| Story blocking + fichier décision documenté | J3 |
| Agent PM background (daytime, analyse backlog, dépendances) | J4 |
| Rapport préparation nocturne + estimation RAM | J4 |
| Agent Feature Manager (DoR validation → branch → assign → notify) | J5 |
| Git worktrees pour branches parallèles sans conflit | J5 |
| Quality Dashboard Web UI (KPIs, tendances, SonarQube) | J6 |
| Pipeline view temps réel (Dev → Reviewer → QA → PM) | J6 |
| Preview environment worktree (pnpm dev, URL accessible aux agents) | J5, J7 |
| DemoAgent Playwright screenshots + rapport visuel | J7 |
| MCP Access Control per agent (progressif) | J5, J7 |
| Historique d'exécution consultable post-sprint | J6 |
| API REST backend (KPIs, SonarQube, pipeline history) | J6 |
| Resource Guard (RAM/CPU seuils, suspension automatique) | J1 |
| Gestion statut BMAD (lecture seule, snapshots versionnés) | J1, J3 |
| Interface review rapide (lien PR, merge manuel) | J2 |
| Interface réponse rapide aux questions PM | J4 |
| Assignment automatique agent+LLM par story | J5 |
| Notification PR ready pour review | J5 |
| Claude API Budget Tracking & Alerts (cap journalier, auto-pause) | J1, J3 |

---

## Domain-Specific Requirements

### Hardware Reference — MacBook Pro M3 Max 64Go

- **RAM disponible nuit** : ~56Go (OS ~8Go fixe) → peut faire tourner simultanément Llama 3.2 70B (~40Go) + Mistral 7B (~4Go) + agents légers
- **RAM disponible jour** : variable — surveiller ce que l'utilisateur fait (Chrome, Xcode, etc.) et adapter le budget agents en temps réel
- **Scalabilité** : architecture prévue pour multi-machine dès le départ — abstraire le runtime d'un agent de la machine qui l'exécute
- **GPU / Neural Engine M3 Max** : exploiter l'accélération matérielle pour les LLMs locaux via MLX ou llama.cpp Metal backend

### Resource Monitoring

- Surveiller en continu : RAM libre, CPU load, GPU/Neural Engine usage
- Ajuster dynamiquement le nombre d'agents actifs selon budget disponible
- Mode nuit : seuil de suspension à **75% RAM** (≈48GB) — profil progressif ramp-up (voir NFR11-14)
- Mode jour : hors scope MVP — future epic Phase 2
- Seuils configurables par profil dans `cop1.config.yaml`

### Phases d'Usage

| Phase | Mode | Ressources | Trigger |
|---|---|---|---|
| **Phase 1 — Nuit** | Async, 100% ressources | ~56Go RAM | Manuel (soir) ou schedule |
| **Phase 2 — Jour Copilot** | Background, adaptatif | Ressources restantes | Manuel ou détection activité |
| **Phase 3 — Live Assist** | Parallèle temps réel | Selon tâche active | Futur — sur demande |

### Coordination Inter-Agents

- **OpenClaw** : option à investiguer comme coordinateur/interface de communication inter-agents — à évaluer vs solution native cop1
- Principe : OpenClaw = intervenant parmi d'autres, pas le centre du système
- Si OpenClaw non retenu : coordinator natif dans cop1 (agent PM = orchestrateur)
- Communication inter-agents : fichiers markdown comme canal principal (pattern BMAD), messages Telegram pour escalade humaine

### Security & Safety

- Agents : commits uniquement sur branches feature (`agent/{story-key}-{timestamp}`)
- Pre-commit obligatoire : `pnpm typecheck && pnpm test` avant tout commit agent
- Fichiers protégés (agents ne peuvent pas modifier) : `.env`, `pnpm-workspace.yaml`, configs racine
- Budget LLM cloud : cap journalier configurable, alerte Telegram si dépassé
- Timeout par tâche agent : configurable, default 30 min — pivot automatique si dépassé
- Git worktrees pour branches parallèles — isolation totale des workspaces agents

### Integration Requirements

| Système | Usage | Phase |
|---|---|---|
| **Ollama / LMStudio** | LLMs locaux (Llama, Mistral, Qwen) | **Phase B** *(moved from MVP — Phase A pivot)* |
| **Anthropic API / Claude Code** | Orchestrateur + BMAD command execution (dev-story, code-review, QA, retro) | MVP |
| **BMAD workflows** | Format stories, sprint-status.yaml | MVP |
| **SonarQube API** | Métriques qualité pour quality dashboard | MVP (adapter existant) |
| **GitHub API** | Statut PR, merge, issues, branches | Growth |
| **Telegram Bot API** | Notifications, questions async | Growth |
| **Playwright MCP** | Automatisation navigateur pour DemoAgent + QA visuel | Growth |
| **OpenClaw** | Coordination inter-agents (à évaluer) | Future |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. LLM-per-Command Routing (Nouveau Paradigme)**
Le paradigme actuel : un outil = un LLM fixe (Claude Code = Claude Sonnet pour tout). cop1 : chaque commande `/dev-story`, `/code-review`, `/qa`, `/ideation` peut cibler un LLM différent — optimisé pour le coût et la capacité de la tâche. Aucun outil existant ne fait ça nativement au niveau de la commande.

**2. Adaptive Strategy Engine (Self-Organizing Work)**
Si bloqué sur du dev → pivot automatique vers grooming, archi, research, ou test des 2 options. Le système ne s'arrête jamais faute d'instructions — il choisit la meilleure activité possible selon le contexte.

**3. Sleep-Time Computing (Resource Maximization)**
Exploiter les ~56Go RAM nocturnes d'un M3 Max pour faire tourner des équipes d'agents en parallèle pendant que le propriétaire dort. Concept : *Morpheus — le code se construit quand vous rêvez.*

**4. Progressive Autonomy (3 phases)**
Phase 1 async (nuit) → Phase 2 copilot adaptatif (journée) → Phase 3 live assist (parallèle temps réel). Adoption progressive sans rupture de workflow.

**5. Per-Agent Rules (iamthelaw Pattern)**
Chaque agent a ses propres règles YAML (`@cop1/rules-engine`) — comportement différencié par rôle. Dev suit des règles de style. Reviewer suit des règles de qualité. PM suit des règles de priorisation.

### Market Context & Competitive Landscape

| Outil | Limite vs cop1 |
|---|---|
| Claude Code | LLM fixe, pas d'orchestration multi-agents |
| Devin / SWE-agent | Cloud-only, coûteux, boîte noire, 1 LLM |
| Continue.dev | Assistance IDE, pas d'autonomie nocturne |
| OpenHands | Pas de resource-awareness, pas de multi-LLM routing |
| Aider | 1 LLM, pas d'orchestration, pas de mode nuit |

**Angle différenciant cop1 :** orchestration multi-LLM resource-aware + mode nuit + adaptive strategy + per-agent rules — combinaison inexistante aujourd'hui.

### Validation Approach
- MVP : 1 nuit réussie → 1 story complète commitée sans intervention humaine
- LLM routing : comparer coût/qualité 1 LLM fixe vs routing dynamique sur 10 stories
- Adaptive strategy : mesurer % de nuits sans blocage total (objectif : 0 nuit blanche)
- Per-agent rules : comparer score qualité code avant/après règles iamthelaw

### Risk Mitigation

| Risque | Mitigation |
|---|---|
| LLM routing trop complexe | Démarrer avec 2 LLMs max (local + Claude), routing simple |
| Adaptive strategy fait de mauvais choix | Log toutes décisions → review humaine matin → amélioration continue |
| Agents nocturnes font des dégâts | Branches isolées + pre-commit hooks + morning review obligatoire |
| OpenClaw / coordination complexe | Démarrer sans OpenClaw (fichiers markdown = protocol BMAD) — ajouter si besoin prouvé |

---

### Growth Features (Post-MVP)

- **Telegram integration** : notification de blocage en journée, réponse async
- **Multi-LLM routing intelligent** : choix automatique du meilleur LLM selon la complexité de la tâche
- **`/llm` command** : configurer le LLM cible avant d'invoquer une commande agent
- **Agents parallèles** : lancer 2 agents simultanément quand les ressources le permettent (format de communication à définir)
- **Test des 2 options** : quand 2 choix architecturaux critiques existent, créer 2 branches et tester les 2
- **Idéation nocturne** : générer des proposals de nouvelles features (fichier markdown à valider le matin)
- **Analyse concurrentielle automatisée** : si bloqué, lancer une analyse et produire un rapport
- **Preview Environment Option A** : spin-up d'un environnement de dev au démarrage du worktree (pas seulement post-dev) — agents peuvent itérer visuellement pendant le sprint
- **DemoAgent avancé** : enregistrement vidéo, GIFs animés, tests de régression visuelle cross-browser
- **MCP Access Control Phase 3** : proxy MCP avec audit log, workflow d'approbation pour opérations sensibles

> **Note :** Anciennement en Growth, désormais dans le scope courant : Quality Dashboard Web UI (CA6), Sprint Workflow Execution Visibility (CA6).

### Vision (Future)

- Système totalement autonome capable de gérer un projet de bout en bout pendant plusieurs jours
- Multi-machine : distribuer les agents sur plusieurs machines pour paralléliser massivement
- Self-improving : l'agent PM analyse ses propres performances et suggère des améliorations du workflow
- Nom de code : **Morpheus** — *"pendant que tu rêves, le code se construit"*


## Developer Tool + Platform Specific Requirements

### Runtime Architecture

**Service Model (daemon) :**
- Backend Fastify tournant en continu (service ou process manager), pausable/reprendable sans perte d'état
- Web UI React existante pour piloter et monitorer — pas d'intégration IDE dans le MVP
- Évolution possible post-MVP : slash commands par IDE pour des tâches récurrentes bien définies

**LLM Infrastructure (Docker stack) :**
- **Ollama** : LLMs locaux (Llama, Mistral, Qwen) — Metal backend M3 Max (MLX / llama.cpp)
- **LiteLLM** : proxy unifié OpenAI-compatible pour router vers Ollama / Anthropic API / autres
- **Claude API** : clé `.env` pour tâches complexes — séparé du runtime local
- Séparation stricte : conteneur LLM ↔ conteneur application cop1
- Local-first : aucun code envoyé au cloud sans consentement explicite

### Communication Inter-Agents (BMAD v6 + Extensions)

**Pattern BMAD v6 retenu :**
- Fichier-centric, enrichissement séquentiel, source de vérité unique
- `sprint-status.yaml` : orchestration séquentielle (`backlog → ready-for-dev → in-progress → review → done`)
- Story files enrichis par chaque agent (Dev Notes, Dev Agent Record, Change Log)
- `project-context.md` : connaissance partagée par tous les agents

**Extensions cop1 :**
- **MCP Servers** : chaque agent peut se connecter à des MCP servers (outils, APIs, recherche) — obligatoire
- **Ticketing** : commencer avec markdown maison + sprint-status.yaml (pattern BMAD) — migrer vers Plane.so si besoin de tracking avancé confirmé
- **Sessions temps réel** : réunions cadrées entre LLMs avec objectifs définis + durée limitée + compte-rendu en markdown/ticket — à explorer en Growth

### Agent Output Format
- **Code** : commits sur `agent/{story-key}-{timestamp}` via git worktrees
- **Stories** : fichier enrichi par sections dédiées (Dev Notes, Dev Agent Record, Change Log)
- **Tracking** : `sprint-status.yaml` mis à jour à chaque transition
- **Rapports** : markdown dans `_bmad-output/` (`morning-report-{date}.md`, `pm-questions-{date}.md`, `decision-{story}-{topic}.md`)
- **Logs** : JSON structurés pour debugging, séparés des fichiers projet

### Setup Requis
- Docker Desktop (Ollama + LiteLLM conteneurisés)
- `docker-compose.yml` pour l'outillage projet : SonarQube, et autres outils qualité — un seul `docker compose up` pour tout démarrer
- Clé Anthropic dans `.env` (jamais committée)
- `pnpm install && pnpm dev` pour démarrer le service
- `cop1.config.yaml` : backlog path, resource budgets, LLM routing rules
- Modèles Ollama pré-téléchargés avant première session


## MVP Scope Definition

### MVP Strategy: "Platform MVP"

**Définition :** Un système qui prouve qu'il peut tourner toute une nuit et produire du code mergeable sur au moins 1 story.

**Critère de succès MVP :**
> "Le lendemain matin, je trouve au moins 1 PR mergeable créée automatiquement pendant la nuit, avec un rapport qui m'explique ce qui s'est passé."

### Capacités MVP (12 capabilities, 3 tiers)

**Tier 1 — Circuit minimum "1 PR mergeable" :**

| # | Capacité | Justification |
|---|----------|---------------|
| 2 | Lecture du backlog (markdown stories BMAD) | Point d'entrée de tout le workflow |
| 4 | Agent Orchestration (dev-story, code-review, QA) | Circuit complet de production de code via agents cop1 (LLMGateway) enrichis par prompts BMAD *(Phase A pivot)* |
| 5 | Workflow Dev Agent → Reviewer Agent (séquentiel) | Circuit complet "production de code" |
| 7 | Morning Report (markdown) | Visibilité sur ce qui s'est passé |
| 9 | Git Worktrees (branches isolées par story) | Évite les conflits, git propre |

**Tier 2 — Sécurité + autonomie nocturne :**

| # | Capacité | Justification |
|---|----------|---------------|
| 1 | Daemon Fastify + Web UI de monitoring | Contrôle et observabilité — sans ça, la nuit c'est une boîte noire |
| 3 | Resource Guard (RAM/CPU monitoring) | Sécurité — éviter de bloquer la machine |
| 6 | PM Agent (questions bloquantes → fichier décision) | Débloquage autonome sans input humain la nuit |
| 8 | Adaptive Strategy L1 (retry avec autre LLM si échec) | Résilience de base, évite les boucles infinies |
| 10 | Claude API Budget Tracking & Alerts | Contrôle des coûts Claude API avec alertes et auto-pause |

**Tier 3 — Observabilité Web UI :**

| # | Capacité | Justification |
|---|----------|---------------|
| 11 | Quality Dashboard Web UI (KPIs, tendances, SonarQube) | Visibilité qualité — services backend existants, Web UI à créer |
| 12 | Sprint Workflow Pipeline View (temps réel + historique) | Visibilité exécution — SSE + EventBus existants, Web UI à créer |

### Journeys couvertes par le MVP

- ✅ **J1** — Nuit autonome complète (journey principale)
- ✅ **J2** — Démarrage et configuration (onboarding)
- ✅ **J3** — Morning review (rapport du matin)
- ✅ **J4** — Gestion des blocages (PM agent + décision files)
- ❌ **J5** — Copilot diurne (post-MVP, Phase 2)
- ✅ **J6** — Dashboard du matin (MVP — capabilities 11-12)
- ❌ **J7** — Démo automatique (Growth — dépend Preview Environment + DemoAgent)

### Sprint Roadmap (FRs clés par horizon)

| Horizon | FRs clés | Focus |
|---------|----------|-------|
| **Sprint 7** (immédiat) | FR137 (prompt enrichment), QA Agent wiring, LoggerBridge wiring, E3-S18 (PM Agent) | Rendre le pipeline existant utile — agents cop1 + LLMGateway enrichis |
| **Sprint 8-9** | FR58 (Quality Dashboard), FR126 (Pipeline View), FR135 (API backend), FR125 (SonarQube), FR129 (historique) | Observabilité Web UI |
| **Sprint 10+** | FR117-118 (Preview Env), FR140 (health-check), FR138 (BMAD #yolo expérimentation) | Preview environment + expérimentation BMAD autonome |
| **Growth** | FR119/FR130-131 (DemoAgent), FR120 (MCP Phase 2), FR123 (Reviewer browse), FR141 (ports dynamiques), CA7 cérémonies | Features avancées — après validation des fondations |

### Chaîne de dépendances

> **Sprint 7 est un prérequis bloquant pour toutes les features Sprint 8+.**
> - E3-S17 (Prompt Enrichment) → condition pour que le code généré soit utile → condition pour que le Dashboard ait des données pertinentes
> - Gap 2 (QA Agent wiring) → condition pour FR117 (preview env build guard) → condition pour Pipeline View (events QA)
> - Gap 3 (LoggerBridge wiring) → condition pour FR129 (historique JSONL) → condition pour FR135 (API backend dashboard)

### Explicitement hors MVP

- Notifications Telegram (post-MVP Phase 2)
- GitHub API / PR automatique (post-MVP — merge manuel en MVP)
- Agents parallèles simultanés (post-MVP — séquentiel en MVP)
- Commande `/llm` CLI (post-MVP)
- Plane.so (post-MVP — markdown maison en MVP)
- OpenClaw (à évaluer en Growth)
- Sessions temps réel entre LLMs (à explorer en Growth)
- Preview Environment (Growth Sprint 10+ — Option B post-dev d'abord, Option A worktree-start en Growth avancé)
- DemoAgent Playwright (post-MVP — dépend du preview environment)
- MCP Access Control Phase 2-3 (post-MVP — Phase 1 soft-limit en MVP)

### Risques MVP

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| LiteLLM complexity (routing multi-provider) | Moyenne | Élevé | Commencer avec 1 provider Ollama + fallback Claude API direct |
| Boucles infinies agent | Faible | Critique | Max iterations par story (configurable), timeout global nuit |
| Qualité code insuffisante pour merge | Moyenne | Élevé | Reviewer agent obligatoire dans MVP, critères DoD explicites |
| RAM overflow sur M3 Max | Faible | Élevé | Resource Guard bloque avant saturation (seuil **75% RAM**, ramp-up progressif) |
| Preview environment processus orphelin | Moyenne | Moyen | Cleanup automatique avec timeout + process tracking dans le workflow engine (NFR29) |
| Playwright MCP instabilité | Moyenne | Faible | DemoAgent step est non-bloquant — en cas d'échec, le workflow continue sans screenshots (NFR30) |


## Functional Requirements

### Capability Area 1 — Backlog Management

- **FR1** : Le Developer peut lire et naviguer le backlog de stories BMAD (markdown)
- **FR2** : Le Developer peut consulter le statut de chaque story (backlog / ready-for-dev / in-progress / review / done)
- **FR3** : Le System peut sélectionner automatiquement la prochaine story à traiter selon l'ordre de priorité décidé (WSJF ou manuel)
- **FR4** : Le Developer peut marquer manuellement une story comme "ready" pour la nuit
- **FR5** : Le System peut enrichir une story avec les outputs des agents (Dev Notes, Agent Record, Change Log)
- **FR63** : Le PM Agent peut évaluer l'état de santé du backlog et produire un rapport (stories prêtes, en grooming, manquantes pour les prochains sprints)
- **FR64** : Le System peut conduire des cérémonies de grooming entre le PM Agent et le Developer pour affiner, compléter, modifier ou annuler des stories
- **FR65** : Le PM Agent peut estimer l'effort des stories en points Fibonacci lors du grooming
- **FR66** : Le System peut vérifier les critères DoR multi-dimensionnels avant d'accepter une story en sprint : (1) story INVEST-conforme + AC définis + effort estimé + dépendances identifiées, (2) compétences équipe disponibles + charge raisonnable, (3) accès/secrets disponibles + infrastructure prête + pas de dépendance externe bloquante
- **FR67** : Le Developer peut consulter un tableau de bord backlog séparé (état idéation/grooming vs sprint actif)
- **FR68** : Le PM Agent peut calculer automatiquement un score de priorité (WSJF) pour ordonner le backlog
- **FR69** : Le Developer peut ajuster manuellement les priorités du backlog, les ajustements étant conservés entre les sessions
- **FR71** : Le System peut alerter si le backlog "prêt" est insuffisant pour couvrir N sprints à venir (seuil configurable)
- **FR80** : Le Developer peut configurer les critères DoR applicables au projet (liste extensible)

### Capability Area 2 — Agent Orchestration

- **FR6** : Le System peut lancer un workflow séquentiel d'agents (Dev → Reviewer → QA → (Demo optionnel, Growth) → PM) sur une story
- **FR7** : Le System peut router chaque commande agent vers un LLM différent selon des règles configurables
- **FR8** : Le System peut détecter un blocage agent (timeout ajusté à la saturation Docker + durée estimée dépassée) et activer la stratégie adaptative
- **FR9** : Le System peut limiter le nombre d'itérations par story pour éviter les boucles infinies
- **FR10** : Le System peut arrêter proprement le workflow autonome et reprendre depuis le dernier état stable
- **FR11** : Le PM Agent peut formuler des questions bloquantes et les persister en fichier décision sans input humain
- **FR12** : Le System peut exécuter des workflows agents pendant une plage horaire programmée (mode nuit)
- **FR41** : Le Dev Agent peut déclarer un blocage avec un type et une raison (timeout, erreur technique, ambiguïté, dépendance manquante, accès manquant, etc.)
- **FR42** : Le PM Agent peut recevoir un blocage déclaré et router vers l'agent compétent (Architect, SM, Developer humain) selon le type de blocage
- **FR43** : Le Developer peut résoudre un blocage (réponse, secret/credential, info technique, arbitrage) via la Web UI ou un fichier de réponse
- **FR44** : Le System peut définir et configurer les types de blocages et leurs règles d'escalade
- **FR49** : Le System peut upgrader dynamiquement le LLM d'un agent ("Super Saiyan mode") selon le niveau de difficulté détecté — chaque agent a un LLM par défaut + un LLM de fallback supérieur
- **FR83** : Le System persiste l'état complet du workflow à chaque transition (story en cours, agent actif, étape, contexte) dans un fichier de checkpoint
- **FR84** : Le System peut reprendre un workflow interrompu (crash, redémarrage, arrêt manuel) depuis le dernier checkpoint sans perte de travail
- **FR116** : Le Developer peut exécuter un sprint en mode worktree (`--simulate`) dans un git worktree isolé — les vrais agents LLM (DevAgent, ReviewerAgent) s'exécutent sur les stories, produisent du code réel, sans auto-merge. Le worktree peut optionnellement lancer un preview environment (processus dev local) pour permettre aux agents de vérifier visuellement leur travail. Le développeur inspecte le worktree et merge manuellement.
- **FR117** : Le System peut lancer un preview environment (processus local `pnpm dev` ou équivalent) dans un git worktree après le commit du DevAgent, **à condition que le build réussisse** (`pnpm build` ou équivalent retourne 0). Le preview environment expose un port local accessible aux agents downstream (ReviewerAgent, QAAgent, DemoAgent) et **persiste jusqu'au cleanup FR118** — il est lancé une seule fois et réutilisé par tous les steps downstream
- **FR141** : *(Growth)* Le System alloue dynamiquement un port unique par preview environment de worktree, évitant les conflits lors de l'exécution parallèle de plusieurs stories
- **FR140** : Le System vérifie l'accessibilité du preview environment avant de le déclarer disponible aux agents downstream. Si le health-check échoue, le preview est marqué indisponible et les agents continuent sans preview
- **FR118** : Le System peut arrêter proprement le preview environment après la fin du workflow complet de la story (après le step PM, pas après chaque step individuel) — cleanup du processus, libération du port, suppression des fichiers temporaires
- **FR119** : *(Growth)* Le DemoAgent peut s'exécuter comme un WorkflowStep supplémentaire dans le pipeline séquentiel (Dev → Reviewer → QA → Demo → PM) après validation QA

### Capability Area 3 — LLM Infrastructure

- **FR13** : Le System peut se connecter à des LLMs locaux (Ollama) via une interface unifiée OpenAI-compatible
- **FR14** : Le System peut basculer vers l'API Claude (cloud) pour les tâches complexes
- **FR15** : Le Developer peut configurer les règles de routing LLM par type de commande agent
- **FR16** : Le System peut télécharger et gérer des modèles Ollama localement
- **FR17** : Chaque agent peut se connecter à des MCP servers pour accéder à des outils externes (recherche, APIs, filesystem)
- **FR47** : Le System peut gérer les droits d'accès MCP par agent via un service centralisé de contrôle d'accès MCP. **Phase 1 MVP** : accès complet à tous les MCP servers, limitation souple via règles iamthelaw. **Phase 2** : configuration per-agent dans `cop1.config.yaml` (DevAgent: filesystem+git, QAAgent: playwright, DemoAgent: playwright+screenshot). **Phase 3 Growth** : proxy MCP + audit log + workflow d'approbation.
- **FR52** : *(Growth — cérémonies)* Le System peut mesurer le débit tokens/seconde de chaque modèle LLM chargé et l'exposer comme métrique observable
- **FR52b** : *(Growth — cérémonies)* Le System exclut des cérémonies les agents dont le LLM assigné est sous le seuil minimum (NFR2 : 15 tok/s) et les remplace par le LLM de fallback configuré
- **FR120** : *(Phase 2)* Le Developer peut configurer les permissions MCP per-agent dans `cop1.config.yaml` sous une section `mcp_permissions` (mapping rôle → liste de MCP tools autorisés). En Phase 1 MVP, le service de contrôle d'accès MCP retourne tous les outils pour tous les agents (accès complet)
- **FR121** : Le System peut logger chaque appel MCP avec l'identité de l'agent appelant, le nom de l'outil, le timestamp, et le résultat (succès/échec) dans le journal structuré

### Capability Area 4 — Resource Management

- **FR18** : Le System peut monitorer en temps réel la RAM et le CPU disponibles (priorité : charge Docker)
- **FR19** : Le System peut suspendre un workflow agent quand les ressources descendent sous un seuil configurable
- **FR20** : Le System peut maximiser l'utilisation des ressources la nuit selon un budget RAM configurable (ex. : 80% de 64GB)
- **FR21** : Le System peut ajuster dynamiquement le nombre de modèles LLM chargés en fonction des ressources disponibles

### Capability Area 5 — Code Production & Git

- **FR137** : Le System inclut systématiquement dans le prompt de la commande BMAD dev-story : (1) la DoD du projet (FR34), (2) le `project-context.md` (contraintes tech stack, conventions, architecture), (3) les acceptance criteria et dev notes de la story. Les tests unitaires font partie de la DoD par défaut. Ce mécanisme s'appuie sur les commandes BMAD existantes — cop1 enrichit le contexte, BMAD exécute.
- **FR138** : *(Sprint 10+ — expérimentation)* Le System peut lancer les commandes BMAD en mode autonome (`#yolo` / `autonomous: true`) pour comparer les résultats avec les agents cop1 existants (passerelle LLM). Le System track les retours de chaque commande (succès/échec/questions non-résolues) et les consigne dans le workflow context. À groomer : stratégie de fallback si commande BMAD échoue silencieusement, critères de comparaison agents cop1 vs BMAD #yolo
- **FR22** : Le Dev Agent peut produire du code sur une branche git isolée (worktree par story) et gérer les conflits en consultant l'historique des commits récents sur main
- **FR23** : Le Dev Agent peut créer des commits structurés avec messages conventionnels
- **FR24** : Le Reviewer Agent peut analyser le code produit et émettre un verdict (approve / request-changes), limité à N refus avant escalade au Developer
- **FR25** : Le System peut merger ou proposer un merge de la branche story vers la branche principale
- **FR26** : Le Developer peut consulter et valider manuellement les branches produites avant merge
- **FR48** : Le System peut planifier les tâches nocturnes en ordonnant les stories par analyse de chevauchement de fichiers (stories modifiant des fichiers disjoints passent en premier). Objectif : zéro conflit merge entre stories exécutées dans une même session nocturne
- **FR122** : Le DevAgent peut fournir une URL preview (host:port) dans le résultat de son step après commit, permettant aux agents downstream de naviguer l'application en cours d'exécution
- **FR123** : *(Growth)* Le ReviewerAgent peut consulter le preview environment (si disponible) en complément de l'analyse statique du code, en utilisant un MCP browser tool

### Capability Area 6 — Monitoring & Reporting

- **FR27** : Le Developer peut consulter l'état du système en temps réel via une Web UI incluant : vue pipeline par story, quality dashboard avec KPIs et tendances, journal narratif, et intégration SonarQube
- **FR28** : Le System peut produire un Morning Report (markdown) résumant la nuit : stories traitées, blocages, résultats
- **FR29** : Le System peut logger tous les événements agents en JSON structuré pour debugging
- **FR30** : Le Developer peut consulter l'historique des décisions prises par les agents sur chaque story
- **FR31** : Le System peut alerter le Developer (notification async) si un blocage critique survient en journée
- **FR53** : Le System peut calculer et afficher un burndown pour anticiper les dérives en cours de sprint
- **FR55** : Le System produit un journal narratif horodaté de toutes les actions et événements du sprint (manager lance sprint → dev prend tâche → blocage détecté → réunion organisée → résolution → reprise → QA valide → PM marque done)
- **FR58** : Le Developer peut consulter un Quality Dashboard Web UI affichant les KPIs du sprint (vélocité, taux blocage, taux rejet DoD, couverture tests) et les métriques par agent (taux de réussite, durée moyenne, tokens consommés), avec graphiques d'évolution multi-sprints et indicateurs de tendance
- **FR70** : Le System peut calculer la vélocité de l'équipe (stories livrées / sprint) et projeter la capacité des prochains sprints
- **FR125** : Le Quality Dashboard affiche les résultats SonarQube (code smells, bugs, vulnérabilités, dette technique) intégrés depuis le service d'intégration SonarQube, avec un indicateur de quality gate (passed/failed)
- **FR126** : Le Developer peut consulter une pipeline view temps réel par story montrant le flux Dev → Reviewer → QA → (Demo) → PM avec : statut de chaque step (pending / running / ok / failed), nom de l'agent actif, modèle LLM utilisé, tokens, durée, et résumé de la commande en cours. Alimentée par les événements temps réel du bus d'événements
- **FR129** : Le Developer peut consulter l'historique des exécutions de sprints passés (pas seulement le temps réel) en naviguant les logs structurés persistés par le service de logging
- **FR135** : Le System expose des endpoints backend pour le quality dashboard (KPIs du sprint courant, évolution multi-sprints, résultats SonarQube) et pour l'historique pipeline (timeline des steps par story), alimentés par les services internes de calcul KPIs, d'intégration SonarQube, et de logging structuré
- **FR139** : Le Quality Dashboard gère gracieusement le cold-start (premier sprint, SonarQube non configuré) : messages informatifs au lieu de graphes vides, indication des prérequis manquants, fonctionnement dégradé sans SonarQube (les KPIs internes restent affichés)

### Capability Area 7 — Agile Ceremony Engine

- **FR45** : Le System peut conduire une rétrospective automatisée en fin de session nocturne (multi-agents) sur ce qui s'est bien/mal passé
- **FR46** : Le System peut produire un plan d'actions issu de la rétrospective pour améliorer le sprint suivant
- **FR50** : Le System peut planifier et exécuter des cérémonies agiles (sprint planning, daily async, retro, review/démo, réunion de blocage, grooming)
- **FR51** : Le Scrum Master Agent peut faciliter les cérémonies, équilibrer les temps de parole, et produire un compte-rendu
- **FR54** : Après chaque cérémonie, le System produit une synthèse/rapport simple lisible par le Developer
- **FR79** : Le Scrum Master Agent dispose d'une base de référence Scrum/Agile consultable (Scrum Guide, guides Atlassian/Asana) pour arbitrer les questions de méthode
- **FR81** : Les cérémonies suivent un modèle tour de table séquentiel — Round 1 : chaque agent contribue à son tour (contexte cumulatif) → Round 2 si divergences : arbitrage → Synthèse finale par le SM Agent
- **FR82** : Le Developer peut lire les contributions des agents et répondre de façon asynchrone, sans que tous les LLMs tournent simultanément
- **FR85** : Le System implémente le modèle round-table séquentiel pour toutes les cérémonies (pas d'asynchrone multi-agent en MVP)
- **FR86** : Durant chaque round de cérémonie (FR81), chaque agent DOIT inclure au moins une section "challenge" ou "perspective alternative" dans sa contribution. Le SM Agent valide la présence de cette section avant de passer au round suivant. Les contributions sans challenge sont flaggées dans le compte-rendu de cérémonie
- **FR87** : Les KPIs de pilotage (vélocité, taux blocage, taux rejet DoD, qualité code) sont observables par le Developer et utilisés par l'équipe pour ses décisions d'auto-amélioration

### Capability Area 8 — Configuration & Rules Engine

- **FR32** : Le Developer peut configurer le système via un fichier `cop1.config.yaml` (backlog path, budgets, routing, plages horaires, mcp_permissions per-agent, demo_agent routes, preview_environment settings)
- **FR33** : Le Developer peut définir des règles métier per-agent via le system `iamthelaw` (YAML rules)
- **FR34** : Le Developer peut définir les Definition of Done (DoD) spécifiques au projet
- **FR35** : Le System peut valider qu'une story répond aux critères DoD avant de la marquer comme terminée
- **FR56** : Le System maintient un ensemble de règles d'équipe (team rules) évolutives, réévaluées à chaque rétrospective, incluant le principe de convergence par diversité
- **FR57** : Le System peut limiter le nombre de rejections DoD et escalader au Developer si le seuil est dépassé
- **FR59** : L'équipe peut proposer des modifications de règles autonomement. Si le Developer n'a pas rejeté une proposition dans les N heures (configurable dans `cop1.config.yaml`, défaut 48h), la proposition est auto-approuvée et appliquée au prochain sprint. Les auto-approbations sont signalées dans le morning report
- **FR60** : Durant chaque rétrospective, les agents peuvent proposer des modifications à leurs propres règles/compétences (iamthelaw YAML)
- **FR61** : Toute modification de règle agent est soumise à approbation explicite du Developer avant application au sprint suivant
- **FR62** : Le Developer peut consulter, approuver, modifier ou rejeter les propositions d'évolution des agents via la Web UI

### Capability Area 9 — BMAD Interface & Story Versioning

- **FR72** : Le System peut lire les stories BMAD en lecture seule (jamais de modification directe des fichiers BMAD)
- **FR73** : Au démarrage de chaque sprint, le System crée un snapshot versionné des stories sélectionnées (version figée pour la durée du sprint)
- **FR74** : Le System travaille exclusivement sur les snapshots — les fichiers BMAD originaux ne sont jamais modifiés pendant un sprint
- **FR75** : En fin de sprint, le System génère un rapport markdown lisible par BMAD listant ce qui a été fait, les changements de statut, et les points d'attention pour mise à jour du backlog
- **FR76** : Avant le sprint planning, le Scrum Master Agent vérifie chaque story candidate contre les critères INVEST
- **FR77** : Le System produit un rapport de santé du sprint backlog indiquant quelles stories sont INVEST-conformes et lesquelles nécessitent du grooming BMAD
- **FR78** : Le System ne peut pas sélectionner une story non-INVEST pour un sprint sans approbation explicite du Developer

### Capability Area 10 — Developer Control

- **FR36** : Le Developer peut démarrer, mettre en pause, et arrêter le daemon cop1
- **FR37** : Le Developer peut déclencher manuellement l'exécution d'une story spécifique
- **FR38** : Le Developer peut consulter et modifier la configuration LLM routing à chaud
- **FR39** : Le Developer peut définir les plages horaires de fonctionnement autonome
- **FR40** : Le Developer peut exporter les données de sessions (stories, logs, rapports) pour archivage ou review post-sprint (J2)
- **FR142** : Le System peut tracker la consommation d'API Claude (tokens envoyés/reçus, coût estimé) par session et par story, et exposer ces données dans le quality dashboard
- **FR143** : Le Developer peut configurer un cap journalier de dépense API Claude dans `cop1.config.yaml` (montant en dollars ou en tokens)
- **FR144** : Le System peut alerter le Developer (notification async) et auto-pauser les workflows agents quand le cap journalier API Claude est atteint — les stories en cours sont mises en pause proprement, le morning report inclut le motif d'arrêt

### Capability Area 12 — Demo Agent & Visual Reporting

- **FR130** : *(Growth)* Le DemoAgent est un WorkflowStep qui s'exécute après la validation QA. Il utilise Playwright MCP (via le contrat d'automatisation navigateur, cf. NFR32) pour naviguer l'application dans le preview environment, capturer des screenshots des pages pertinentes, et les stocker dans `.cop1/demos/{sprint}/{story}/`
- **FR131** : *(Growth)* Le DemoAgent produit un rapport visuel de sprint en markdown avec images embarquées (avant/après, features clés). Les pages/routes à capturer sont configurables dans `cop1.config.yaml` ou dans les Dev Notes de chaque story


## Non-Functional Requirements

### Performance

- **NFR1** : La Web UI répond aux actions utilisateur en moins de 500ms (hors attente LLM)
- **NFR2** : Un agent LLM local (Ollama) doit atteindre un minimum de **15 tokens/seconde** pour participer à une cérémonie — en dessous, il est exclu au profit du LLM de fallback
- **NFR3** : Le démarrage du daemon cop1 (service + connexion Docker) s'effectue en moins de 30 secondes
- **NFR4** : Le Resource Monitor vérifie l'état des ressources en continu avec une latence de mesure < 1 seconde

### Security & Privacy

- **NFR5** : Aucune donnée de code source ni clé API n'est transmise vers un service cloud sans consentement explicite (local-first by design)
- **NFR6** : Les clés API (Anthropic, etc.) sont stockées exclusivement dans `.env` — jamais committées, jamais loggées en clair
- **NFR7** : Les conteneurs Docker LLM sont isolés réseau du reste du système (pas d'accès internet sauf Anthropic API si activée)
- **NFR8** : Les MCP servers sont isolés par rôle agent — un agent ne peut pas accéder aux outils d'un autre rôle sans règle explicite. Phase 1 MVP : soft-limit via règles iamthelaw, audit log actif. Phase 2 : enforcement par le service de contrôle d'accès MCP. Phase 3 : proxy MCP avec approbation.
- **NFR28** : Chaque appel MCP est audité (agent, tool, timestamp, résultat) dans le journal structuré, même en Phase 1 (accès complet)

### Reliability & Resilience

- **NFR9** : En mode nuit autonome, le système peut fonctionner sans intervention humaine pendant 8 heures consécutives avec une disponibilité cible de 95%
- **NFR10** : Tout workflow interrompu (crash, OOM, arrêt forcé) est récupérable depuis le dernier checkpoint sans perte de travail (checkpoint à chaque transition de statut)
- **NFR11** : Le seuil de suspension automatique est fixé à **75% RAM** (≈48GB/64GB) — jamais dépassé sans approbation explicite, pour éviter freeze machine et corruption de données. Mieux vaut tourner à 75% stable que risquer un arrêt brutal à 85%+
- **NFR12** : Un agent bloqué depuis plus de `max_iteration_timeout` (configurable, défaut 30 min) est automatiquement escaladé sans intervention humaine

### Resource Management (M3 Max — Mode Nuit)

- **NFR13** : Un agent Resource Monitor (LLM léger, faible coût) surveille les ressources toutes les 10 secondes (RAM libre, CPU load, GPU usage) et peut **suggérer** des ajustements de seuils — les suggestions de réduction (ex: libérer un modèle LLM quand RAM libre < 20%) sont automatiquement acceptées par le Manager Agent, les suggestions d'augmentation (ex: charger un modèle supplémentaire quand RAM libre > 40%) suivent le profil progressif NFR14
- **NFR14** : La montée en charge RAM suit un profil progressif : démarrage à 50% du budget RAM configuré, augmentation par paliers de +10% toutes les 15 minutes si la charge reste stable (CPU < 80%, pas d'OOM kill), avec capacité de repli rapide (< 30 secondes pour décharger un modèle) si instabilité détectée (swap actif, latence tokens dégradée > 50%)
- **NFR15** : Les seuils de ressources (RAM %, tokens/sec minimum) sont configurables par l'utilisateur dans `cop1.config.yaml`
- **NFR16** : Le mode copilot jour (budget RAM réduit) est **hors scope MVP** — réservé comme future epic Phase 2

### Observability

- **NFR17** : Tous les événements système sont loggés en JSON structuré avec timestamp, agent, story, action, et durée
- **NFR18** : Le Morning Report est généré dans les 5 minutes suivant la fin de la plage horaire nocturne
- **NFR19** : La Web UI affiche l'état du sprint en temps réel avec un délai maximum de 5 secondes
- **NFR20** : Chaque cérémonie produit un compte-rendu markdown dans les 2 minutes suivant sa clôture
- **NFR26** : L'historique des exécutions de sprint est consultable pour les N derniers sprints (N configurable, défaut 10) avec un temps de chargement < 3 secondes
- **NFR27** : Le Quality Dashboard recalcule les KPIs et tendances en < 2 secondes à l'ouverture de la page
- **NFR33** : Les API REST backend (FR135) répondent en < 500ms pour les endpoints KPIs/SonarQube et en < 2 secondes pour l'historique pipeline (parsing logs structurés)
- **NFR34** : Chaque type de feature a une stratégie de test définie avec seuils de couverture : backend domain ≥ 80% (unit + integration via Vitest), Web UI ≥ 60% (component tests React), SSE/bus d'événements ≥ 70% (integration tests avec mock), process management/preview env ≥ 50% (integration tests avec timeout). Les workflows BMAD TEA (`bmad_tea_automate`, `bmad_tea_test-review`, `bmad_tea_atdd`) sont utilisables pour générer et auditer les tests

### Maintainability

- **NFR21** : L'architecture hexagonale est respectée — zéro dépendance infrastructure dans la couche domaine (vérifiable via lint rule)
- **NFR22** : La couverture de tests unitaires de la couche domaine est maintenue ≥ 80%
- **NFR23** : Toute règle d'équipe (team rule) ou règle agent (iamthelaw) est versionnée en YAML lisible par un humain
- **NFR24** : La configuration complète du système (`cop1.config.yaml` + rules) permet de recréer un environnement identique sur une autre machine
- **NFR29** : Le preview environment (processus dev local) est automatiquement arrêté en cas de crash du workflow, timeout, ou fin de story — aucun processus orphelin ne doit persister
- **NFR30** : Le DemoAgent a un timeout configurable (défaut 5 min par story) — si Playwright ne répond pas, le step est marqué failed sans bloquer le reste du workflow
- **NFR31** : Le preview environment démarre en < 30 secondes après le commit DevAgent (temps avant que l'URL soit accessible aux agents downstream)
- **NFR32** : Le DemoAgent abstrait l'accès à Playwright derrière un contrat métier dédié (navigate, screenshot, interact). L'implémentation de ce contrat utilise le service de contrôle d'accès MCP pour obtenir le Playwright MCP tool, évitant une double abstraction — le contrôle d'accès gère les permissions, le contrat métier définit les opérations
