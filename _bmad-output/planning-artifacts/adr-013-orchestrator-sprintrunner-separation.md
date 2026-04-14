# ADR-013 — Orchestrator vs SprintRunner Separation

**Date:** 2026-04-12
**Status:** Accepted
**Approved by:** elzinko on 2026-04-13
**Authors:** elzinko, Winston (Claude Opus 4.6 — architect agent)
**Context:** Formalisation de la séparation entre deux couches d'orchestration cop1, post-restructuration EA10/EA11 (SCP 2026-04-11) et post-tranchage du bridge tools (ADR-014)
**Related:** ADR-012 (Multi-turn BMAD interaction), ADR-014 (Supervisor Tool Interface), ADR-009 (sprint-status read-only), SCP 2026-04-11
**Prerequisites for:** EA10-S4 (OrchestratorService main loop), EA11-S3 (Extract technical services)
**Supersedes:** Stub 3 lignes dans `architecture.md` lignes 1120-1124 (créé 2026-04-07 par SCP, obsolète depuis SCP 2026-04-11 — mauvais numéro de story et scope trop large)

---

## 1. Executive Summary

cop1 introduit en Sprint 12/13 un `OrchestratorService` chargé de dérouler un épic BMAD de bout en bout via un playbook (`create-story → dev-story → code-review`, pour chaque story de l'épic cible). Or cop1 dispose déjà d'un `SprintRunner` (`packages/app/src/composition/SprintRunner.ts`, ~260 LOC) qui couvre la mécanique intra-command (worktree, session BMAD multi-turn, checkpoint, émission d'events).

**ADR-013 formalise la frontière entre les deux couches**, documente la surface publique de chacune, et cadre l'impact du refactoring EA11-S3 sur le SprintRunner existant. Elle ne tranche **aucune** décision architecturale neuve — le code existe, la direction est actée par SCP 2026-04-11 §4.2 et ADR-014 §2.2, ce document en capture la lettre.

### Décisions clefs

| # | Question | Décision |
|---|---|---|
| D1 | Frontière sémantique | **SprintRunner = intra-command primitive** (une invocation BMAD = worktree + session + checkpoint + events). **OrchestratorService = inter-command loop** (playbook → stories → séquence de commandes BMAD). |
| D2 | Forme d'interface | **Classes TypeScript concrètes**, pas de port, injection par constructor. Un `SprintRunnerPort` sera introduit si un second adapter devient un besoin réel (V1.1+). |
| D3 | Surface publique du SprintRunner refactoré | Nouvelle méthode `runBmadCommand(command, story, context) → InvocationResult`. La méthode `run()` actuelle reste fonctionnelle pour le CLI `cop1 run` non-orchestrator. |
| D4 | Services partagés | `WorktreeService`, `HistoryService`, `StepByStepController` sont extraits par EA11-S3 et consommés à la fois par SprintRunner (intra) et OrchestratorService (inter). |
| D5 | Séparation events/persistance | Events intra namespacés `session.*` / `worktree.*` / `checkpoint.*`. Events inter namespacés `orchestrator.*`. Persistance intra = Track 2+3 (ADR-014 §8). Persistance inter = `.cop1/orchestrator-state.yaml` dédié (§8.4). |

---

## 2. Problem Statement

### 2.1 Ce qui existe déjà

`SprintRunner` est l'entrypoint actuel du CLI `cop1 run`. Sa méthode `run()` :

1. Charge la config projet via `ConfigLoader`
2. Câble la télémétrie (`StructuredLogger` + `LoggerBridge`)
3. Lit la liste des stories via `BMADReader`
4. Filtre les stories éligibles via `BmadStatusReader`
5. Crée un worktree isolé si `--simulate` est passé
6. Démarre une session sprint (`SprintSessionService`)
7. Lit un checkpoint existant s'il y en a un (`CheckpointService`)
8. Construit les `WorkflowStep[]` via `PipelineStepFactory`
9. Boucle sur les stories éligibles et fait tourner `WorkflowEngine.run(context, steps)` pour chacune
10. Sauvegarde un checkpoint par story, émet des events, retourne un `SprintRunResult`

Le `WorkflowEngine` (layer `@cop1/sprint-core`) exécute séquentiellement les steps, dont le principal en V1-light est `BMADSessionStep` (ADR-012) qui invoque une commande BMAD multi-turn via `BMADSessionPort`.

**Observation clef** : la `run()` actuelle mélange trois préoccupations — la boucle sur les stories, la séquence de steps par story, et la mécanique par invocation (worktree + session + checkpoint). Cette imbrication est viable pour le CLI `cop1 run` mais ne laisse aucun point d'entrée propre pour un orchestrateur externe qui voudrait exécuter UNE commande BMAD pour UNE story.

### 2.2 Ce qui est introduit par SCP 2026-04-11

- **EA10-S4** — `OrchestratorService`, nouvelle classe qui lit un playbook markdown et déroule la séquence `create-story → dev-story → code-review` pour chaque story d'un épic cible. Portée par le CLI `cop1 orchestrator run --epic <id>` (EA10-S6).
- **EA11-S3** — extraction de `WorktreeService`, `HistoryService` (qui absorbera `NarrativeLogPort` remplacé par `ExchangeHistoryReader` via EA11-S8), `StepByStepController` depuis les internals actuels du SprintRunner.
- **EA10-S5** — mode `--step-by-step` inter-command (distinct du mode intra-command EA8-S5).

### 2.3 Tension à résoudre

Sans frontière formalisée, trois risques concrets :

1. **Duplication de mécanique worktree + session + checkpoint** entre SprintRunner et OrchestratorService (les deux auraient tendance à ré-implémenter le même cycle).
2. **Confusion sur qui pilote la boucle** : SprintRunner a déjà une boucle stories ; OrchestratorService introduit une boucle stories × commands. Si les deux boucles coexistent sans contrat clair, on obtient une nested loop mal définie et non testable.
3. **Surface publique ambiguë** : à quoi un consommateur (CLI, daemon, tests) doit-il s'adresser pour "exécuter une commande BMAD sur une story" ? À SprintRunner ou à OrchestratorService ?

### 2.4 Hors scope (renvoyé par référence)

Par référence aux ADRs adjacentes :

- **Bridge mechanism superviseur → services** : tranché par ADR-014 §4 (Q1) — in-process MCP via `createSdkMcpServer`
- **Catalogue des tools cop1** : tranché par ADR-014 §4.4
- **Persistance 3-tracks (Track 2 exchange history + Track 3 metrics)** : tranchée par ADR-014 §8
- **Frontière code / LLM** : tranchée par ADR-014 §3 (Q4)
- **Format du playbook** : tranché par ADR-014 §7 (Q5)
- **Session BMAD multi-turn (Agent SDK)** : tranché par ADR-012

ADR-013 documente strictement la frontière entre deux couches d'orchestration cop1 côté TypeScript.

---

## 3. Options considérées

### Option A — Monolithe (rejetée)

OrchestratorService absorbe SprintRunner : une seule classe lit le playbook, crée les worktrees, invoque les sessions BMAD, maintient les checkpoints.

**Verdict : REJETÉ.** Fait coexister trois préoccupations (intra-command mechanics / inter-command sequencing / playbook interpretation) dans une seule classe non testable en isolation. Rend impossible la conservation du CLI `cop1 run` non-orchestrator en V1-light.

### Option B — Deux couches, OrchestratorService délègue à SprintRunner (retenue)

SprintRunner expose une primitive par-invocation (`runBmadCommand`). OrchestratorService itère le playbook et appelle cette primitive une fois par commande × story. Les deux classes partagent les services extraits par EA11-S3.

**Verdict : RETENU.** Sépare intra et inter proprement, conserve la testabilité de chaque couche en isolation, permet la coexistence des deux CLIs pendant la transition.

### Option C — Trois couches avec service intermédiaire (rejetée)

Ajouter une troisième couche `StoryRunner` entre SprintRunner et OrchestratorService, chargée de "la séquence de commandes pour une story".

**Verdict : REJETÉ.** Over-engineering en V1-light. La séquence de commandes pour une story est déjà capturée par la boucle interne d'OrchestratorService ; pas besoin de classe dédiée. À reconsidérer si un besoin concret d'exécution partielle "une story entière en isolation" apparaît.

---

## 4. Decision — Frontière SprintRunner / OrchestratorService

### 4.1 Périmètre SprintRunner (intra-command primitive)

**Responsabilité unique** : exécuter UNE invocation BMAD pour UNE story, de bout en bout.

**Ce que SprintRunner fait** :

1. Crée ou réutilise le worktree pour la story (via `WorktreeService`)
2. Charge le contenu de la story et le contexte nécessaire au prompt initial
3. Démarre ou reprend une session BMAD multi-turn (via `BMADSessionPort` — ADR-012)
4. Sauvegarde un checkpoint à chaque transition significative (via `CheckpointService`)
5. Émet des events intra-invocation (`session.*`, `worktree.*`, `checkpoint.*`) sur l'`EventBus`
6. Consomme `StepByStepController` pour les pauses intra-command (EA8-S5)
7. Retourne un `InvocationResult` structuré : status (`ok|failed|aborted`), output, durée, tokens, worktreePath, sessionId

**Ce que SprintRunner NE fait PAS** :

- Lire un playbook
- Décider de la séquence de commandes BMAD
- Piloter la session superviseur long-running
- Écrire dans `sprint-status.yaml`
- Boucler sur plusieurs stories *côté nouvelle primitive* (la `run()` legacy conserve cette boucle pour le CLI `cop1 run`)

### 4.2 Périmètre OrchestratorService (inter-command loop)

**Responsabilité unique** : dérouler un playbook sur un épic cible, en orchestrant la session superviseur long-running et la séquence de commandes BMAD par story.

**Ce qu'OrchestratorService fait** :

1. Charge le playbook markdown (via `PlaybookLoader` — EA10-S1)
2. Résout la liste des stories de l'épic cible via `BmadStatusReader`
3. Démarre la session superviseur long-running (via `SupervisorLLMPort` — ADR-014 §6)
4. Pour chaque story × chaque commande du playbook : délègue à `SprintRunner.runBmadCommand()`
5. Interprète le résultat retourné : success → commande suivante ; failed → logique d'escalade (ADR-014 §4.3, multi-step resolution loop EA10-S8)
6. Consomme `StepByStepController` pour les pauses inter-command (EA10-S5)
7. Persiste l'état de progression inter-invocation pour reprise sur crash (canal à confirmer — voir §8.4)
8. Émet des events inter-invocation (`orchestrator.epic.*`, `orchestrator.story.*`, `orchestrator.transition.*`)

**Ce qu'OrchestratorService NE fait PAS** :

- Créer des worktrees directement
- Démarrer des sessions BMAD directement
- Invoquer `BMADSessionPort` directement
- Interpréter le contenu brut d'une commande BMAD

### 4.3 Diagramme de délégation

```
CLI `cop1 orchestrator run --epic EA6`
  │
  ▼
OrchestratorService.run(epicId, playbookPath)
  │
  ├── PlaybookLoader.load()                          [EA10-S1]
  ├── supervisorLLM.startSession(...)                [ADR-014 §6]
  │
  ├── for each story in epic.stories:
  │    ├── stepByStep.pauseBeforeStory(story)        [EA10-S5]
  │    │
  │    └── for each command in playbook.sequence:
  │         ├── stepByStep.pauseBeforeCommand(...)   [EA10-S5]
  │         │
  │         └── sprintRunner.runBmadCommand(          ◄── délégation
  │                command, story, context
  │             )
  │             │
  │             ├── worktreeService.ensure(story)    [EA11-S3]
  │             ├── bmadSessionPort.startSession(..) [ADR-012]
  │             ├── checkpointService.save(...)
  │             ├── historyService.append(...)       [EA11-S3 → ADR-014 §8]
  │             └── return InvocationResult
  │
  ├── supervisorLLM.closeSession()
  └── return EpicRunResult
```

### 4.4 Qui consomme quoi

| Consommateur | Appelle | Pourquoi |
|---|---|---|
| CLI `cop1 run` (legacy) | `SprintRunner.run()` legacy | Préservation du path non-orchestrator en V1-light |
| CLI `cop1 orchestrator run` | `OrchestratorService.run()` | Path playbook-driven, cible V1-light |
| `OrchestratorService` | `SprintRunner.runBmadCommand()` | Primitive intra-command, une invocation à la fois |
| `SprintRunner` (les deux méthodes) | `WorktreeService`, `BMADSessionPort`, `CheckpointService`, `HistoryService`, `StepByStepController` | Substrat commun EA11-S3 |
| Tests unitaires `OrchestratorService` | Mock de `SprintRunner` | Isolation stricte de la logique de boucle |
| Tests unitaires `SprintRunner` | Mocks des services injectés | Isolation stricte de la mécanique d'invocation |

---

## 5. Forme d'interface — classes concrètes

### 5.1 Décision : pas de port en V1-light

SprintRunner et OrchestratorService sont des **classes TypeScript concrètes**, injectées par constructor via la composition root (`packages/app/src/composition/`).

**Pas de `SprintRunnerPort`**, pas d'`OrchestratorServicePort`.

### 5.2 Rationale

Le même raisonnement qu'ADR-014 §6.4 s'applique :

- **Aucun second adapter planifié.** SprintRunner a une seule implémentation concrète. Les tests d'OrchestratorService mockent les dépendances internes du SprintRunner (`WorktreeService`, `BMADSessionPort`, etc.), pas le runner lui-même, ce qui donne une isolation suffisante sans port.
- **Coût d'abstraction évité.** Un port ajouterait ~100-200 LOC de boilerplate pour un bénéfice hypothétique.
- **Plan de sortie explicite** : si un second adapter apparaît (ex : `LocalSimulationRunner` pour dry-run pur sans spawn BMAD, ou `DistributedRunner` multi-workers en V1.1+), on introduit le port à ce moment-là, avec les **besoins réels** du second adapter. Refacto local, non-invasif pour OrchestratorService.

### 5.3 Surface publique proposée

```typescript
// packages/app/src/composition/SprintRunner.ts (refactoré)

export interface InvocationContext {
  projectPath: string;
  storyId: string;
  storyContent: string;
  preserveWorktree?: boolean;
  resumeFromCheckpoint?: boolean;
  /** Propagates user ctrl-c or graceful shutdown from the orchestrator (see §8.5) */
  signal?: AbortSignal;
}

export interface InvocationResult {
  status: 'ok' | 'failed' | 'aborted';
  command: string;
  storyId: string;
  output: string;
  sessionId: string;
  worktreePath: string;
  durationMs: number;
  tokensUsed?: number;
  checkpointSaved: boolean;
}

export class SprintRunner {
  constructor(deps: SprintRunnerDeps) { /* ... */ }

  /** Nouvelle primitive — exécute UNE commande BMAD pour UNE story */
  async runBmadCommand(
    command: string,
    story: StoryMetadata,
    context: InvocationContext,
  ): Promise<InvocationResult> { /* ... */ }

  /** Legacy — préservée pour le CLI `cop1 run` non-orchestrator */
  async run(options?: SprintRunOptions): Promise<SprintRunResult> { /* ... */ }

  /** Helper existant — conservé */
  listEligible(filter?: string): Array<{ id: string; title: string; status: string }> { /* ... */ }
}
```

```typescript
// packages/app/src/features/orchestrator/OrchestratorService.ts (nouveau — EA10-S4)

export interface OrchestratorDeps {
  sprintRunner: SprintRunner;
  playbookLoader: PlaybookLoader;
  supervisorLLM: SupervisorLLMPort;
  statusReader: SprintStatusReaderPort;
  stepByStep: StepByStepController;
  eventBus: EventBus;
}

export interface EpicRunResult {
  epicId: string;
  storiesAttempted: number;
  storiesCompleted: number;
  storiesFailed: number;
  commandsInvoked: number;
  durationMs: number;
  escalated: boolean;
  escalationReason?: string;
}

export class OrchestratorService {
  constructor(deps: OrchestratorDeps) { /* ... */ }

  async run(epicId: string, playbookPath: string): Promise<EpicRunResult> { /* ... */ }
}
```

---

## 6. Impact sur le code existant

### 6.1 Refactoring SprintRunner (porté par EA11-S3)

EA11-S3 extrait les services partagés depuis les internals actuels du SprintRunner :

| Logique actuelle (dans `SprintRunner.run()`) | Extraction vers | LOC approx |
|---|---|---|
| `createSimulateWorktree()` (lignes 213-236) | `WorktreeService` | ~40 |
| Intégration `StructuredLogger` + `LoggerBridge` | `HistoryService` (wrapper, alignement ADR-014 §8) | ~30 |
| Logique `--step-by-step` (future) | `StepByStepController` | ~50 |
| Boucle sur stories + pipeline steps + checkpoint | Reste dans `SprintRunner.run()` legacy | inchangé |
| Nouvelle primitive `runBmadCommand()` | Nouvelle méthode sur `SprintRunner` | ~100 |

**Note** : la méthode `run()` legacy est réécrite en interne pour consommer `runBmadCommand()` en boucle, afin d'éviter la duplication de la mécanique worktree + checkpoint. Les deux méthodes partagent les services extraits. L'objectif du refactoring n'est pas de supprimer `run()` mais de factoriser ses internals autour de la nouvelle primitive.

### 6.2 Deprecations

**Aucune deprecation dure** en EA11-S3/S4.

- `SprintRunner.run()` legacy **reste publique et fonctionnelle** tant que le CLI `cop1 run` existe.
- Une deprecation `@deprecated` pourra être ajoutée en V1.1+ si OrchestratorService atteint une parité fonctionnelle complète, notamment sur le mode `--simulate` (worktree éphémère de dry-run) et le mode `--dry-run`, qui ne sont pas dans le scope V1-light d'OrchestratorService.
- EA11-S1 déprécie les vieilles classes d'agents cop1 (`DevAgent`, `ReviewerAgent`, etc.) mais **ne touche pas à SprintRunner** — aucune interaction avec cet ADR.

### 6.3 Composition root

```typescript
// packages/app/src/composition/buildDependencies.ts (esquisse)

const worktreeService = new WorktreeService({ projectPath });
const historyService = new HistoryService({ projectPath, eventBus });
const stepByStep = new StepByStepController({ /* ... */ });
const checkpointService = new CheckpointService(projectPath);
const bmadSessionPort = new AgentSdkSessionAdapter({ /* ... */ });

const sprintRunner = new SprintRunner({
  projectPath,
  eventBus,
  worktreeService,
  historyService,
  checkpointService,
  bmadSessionPort,
  stepByStep,
  statusReader,
  // ...
});

const supervisorLLM = new ClaudeSdkSupervisorAdapter({ /* ... */ });
const playbookLoader = new PlaybookLoader();

const orchestratorService = new OrchestratorService({
  sprintRunner,
  playbookLoader,
  supervisorLLM,
  statusReader,
  stepByStep,
  eventBus,
});
```

### 6.4 Events et persistance

**Events intra-invocation** (émis par SprintRunner, inchangés dans leur structure existante) :

- `session.started`, `session.turn.question_intercepted`, `session.turn.answered_*`, `session.completed`, `session.failed`
- `worktree.created`, `worktree.reused`, `worktree.cleanup`
- `checkpoint.saved`, `checkpoint.resumed`, `checkpoint.cleared`

**Events inter-invocation** (nouveaux, émis par OrchestratorService) :

- `orchestrator.epic.started`, `orchestrator.epic.completed`, `orchestrator.epic.failed`
- `orchestrator.story.started`, `orchestrator.story.completed`, `orchestrator.story.failed`
- `orchestrator.transition.awaiting` (mode `--step-by-step`), `orchestrator.transition.approved`
- `orchestrator.escalation.raised`

**Persistance intra-invocation** : via `HistoryService` → Track 2 + Track 3 d'ADR-014 §8. Aucune duplication avec la persistance inter.

**Persistance inter-invocation** : état de progression (story courante, commande courante, commandes complétées) écrit dans `.cop1/orchestrator-state.yaml` via atomic rename. Schéma et règle de réconciliation au démarrage définis en §8.4. Aucune mutation de `sprint-status.yaml` (respect d'ADR-009).

---

## 7. Cohérence architecturale

### 7.1 Cohérence avec ADR-012 (Agent SDK multi-turn)

| Aspect | Cohérence |
|---|---|
| `BMADSessionStep` disparaît-il ? | **Non.** BMADSessionStep reste le lieu où le SDK est appelé. SprintRunner.runBmadCommand() appelle soit BMADSessionStep directement, soit BMADSessionPort directement — détail d'implémentation laissé à EA11-S3/EA10-S4, pas tranché ici. |
| `WorkflowEngine` / `WorkflowStep` conservé ? | **Oui pour le path legacy.** SprintRunner.run() continue d'utiliser le pipeline via WorkflowEngine. La nouvelle primitive `runBmadCommand()` peut en V1-light bypasser le WorkflowEngine pour simplifier (une invocation = un step), ou le consommer directement. Choix d'implémentation. |
| `ClaudeResumeSessionAdapter` fallback | Compatible : le fallback reste disponible derrière `BMADSessionPort`, aucun impact structurel. |

### 7.2 Cohérence avec ADR-014 (Supervisor Tool Interface)

| Aspect | Cohérence |
|---|---|
| Le superviseur appelle-t-il SprintRunner directement ? | **Non.** Le superviseur n'appelle que des tools (ADR-014 §4.4). Le tool `invoke_bmad_command` est implémenté côté runtime hôte et peut consommer `SprintRunner.runBmadCommand()` en interne, mais le superviseur ne voit que l'interface tool. |
| Le superviseur a-t-il connaissance de l'OrchestratorService ? | **Non.** OrchestratorService est le runtime hôte qui lance la session superviseur. Le superviseur ne voit qu'une boîte noire qui lui donne le contrôle via son system prompt et les tools. |
| Cohérence avec Q4 (frontière code/LLM) | **Oui.** OrchestratorService et SprintRunner sont du code TS (runtime hôte, primitives, garde-fous). Le LLM superviseur est pilote stratégique via tools. ADR-013 reste entièrement côté "TS = runtime hôte". |
| Cohérence avec Q6 (persistance) | **Oui pour intra.** SprintRunner consomme HistoryService qui écrit Track 2+3. **À confirmer pour inter** — voir Open Question §8.4. |
| `NarrativeLogPort` legacy | Non réintroduit. SprintRunner refactoré consomme `HistoryService` qui s'appuiera sur `ExchangeHistoryReader` une fois EA11-S8 livrée. Cohérent avec ADR-014 §8.5. |

### 7.3 Cohérence avec ADR-009 (sprint-status.yaml read-only)

**Tension résolue en §8.4.** ADR-009 déclare cop1 read-only sur `sprint-status.yaml`. ADR-013 introduit un besoin d'écrire l'état de progression inter-invocation — **résolu par la création d'un fichier dédié** `.cop1/orchestrator-state.yaml` qui enregistre un **checkpoint de process** (pas des transitions de story). BMAD reste canonical writer sur `sprint-status.yaml`, cop1 écrit dans son propre espace `.cop1/**`. Aucune zone grise nouvelle, aucun addendum à ADR-009 requis.

Règle de réconciliation au démarrage (§8.4) : comparaison croisée entre `sprint-status.yaml` (lu via `BmadStatusReader`) et `orchestrator-state.yaml` au resume, avec event `orchestrator.state.reconciled` émis en cas de divergence. Testable en isolation.

### 7.4 Cohérence avec l'architecture hexagonale

| Principe | Respect |
|---|---|
| Ports dans `domain/`, adapters dans `infrastructure/` | **OUI.** SprintRunner et OrchestratorService sont des **classes d'application layer** (composition / feature), pas des classes de domaine. Ils vivent dans `packages/app/src/composition/` et `packages/app/src/features/orchestrator/` respectivement. Ils consomment les ports existants (`BMADSessionPort`, `SupervisorLLMPort`, `SprintStatusReaderPort`). |
| Les classes de domaine référencent-elles SprintRunner/OrchestratorService ? | **Non.** Aucune. Ces classes sont des orchestrateurs techniques côté application layer, invisibles du domaine. |
| Testabilité | **OUI.** OrchestratorService teste avec mock de SprintRunner. SprintRunner teste avec mocks des services injectés. |

---

## 8. Related Decisions

Cinq questions corollaires à la frontière principale sont tranchées ici, après revue adversariale (2026-04-12). Aucune n'est laissée ouverte : elles sont consommées directement par EA11-S3 et EA10-S4.

### 8.1 — `SprintRunnerPort` : pas de port en V1-light

**Décision** : SprintRunner reste une classe TypeScript concrète. Pas de `SprintRunnerPort`.

**Rationale** : même **méthode d'arbitrage** qu'ADR-014 §6.4 ("port si et seulement si un besoin concret d'abstraction existe"), appliquée ici au cas plus simple où aucun second provider n'est envisagé — ADR-014 a retenu l'école "port minimal SDK-shaped", ADR-013 retient l'école "pas de port" parce que SprintRunner n'a aucun second adapter en embuscade. Mocker une classe concrète via `vi.fn()` ou `vi.mocked()` est strictement équivalent à mocker un port pour le test runtime, à ~5 LOC près. Le `--simulate` (worktree éphémère) n'est pas un second adapter — c'est un paramètre d'`InvocationContext.preserveWorktree`, une seule implémentation avec deux modes de worktree.

**Trigger de révision explicite** : dès qu'une 2e implémentation de `runBmadCommand` est spécifiée (PR ou ADR), introduire le port **avant** de merger — pas pendant l'implémentation, pas après.

### 8.2 — `SprintRunner.run()` legacy : conservée avec critère de sortie mesurable

**Décision** : `run()` legacy conservée en V1-light. EA11-S3 extrait des **helpers privés partagés** (`ensureWorktree`, `runBmadSession`, `saveCheckpoint`) entre `run()` et `runBmadCommand()`. La boucle sprint-level (`SprintSessionService`, expiration, `WorkflowEngine` multi-step) reste propre à `run()` — le "refacto interne" est partiel par construction : seul le sous-bloc worktree + session + checkpoint est mutualisé, pas la boucle externe.

**Critère de deprecation V1.1+** (toutes les conditions doivent être réunies) :
1. `cop1 orchestrator` utilisé en routine sur **≥1 épic** sans régression
2. Modes `--simulate` et `--dry-run` portés côté CLI `cop1 orchestrator`
3. Aucun consommateur externe de `SprintRunner.run()` hors du CLI `cop1 run`

Tant que ces trois conditions ne sont pas réunies, pas de `@deprecated`. Le non-respect du critère (1) en particulier évite le classique "legacy éternel".

### 8.3 — `StepByStepController` : service unifié avec modèle de commande explicite

**Décision** : un seul `StepByStepController` avec deux méthodes (`pauseBeforeInternalStep`, `pauseBeforeCommand`), injecté à la fois dans SprintRunner et OrchestratorService.

**Modèle de commande unifié** : chaque prompt accepte quatre actions — `{continue, skip-to-next-command, skip-to-next-story, abort}`. L'état `skip-to-next-*` est maintenu par le controller et consulté par les deux méthodes au prochain appel (un `skip-to-next-command` éteint les pauses intra restantes de la commande courante ; un `skip-to-next-story` éteint aussi les pauses inter restantes de la story courante). Cette sémantique est testable en isolation.

**Dépendance d'affichage** : résolue via un `PromptPort` injecté dans le controller (adapter TTY par défaut, adapter no-op pour les tests, adapter JSON réservé pour une éventuelle intégration SSE V1.1+). Évite la dépendance circulaire avec les services d'affichage CLI.

**Split en deux interfaces** : reporté à V1.1+ uniquement si un second consommateur non-CLI (ex : daemon web) apparaît. En V1-light, la surface unifiée gagne en simplicité ce qu'elle perd en ségrégation d'interface.

### 8.4 — Persistance inter-invocation : nouveau fichier `.cop1/orchestrator-state.yaml`

**Décision** : **Option A** — création d'un fichier dédié `.cop1/orchestrator-state.yaml` dans le **repo principal** (pas dans le worktree simulate), gitignored, écrit via atomic rename (tmp + rename, comme `sprint-status.yaml` le fait).

**Schéma minimal** :

```yaml
# .cop1/orchestrator-state.yaml
epicId: EA6
playbookPath: .cop1/playbooks/default.md
sessionId: 8583af...           # session superviseur long-running
currentStoryId: EA6-S3
currentCommand: bmad-bmm-dev-story
completedCommands:
  - { storyId: EA6-S1, command: bmad-bmm-create-story, timestamp: 2026-04-12T14:30:02Z }
  - { storyId: EA6-S1, command: bmad-bmm-dev-story,    timestamp: 2026-04-12T14:42:18Z }
  - { storyId: EA6-S1, command: bmad-bmm-code-review,  timestamp: 2026-04-12T14:51:44Z }
  # ...
startedAt: 2026-04-12T14:29:50Z
updatedAt: 2026-04-12T15:03:12Z
```

**Justification vs ADR-009** : ADR-009 interdit à cop1 d'écrire dans `sprint-status.yaml` parce que **BMAD est canonical writer sur les transitions de story**. Le fichier `orchestrator-state.yaml` n'enregistre **pas** de transitions de story — il enregistre un **checkpoint de process** (quelle commande l'orchestrator exécute actuellement pour la story in-progress). C'est le pendant inter-invocation du `CheckpointService` intra-invocation déjà existant dans `.cop1/`. Analogue structurel valide : `sprint-status.yaml` est owned BMAD, `.cop1/**` est owned cop1 — cette position ne crée aucune nouvelle zone grise.

**Règle de réconciliation au démarrage** : à chaque `OrchestratorService.resume()`, lecture croisée de `sprint-status.yaml` via `BmadStatusReader` et comparaison avec `orchestrator-state.yaml`. Si BMAD a avancé une story à `done` pendant qu'orchestrator pensait être dans une commande antérieure (ex : `dev-story` Step 9 a conclu et committé pendant que l'orchestrator était crashé), orchestrator saute à la story suivante et émet l'event `orchestrator.state.reconciled` avec le delta `{storyId, expectedCommand, actualStatus}`. Cette règle est testable en isolation avec deux fixtures (état cohérent / état divergent).

**Option B rejetée** : autoriser l'orchestrator à muter `sprint-status.yaml` casserait ADR-009 sans gain — BMAD gère déjà les transitions via `/bmad-bmm-dev-story` Step 9. Dupliquer ce write côté orchestrator réintroduirait exactement la classe de bug qu'ADR-009 a fermée.

**Option C rejetée** : Track 3 JSONL est **append-only** (ADR-014 §8.4) — reconstruction d'état impose soit un rejeu complet du journal soit un index maintenu à la main. Pour un crash-recovery qui doit être atomique et O(1), un fichier YAML avec atomic rename est structurellement plus sain. Track 3 reste la source de vérité pour l'observabilité, pas pour le recovery.

**Concurrence multi-worktree** : en V1-light, un seul orchestrator tourne à la fois (un second run concurrent est un anti-pattern de toute façon — sessions superviseur mélangées, commits qui se marchent dessus). File lock optionnel reporté à V1.1+ si un cas d'usage multi-orchestrator apparaît.

**Cette section tient lieu de décision formelle.** Pas d'addendum ADR-009 requis, pas de mini-ADR dédié. EA10-S4 peut consommer cette décision directement.

### 8.5 — OrchestratorService n'observe pas les events intra de SprintRunner

**Décision** : OrchestratorService prend ses décisions **uniquement sur `InvocationResult` retourné**. Séparation stricte entre contrôle (retour typé) et observabilité (events).

**Contrôle de budget V1-light — post-invocation** : `InvocationResult.tokensUsed` est agrégé entre les appels, orchestrator décide d'escalade (ou d'arrêt graceful) **avant** la commande suivante. Pas de kill mid-invocation en V1-light. Cette approche est suffisante pour un playbook typique ~27 invocations par épic (ADR-014 §5.6) : même si une invocation dépasse son budget, le dépassement est borné par les garde-fous internes du SDK (`max_turns_per_workflow`, `max_tokens_per_session` — ADR-014 annexe A).

**Canal d'interruption** : `InvocationContext` expose un `signal?: AbortSignal` (déjà ajouté à §5.3) pour propager un ctrl-c utilisateur ou un arrêt graceful déclenché par l'orchestrator entre deux invocations (ex : détection d'un budget épuisé post-invocation N, veut empêcher l'invocation N+1 déjà en flight). Pattern Node standard, zéro coût d'implémentation.

**Events intra** (`session.*`, `worktree.*`, `checkpoint.*`) : dédiés à l'observabilité — Track 3 metrics, SSE dashboard, transcript generator (EA11-S7). Jamais consommés par OrchestratorService lui-même. Cette règle rend OrchestratorService testable sans event bus.

**Plan d'évolution V1.1+** : si un besoin de contrôle budget **mid-invocation** émerge (ex : invocations qui atteignent régulièrement leur budget interne), on ajoutera un `onProgress?: (progress: InvocationProgress) => void` callback typé à `InvocationContext`, **pas** une subscription events par l'orchestrator. Conserve la séparation contrôle/observabilité.

---

## 9. Implementation Stories

ADR-013 est formalisée par **EA11-S4** (cette story). Les stories qui la consomment :

| Story | Rôle | Dépendance sur ADR-013 |
|---|---|---|
| **EA11-S3** | Extract technical services (`WorktreeService`, `HistoryService`, `StepByStepController`) | Référence §4.1 et §6.1 pour le scope d'extraction |
| **EA10-S4** | `OrchestratorService` main loop, 1-epic scope | Référence §4.2, §5.3 pour la surface publique et §8.4 pour la persistance |
| **EA10-S5** | Mode `--step-by-step` inter-command | Référence §8.3 pour le `StepByStepController` partagé |
| **EA10-S6** | CLI `cop1 orchestrator run --epic <id>` | Référence §4.4 + §6.3 pour le câblage composition root |

Aucune story d'implémentation nouvelle n'est introduite par ADR-013 elle-même — cet ADR documente une décision et balise le refactoring, il ne crée pas de travail au-delà de ce qui est déjà prévu par SCP 2026-04-11.

---

## 10. Decision Record

| Rôle | Nom | Décision | Date |
|---|---|---|---|
| Architect | Winston (Claude Opus 4.6) | Draft produced, revised after adversarial review | 2026-04-12 |
| Adversarial Reviewer | general-purpose agent (Claude) | 5 positions validated with precision amendments integrated | 2026-04-12 |
| Product Owner / User | elzinko | ✅ Approved | 2026-04-13 |

### Prochaines actions

1. **elzinko** — relecture d'ADR-013, corrections éventuelles
2. **elzinko** — approbation formelle (changer status en `Accepted`)
3. **elzinko / architect** — remplacement du stub obsolète dans `architecture.md` (lignes 1120-1124, créé 2026-04-07) par une référence pointant vers ce fichier
4. **Dev team** — consommer cet ADR comme référence au démarrage d'EA11-S3 et EA10-S4

### Blocages levés par ADR-013

- **EA11-S3** (Extract technical services) — scope d'extraction clair (§6.1), modèle `StepByStepController` unifié (§8.3)
- **EA10-S4** (OrchestratorService main loop) — surface publique et frontière de délégation clairs (§4, §5.3), persistance inter-invocation tranchée (§8.4), modèle de contrôle sans observation d'events intra (§8.5)
- **EA10-S5** (Mode `--step-by-step` inter-command) — substrat `StepByStepController` partagé avec modèle de commande explicite (§8.3)

**Aucun blocage résiduel.** Les 5 questions corollaires sont toutes tranchées en §8.

---

**Fin d'ADR-013**
