# ADR-014 — Supervisor Tool Interface

**Date:** 2026-04-11
**Status:** Accepted
**Approved by:** elzinko on 2026-04-11
**Authors:** elzinko, Winston (Claude Opus 4.6 — architect agent)
**Context:** Architect session declenchée par SCP 2026-04-11, story EA11-S5
**Related:** ADR-012 (Multi-turn BMAD interaction), ADR-013 (Orchestrator vs SprintRunner — à écrire), SCP 2026-04-11
**Prerequisites for:** EA10-S4 (OrchestratorService main loop), EA10-S7 (multi-agent advisory), EA11-S6 (SupervisorContext bootstrap), EA11-S7 (session transcript generator), EA11-S8 (legacy SessionLogger refactor — new story proposed)

---

## 1. Executive Summary

cop1 doit automatiser le déroulement d'un épic BMAD end-to-end en remplaçant l'humain par un **superviseur LLM long-running**. ADR-012 a tranché le moteur d'exécution (Claude Agent SDK, multi-turn, interception via `canUseTool`). ADR-014 tranche l'**interface** : comment le superviseur invoque-t-il les services techniques cop1 (worktree, checkpoint, history, step-by-step, consult-agent), comment les services sont-ils organisés, et comment l'historique est-il stocké.

### Décisions clefs

| # | Question | Décision |
|---|---|---|
| Q1 | Bridge mechanism | **In-process MCP server via `createSdkMcpServer`**, avec architecture en 3 couches (core logic / SDK wrapper / futur MCP standalone) |
| Q2 | Access scope | **Supervisor-only**. BMAD agents pristine, aucun accès aux tools cop1 |
| Q3 | LLM provider abstraction | **`SupervisorLLMPort` minimal SDK-shaped** — testabilité garantie, portabilité full non garantie (trade-off assumé, voir §6.4) |
| Q4 | Code vs LLM frontier | **TS = runtime hôte** (primitives, hooks invariants, persistance, garde-fous). **LLM = pilote stratégique** long-running. Session unique par run d'épic. Budget token chiffré en §3.3. |
| Q5 | Playbook format | **Markdown + front-matter YAML**. Front-matter validé par schéma Zod, hooks enforced par runtime (voir §7.3-bis). Body libre injecté dans le system prompt. |
| Q6 | Supervisor history | **Trois tracks distincts** : SDK session (resume) / Exchange history (rétro, un fichier markdown par session, actions sémantiques élargies — voir §8.3) / Metrics (JSONL dénormalisé par jour). Gitignored par défaut, auto-bootstrap du `.gitignore` avec confirmation. |

---

## 2. Problem Statement

### 2.1 Pourquoi cette ADR

Le SCP 2026-04-11 (sections 1, 2, 4.5) identifie trois écarts critiques entre la direction architecturale posée en EA9 et ce qu'il faut pour livrer le V1-light "automate one epic" :

1. `SupervisorContext` n'est pas réellement enrichi (fallback sur des chaînes vides dans `SupervisorService.ts:190-199`)
2. Aucun canal de consultation d'agents externes n'existe dans `SupervisorService` (décision cascade = déterministe → LLM → escalation, pas de "consult")
3. Aucune formalisation du bridge entre le superviseur et les services cop1 n'existe

Le SCP §4.5 pose explicitement 6 questions (Q1-Q6) dont les réponses **bloquent le démarrage de EA10-S4 (OrchestratorService) et EA10-S7 (multi-agent advisory)**.

### 2.2 Ce qui est déjà tranché (hors scope ADR-014)

- **ADR-012** — Claude Agent SDK comme moteur multi-turn, `canUseTool` pour interception, architecture à deux acteurs (BMAD agent interactif + LLM superviseur)
- **ADR-013 (à écrire en parallèle, EA11-S4)** — séparation `OrchestratorService` (inter-command, boucle playbook) vs `SprintRunner` (intra-command, mécanique worktree/session/checkpoint)
- **SCP 2026-04-11** — restructuration EA10 (9 stories), création EA11 (7 stories), report de l'auto-décision V1.1+

### 2.3 Ce qu'ADR-014 doit trancher

ADR-014 répond aux 6 questions du SCP §4.5 en se conformant à la vision superviseur enregistrée dans `memory/project_supervisor_vision.md` :

- Superviseur = agent LLM puissant, long-running, pilote stratégique
- Invocation des services via un bridge à définir (MCP / Agent SDK / hybride / sidecar)
- Évolvable, non verrouillé sur un protocole propriétaire
- Historique = citoyen d'observabilité de première classe
- Autonomie : cop1 lance, superviseur prend la main

---

## 3. Q4 — Frontière code vs LLM (principe directeur)

Cette question est traitée en premier parce qu'elle définit la forme de toutes les autres réponses.

### 3.1 Principe

> **Le runtime hôte TypeScript fournit les primitives, la persistance et les garde-fous. Le superviseur LLM est le pilote stratégique long-running. Ils se rencontrent au niveau des tools.**

Ce principe inverse le modèle naïf "TS = boucle extérieure, LLM = consultant appelé à des hooks". Dans ADR-014, **le superviseur porte la boucle stratégique dans son contexte LLM continu**, et le TS est le host qui lui fournit des primitives et de la sécurité.

### 3.2 Répartition des responsabilités

| Zone | TypeScript (runtime hôte) | LLM superviseur |
|---|---|---|
| Choix du prochain workflow | ❌ | ✅ Lit le playbook, décide la séquence |
| Conversation avec un workflow BMAD | Transport child-process | ✅ Porte la conversation tour par tour |
| Appel de `/bmad-help` en cas de blocage | Expose le tool | ✅ Décide quand et pourquoi l'appeler |
| Mémoire inter-workflows | Persiste la session sur disque | ✅ Porte nativement dans son contexte |
| Worktree / checkpoint / commit | Expose les tools | ✅ Appelle les tools quand il juge nécessaire |
| Invocation de commandes BMAD | Child process, streams, signaux | ✅ Déclenche via tool, consomme le résultat |
| Retry sur erreur transitoire (réseau, crash) | ✅ Garde-fou silencieux | Informé mais ne décide pas |
| Retry sur erreur sémantique (reviewer rejette) | ❌ | ✅ Décision de pilotage |
| Classification d'erreur | Binaire : transitoire / remontée au LLM | ✅ Interprète le reste |
| Gate step-by-step | Intercepte entre tool calls | Informé, peut produire un briefing |
| Budget / plafond d'itérations | ✅ Garde-fou dur | Informé via tool `remaining_budget` |
| NarrativeLog | ✅ Side-effect automatique | Consommateur via tool `query_session_history` |

### 3.3 Session long-running — pas de "session fraîche par workflow"

Le superviseur tient **une seule session LLM pour tout un run d'épic**. Il ne perd pas le contexte entre create-story, dev-story, code-review : la mémoire du superviseur EST le contexte SDK continu.

#### Budget token — chiffrage réaliste

| Composant | Taille estimée | Statut |
|---|---|---|
| System prompt (playbook body + identity) | ~5-15 k tokens | Cacheable (prefix stable) |
| Project context (PRD + architecture + story + epic narrative) | ~20-50 k tokens | Cacheable (prefix stable, invalide si PRD change) |
| Tool definitions (catalogue §4.4) | ~2-5 k tokens | Cacheable |
| **Sous-total prefix cacheable** | **~30-70 k tokens** | Chargé une fois, réutilisé |
| Tour moyen (question BMAD + réponse superviseur) | ~1-3 k tokens | Accumulé |
| Tools results (output BMAD, recall history, etc.) | ~0.5-2 k tokens | Accumulé |
| **Sous-total par tour** | **~1.5-5 k tokens** | Croît linéairement |

**Projection pour un run V1-light** :
- Scénario conservateur : 10 stories × 3 workflows × 15 tours × 2 k tokens/tour = **900 k tokens accumulés**
- Scénario chargé : 15 stories × 3 workflows × 30 tours × 4 k tokens/tour = **5.4 M tokens accumulés**

Le scénario conservateur tient dans la fenêtre Opus 1M sans compaction. Le scénario chargé la dépasse → compaction SDK requise.

#### Conséquence : 1M context ne suffit pas seul

Le fait de *garder* le contexte produit un effet recherché (mémoire cross-story, évite les frictions répétées), mais **requiert que la compaction SDK soit fonctionnelle** pour les runs chargés. Reconstruire un contexte à chaque workflow est coûteux en tokens *et* lossy — non retenu.

### 3.4 Compaction

**Déléguée au SDK nativement.** Aucune réinvention, aucune logique custom. Le SDK Anthropic Agent SDK gère la compaction automatique du working window de sa session ; la logique de "quelles parties compresser" est interne et opaque.

**Safety net en TS** (complémentaire, pas remplaçant) :

| Garde-fou | Valeur par défaut | Action au dépassement |
|---|---|---|
| Plafond dur d'itérations par session | `max_turns_per_workflow` du playbook (défaut 50) | Checkpoint + escalation utilisateur |
| Plafond dur de tokens par session | `max_tokens_per_session` du playbook (défaut 500 k) | Checkpoint + escalation utilisateur |
| Plafond dur de durée par workflow | `max_duration_per_workflow_seconds` (défaut 1800) | Checkpoint + abort workflow |

**Justification du 500 k sur un 1M context** : marge réservée (~500 k) pour le prefix cacheable (system prompt + project context + tools + playbook) et la headroom de compaction. Le plafond est une safety rail qui se déclenche AVANT que le SDK soit forcé de compacter agressivement et perdre de la nuance. Si le run dépasse ce plafond, c'est un signal qu'il faut un checkpoint + relaunch plutôt que laisser le SDK compacter à l'aveugle.

**Configurable par playbook** : un playbook "long run" (EA de 30+ stories) peut relever le plafond à 800 k, au prix de compaction plus agressive.

### 3.5 Persistance et recovery — référence §8

La forme concrète de la persistance est décrite en §8 (architecture à 3 tracks). Ce que §3 pose comme principes :

**Pattern de recovery : "replay-then-rebuild"** — le superviseur doit pouvoir reprendre un run crashé avec le minimum de perte.

- **Strategy A (primary) — replay via SDK natif** : le SDK Anthropic supporte nativement la reprise d'une session persistée via `resume: session_id`. Le Track 1 de §8 (session SDK native) contient tout ce qu'il faut. Zéro perte de contexte, reprise exacte au tour où le crash a eu lieu.
- **Strategy B (fallback) — rebuild from Track 2** : si Track 1 est indisponible ou corrompu (ex : upgrade SDK breaking), le runtime peut reconstruire un briefing depuis l'exchange history markdown (Track 2) et ouvrir une nouvelle session "fraîche mais informée". Plus lossy (pas de nuance interne), mais fonctionnellement équivalent pour reprendre où on en était.

**V1-light livre Strategy A uniquement.** Strategy B est une option documentée mais non implémentée — elle ne sera construite qu'en cas de besoin concret (ex : changement de provider LLM, ou incident de corruption Track 1).

Le catalogue détaillé (format des fichiers, emplacement, gitignore policy) est en §8.

---

## 4. Q1 — Bridge mechanism

### 4.1 Options analysées

| Option | Verdict |
|---|---|
| BMAD sidecar file-based | ❌ Incompatible avec session long-running (Q4) |
| Agent SDK in-process tools natifs | ✅ Simple mais verrouille sur le format SDK |
| Serveur MCP standalone externe | ✅ Évolvable mais coût V1-light élevé |
| Hybride arbitraire | ❌ Frontière technique non justifiable |
| **In-process MCP via `createSdkMcpServer`** | ✅ **Retenue** |

### 4.2 Décision : In-process MCP via `createSdkMcpServer`

Le Claude Agent SDK expose nativement une API pour créer un serveur MCP **in-process** :

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const createWorktree = tool(
  "create_worktree",
  "Create an isolated git worktree for a story",
  { branch: z.string(), storyId: z.string() },
  async (args) => { /* TS implementation */ }
);

const cop1Server = createSdkMcpServer({
  name: "cop1-supervisor-tools",
  version: "1.0.0",
  tools: [createWorktree, invokeBmadCommand, querySessionHistory, ...]
});
```

Propriétés :
- **Contrat MCP** (portable, standardisé) sans le coût d'un process IPC séparé
- **Appels in-memory** : latence négligeable
- **Consommation native** par le SDK : `options: { mcpServers: { cop1: cop1Server } }`
- **Portabilité future** : si un consommateur externe apparaît (autre agent, LLM local), on bascule vers un serveur MCP stdio standalone sans réécrire les tools

Vérification Context7 effectuée : cette API est documentée et stable dans la doc officielle Anthropic Agent SDK.

### 4.3 Architecture en 3 couches — découplage pour évolvabilité long-terme

```
┌────────────────────────────────────────────────────────┐
│ Couche 1 — Core functions (TS pur, zéro dépendance)   │
│                                                         │
│   async function createWorktreeCore(params)           │
│   async function invokeBmadCommandCore(params)         │
│   async function querySessionHistoryCore(params)       │
│   ...                                                   │
│                                                         │
│   → Logique métier, testable en isolation              │
└─────────────────────┬──────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌──────────────────────┐ ┌─────────────────────────┐
│ Couche 2a — Wrapper  │ │ Couche 2b — Wrapper MCP │
│ Agent SDK (V1-light) │ │ standalone (V1.1+)      │
│                      │ │                         │
│ tool() +             │ │ @modelcontextprotocol/  │
│ createSdkMcpServer() │ │ sdk, stdio server       │
│                      │ │                         │
│ → consommé par le    │ │ → consommable par tout  │
│   superviseur in-    │ │   client MCP (futur     │
│   process            │ │   agent, LLM local)     │
└──────────────────────┘ └─────────────────────────┘
```

- **V1-light** livre couches 1 + 2a uniquement
- **V1.1+** ajoute couche 2b sans toucher à la logique métier
- **Garantie long-terme** : si Anthropic casse le SDK, on garde la couche 1, on remplace 2a

Coût V1-light : ~30 lignes de boilerplate par tool (wrapper SDK → core). Accepté comme prix de la garantie long-terme explicitement demandée par elzinko.

### 4.4 Catalogue des tools V1-light

| Tool | Signature | Purpose | Couche 1 |
|---|---|---|---|
| `invoke_bmad_command` | `(command: string, history: ConversationHistory, next_message?: string) → BmadResponse` | Invoque un workflow BMAD en child-process, retourne sa sortie | `BmadCommandInvoker` |
| `create_worktree` | `(storyId: string, branch?: string) → WorktreeHandle` | Crée un worktree isolé pour une story | `WorktreeService` |
| `cleanup_worktree` | `(worktreeId: string) → void` | Supprime le worktree une fois son travail fait | `WorktreeService` |
| `commit_anchor` | `(metadata: AnchorMetadata) → { sha: string }` | Commit d'ancrage (empty ou réel) avec metadata structurée | `GitAnchorService` |
| `checkpoint` | `(state: CheckpointState) → void` | Snapshot de progression du run | `CheckpointService` |
| `query_session_history` | `(filter: HistoryFilter) → SessionInteraction[]` | Query rapide sur l'historique Track 2/3 | `SessionHistoryReader` (refactoré post-EA11-S8) |
| `consult_agent` | `(agentId: string, question: string) → AgentAdvice` | Consulte un agent BMAD externe (V1.1+, stub V1-light) | `AgentConsultationService` (stub) |
| `get_remaining_budget` | `() → BudgetStatus` | Retourne budget tokens/itérations disponibles | `BudgetGuard` |

**Nommage** : le tool query est volontairement nommé `query_session_history` (et non `recall_narrative_log`) pour éviter la confusion avec le `NarrativeLogPort` legacy qui est supprimé par EA11-S8. Le nom reflète ce qu'il fait : requêter l'historique de sessions, qu'il soit backé par Track 2 ou Track 3.

Tool built-in SDK utilisés sans implémentation cop1 :
- `AskUserQuestion` (natif SDK) — questions structurées à l'humain
- `canUseTool` callback (natif SDK) — intercept pour validation/pause

---

## 5. Q2 — Access scope

### 5.1 Décision : Supervisor-only

Les tools MCP cop1 sont consommés **exclusivement** par la session superviseur. Aucun agent BMAD interne n'en a connaissance ni accès.

### 5.2 Principe "BMAD reste BMAD"

Les workflows, agents et commandes BMAD ne sont **jamais** modifiés, instrumentés ni patchés :
- Pas de hook injecté
- Pas de sidecar forcé
- Pas de variable d'environnement pointant vers un serveur MCP cop1
- Pas de flag ajouté aux CLI BMAD

Les processes BMAD sont des child-processes pristines qui reçoivent leurs arguments CLI et produisent leur sortie, sans connaissance de cop1.

### 5.3 Point de contact unique

Toute interaction cop1 ↔ BMAD passe exclusivement par le tool `invoke_bmad_command`. Pas de deuxième canal, pas de protocole out-of-band.

### 5.4 Conséquences

**Positives** :
- Zéro surface d'attaque BMAD — rien à auditer côté BMAD
- Zéro négociation de permissions
- Zéro dépendance cop1 introduite dans BMAD → BMAD peut être mis à jour indépendamment
- Isolation destructive : les actions potentiellement destructives de BMAD (Bash, Write, rm) sont contenues dans le worktree créé par le superviseur

**À accepter** :
- Le superviseur est un choke point : s'il tombe, rien ne se passe. Mitigation : pattern Q4 de persistance/recovery
- Duplication potentielle si deux agents ont besoin du même service : résolue en V1.1+ par le wrapper MCP standalone (couche 2b)

### 5.5 Évolution V1.1+

Si un cas d'usage concret apparaît (ex : iamthelaw agent qui consulte le NarrativeLog pour auto-retro), la couche 2b de Q1 permet d'ajouter un second consommateur **sans modifier les tools eux-mêmes**. Zéro refacto architectural requis.

### 5.6 Granularité des commits — conséquence d'implémentation

Le superviseur produit **un commit par workflow BMAD**, via le tool `commit_anchor`, quel que soit le résultat :
- **Commit vide (`--allow-empty`) si rien n'a changé** — sert d'ancrage temporel corrélé au superviseur
- **Commit réel** si des fichiers ont bougé

Le message de commit est structuré :

```
[cop1/<workflow>] <story-id>: <one-line summary>

session-id: <uuid>
session-dir: .cop1/history/sprints/<sprint>/sessions/<filename>
supervisor-turn: <n>
workflow: bmad-bmm-<workflow>
story: <story-id>
status: completed|failed|aborted
narrative-log-cursor: <event-id>
```

Cette convention permet la navigation bidirectionnelle **git log ↔ exchange history ↔ metrics** : depuis n'importe quel commit d'ancrage, on retrouve le fichier de session ; depuis une session, on retrouve le SHA via le champ `related_commit` des front-matter.

**Volume et opt-out** : sur 9 stories × 3 workflows = 27 commits par épic, dont potentiellement ~15 empty commits. Pour éviter la pollution du git log sur des PR finales, deux mitigations sont prévues :
- **Config projet** `commits.skip_empty_anchors: true` désactive les commits vides (les autres ancrages passent par tags git légers ou via Track 3 metrics)
- **Script de squash** `cop1 commits squash --session <id>` fusionne les ancrages vides tout en préservant les commits réels, à utiliser avant `git rebase` final de la PR

### 5.7 Évolution BMAD et re-entrance — stratégies explicites

#### Version pinning du playbook

Le playbook front-matter contient `bmad_target_version` et `allowed_commands`. Si BMAD publie une version qui renomme `/bmad-bmm-dev-story` en `/bmad-bmm-develop`, deux comportements sont possibles :

| Mode | Comportement | Défaut |
|---|---|---|
| `strict` | Rejet au load du playbook avec message d'erreur explicite | ✅ par défaut |
| `compat` | Table d'alias dans le playbook : `command_aliases: { "/bmad-bmm-dev-story": "/bmad-bmm-develop" }` auto-substitués au niveau du tool `invoke_bmad_command` | Opt-in |

La stratégie `strict` par défaut est volontaire : elle force une revue explicite du playbook lors d'un upgrade BMAD, évitant les surprises silencieuses. Le mode `compat` existe pour les cas où l'upgrade doit être progressif.

#### Re-entrance de `invoke_bmad_command`

Quand le superviseur exécute `/bmad-bmm-dev-story` et appelle `/bmad-help` à l'intérieur du même workflow, deux invocations `invoke_bmad_command` sont actives simultanément du point de vue du superviseur.

**Ce n'est pas un deadlock** parce que :
- Chaque `invoke_bmad_command` est un **child-process frais et stateless** (pattern actuel de `BMADSessionStep`)
- Le superviseur est monothread côté SDK : il ne peut pas appeler deux tools en parallèle réel, le SDK sérialise les tool calls
- `/bmad-help` termine et retourne avant que la conversation avec `/bmad-bmm-dev-story` reprenne

**Garde-fou** : le tool `invoke_bmad_command` maintient un compteur de profondeur de re-entrance. Au-delà de 3 niveaux (workflow → help → help-recursive → …), le tool retourne une erreur pour forcer le superviseur à escalader plutôt que boucler.

---

## 6. Q3 — LLM provider abstraction

### 6.1 Décision : `SupervisorLLMPort` minimal (école port)

Un port TypeScript existe dès V1-light avec une surface réduite au strict nécessaire :

```typescript
// packages/sprint-core/src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts

export interface SupervisorSessionHandle {
  readonly sessionId: string;
  sendMessage(message: string): AsyncIterable<SupervisorMessage>;
  resume(sessionId: string): Promise<void>;
  close(): Promise<void>;
}

export interface SupervisorLLMPort {
  startSession(config: {
    systemPrompt: string;
    mcpServers: Record<string, unknown>;
    canUseTool?: CanUseToolCallback;
    budgets: BudgetConfig;
  }): Promise<SupervisorSessionHandle>;

  resumeSession(sessionId: string): Promise<SupervisorSessionHandle>;
}
```

### 6.2 Implémentation V1-light

Un seul adapter : `ClaudeSdkSupervisorAdapter`, qui wrap le SDK Anthropic.

### 6.3 Ce qui n'est PAS dans le port

Volontairement exclus pour éviter l'over-design prématuré :
- Pas de primitive de streaming typé générique (on expose l'AsyncIterable SDK-shaped)
- Pas de gestion de sous-agents
- Pas d'abstraction de format de message générique (on reste proche des types SDK)
- Pas de méthodes "au cas où"

Si un second adapter apparaît (local LLM, remote provider), on élargit le port **avec les besoins réels du second adapter**, pas avec une spéculation.

### 6.4 Bénéfices et limites — honnêteté sur la portabilité

**Ce que le port garantit (V1-light)** :
- ✅ **Testabilité** : la logique d'orchestration peut être testée avec un mock du port, sans consommer de tokens Claude. Les tests unitaires d'`OrchestratorService` et de la logique de décision utilisent ce mock.
- ✅ **Frontière nommée** : le code de l'orchestrator référence une abstraction nommée (`SupervisorLLMPort`) plutôt que d'importer `@anthropic-ai/claude-agent-sdk` partout. Meilleure clarté, refacto plus facile.

**Ce que le port NE garantit PAS** :
- ❌ **Portabilité plug-and-play vers un LLM provider non-Claude**. Le port expose des concepts SDK-shaped (`mcpServers`, `canUseTool`, `AsyncIterable<SupervisorMessage>`) qui ne sont pas traductibles mécaniquement vers un OpenAI, Gemini ou llama.cpp sans adaptation substantielle.
- ❌ **Abstraction générique multi-providers**. Un second adapter (ex : `LocalLlamaAdapter`) devra probablement **élargir le port** avec des concepts qui lui sont propres, voire réécrire une partie de l'orchestrator pour gérer les différences de modèle de tools.

**Pourquoi c'est un trade-off assumé** :
- L'école "full portability" (port agnostique) aurait nécessité ~300-500 LOC de code d'abstraction en V1-light pour un bénéfice hypothétique (aucun second adapter planifié)
- L'école "no port" aurait rendu les tests unitaires du superviseur dépendants des tokens Claude
- L'école "port minimal SDK-shaped" (celle retenue) donne la testabilité gratuitement, avec un coût de refacto modéré si un second adapter apparaît un jour

**Plan de sortie explicite (V1.1+ si besoin réel)** :
Si un second provider LLM devient un requirement concret, la démarche sera :
1. Écrire le second adapter (ex : `OpenAiSupervisorAdapter`)
2. Identifier les concepts du port incompatibles (`canUseTool`, format `mcpServers`, etc.)
3. Élargir le port avec les abstractions nécessaires, en gardant `ClaudeSdkSupervisorAdapter` fonctionnel
4. Ce refacto touche `SupervisorLLMPort` + les 2 adapters, **pas** la logique métier de l'orchestrator (contenue dans la couche 1 des tools)

Cette honnêteté est importante : ne pas promettre en §6 ce qu'on ne livrera pas, et réserver la question vraie de la portabilité à un ADR futur qui aura un cas d'usage concret à traiter.

---

## 7. Q5 — Format du playbook

### 7.1 Décision : Markdown + front-matter YAML

Un playbook est un fichier markdown avec un front-matter YAML. Le front-matter porte les métadonnées vérifiables par le runtime. Le body est un texte libre injecté dans le system prompt du superviseur.

### 7.2 Front-matter — schéma validé par Zod

Champs minimaux V1-light :

```yaml
playbook_version: 1
bmad_target_version: "6.0.0-Beta.8"
bmad_module: bmm
scope:
  mode: single_epic
  max_stories_per_run: 30
allowed_commands:
  - /bmad-bmm-create-story
  - /bmad-bmm-dev-story
  - /bmad-bmm-code-review
  - /bmad-help
help_command: /bmad-help
budgets:
  max_turns_per_workflow: 50
  max_tokens_per_session: 500000
  max_duration_per_workflow_seconds: 1800
hooks:
  pre_workflow:
    - create_worktree
  post_workflow_success:
    - commit_anchor
  step_by_step:
    enabled: false
decision_policy:
  on_workflow_failure: consult_bmad_help_then_escalate
  on_budget_exceeded: checkpoint_and_escalate
  on_ambiguous_bmad_question: escalate_to_user
```

Validation à la load : `PlaybookSchema` Zod rejette les playbooks invalides avant d'initialiser le superviseur. Erreurs lisibles pointant vers le champ fautif.

### 7.3 Body — injecté dans le system prompt

Le body markdown est injecté **tel quel** dans le system prompt du superviseur via `SupervisorLLMPort.startSession({ systemPrompt: playbookBody + projectContext })`.

Pas de sections obligatoires. Le rédacteur du playbook structure librement la prose. La validation est de la responsabilité du superviseur LLM lui-même lors de l'exécution.

### 7.3-bis Sémantique des hooks — side-effects runtime enforced, pas décisions LLM

Le front-matter contient une section `hooks` (ex : `pre_workflow: [create_worktree]`, `post_workflow_success: [commit_anchor]`). **Ces hooks sont des side-effects exécutés par le runtime hôte, pas des décisions déléguées au LLM superviseur.**

Pourquoi cette distinction est importante :

- **Les hooks sont des invariants d'hygiène** : un worktree DOIT exister avant que dev-story tourne (sinon le child-process BMAD touche le vrai repo), un commit d'ancrage DOIT être produit après chaque workflow réussi (sinon la traçabilité casse). Ces invariants ne sont pas l'affaire du LLM.
- **Le runtime hôte les exécute automatiquement** autour de chaque appel `invoke_bmad_command`, **en appelant les mêmes tools** qui sont aussi exposés au superviseur.
- **Le superviseur peut aussi appeler ces tools lui-même, ad hoc** : par exemple, `commit_anchor` au milieu d'un workflow s'il veut produire un checkpoint intermédiaire. Les deux chemins coexistent.

Résumé :

| Tool appelé | Via hook runtime automatique | Via LLM ad-hoc |
|---|---|---|
| `create_worktree` | ✅ Pré-workflow obligatoire | 🟡 Possible mais rare |
| `cleanup_worktree` | ✅ Post-workflow cleanup | 🟡 Possible si LLM décide d'abandonner |
| `commit_anchor` | ✅ Post-workflow success | ✅ Checkpoints intermédiaires |
| `checkpoint` | 🟡 Possible pré-workflow | ✅ Snapshots à discrétion |
| `invoke_bmad_command` | ❌ Jamais automatique | ✅ **Seul chemin LLM-driven** |
| `consult_agent` | ❌ | ✅ |
| `query_session_history` | ❌ | ✅ |

**Conséquence pour Q4** : ceci ne contredit pas la règle §3.2 "LLM pilote stratégiquement". Les hooks ne sont pas des *décisions stratégiques*, ce sont des *invariants techniques*. Le LLM décide **quoi** faire (quel workflow lancer, quand avancer) ; le runtime garantit **comment** les invariants sont tenus.

**Conséquence pour Q5** : le front-matter `hooks` est **enforced**, validé par schema, et les valeurs doivent correspondre à des implémentations TS connues du runtime. Pas de hooks dynamiques, pas de code inline.

### 7.4 Garde-fou : whitelist des commandes

Le tool `invoke_bmad_command` rejette toute commande absente de `allowed_commands` dans le front-matter. Protection contre les hallucinations ("le superviseur invente `/bmad-bmm-yolo` et ça plante").

### 7.5 Emplacement

```
.cop1/playbooks/
  default.md              ← playbook par défaut
  <future variants>.md    ← V1.1+
```

V1-light : un seul playbook, `.cop1/playbooks/default.md`. Le directory est prêt pour des variants futurs (experimental-retro, experimental-full-sprint, etc.) sans refacto.

### 7.6 CLI

```bash
cop1 orchestrator run --epic EA11                              # utilise default.md
cop1 orchestrator run --epic EA11 --playbook experimental.md   # override
cop1 playbook validate .cop1/playbooks/default.md              # lint
cop1 playbook show                                             # dump du playbook résolu (incluant body)
```

### 7.7 Exemple complet — playbook V1-light cop1 minimal

Voir annexe A. À livrer via story EA10-S3.

---

## 8. Q6 — Historique superviseur — architecture à trois tracks

### 8.1 Principe

L'historique superviseur n'est pas un concept monolithique. Trois purposes distincts = trois tracks avec trois formats optimisés :

| Track | Qui la gère | Usage | Durabilité | Commit |
|---|---|---|---|---|
| **1. SDK Session** | Agent SDK natif | Resume-on-crash | Transient | ❌ |
| **2. Exchange History** | Runtime hôte cop1 | Rétro, analyse, mémoire | Durable | ❌ par défaut (opt-in) |
| **3. Metrics** | Runtime hôte cop1 | Observabilité technique | Durable | ❌ (cache dérivé) |

### 8.2 Track 1 — SDK Session (resume-on-crash)

- Géré par l'Agent SDK nativement via `session_id` et `resume: session_id`
- Contenu : tous les messages SDK bruts (thinking, tool calls, tool results)
- Stockage : délégué au SDK, local, transient
- Format : propriétaire SDK
- Commit : jamais
- Perte acceptable : oui (run peut être relancé)

### 8.3 Track 2 — Exchange History (rétro et analyse)

**Un fichier markdown par session**, append-only pendant le run.

#### Emplacement et nommage

```
.cop1/history/
  sprints/
    sprint-12/
      sessions/
        20260411-143000_EA11-S5_create-story_8583af.md
        20260411-164522_EA11-S5_dev-story_b72e1c.md
        20260412-091505_EA11-S5_code-review_f901ab.md
```

Nommage : `<yyyymmdd-HHmmss>_<story-id>_<workflow>_<short-hash>.md`. Tri lexicographique = tri chronologique.

#### Contenu — les actions sémantiques du superviseur et les réponses reçues

Track 2 capture **tout ce qui est sémantiquement significatif pour une rétro** : les décisions du superviseur et les réponses qu'il obtient. Concrètement :

**Sont stockés** :
- **`invoke_bmad_command`** — demande du superviseur + réponse BMAD (cas principal, la grande majorité des entrées)
- **`consult_agent`** — demande de consultation + advice reçu (V1.1+, stub V1-light)
- **`commit_anchor`** — décision de commit + metadata (SHA, message, status)
- **`escalation`** — raison de l'escalation + question posée à l'humain (via `AskUserQuestion`) + réponse de l'humain
- **`step_by_step_pause`** — contexte de la pause + décision utilisateur (continue/abort/modify)

**NE sont PAS stockés** :
- Thinking blocks du superviseur (raisonnement interne) — exclus pour garder Track 2 lisible, pas pour cacher l'information (reste dans Track 1 SDK natif)
- Tool calls de plomberie : `checkpoint`, `query_session_history`, `get_remaining_budget`, `create_worktree`, `cleanup_worktree` — techniques, sans valeur rétro
- Metadata de perf (latences, tokens) — vont dans Track 3

**Rationale de cette sélection** : Track 2 doit répondre à la question *"pourquoi le superviseur a-t-il fait ce qu'il a fait ?"*. Les thinking blocks sont du raisonnement brut peu actionable ; les décisions (consult, commit, escalation) sont les actes sémantiques qui expliquent la trajectoire du run. La plomberie technique (checkpoint, query) ne contribue pas à cette narration et pollue la lecture.

#### Format interne

Chaque entrée est un bloc `## NNN — <action_type>` avec timestamp et contenu. L'action_type permet au lecteur de scanner rapidement les décisions stratégiques.

```markdown
---
session_id: 8583af39-ecd7-497f-9297-c5cfb4b8cc69
sprint: sprint-12
epic: EA11
story: EA11-S5
workflow: /bmad-bmm-create-story
started: 2026-04-11T14:30:00.123Z
ended: 2026-04-11T14:47:22.891Z
outcome: completed
related_commit: a1b2c3d4
---

# Exchange History — EA11-S5 / create-story

## 001 — supervisor → BMAD (invoke_bmad_command)
`2026-04-11T14:30:22.156Z`

Invoque le workflow /bmad-bmm-create-story avec le contexte suivant :
- Story: EA11-S5
- Epic: EA11 (Orchestrator Foundation)
...

## 002 — BMAD → supervisor (invoke_bmad_command result)
`2026-04-11T14:30:35.402Z`

Bonjour ! Je vais créer la story EA11-S5. Avant de commencer...

## 003 — supervisor → BMAD (invoke_bmad_command)
`2026-04-11T14:30:58.773Z`

...

## 024 — supervisor decision (commit_anchor)
`2026-04-11T14:45:12.331Z`

**commit** : a1b2c3d4
**message** : [cop1/create-story] EA11-S5: ADR-014 story formalization
**files** : .bmad-output/stories/EA11-S5.md (created)
**status** : completed

## 025 — supervisor → user (escalation)
`2026-04-11T14:46:02.778Z`

**reason** : BMAD demande confirmation d'un choix d'architecture ambigu
**question** : "Should ADR-014 use MCP server or Agent SDK in-process tools?"

## 026 — user → supervisor (escalation response)
`2026-04-11T14:46:45.010Z`

"Use Agent SDK in-process via createSdkMcpServer, see ADR-014 §4.2"
```

#### Écriture au runtime

Le runtime hôte observe **tous les tool calls sémantiques** via le hook SDK approprié (`canUseTool` callback + tool result callback) et filtre sur la whitelist de §8.3 "Sont stockés". Chaque événement déclenche un append atomique dans le fichier markdown de la session courante.

#### Échappement anti-injection

Les sorties BMAD sont du texte arbitraire produit par un LLM. Une sortie malicieuse ou malchanceuse peut contenir une séquence `---` au début d'une ligne, qui, concatenée naïvement, pourrait ouvrir un faux bloc front-matter YAML au milieu du fichier et tromper les readers/parsers.

**Stratégie d'échappement** dans `ExchangeHistoryWriter` :
- Scanner chaque contenu à écrire pour la séquence `^---\s*$` en début de ligne
- Si détectée, préfixer la ligne avec un zero-width space U+200B ou un échappement markdown (`\---`) qui est équivalent visuel mais non-parsable comme front-matter
- Aussi échapper les séquences ``` ``` `` `` `` en début de ligne si elles cassent le rendu markdown
- Test unitaire obligatoire couvrant ces cas dans EA11-S8

Cette stratégie est appliquée uniformément sur `supervisor → BMAD` ET sur `BMAD → supervisor` (les deux peuvent contenir du texte arbitraire).

#### Commit policy

**Gitignored par défaut**. Opt-in via flag CLI `--share-history` ou config projet `history.commit_strategy: selective`.

Rationale : position elzinko "on n'est pas obligé de commit tant qu'on n'en a pas besoin". La working memory est locale et suffisante pour les besoins V1-light. Si un besoin concret de partage apparaît, la bascule est triviale (changement de `.gitignore`).

### 8.4 Track 3 — Metrics (observabilité technique)

#### Format — JSONL dénormalisé

Un fichier par jour, append-only, chaque ligne = un événement complet avec toutes ses dimensions inline.

```jsonl
{"ts":"2026-04-11T14:30:35.402Z","type":"llm_call","session_id":"8583af...","sprint":"sprint-12","story":"EA11-S5","workflow":"create-story","model":"claude-opus-4-6","tokens_in":1247,"tokens_out":389,"latency_ms":13246}
{"ts":"2026-04-11T14:30:36.100Z","type":"tool_call","session_id":"8583af...","tool":"invoke_bmad_command","latency_ms":45,"success":true}
{"ts":"2026-04-11T14:47:22.891Z","type":"session_end","session_id":"8583af...","duration_ms":1042768,"turns":27,"tokens_total":42091,"outcome":"completed"}
```

#### Emplacement

```
.cop1/metrics/
  sprints/
    sprint-12/
      2026-04-11.metrics.jsonl
      2026-04-12.metrics.jsonl
```

#### Catalogue d'événements V1-light

| Type | Déclenchement | Dimensions |
|---|---|---|
| `llm_call` | À chaque invocation LLM | session_id, sprint, story, workflow, model, tokens_in, tokens_out, latency_ms |
| `tool_call` | À chaque tool invoqué | session_id, tool, latency_ms, success, error_type? |
| `bmad_workflow_start` | Début d'un workflow BMAD | session_id, workflow, story |
| `bmad_workflow_end` | Fin d'un workflow BMAD | session_id, workflow, story, duration_ms, turns, outcome |
| `session_start` | Début de session superviseur | session_id, sprint, epic, budget_tokens, budget_turns |
| `session_end` | Fin de session superviseur | session_id, duration_ms, turns, tokens_total, outcome |
| `budget_warning` | Approche d'un plafond | session_id, budget_type, current, limit, pct |
| `escalation` | Escalation vers utilisateur | session_id, reason |

#### Query CLI

```bash
cop1 metrics session --id 8583af...          # résumé d'une session
cop1 metrics sprint --id sprint-12            # résumé d'un sprint
cop1 metrics perf --model claude-opus-4-6     # perf par modèle
cop1 metrics tokens --since 2026-04-01        # usage tokens sur période
```

Implémenté comme reader JSONL en streaming + agrégation mémoire. Pas de dépendance binaire.

#### Pas de SQLite en V1-light

Volume V1-light : ~1000-2000 turns par run × ~20 runs par mois = ~20K-40K events/mois. Scan JSONL sub-seconde. SQLite est une optimisation prématurée.

**Réservation V1.1+** : si volume ou queries complexes le justifient, migration vers SQLite possible. Migration non-breaking (les JSONL restent source de vérité). Documentation à prévoir dans un futur ADR dédié si nécessaire.

#### Commit policy

**Gitignored par défaut** (cache dérivé, regénérable en partie depuis Track 2, peu partageable cross-machine).

### 8.5 Subsume du legacy `SessionLogger` / `SessionHistoryReader`

Le code EA9 actuel expose deux classes dans `packages/sprint-core/src/features/bmad-orchestration/application/` :

- `SessionLogger` (87 LOC) — écrit des `SessionInteraction` typés dans un `StructuredLogger` (format JSONL quotidien `.cop1/sprint-log-{date}.jsonl`) et les émet sur un `EventBus`
- `SessionHistoryReader` (167 LOC) — relit ces JSONL et les filtre par storyId / epicId / sessionId / plage temporelle

Le `SprintJournalService` (in-memory stub) n'est connecté à rien et peut être supprimé.

**Décision** : option A — **subsume**. Les deux classes sont réimplémentées pour lire/écrire la nouvelle structure Tracks 2+3, en préservant :
- Le type `SessionInteraction` (contrat public — doit évoluer pour refléter les nouveaux action_types mais avec migration compatible)
- L'API du reader (`getHistoryForStory`, `getHistoryForEpic`, `getRecentHistory`, filtres)
- Les event types (`session.turn.question_intercepted`, `session.turn.answered_deterministic`, `session.turn.answered_llm`, `session.turn.escalated`) — ces métadonnées enrichissent Track 3
- L'intégration `EventBus` pour le temps réel (SSE, si réactivé par EA3)

#### Estimation LOC révisée

| Composant | LOC estimé | Statut |
|---|---|---|
| Nouveau `ExchangeHistoryWriter` (Track 2) + échappement front-matter + tests | ~250-350 | NEW |
| Nouveau `MetricsWriter` (Track 3 JSONL journalier) + tests | ~150-200 | NEW |
| `SessionLogger` refactoré pour router vers Track 2 + Track 3 | ~100-150 (vs 87 initial) | MODIFY |
| Nouveau `ExchangeHistoryReader` (lecture Track 2) | ~150-200 | NEW |
| `SessionHistoryReader` refactoré pour lire depuis nouvelles sources + tests | ~150-200 (vs 167 initial) | MODIFY |
| Migration des consumers (`BMADSessionStep`, `SupervisorService`, etc.) | ~50-100 | MODIFY |
| Adaptation des tests existants | ~100-150 | MODIFY |
| **Total réaliste** | **~950-1350 LOC** | |

L'estimation initiale de 300-500 LOC était optimiste. La valeur réaliste est **~1000-1350 LOC avec tests**, ce qui classe EA11-S8 comme une story **medium-large** dans le sprint 12. À surveiller côté capacity.

#### Events Track 3 rediffusés via EventBus

Pour préserver l'intégration SSE existante (`@fastify/sse-plugin`), le `MetricsWriter` émet sur l'`EventBus` les events suivants, en miroir de ce qu'il écrit dans `.cop1/metrics/*.jsonl` :

| Event type EventBus | Écrit aussi en JSONL | Consommateur SSE |
|---|---|---|
| `session.start` | ✅ `session_start` | Dashboard live, sprint status widget |
| `session.end` | ✅ `session_end` | Dashboard live, completion notifications |
| `workflow.start` | ✅ `bmad_workflow_start` | Timeline |
| `workflow.end` | ✅ `bmad_workflow_end` | Timeline, success/failure alerts |
| `escalation.raised` | ✅ `escalation` | User notification (urgent) |
| `budget.warning` | ✅ `budget_warning` | Budget gauge widget |

Les events purement techniques (`llm_call`, `tool_call`) ne sont **pas** rediffusés via SSE pour éviter de spammer les consumers temps réel ; ils restent uniquement en JSONL pour analyse post-hoc.

Ce refacto est encapsulé dans une nouvelle story proposée : **EA11-S8 — Refactor SessionLogger/Reader vers nouvelle structure file-based 3-tracks**. Bloque EA11-S7 (transcript generator) qui consomme cette structure.

### 8.6 Garde-fou `.gitignore` — auto-bootstrap au lieu de hard fail

cop1 vérifie au démarrage que `.cop1/history/` et `.cop1/metrics/` sont listés dans `.gitignore`.

**Comportement** (améliorée depuis la première version "hard fail" pour ne pas casser l'onboarding premier-run) :

1. **Si les lignes sont présentes** → OK, démarrage normal
2. **Si les lignes sont absentes** → cop1 propose d'ajouter automatiquement le snippet, affiche ce qu'il va écrire, demande confirmation interactive (ou accepte un flag `--yes` pour CI)

```
cop1 orchestrator run --epic EA11

⚠️  .cop1/history/ et .cop1/metrics/ ne sont pas dans .gitignore.
cop1 va écrire automatiquement les lignes suivantes à la fin de votre .gitignore :

    # cop1 working memory (track 2 exchange history + track 3 metrics)
    .cop1/history/
    .cop1/metrics/

Continuer ? [Y/n]
```

3. **Si `--yes` passé en arg** → écriture silencieuse, logged dans stdout
4. **Si refus (`n`)** → cop1 refuse de démarrer avec un message "Ajoutez `.cop1/history/` et `.cop1/metrics/` à votre `.gitignore` manuellement, ou utilisez `--share-history` pour opt-in au commit (voir §8.3)"

Cette stratégie évite la friction "hard fail" sur le premier run tout en protégeant contre les fuites accidentelles.

---

## 9. Consequences

### 9.1 Impact sur le code

**Nouveaux fichiers (V1-light)** :

```
packages/sprint-core/src/features/bmad-orchestration/
  domain/ports/
    SupervisorLLMPort.ts                              [NEW — Q3]
    PlaybookSchema.ts                                 [NEW — Q5]
  application/
    SupervisorLLMAdapter.claude-sdk.ts                [NEW — Q3]
    PlaybookLoader.ts                                 [NEW — Q5, EA10-S1]
    ExchangeHistoryWriter.ts                          [NEW — Q6 Track 2]
    MetricsWriter.ts                                  [NEW — Q6 Track 3]
  tools/
    core/
      createWorktreeCore.ts                           [NEW — Q1 couche 1]
      invokeBmadCommandCore.ts                        [NEW — Q1 couche 1]
      commitAnchorCore.ts                             [NEW — Q1 couche 1]
      checkpointCore.ts                               [NEW — Q1 couche 1]
      querySessionHistoryCore.ts                      [NEW — Q1 couche 1]
      getRemainingBudgetCore.ts                       [NEW — Q1 couche 1]
      consultAgentCore.ts                             [NEW — Q1 couche 1, stub V1-light]
    sdk-wrappers/
      index.ts                                        [NEW — Q1 couche 2a, createSdkMcpServer]
```

**Fichiers modifiés** :

```
packages/sprint-core/src/features/bmad-orchestration/application/
  SessionLogger.ts          [REFACTOR — EA11-S8, subsume Q6]
  SessionHistoryReader.ts   [REFACTOR — EA11-S8, subsume Q6]
  SupervisorService.ts      [EXTEND — EA10-S8, multi-step loop, consult]
```

**Fichiers supprimés** :

```
packages/sprint-core/src/features/sprint-journal/
  (tout le feature — stub mort, EA11-S8)
```

### 9.2 Impact sur les stories

**Nouvelle story proposée au SCP** : **EA11-S8 — Refactor SessionLogger/Reader vers structure 3-tracks**.

- Sprint : 12 (même sprint qu'EA11)
- Bloque : EA11-S7 (transcript generator)
- Effort : **medium-large (~950-1350 LOC nouveaux + modifiés, tests inclus)** — re-estimé en §8.5, plus important que l'estimation initiale du SCP. À surveiller côté capacity Sprint 12.
- Livrables : nouveaux writers Track 2 + Track 3, readers adaptés, échappement anti-injection front-matter, `SessionInteraction` préservé avec migration compatible, intégration EventBus préservée, tests passants

**Stories débloquées par ADR-014** :
- EA10-S4 (OrchestratorService) — peut maintenant référencer `SupervisorLLMPort` et les tools cop1
- EA10-S7 (multi-agent advisory) — peut maintenant définir `consult_agent` comme stub V1-light + implémentation V1.1+
- EA10-S8 (multi-step resolution loop) — cadre de décision clair
- EA11-S6 (SupervisorContext bootstrap loader) — cadre de persistance clair
- EA11-S7 (transcript generator) — format d'entrée défini (Track 2 markdown)

### 9.3 Impact sur la doc d'architecture

À mettre à jour dans `_bmad-output/planning-artifacts/architecture.md` :

- **Section Architecture Decisions** : référencer ADR-014 (avec ADR-013 en parallèle)
- **Section Components — sprint-core.bmad-orchestration** : ajouter `SupervisorLLMPort`, `ExchangeHistoryWriter`, `MetricsWriter`, catalogue de tools
- **Section Persistence** : documenter la structure `.cop1/history/` et `.cop1/metrics/`, policy gitignore
- **Section Observability** : documenter les 3 tracks, la convention de commits d'ancrage, la navigation bidirectionnelle git ↔ history ↔ metrics
- **Section Legacy** : marquer `NarrativeLogPort` comme obsolète, référence à EA11-S8

### 9.4 Impact sur le PRD

FR145, FR146, FR147 du SCP 2026-04-11 restent valides. Aucun ajout requis par ADR-014 au-delà de ce qui est déjà dans le SCP.

### 9.5 Impact sur les tests

- **Tests unitaires** du port `SupervisorLLMPort` avec mock — testabilité de la logique d'orchestration sans tokens Claude
- **Tests d'intégration** de chaque tool couche 1 (core) en isolation
- **Tests de contrat** du wrapper SDK couche 2a — vérification que le tool se comporte bien dans le runtime SDK
- **Tests E2E** (EA10-S9) sur fixture EA6 cobaye : un run complet avec orchestrator, superviseur, BMAD, production des artefacts Track 2 et Track 3

### 9.6 Impact opérationnel

- Nouveau directory `.cop1/history/` et `.cop1/metrics/` à provisionner au premier run
- `.gitignore` projet à étendre (vérifié au démarrage, message d'erreur explicite)
- Pas d'infrastructure externe (pas de DB, pas de service)
- Pas de changement CI/CD

---

## 10. Implementation plan

### 10.1 Prerequisites (Sprint 12)

Avant qu'ADR-014 puisse être consommé par du code :

1. **EA11-S4** — ADR-013 (Orchestrator vs SprintRunner) écrit et approuvé. Straightforward.
2. **EA11-S5** — cette ADR-014 écrite et approuvée (architect session, cette session).
3. **EA11-S3** — Extract technical services (`WorktreeService`, `HistoryService`, `StepByStepController`). Fournit la base pour les tools couche 1 de Q1.

### 10.2 Sprint 12 — implementation

Une fois ADR-014 approuvée, Sprint 12 livre :

1. **EA11-S8** (new) — refactor SessionLogger/Reader vers 3 tracks
2. **EA11-S6** — SupervisorContext bootstrap loader
3. **EA11-S7** — Session transcript generator (post-hoc sur Track 2 markdown)
4. **EA11-S1/S2** — Deprecations cop1 agents + legacy mode

### 10.3 Sprint 13 — EA10 orchestrator

Dépendances débloquées :
- EA10-S1 — PlaybookLoader (consomme Q5)
- EA10-S2 — Playbook format spec
- EA10-S3 — cop1 minimal playbook (consomme Q5, annexe A)
- EA10-S4 — OrchestratorService (consomme Q1 + Q4 + Q3)
- EA10-S5 — step-by-step inter-command (`canUseTool` intercept)
- EA10-S6 — CLI `cop1 orchestrator run`
- EA10-S7 — multi-agent advisory (consult_agent stub)
- EA10-S8 — multi-step resolution loop (consomme Q4)

### 10.4 Sprint 14 — intégration

- EA10-S9 — E2E test sur EA6 cobaye

---

## 11. Open Questions — explicitement non tranchées

### 11.1 Distillation et mémoire inter-runs

**Question** : comment le superviseur d'un futur run bénéficie-t-il de l'expérience des runs passés (essence, patterns, leçons) ?

**Option discutée mais abandonnée en V1-light** : un tool `distill_session(sessionId)` qui extrait une essence compacte depuis Track 2 + fichiers BMAD, stockée dans `.cop1/memory/`, committable et partageable avec des agents futurs.

**Position actuelle** : *tout garder plutôt que distiller*. Track 2 préserve intégralement les échanges, et les runs futurs bénéficient du contexte injecté au system prompt (via `SupervisorContext` — EA11-S6), pas d'un mécanisme de mémoire à long terme.

**À revoir** : si la rétrospective (EA4 future) ou un besoin concret d'apprentissage cross-sprint émerge. Référence future ADR.

### 11.2 Mécanisme de partage des essences avec agents futurs

**Question** : si un jour les agents BMAD doivent être informés de l'historique (pour enrichir leurs réponses), comment le faire *sans modifier BMAD* ?

**Options envisagées, aucune retenue** :
- Sidecar file injecté dans le cwd du workflow BMAD
- Tool de query exposé via MCP standalone (couche 2b Q1)
- Injection via le system prompt BMAD (mais BMAD n'a pas de hook pour ça sans modification)
- Enrichissement par le superviseur dans ses messages à BMAD (conforme au principe Q2 "BMAD pristine")

**Position actuelle** : délibérément non tranché. À décider quand un cas d'usage concret apparaît (probablement lors de l'intégration iamthelaw — EA7).

### 11.3 Migration SQLite pour Track 3

**Question** : quand le volume de metrics justifie-t-il une migration vers SQLite ?

**Critère proposé** : si les CLI queries deviennent > 500ms ou si on veut des agrégations multi-dimensionnelles complexes, migrer. Les JSONL restent la source de vérité, SQLite devient un index rebuild-able.

**Quand** : non-sujet V1-light. À rouvrir dans un ADR dédié si/quand nécessaire.

### 11.4 Second provider LLM

**Question** : quand et comment ajouter un second adapter (`OpenAiSupervisorAdapter`, `LocalLlamaSupervisorAdapter`) ?

**Position actuelle** : le port `SupervisorLLMPort` existe, mais son design est **minimal et ciblé sur Claude SDK**. Si un second adapter est requis, on élargit le port avec les **besoins réels** du second adapter. Pas de design spéculatif.

### 11.5 iamthelaw rules dans SupervisorContext

**Question** : quand et comment injecter les règles iamthelaw dans le contexte du superviseur ?

**Position actuelle** : le champ `iamtheLawRules` existe dans `SupervisorContext` mais reste vide en V1-light. Rempli par une future story de l'épic EA7 (iamthelaw BMAD module).

### 11.6 Observabilité temps réel (SSE)

**Question** : le `EventBus` du legacy `SessionLogger` alimentait un endpoint SSE (`@fastify/sse-plugin`) pour un dashboard live. Ce canal est-il préservé ?

**Position actuelle — préservation avec catalogue explicite** : le refactor EA11-S8 préserve l'intégration `EventBus`. Les events rediffusés sont explicitement listés en §8.5 (tableau "Events Track 3 rediffusés via EventBus"), principalement les événements de haut niveau (`session.start/end`, `workflow.start/end`, `escalation.raised`, `budget.warning`). Les events techniques (`llm_call`, `tool_call`) ne sont PAS rediffusés pour éviter de spammer les consumers SSE. Implémentation au niveau du runtime hôte, pas du LLM.

---

## 12. Decision Record

| Rôle | Nom | Décision | Date |
|---|---|---|---|
| Architect | Winston (Claude Opus 4.6) | Draft produced, revised after adversarial review | 2026-04-11 |
| Adversarial Reviewer | general-purpose agent (Claude) | Review findings integrated (8 MAJOR + 4 MINOR corrections applied) | 2026-04-11 |
| Product Owner / User | elzinko | ✅ Approved | 2026-04-11 |

### Prochaines actions

1. **elzinko** — relecture d'ADR-014 section par section, corrections éventuelles
2. **elzinko** — approbation formelle (changer status en `Accepted`)
3. **elzinko / PM-SM** — enregistrer la nouvelle story EA11-S8 dans `sprint-status.yaml` et `epics.md` (conséquence de §8.5)
4. **architect (follow-up)** — écrire ADR-013 (Orchestrator vs SprintRunner) en parallèle, sans dépendance circulaire avec ADR-014
5. **Dev team** — démarrer EA11-S3 / S6 / S7 / S8 en Sprint 12 en se référant à ADR-014 §9

### Blocages levés par ADR-014

- EA10-S4 (OrchestratorService main loop) ✅
- EA10-S7 (multi-agent advisory capability) ✅
- EA10-S8 (multi-step resolution loop) ✅
- EA11-S6 (SupervisorContext bootstrap loader) ✅
- EA11-S7 (session transcript generator) ✅
- EA11-S8 (nouvelle story proposée) ✅

---

## Annexe A — Playbook V1-light cop1 minimal (exemple)

Contenu de référence pour `.cop1/playbooks/default.md`, à livrer via EA10-S3 :

```markdown
---
playbook_version: 1
bmad_target_version: "6.0.0-Beta.8"
bmad_module: bmm
scope:
  mode: single_epic
  max_stories_per_run: 30
allowed_commands:
  - /bmad-bmm-create-story
  - /bmad-bmm-dev-story
  - /bmad-bmm-code-review
  - /bmad-help
help_command: /bmad-help
budgets:
  max_turns_per_workflow: 50
  max_tokens_per_session: 500000
  max_duration_per_workflow_seconds: 1800
hooks:
  pre_workflow:
    - create_worktree
  post_workflow_success:
    - commit_anchor
  step_by_step:
    enabled: false
decision_policy:
  on_workflow_failure: consult_bmad_help_then_escalate
  on_budget_exceeded: checkpoint_and_escalate
  on_ambiguous_bmad_question: escalate_to_user
---

# cop1 minimal playbook — single epic automation

## Mission

You are the cop1 supervisor. Your mission is to automate the development of
one BMAD epic end-to-end. You will drive `/bmad-bmm-create-story`, then
`/bmad-bmm-dev-story`, then `/bmad-bmm-code-review` for each story of the
target epic, in order.

You do not do business reasoning yourself. You delegate to BMAD workflows
and answer their questions based on the project context injected into
your session.

## Workflow sequence (per story)

For each story of the target epic, in the order given by `sprint-status.yaml`:

1. **Create the story via `/bmad-bmm-create-story`**
   - Pass the story id and the epic context
   - Answer questions about scope, acceptance criteria, blockers using the
     project PRD, architecture doc, and the epic narrative
   - Expected outcome: a story file written under the BMAD output location

2. **Implement the story via `/bmad-bmm-dev-story`**
   - The workflow runs inside the worktree created by the `create_worktree`
     hook
   - Answer clarifying questions using the story file just produced
   - Expected outcome: code changes staged, tests passing

3. **Review the implementation via `/bmad-bmm-code-review`**
   - Expected outcome: review report produced

After each workflow completes successfully, the `commit_anchor` hook will
produce a commit marker. You do not commit yourself.

## When you don't know what to do

If you are uncertain about what command comes next or how to respond to a
BMAD question, invoke `/bmad-help` as your first recourse. Only escalate to
the user if `/bmad-help` is unhelpful.

## Escalation

Escalate to the user (via the `AskUserQuestion` tool) only when:
- A BMAD workflow fails twice in a row with the same error
- A budget is exceeded (see front-matter)
- You face a decision with ambiguous project-level implications

## What you do NOT do

- You do NOT run sprint-planning or retrospective (deferred to V1.1)
- You do NOT modify BMAD files or workflows
- You do NOT commit, create worktrees, or run git commands directly — use
  the provided hooks and tools
- You do NOT reason across multiple epics; stay scoped to the target epic
```

---

## Annexe B — Catalogue des commits d'ancrage (spec)

### Format du message de commit

```
[cop1/<workflow>] <story-id>: <one-line summary>

session-id: <uuid>
session-dir: .cop1/history/sprints/<sprint>/sessions/<filename>
supervisor-turn: <n>
workflow: bmad-bmm-<workflow>
story: <story-id>
status: completed|failed|aborted
narrative-log-cursor: <event-id>
```

### Règles

- **Par défaut : un commit par workflow**, même si aucun fichier n'a changé (`git commit --allow-empty`)
- **Opt-out configurable** via `commits.skip_empty_anchors: true` dans `.cop1/config.yaml` — dans ce mode, les ancrages vides sont ignorés et seuls les commits "réels" sont produits. L'information de session-mapping reste accessible via Track 3 (events `workflow.end`)
- **Préfixe `[cop1/<workflow>]`** reconnaissable et filtrable via `git log --grep "^\[cop1/"`
- **Champ `session-dir`** pointe vers le fichier Track 2 de la session (navigation forward)
- **Champ `related_commit` dans le front-matter Track 2** pointe vers le SHA (navigation backward)
- **Squash au moment de la PR** via script `cop1 commits squash --session <id>` ou `git rebase -i` interactif — préserve les commits "réels", fusionne les ancrages vides. Recommandé avant une PR finale vers `main` pour réduire la noise du git log.

---

**End of draft ADR-014**
