# ADR-012 — Multi-Turn BMAD Interaction: Agent SDK + LLM Supervisor

**Date:** 2026-03-19
**Status:** Proposed
**Authors:** elzinko, Claude Opus 4.6
**Context:** Consultation architecturale — cop1 doit interagir en multi-turn avec les workflows BMAD interactifs
**Supersedes:** None (extends ADR-008, ADR-011)
**Related:** ADR-008 (BMAD Execution Gateway), ADR-011 (Distribution & Orchestration), ADR-007 (2-layer architecture)

---

## 1. Executive Summary

cop1 orchestre des workflows BMAD de façon autonome (sans humain). Or, les workflows BMAD (dev-story, code-review, qa-automate, create-story, retrospective) sont **interactifs** — ils posent des questions et attendent des réponses dans la même session.

Le `ClaudeCliAdapter` actuel utilise le mode **single-shot** (`claude -p "prompt" --output-format json`) : un prompt, une réponse, fin du process. Ce modèle ne supporte pas les conversations multi-turn.

**Décision :** Adopter le **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) comme moteur d'exécution, combiné avec un **LLM Supervisor** qui remplace l'humain pour répondre aux questions des workflows BMAD.

Le SDK offre :
- Multi-turn natif (session resumption)
- Interception structurée des questions via `canUseTool` + `AskUserQuestion`
- Accès aux skills BMAD via `settingSources: ["project"]`
- Streaming, hooks, et contrôle programmatique complet

---

## 2. Problem Statement

### 2.1 Constat vérifié

Les workflows BMAD sont conçus pour une interaction humaine :

- `/bmad-bmm-dev-story` : 10 étapes, pose des questions à chaque transition ("Ready to implement? [C]", "Which story?", "Tests pass?")
- `/bmad-bmm-code-review` : demande confirmation avant d'appliquer les corrections
- `/bmad-bmm-qa-automate` : propose des choix de stratégie de test
- `/bmad-bmm-retro` : sollicite des feedbacks et des votes

**Aucun mode yolo/auto/non-interactif n'existe dans BMAD.** Le `--permission-mode acceptEdits` ne couvre que l'acceptation d'éditions de fichiers, pas les questions de décision des workflows.

### 2.2 Modèle actuel (single-shot)

```
ClaudeCliAdapter.execute()
  └── spawn('claude', ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits'])
      └── Un seul prompt → une seule réponse → process terminé
```

**Limitation :** Si le workflow BMAD pose une question, la réponse contient la question mais le process est terminé. Impossible de répondre.

### 2.3 Fait technique critique : les skills ne fonctionnent PAS en mode headless

Les slash commands BMAD (ex: `/bmad-bmm-dev-story`) sont des **skills** — des raccourcis côté client résolus par le **skill resolver** de Claude Code interactif. Le mécanisme :

```
Mode interactif (fonctionne) :
  Utilisateur tape: /bmad-bmm-dev-story
       │
       ▼
  [Skill resolver] ← intercepte le "/"
       │
       ▼
  Lit le fichier workflow.md associé
       │
       ▼
  Injecte le contenu comme instruction système au LLM
  → Le LLM reçoit le workflow complet, jamais le texte "/bmad-bmm-dev-story"
```

```
Mode headless -p (NE fonctionne PAS) :
  claude -p "/bmad-bmm-dev-story"
       │
       ▼
  [Pas de skill resolver en mode -p]
       │
       ▼
  Le texte brut "/bmad-bmm-dev-story" est envoyé au LLM
  → Le LLM ne sait pas quoi en faire
```

Documentation officielle (headless.md) :
> *"User-invoked skills like /commit and built-in commands are only available in interactive mode. In -p mode, describe the task you want to accomplish instead."*

**Conséquence :** Le `ClaudeCliAdapter` actuel avec `claude -p "/bmad-bmm-dev-story"` n'a en réalité **jamais invoqué les skills BMAD correctement**. Le LLM recevait le texte brut et essayait de deviner quoi faire.

### 2.4 Ce qui doit changer

cop1 doit pouvoir :
1. Démarrer une session BMAD avec accès réel aux skills
2. Détecter quand l'agent pose une question
3. Générer une réponse intelligente (via un superviseur LLM)
4. Renvoyer la réponse dans la même session
5. Répéter jusqu'à completion du workflow
6. Logger toutes les interactions (questions, réponses, décisions)

---

## 3. Options Analysées

### Option A — Session continuation CLI (`claude --resume <session_id>`)

**Mécanisme :** Chaque tour = nouveau process CLI, contexte préservé via session ID.

```bash
# Tour 1
claude -p "Execute the dev-story workflow" --output-format json
# Tour N
claude --resume "abc123" -p "EA2-S3" --output-format json
```

| Critère | Évaluation |
|---------|-----------|
| BMAD Skills | **NON** — le mode `-p` n'a pas de skill resolver (doc officielle) |
| Multi-turn | OUI — contexte préservé entre tours |
| Détection questions | Heuristiques sur l'output JSON (fragile) |
| Robustesse | Bonne — session persiste sur disque |
| Coût tokens | Élevé — contexte re-chargé à chaque resume |

**Verdict : FALLBACK V1** — fonctionne pour le multi-turn mais ne résout pas le problème des skills. Nécessiterait de charger manuellement les fichiers workflow BMAD comme prompts.

### Option B — Stream JSON bidirectionnel (`--output-format stream-json`)

**Verdict : REJETÉ** — trop fragile, insuffisamment documenté pour le bidirectionnel. Si le process meurt, tout est perdu.

### Option C — Anthropic SDK directement (`@anthropic-ai/sdk`)

**Verdict : REJETÉ** — perd toute l'intégration Claude Code (outils Read/Write/Edit/Bash, MCP, skills, permissions).

### Option D — PTY / pseudo-terminal (`node-pty`)

**Verdict : REJETÉ** — GitHub issue #15553 confirme que l'envoi programmatique d'input au TUI Ink de Claude Code est **cassé** (`\n` traité comme newline, pas submit). Le SDK est la solution officielle.

> **Note R&D :** L'approche terminal (tmux + détection de prompt) est une piste intéressante mais nécessite un outil dédié. Des projets comme **Claude Squad** (tmux + worktrees) explorent ce terrain. Sujet séparé.

### Option E — Prompt enrichi (réponses pré-injectées)

**Verdict : OPTIMISATION complémentaire** — réduit le nombre de tours (~30%) en pré-injectant les réponses prévisibles dans le prompt initial. Insuffisant seul (ne couvre pas les questions imprévisibles).

### Option F — Claude Agent SDK avec skills (`@anthropic-ai/claude-agent-sdk`)

**Mécanisme :** API TypeScript native avec accès aux skills BMAD via configuration explicite.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Execute the BMAD dev-story workflow for story EA2-S3",
  options: {
    cwd: "/path/to/project",
    settingSources: ["user", "project"],  // ← charge les skills BMAD du projet
    allowedTools: ["Skill", "Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    // resume: sessionId,  // multi-turn natif
  }
})) {
  if (message.type === "tool_use" && message.tool === "AskUserQuestion") {
    // Claude pose une question → le superviseur cop1 répond
    // Le callback canUseTool intercepte la question structurée
  }
}
```

**Capacité clé — `canUseTool` + `AskUserQuestion` :**

Quand Claude utilise l'outil `AskUserQuestion` (= pose une question à l'utilisateur), le SDK route cette demande vers un callback `canUseTool` que cop1 peut intercepter et répondre **programmatiquement**. Pas besoin de parser du texte libre pour détecter les questions — elles arrivent structurées.

| Critère | Évaluation |
|---------|-----------|
| BMAD Skills | **OUI** — via `settingSources: ["project"]` + `allowedTools: ["Skill"]` |
| Multi-turn | **OUI** — natif, in-process, session resumption |
| Détection questions | **STRUCTURÉE** — `AskUserQuestion` intercepté via `canUseTool` |
| Robustesse | Excellente — pas de spawn de process par tour |
| Coût tokens | Identique ou moindre (pas de re-chargement de contexte entre tours) |
| Outils Claude Code | **OUI** — Read, Write, Edit, Bash, Glob, Grep tous disponibles |
| MCP | **OUI** — configurable via `mcpServers` |
| Hooks | **OUI** — PreToolUse, PostToolUse, Stop, SessionStart |

**Nuance importante :** On n'écrit pas `/bmad-bmm-dev-story` dans le prompt. On décrit la tâche naturellement ("Execute the BMAD dev-story workflow for story EA2-S3") et Claude **découvre et invoque le skill autonomement** via l'outil `Skill` car il voit les skills BMAD enregistrées dans le projet.

**Verdict : RETENU comme V1 recommandé**

---

## 4. Decision: Agent SDK + LLM Supervisor

### 4.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  SprintRunner                                                        │
│  (orchestration existante — pipeline dev → review → QA)              │
│                                                                      │
│  Pour chaque story :                                                 │
│    BMADSessionStep.run(context)                                      │
│      │                                                               │
│      ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  BMADSessionPort (NEW — interface hexagonale)                  │  │
│  │                                                                │  │
│  │  startSession(command, context) → SessionHandle                │  │
│  │  continueSession(sessionId, message) → SessionTurnResult       │  │
│  └──────────────┬─────────────────────────────────────────────────┘  │
│                 │                                                     │
│     V1 Adapter  │  V0 Fallback Adapter                               │
│         ▼       │       ▼                                            │
│  ┌──────────────┴───────────────────────────────────────────────┐    │
│  │  AgentSdkSessionAdapter (V1 — recommandé)                    │    │
│  │                                                              │    │
│  │  Uses @anthropic-ai/claude-agent-sdk                         │    │
│  │  - settingSources: ["project"] → skills BMAD disponibles     │    │
│  │  - canUseTool callback → intercepte AskUserQuestion          │    │
│  │  - Multi-turn natif via session resumption                   │    │
│  │  - Streaming pour observabilité temps réel                   │    │
│  │                                                              │    │
│  │  ClaudeResumeSessionAdapter (V0 fallback)                    │    │
│  │  - claude --resume <session_id> -p "response"                │    │
│  │  - Charger les workflows manuellement comme prompts          │    │
│  │  - Détection questions par heuristiques (fragile)            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  SupervisorService (NEW — application layer)                   │  │
│  │                                                                │  │
│  │  Reçoit les questions interceptées par le SDK                  │  │
│  │  Analyse : question simple ou complexe ?                       │  │
│  │  Si simple → répond directement (lookup table, "C", etc.)     │  │
│  │  Si complexe → invoque SupervisorLLMPort pour décision        │  │
│  │  Si hors mandat → escalade au développeur                     │  │
│  │                                                                │  │
│  │  Peut invoquer des commandes auxiliaires :                     │  │
│  │    - bmad-help (guidance méthodologique)                       │  │
│  │    - lecture de fichiers (story, context, rules)               │  │
│  │                                                                │  │
│  │  Logger toutes les interactions dans le SessionLog             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  SupervisorLLMPort (NEW — port domain)                         │  │
│  │                                                                │  │
│  │  generateResponse(question, context) → string                  │  │
│  │                                                                │  │
│  │  V1: AgentSdkSupervisorAdapter (même SDK, session séparée)     │  │
│  │  Future: OllamaSupervisorAdapter (LLM local)                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Flux Multi-Turn Détaillé (Agent SDK)

```
cop1 SprintRunner → BMADSessionStep.run(story: EA2-S3)
    │
    │  ① Configure le SDK
    │     settingSources: ["project"]   → skills BMAD chargées
    │     allowedTools: ["Skill", "Read", "Write", "Edit", "Bash"]
    │     cwd: worktreePath
    │
    ├── AgentSdkSessionAdapter.startSession(
    │       "Execute the BMAD dev-story workflow for story EA2-S3",
    │       context
    │   )
    │   │
    │   ├── SDK appelle query() → Claude démarre
    │   ├── Claude découvre le skill "bmad-bmm-dev-story" via Skill tool
    │   ├── Claude charge le workflow et commence l'exécution
    │   │
    │   ├── Claude utilise AskUserQuestion: "Which story to develop?"
    │   │   → canUseTool intercepte
    │   │   → SupervisorService.respond("Which story?", context)
    │   │   → Réponse: "EA2-S3" (depuis le contexte du sprint)
    │   │   → SDK renvoie la réponse à Claude
    │   │
    │   ├── Claude continue le workflow...
    │   │   → Read, Write, Edit, Bash (auto-approved via allowedTools)
    │   │
    │   ├── Claude utilise AskUserQuestion: "I found 3 approaches..."
    │   │   → canUseTool intercepte
    │   │   → SupervisorService.respond(question, context)
    │   │   → Question complexe → SupervisorLLMPort.generateResponse()
    │   │   → Réponse: "A) Repository pattern — per ADR-006"
    │   │   → SDK renvoie la réponse à Claude
    │   │
    │   ├── Claude termine le workflow
    │   │   → Tous les fichiers modifiés dans le worktree
    │   │   → sprint-status.yaml mis à jour par BMAD
    │   │
    │   └── SDK retourne le résultat final
    │
    └── Return StepResult { status: 'ok', report: finalOutput }
```

**Avantage clé vs Option A :** Les questions arrivent **structurées** via `AskUserQuestion`, pas comme du texte libre à parser. Pas besoin d'heuristiques fragiles pour détecter si l'output est une question ou une completion.

### 4.3 Gestion des Questions par le SupervisorService

Le `SupervisorService` traite les questions interceptées via `canUseTool` à trois niveaux :

**Niveau 1 — Réponses déterministes (rapide, sans LLM) :**

```typescript
// Questions prévisibles → lookup table
const DETERMINISTIC_ANSWERS: Record<string, string> = {
  // Continuation prompts
  'continue': 'C',
  'ready to proceed': 'C',
  'ready to start': 'C',
  // Story selection (injected from context)
  'which story': context.storyId,
};
```

**Niveau 2 — Superviseur LLM (décisions contextuelles) :**

Pour les questions architecturales, les choix de design, ou les situations ambigues, le superviseur est invoqué avec le contexte complet (story, architecture, règles iamthelaw, historique de session).

**Niveau 3 — Escalade au développeur :**

Si le superviseur ne peut pas répondre (question hors mandat, décision irréversible non couverte par les règles), il retourne `ESCALATE: [reason]` et le workflow est mis en pause.

### 4.4 Le Superviseur — Rôle et Architecture

Le superviseur est un **agent LLM qui remplace l'humain** dans les interactions avec les workflows BMAD.

**Capacités :**

1. **Répondre aux questions simples** : "Continue? [C]" → "C"
2. **Prendre des décisions architecturales** : "Which approach?" → analyse le project-context, l'architecture, les règles iamthelaw
3. **Fournir du contexte manquant** : "What's the story content?" → injecte le contenu de la story
4. **Invoquer des commandes auxiliaires** : peut appeler bmad-help pour obtenir de la guidance méthodologique
5. **Refuser et escalader** : si la question dépasse son mandat

**Contexte fourni au superviseur pour chaque question :**

```typescript
interface SupervisorContext {
  workflowCommand: string;        // "bmad-bmm-dev-story"
  storyId: string;                // "EA2-S3"
  storyContent: string;           // Contenu markdown complet
  projectContext: string;         // project-context.md
  architectureRules: string;      // architecture.md (extraits pertinents)
  iamtheLawRules: string;         // rules.md (sidecar ou YAML parsé)
  sessionHistory: SessionTurn[];  // Tours précédents (questions + réponses)
  currentQuestion: string;        // La question interceptée
}
```

**Prompt du superviseur :**

```
You are the cop1 Supervisor — an autonomous decision-maker replacing the human
developer during BMAD workflow execution.

## Decision Framework
1. If the question has a clear answer in the story AC → use it
2. If the question is about architecture → follow architecture.md and iamthelaw rules
3. If the question is about process → follow project-context.md conventions
4. If the question is a simple continuation prompt → answer "C" or equivalent
5. If you cannot determine the right answer → respond with "ESCALATE: [reason]"

## Context
[storyContent, projectContext, architectureRules, iamtheLawRules, sessionHistory]

## Current Question
[currentQuestion]

## Your Response
Respond ONLY with the answer. No explanation needed.
If escalating: ESCALATE: [reason]
```

---

## 5. New Port Design: `BMADSessionPort`

### 5.1 Pourquoi un nouveau port (et pas modifier `BMADCommandPort`)

| `BMADCommandPort` (existant) | `BMADSessionPort` (nouveau) |
|------------------------------|---------------------------|
| Sémantique **single-shot** : un appel = un résultat | Sémantique **session** : démarrer, continuer, terminer |
| Pas de state entre appels | `sessionId` = ressource avec lifecycle |
| Adapter : `ClaudeCliAdapter` (`claude -p`) | Adapter : `AgentSdkSessionAdapter` (SDK) |

Créer un nouveau port plutôt que modifier l'existant permet :
- **Rétrocompatibilité** : `BMADCommandPort` et `ClaudeCliAdapter` restent intacts
- **Coexistence** : certains usages restent single-shot (queries simples), d'autres deviennent multi-turn
- **Tests** : `InMemorySessionAdapter` pour les tests unitaires

### 5.2 Interface BMADSessionPort

```typescript
// packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts

export interface BMADSessionContext {
  projectPath: string;
  storyId: string;
  storyContent: string;
  /** Pre-composed answers injected in the initial prompt (Option E optimization) */
  preAnswers?: Record<string, string>;
}

export interface SessionHandle {
  sessionId: string;
  firstTurn: SessionTurnResult;
}

export interface SessionTurnResult {
  output: string;
  durationMs: number;
  tokensUsed?: number;
  completed: boolean;
  sessionId: string;
}

export interface BMADSessionPort {
  startSession(command: string, context: BMADSessionContext): Promise<SessionHandle>;
  continueSession(sessionId: string, message: string): Promise<SessionTurnResult>;
}
```

### 5.3 Interface SupervisorLLMPort

```typescript
// packages/sprint-core/src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts

export interface SupervisorQuestion {
  workflowCommand: string;
  storyId: string;
  currentQuestion: string;
  fullOutput: string;
  sessionHistory: Array<{ role: 'workflow' | 'supervisor'; content: string }>;
}

export interface SupervisorResponse {
  answer: string;
  escalated: boolean;
  escalationReason?: string;
  auxiliaryCallsMade?: string[];
  durationMs: number;
  tokensUsed?: number;
}

export interface SupervisorLLMPort {
  generateResponse(
    question: SupervisorQuestion,
    context: SupervisorContext,
  ): Promise<SupervisorResponse>;
}
```

---

## 6. Impact on Existing Components

### 6.1 Components NOT Modified

| Component | Raison |
|-----------|--------|
| `BMADCommandPort` | Conservé — sémantique single-shot toujours utile |
| `ClaudeCliAdapter` | Conservé — implémente `BMADCommandPort` pour les usages simple |
| `SprintRunner` | Aucun changement — consomme des `WorkflowStep` via `WorkflowEngine` |
| `WorkflowEngine` | Aucun changement — exécute séquentiellement des `WorkflowStep` |
| `WorkflowStep` / `WorkflowContext` | Aucun changement d'interface |

### 6.2 New Components

| Component | Package | Layer | Description |
|-----------|---------|-------|-------------|
| `BMADSessionPort` | sprint-core | domain/ports | Port hexagonal pour sessions multi-turn |
| `SupervisorLLMPort` | sprint-core | domain/ports | Port hexagonal pour le superviseur LLM |
| `AgentSdkSessionAdapter` | sprint-core | infrastructure | Implémente `BMADSessionPort` via `@anthropic-ai/claude-agent-sdk` |
| `ClaudeResumeSessionAdapter` | sprint-core | infrastructure | Fallback : implémente `BMADSessionPort` via `claude --resume` |
| `AgentSdkSupervisorAdapter` | sprint-core | infrastructure | Implémente `SupervisorLLMPort` via SDK (session séparée) |
| `SupervisorService` | sprint-core | application | Orchestre les réponses aux questions (déterministe + LLM + escalade) |
| `SessionLogger` | sprint-core | application | Enregistre toutes les interactions dans le JSONL |
| `BMADSessionStep` | sprint-core | application | Nouveau `WorkflowStep` utilisant `BMADSessionPort` + `SupervisorService` |

### 6.3 Modified Components

| Component | Modification |
|-----------|-------------|
| `BMADDevStoryStep` | **Remplacé** par `BMADSessionStep` configuré avec `command: 'bmad-bmm-dev-story'` |
| `BMADReviewStep` | **Remplacé** par `BMADSessionStep` configuré avec `command: 'bmad-bmm-code-review'` |
| `PipelineStepFactory` | Instancie `BMADSessionStep` au lieu de `BMADDevStoryStep` / `BMADReviewStep` |
| `StoryContextBuilder` | Enrichi pour produire le `BMADSessionContext` avec pre-answers |
| `package.json` (sprint-core) | Ajoute `@anthropic-ai/claude-agent-sdk` comme dépendance |

### 6.4 Composition Root Changes

```typescript
// packages/app/src/composition/PipelineStepFactory.ts (modifié)

// Avant:
const devStep = new BMADDevStoryStep(commandPort, options);
const reviewStep = new BMADReviewStep(commandPort, options);

// Après:
const sessionPort = new AgentSdkSessionAdapter(eventBus, sdkOptions);
const supervisorPort = new AgentSdkSupervisorAdapter(eventBus);
const supervisorService = new SupervisorService(supervisorPort, sessionLogger);

const devStep = new BMADSessionStep(sessionPort, supervisorService, {
  name: 'bmad-dev',
  command: 'bmad-bmm-dev-story',
  ...options,
});
const reviewStep = new BMADSessionStep(sessionPort, supervisorService, {
  name: 'bmad-review',
  command: 'bmad-bmm-code-review',
  ...options,
});
```

---

## 7. Session Logging & Historisation

Toutes les interactions de chaque session multi-turn sont loggées pour :
- Traçabilité (qui a décidé quoi et pourquoi)
- Debugging (comprendre les échecs)
- Coût (tokens consommés par session)
- Amélioration du superviseur (analyser les patterns de questions/réponses)

### 7.1 Format de log

```typescript
interface SessionLogEntry {
  timestamp: string;              // ISO 8601
  sessionId: string;
  storyId: string;
  workflowCommand: string;
  turn: number;
  role: 'workflow' | 'supervisor' | 'system';
  content: string;
  analysis?: {
    type: 'question_simple' | 'question_complex' | 'completion' | 'error' | 'escalation';
    method: 'deterministic' | 'llm' | 'canUseTool';
  };
  tokensUsed?: number;
  durationMs: number;
  auxiliaryCallsMade?: string[];
}
```

### 7.2 Event Types

Les logs de session sont ajoutés au narrative log existant (`.cop1/sprint-log-*.jsonl`) :

```
session.started
session.turn.question_intercepted
session.turn.answered_deterministic
session.turn.answered_llm
session.turn.escalated
session.tool.approved
session.tool.rejected
session.workflow.completed
session.workflow.failed
```

---

## 8. Cost Analysis

### 8.1 Modèle de coût Agent SDK vs CLI

| Phase | SDK (in-process) | CLI `--resume` (spawn par tour) |
|-------|-----------------|-------------------------------|
| Session start | ~10K input | ~10K input |
| Continuation | **0** (même session) | ~(10K + N×5K) input (re-chargement) |
| Question superviseur | ~3K input + ~0.5K output | ~3K input + ~0.5K output |
| Token overhead per story | **~30-50K total** | **~100-115K total** |

**Le SDK est ~2-3x moins cher** car il n'y a pas de re-chargement de contexte entre les tours.

### 8.2 Optimisations de coût

1. **Pre-answers (Option E)** : injecter les réponses prévisibles dans le prompt initial → réduit les tours de ~30%
2. **Supervisor model selection** : utiliser Haiku pour les questions simples, Sonnet/Opus pour les décisions complexes
3. **Max turns** : limite configurable (défaut: 20) pour éviter les boucles infinies
4. **Budget check per turn** : intégration avec le `BudgetService` existant
5. **`--max-budget-usd`** : le SDK supporte une limite de coût par session

---

## 9. Open Source Ecosystem

### 9.1 Projets directement pertinents

| Projet | Description | Pertinence pour cop1 |
|--------|------------|---------------------|
| **[Claude Squad](https://github.com/smtg-ai/claude-squad)** | Terminal app gérant plusieurs instances Claude Code via tmux + git worktrees. Chaque agent a un workspace isolé. | Pattern d'isolation worktree très similaire à cop1. Source d'inspiration pour la gestion multi-agent. |
| **[Ruflo (ex Claude Flow)](https://github.com/ruvnet/ruflo)** | 21.5k+ stars. Orchestration multi-agent, 259 MCP tools, 60+ agents. TypeScript + WASM. | Framework mature d'orchestration. Validé à grande échelle. Référence pour le stream-chaining. |
| **[bmad-mcp-server](https://github.com/mkellerman/bmad-mcp-server)** | MCP server exposant les personas BMAD (Mary, Winston, Amelia, etc.) comme outils. | Pourrait fournir le contexte BMAD au superviseur cop1 via MCP. Alternative future à la lecture directe des fichiers. |
| **[Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)** | Feature expérimentale officielle Anthropic. Multi-agent via tmux/iTerm2, mailbox system, shared task list. | Pattern officiel d'orchestration multi-agent. Hooks `TeammateIdle`, `TaskCompleted` pour quality gates. |

### 9.2 Outils de terminal automation (pistes R&D)

| Outil | Approche | Limitation |
|-------|---------|-----------|
| **node-pty** (Microsoft) | Fork pseudoterminals en Node.js. Utilisé par VS Code. | GitHub #15553 : input programmatique cassé avec Claude Code TUI (Ink) |
| **nexpect** (npm) | Pattern expect pour Node.js : spawn → expect(pattern) → sendline | Non maintenu. Fragile avec Claude Code. |
| **tmux send-keys** | `tmux send-keys -t session 'text' Enter` | Workaround : text → Escape (dismiss autocomplete) → Enter. ~0.4s latence. |
| **pexpect** (Python) | Gold standard du expect pattern | Même problème PTY que node-pty avec Claude Code |

### 9.3 Approche MCP inversée (piste future)

Au lieu que cop1 pilote Claude, **Claude pilote cop1 via MCP** :

```
┌─────────────────────────────┐
│  Claude Code (ou Agent SDK)  │
│                              │
│  Utilise les outils cop1     │
│  via MCP pour :              │
│  - Lire le sprint backlog    │
│  - Sélectionner une story    │
│  - Vérifier le budget        │
│  - Logger les événements     │
│  - Appliquer les règles      │
└──────────┬───────────────────┘
           │ MCP protocol (stdio)
           ▼
┌─────────────────────────────┐
│  cop1 MCP Server             │
│                              │
│  Tools:                      │
│  - sprint/list-stories       │
│  - sprint/get-status         │
│  - budget/check              │
│  - iamthelaw/get-rules       │
│  - log/append-event          │
└─────────────────────────────┘
```

**Avantages :** Découplé de Claude Code, fonctionne avec n'importe quel client MCP, suit le standard industriel. **Non retenu en V1** — nécessite une refonte de l'architecture de contrôle. À évaluer en V3+.

---

## 10. Evolution Path

### V1 — Agent SDK + Supervisor (cet ADR)

```
cop1 SprintRunner
  └── BMADSessionStep
        ├── AgentSdkSessionAdapter (@anthropic-ai/claude-agent-sdk)
        │     settingSources: ["project"] → skills BMAD
        │     canUseTool → intercepte AskUserQuestion
        └── SupervisorService
              ├── Réponses déterministes (lookup table)
              └── AgentSdkSupervisorAdapter (questions complexes)
```

- Skills BMAD accessibles nativement via le SDK
- Questions interceptées proprement (structurées, pas heuristiques)
- Superviseur LLM pour les décisions contextuelles
- `ClaudeResumeSessionAdapter` disponible en fallback si le SDK pose problème

### V2 — Multi-LLM + Supervisor avancé

```
cop1 SprintRunner
  └── BMADSessionStep
        ├── AgentSdkSessionAdapter (inchangé)
        └── SupervisorService
              ├── Réponses déterministes
              ├── AgentSdkSupervisorAdapter (Claude pour décisions complexes)
              └── OllamaSupervisorAdapter (LLM local pour questions simples)
```

- LLM différents par type de question (Ollama local pour "Continue?", Claude pour l'architecture)
- Réduction des coûts significative sur les questions simples

### V3 — cop1 comme MCP Server + Agent Teams

- cop1 expose ses services via MCP
- Claude (ou Agent Teams) pilote le sprint via les outils MCP de cop1
- Inversion du contrôle : Claude est autonome, cop1 est un service
- Possibilité d'utiliser Agent Teams pour paralléliser les stories

### V4 — Terminal Manager (R&D)

Exploration d'un outil dédié de gestion de sessions terminal (tmux/screen) avec détection intelligente de "l'agent attend une réponse". Inspiration : Claude Squad. Sujet de R&D séparé.

---

## 11. Architectural Coherence

### 11.1 Respect de l'hexagonal

| Principe | Respect |
|----------|---------|
| Ports dans domain, adapters dans infrastructure | **OUI** — `BMADSessionPort` et `SupervisorLLMPort` dans domain/ports |
| Injection via constructor | **OUI** — composition root instancie et injecte |
| Testabilité | **OUI** — `InMemorySessionAdapter` et `InMemorySupervisorAdapter` pour les tests |
| Pas de leak d'infrastructure dans le domain | **OUI** — le domain ne sait pas que le SDK existe |

### 11.2 Cohérence avec les ADRs existants

| ADR | Impact | Cohérence |
|-----|--------|-----------|
| ADR-007 (2-layer) | Layer 2 (cop1) utilise Layer 1 (BMAD) via SDK au lieu de CLI spawn | **OUI** — même contrat, mécanisme amélioré |
| ADR-008 (BMAD Gateway) | `BMADSessionPort` complète `BMADCommandPort`, ne le remplace pas | **OUI** — Strategy pattern préservé |
| ADR-009 (sprint-status read-only) | Aucun impact — cop1 reste read-only sur sprint-status.yaml | **OUI** |
| ADR-010 (iamthelaw) | Les règles sont injectées dans le contexte du superviseur | **OUI** — enrichit les décisions |
| ADR-011 (Distribution) | Le superviseur concrétise la vision de ADR-011 Section 6.2 | **OUI** — aligné avec l'évolution progressive |

### 11.3 Cohérence avec l'architecture.md

Le nouveau `BMADSessionPort` suit les patterns définis :

- **Naming** : PascalCase interface, kebab-case fichier (`bmad-session-port.ts`)
- **Suffixes** : `Port` pour l'interface, `Adapter` pour l'implémentation
- **Structure** : dans `features/bmad-orchestration/domain/ports/` et `infrastructure/`
- **Events** : dot-notation (`session.turn.question_intercepted`)
- **Errors** : `Result<T>` pattern pour les erreurs métier

---

## 12. Implementation Stories (Suggested)

| Story | Title | Description | Dependency | Effort |
|-------|-------|-------------|------------|--------|
| **S1** | BMADSessionPort + AgentSdkSessionAdapter | Port + adapter avec `startSession()` / `continueSession()` via Agent SDK. Config `settingSources`, `canUseTool` callback pour `AskUserQuestion`. Tests unitaires avec mock SDK. | None | Medium |
| **S2** | SupervisorLLMPort + AgentSdkSupervisorAdapter | Port + adapter pour le superviseur. Prompt engineering du supervisor prompt. Tests avec questions simulées. | None | Medium |
| **S3** | SupervisorService | Orchestre les réponses : déterministe → LLM → escalade. Intègre session logging. | S1, S2 | Medium |
| **S4** | BMADSessionStep | Nouveau WorkflowStep remplaçant BMADDevStoryStep/BMADReviewStep. Intègre BMADSessionPort + SupervisorService. | S3 | Medium |
| **S5** | PipelineStepFactory migration | Remplacer l'instanciation des BMADCommandSteps par BMADSessionSteps. Wiring composition root. Integration test E2E. | S4 | Small |
| **S6** | ClaudeResumeSessionAdapter (fallback) | Adapter alternatif via `claude --resume` pour les cas où le SDK ne convient pas. Chargement manuel des workflows BMAD comme prompts. | S1 (interface) | Small |

---

## 13. Open Questions

1. **Skill discovery** : Quand le SDK charge les skills via `settingSources: ["project"]`, Claude les découvre-t-il automatiquement ou faut-il mentionner le nom du skill dans le prompt ? À valider expérimentalement.
2. **Session cleanup** : Les sessions SDK persistent-elles sur disque ? Stratégie de rétention à définir.
3. **Supervisor model** : Quel modèle pour le superviseur en V1 ? Haiku (rapide/cheap) pour les questions simples + Sonnet pour les décisions ? Ou un seul modèle ?
4. **Pre-answers corpus** : Quelles réponses pré-injectées pour chaque workflow ? À construire empiriquement en observant les questions posées en mode interactif.
5. **SDK stability** : Le Claude Agent SDK est relativement récent. Prévoir le `ClaudeResumeSessionAdapter` en fallback est prudent.
6. **API key management** : Le SDK nécessite `ANTHROPIC_API_KEY`. Impact sur l'architecture de sécurité (`.env`, pas dans le code).
7. **bmad-mcp-server** : Faut-il intégrer le MCP server de mkellerman pour enrichir le contexte BMAD du superviseur ? À évaluer.

---

## 14. Decision Record

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Agent SDK** (`@anthropic-ai/claude-agent-sdk`) comme moteur d'exécution V1 | Multi-turn natif, interception structurée des questions (`AskUserQuestion`), accès aux skills BMAD via `settingSources`, ~2-3x moins cher que `--resume` |
| D2 | LLM Supervisor pour répondre aux questions des workflows | Les questions sont trop variées et contextuelles pour un système de règles déterministes seul |
| D3 | Nouveau port `BMADSessionPort` (pas modifier `BMADCommandPort`) | Sémantiques différentes (stateless vs stateful), rétrocompatibilité, coexistence |
| D4 | `ClaudeResumeSessionAdapter` comme fallback V0 | Prudence si le SDK pose problème. Nécessite de charger les workflows manuellement + heuristiques de détection |
| D5 | Prompt enrichi (Option E) comme optimisation complémentaire | Réduit les tours (~30%) en pré-injectant les réponses prévisibles |
| D6 | `SupervisorLLMPort` séparé du `BMADSessionPort` | Le superviseur peut évoluer indépendamment (multi-LLM en V2, Ollama en V3) |
| D7 | Approche MCP inversée documentée mais non retenue en V1 | Pattern prometteur (cop1 comme MCP server) mais nécessite refonte du contrôle. V3+ |
| D8 | Les slash commands ne fonctionnent pas en mode headless (`-p`) | Découverte critique : le skill resolver est exclusif au mode interactif. Le SDK avec `settingSources` est la solution officielle |
| D9 | Log complet de toutes les interactions | Traçabilité, debugging, coût tracking, amélioration continue du superviseur |
| D10 | Skills BMAD accessibles via SDK avec `settingSources: ["project"]` | Pas besoin de charger les fichiers workflow manuellement. Claude découvre et invoque les skills nativement. |
