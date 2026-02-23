---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
lastStep: 8
status: 'complete'
completedAt: '2026-02-13'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/implementation-readiness-report-2026-02-13.md'
workflowType: 'architecture'
project_name: 'cop1'
user_name: 'elzinko'
date: '2026-02-13'
---

# Architecture Decision Document — Morpheus / cop1

_Ce document se construit collaborativement étape par étape. Les sections sont ajoutées au fil des décisions architecturales._

## Project Context Analysis

### Requirements Overview

**Functional Requirements — 87 FRs sur 11 capability areas :**

| Capability Area | # FRs | Implication architecturale clé |
|-----------------|-------|-------------------------------|
| Backlog Management | 14 | Filesystem reader BMAD, state machine stories, WSJF scoring |
| Agent Orchestration | 14 | Workflow engine, checkpoint system, escalade, LLM upgrade |
| LLM Infrastructure | 7 | LiteLLM proxy, Ollama, routing layer + access policy par agent |
| Resource Management | 4 | Resource Monitor continu, seuil 75% RAM, ramp-up progressif |
| Code Production & Git | 6 | Git worktrees, commit pipeline, conflict resolution |
| Monitoring & Reporting | 9 | Event streaming, narrative log JSON, dashboards temps réel |
| Agile Ceremony Engine | 10 | Round-table séquentiel, contexte partagé, SM Agent |
| Config & Rules Engine | 10 | iamthelaw YAML, cop1.config.yaml, hot reload, team rules |
| BMAD Interface | 7 | Lecture seule stricte, snapshot versioning par sprint |
| Developer Control | 5 | Daemon lifecycle, Web UI React, approbations |
| Team Self-Improvement | 2 | KPIs, team rules évolutives, agent skills evolution |

**Non-Functional Requirements structurantes :**
- **NFR11** : 75% RAM hard limit → Resource Guard = composant critique bloquant
- **NFR2** : 15 tokens/sec minimum par agent en cérémonie → health check LLM avant participation
- **NFR1** : 500ms Web UI → Fastify + WebSocket pour updates temps réel
- **NFR10** : Checkpoint à chaque transition → persistance event-sourcing style, crash-safe
- **NFR5** : Local-first, zéro cloud sans consentement → pas de télémétrie cachée

**Scale & Complexity :**
- Domaine principal : **Backend orchestration + AI/LLM integration**
- Complexité : **High** — multi-LLM routing, agent lifecycle, resource awareness, BMAD interface
- Composants architecturaux estimés : **8-10 packages** (extension monorepo pnpm existant)

### LLM Access Tiers (précision architecturale)

Le LLM Router gère des **policies d'accès par agent + par scénario** — pas simplement du routing par commande :

| Tier | LLM | Accès | Déclencheur |
|------|-----|-------|-------------|
| **Standard** | Ollama local (Llama/Mistral/Qwen) | Permanent | Tâches courantes |
| **Elevated** | Claude API / LLM cloud puissant | Temporaire ou permanent par agent | Analyse profonde, stratégie, architecture, blocage complexe |
| **Super Saiyan** | Meilleur LLM disponible (Claude Opus, etc.) | Temporaire, déclenché par agent ou PM | Situation critique, décision irréversible |

→ Implication : le LLM Router = système de **capabilities par agent** avec grant/revoke temporaire, pas simple lookup de config.

### Technical Constraints & Dependencies

| Contrainte | Impact architectural |
|------------|---------------------|
| Monorepo pnpm existant (6 packages) | Ajouter packages sans casser l'existant |
| Hexagonal architecture existante | Tous nouveaux composants respectent domain/infra boundaries |
| Native ESM (NodeNext) | Extensions `.js` obligatoires dans tous imports TypeScript |
| TypeScript strict (noUncheckedIndexedAccess) | Toutes interfaces null-safe |
| Docker stack (Ollama + LiteLLM) | Interface LLM via HTTP uniquement, OpenAI-compatible |
| BMAD read-only | Pas de write sur fichiers BMAD — adapter/snapshot pattern obligatoire |
| Git worktrees | Filesystem agent isolé par story — paths dynamiques |
| M3 Max 64GB, Metal backend | Ollama avec Metal acceleration |

### Cross-Cutting Concerns

1. **Resource Awareness** — tous les composants consultent le Resource Guard avant allocation
2. **Observability** — narrative log JSON structuré traversant toutes les couches
3. **Agent Identity & Isolation** — chaque agent a son LLM tier, ses rules iamthelaw, son workspace git
4. **Checkpoint / State Persistence** — toute transition de statut doit être durable (crash-safe)
5. **BMAD Compatibility** — lecture seule + snapshot → jamais de mutation des sources
6. **Security** — clés API uniquement en `.env`, MCP isolation par rôle agent
7. **LLM Access Policy** — grant/revoke temporaire de tiers LLM supérieurs par agent selon scénario

## Starter Template Evaluation

### Décision : Brownfield Extension — Pas de starter

Projet brownfield avec monorepo pnpm existant (6 packages). Stratégie : étendre les packages existants et ajouter 2 nouveaux packages MVP uniquement.

### Package Structure Révisée (validée en Party Mode)

**Packages existants — étendus :**

| Package | Extensions MVP |
|---------|---------------|
| `@cop1/domain` | + `AgentInterface`, `AgentRegistry`, `ResourceMonitorPort`, `GitPort` |
| `@cop1/llm-gateway` | + LLM Router layer, Access Tier Policy (Standard / Elevated / Super Saiyan) |
| `@cop1/infrastructure` | + BMAD reader adapter (read-only), Git adapter, Resource monitor adapter |

**Nouveaux packages — MVP (2 uniquement) :**

| Package | Responsabilité |
|---------|----------------|
| `@cop1/agent-core` | Workflow engine + agent lifecycle + checkpoint state |
| `@cop1/ceremony-engine` | Agile ceremonies, round-table séquentiel, SM facilitation |

**Post-MVP si besoin prouvé :**
- `@cop1/workflow-engine` — si `agent-core` devient trop gros (split PR-driven)
- `@cop1/git-worker` — si git adapter dans infrastructure devient trop complexe

### Décisions architecturales issues du Party Mode

1. **LLM Router intégré dans `@cop1/llm-gateway`** — point d'entrée unique vers tous les LLMs, évite duplication
2. **BMAD reader dans `@cop1/infrastructure`** — adaptateur filesystem, pas un package séparé (règle hexagonale)
3. **Ports domain obligatoires** pour ResourceMonitor (`ResourceMonitorPort`) et Git (`GitPort`) — testabilité sans mocks système
4. **`AgentInterface` dans domain** — interface standardisée que tous les agents implémentent (story, LLM tier, blocage, output)
5. **`AgentRegistry` dans domain** — catalogue des agents disponibles avec leurs tiers LLM et règles iamthelaw
6. **YAGNI MVP** — 3 packages touchés (extensions) + 2 créés, pas 6 nouveaux packages

### Structure de chaque nouveau package (pattern `@cop1/domain`)

```
packages/{name}/
  src/
    entities/       # domain objects
    use-cases/      # business logic
    ports/          # interfaces vers l'extérieur
  tests/
  tsconfig.json     # extends root, NodeNext
  package.json      # ESM, "type": "module"
```

## Core Architectural Decisions

### Decision Priority Analysis

**Décisions critiques (bloquent l'implémentation) :**
- ADR-001 : Persistance d'état (fichiers YAML + JSONL)
- ADR-003 : Protocol de communication inter-agents
- ADR-005 : LLM routing et access tiers

**Décisions importantes (structurent l'architecture) :**
- ADR-002 : Communication daemon ↔ Web UI

**Décisions différées (post-MVP) :**
- SQLite — si volume ou concurrence le justifient (port `SprintStatePort` prêt)
- WebSocket — si SSE insuffisant (upgrade path documenté)
- Split `@cop1/agent-core` → `@cop1/workflow-engine` si nécessaire

---

### ADR-001 — Persistance d'état : Fichiers YAML + JSONL (derrière ports domain)

**Décision :** Tout est fichier. Pas de base de données en MVP.

```
sprint-status.yaml          ← état courant sprint (atomic rename, crash-safe)
stories/{id}-snapshot.md    ← story figée au démarrage sprint (read-only)
stories/{id}-enriched.md    ← story enrichie par les agents
cop1.config.yaml            ← configuration système
morning-report-{date}.md    ← rapport généré post-nuit
ceremony-{type}-{date}.md   ← compte-rendus cérémonies
sprint-log-{date}.jsonl     ← narrative log append-only (NFR17)
```

**Ports domain obligatoires (testabilité) :**
```typescript
// @cop1/domain/src/ports/SprintStatePort.ts
interface SprintStatePort {
  getStatus(storyId: StoryId): StoryStatus
  transition(storyId: StoryId, to: StoryStatus): Promise<void>
  getCurrentSprint(): SprintSnapshot
}

// @cop1/domain/src/ports/NarrativeLogPort.ts
interface NarrativeLogPort {
  append(event: NarrativeEvent): Promise<void>
  getEventsForStory(storyId: StoryId): NarrativeEvent[]
}
```

**Implémentations :**
- `InMemorySprintStateAdapter` — tests unitaires, zero filesystem
- `YamlSprintStateAdapter` — production, atomic rename POSIX
- `SqliteSprintStateAdapter` — post-MVP si besoin prouvé, même interface

**Rationale :** YAGNI, cohérent avec pattern BMAD, zéro dépendance additionnelle, debuggable à l'œil nu, évolutif via ports

---

### ADR-002 — Communication daemon ↔ Web UI : SSE + REST

**Décision :** Server-Sent Events pour le flux temps réel, REST pour les commandes.

- **SSE** (`@fastify/sse-plugin`) : narrative log, sprint status, KPIs, alerts
- **REST** (Fastify existant) : commandes, config, approbations agent skills
- **Post-MVP** : upgrade WebSocket si ceremony live ou collaboration temps réel

**Rationale :** Suffisant pour NFR19 (5s max), YAGNI, upgrade path clair

---

### ADR-003 — Agent Communication Protocol : File-centric + callbacks in-process

**Décision :** Le fichier story enrichi est la source de vérité. L'orchestrateur utilise des callbacks TypeScript synchrones après chaque écriture agent.

```
orchestrateur.run(storyPath)
  → devAgent.execute(storyPath)      // écrit section "Dev Notes"
  → callback → orchestrateur lit état via SprintStatePort
  → reviewerAgent.execute(storyPath) // écrit section "Review"
  → callback → orchestrateur lit état
  → ...
```

**Rationale :** BMAD-compatible, crash-safe (fichier = source de vérité), debuggable, pas de couplage fort inter-agents

---

### ADR-005 — LLM Routing & Access Tiers : Config YAML + PM Agent + interface domain

> **SUSPENDED (2026-02-22):** Phase A BMAD Pivot — Ollama/LLM tier routing suspended for Phase A. All agent execution goes through BMADCommandPort → Claude Code CLI. This ADR may be reactivated in Phase B when local LLM support is added. See ADR-008.

**Décision :** 3 couches séparées. `iamthelaw` n'est PAS impliqué (reste dédié aux règles comportementales).

**Couche 1 — `cop1.config.yaml` (defaults statiques) :**
```yaml
agents:
  dev-agent:
    llm_default: "ollama/llama3.2"
    llm_elevated: "anthropic/claude-3-5-sonnet"
    llm_super_saiyan: "anthropic/claude-opus-4-5"
  reviewer-agent:
    llm_default: "ollama/mistral"
    llm_elevated: "anthropic/claude-3-5-sonnet"
```

**Couche 2 — PM Agent (assignation dynamique) :**
- Assigne le tier selon le type de tâche au sprint planning
- Approuve les demandes d'upgrade des agents bloqués
- Escalade au Developer si Super Saiyan requis

**Couche 3 — Interface `@cop1/domain` :**
```typescript
interface LLMAccessRequest {
  agentId: AgentId
  requestedTier: 'standard' | 'elevated' | 'super_saiyan'
  reason: string
  requiresManagerApproval: boolean
}

interface LLMAccessGrant {
  model: string
  maxTokens: number
  expiresAt: Date | 'session' | 'permanent'
}
```

**Rationale :** Config/runtime/domain séparés, PM Agent comme point de contrôle naturel, iamthelaw reste dédié au comportement

---

### Decision Impact Analysis

**Séquence d'implémentation recommandée :**
1. Ports domain (`SprintStatePort`, `NarrativeLogPort`, `LLMAccessRequest`) — fondation
2. `YamlSprintStateAdapter` + `JsonlNarrativeLogAdapter` dans `@cop1/infrastructure`
3. File-centric protocol + orchestrateur callbacks dans `@cop1/agent-core`
4. LLM router + tier policy dans `@cop1/llm-gateway`
5. SSE endpoint dans `@cop1/api`

**Dépendances croisées :**
- ADR-003 (file-centric) dépend d'ADR-001 (YAML stories + SprintStatePort)
- ADR-005 (LLM router) dépend de `AgentInterface` dans domain
- ADR-002 (SSE) dépend du narrative log (NarrativeLogPort → events stream)

## Implementation Patterns & Consistency Rules

### Points de conflit identifiés — 7 zones critiques

Contexte : monorepo TypeScript strict + Native ESM + architecture hexagonale + agents AI qui écrivent du code de nuit sans review humaine synchrone. Les conflits ci-dessous sont **certains** sans règles explicites.

---

### 1. Naming Patterns

**Fichiers TypeScript — kebab-case strict :**
```
✅ sprint-state-port.ts
✅ yaml-sprint-state-adapter.ts
✅ llm-access-request.ts
❌ SprintStatePort.ts       (PascalCase réservé aux classes/interfaces)
❌ sprintStatePort.ts       (camelCase interdit pour les fichiers)
```

**Classes, Interfaces, Types — PascalCase :**
```typescript
interface SprintStatePort { }
class YamlSprintStateAdapter implements SprintStatePort { }
type StoryStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked'
type AgentId = string & { readonly _brand: 'AgentId' }
```

**Variables, fonctions, paramètres — camelCase :**
```typescript
const storyId = storyId('US-42')
async function transitionStatus(storyId: StoryId, to: StoryStatus): Promise<void>
```

**Branded types + helper constructors (obligatoires) :**
```typescript
type StoryId  = string & { readonly _brand: 'StoryId'  }
type AgentId  = string & { readonly _brand: 'AgentId'  }
type SprintId = string & { readonly _brand: 'SprintId' }

// Constructors helper — évite les casts manuels dans les agents
function storyId(raw: string):  StoryId  { return raw as StoryId  }
function agentId(raw: string):  AgentId  { return raw as AgentId  }
function sprintId(raw: string): SprintId { return raw as SprintId }
```

**Suffixes canoniques :**
```
Port     → SprintStatePort, NarrativeLogPort, ResourceMonitorPort, GitPort, LLMGatewayPort
Adapter  → YamlSprintStateAdapter, JsonlNarrativeLogAdapter, BMADReaderAdapter
Agent    → DevAgent, ReviewerAgent, QAAgent, PMAgent, SMAgent, ResourceMonitorAgent
```

**Events — dot-notation `domain.entity.action` :**
```
story.status.transitioned
story.status.transitioning       ← intention (avant l'action)
agent.blocked.detected
agent.slot.reserved
llm.tier.upgraded
ceremony.sprint_planning.completed
ceremony.decision.forced
resource.ram.threshold_exceeded
use-case.started
use-case.completed
use-case.failed
```

**Fichiers de persistance — kebab-case + date ISO :**
```
sprint-status.yaml
sprint-log-2026-02-13.jsonl
morning-report-2026-02-13.md
ceremony-sprint-planning-2026-02-13.md
stories/US-42-snapshot.md
stories/US-42-enriched.md
stories/US-42.lock                ← lock file (TTL 10 min)
iamthelaw/dev-agent.yaml
iamthelaw/reviewer-agent.yaml
```

---

### 2. Structure Patterns

**Tests — co-localisés avec le code source :**
```
packages/agent-core/src/
  use-cases/
    run-sprint-workflow.ts
    run-sprint-workflow.test.ts
  entities/
    agent-state.ts
    agent-state.test.ts
```

**Localisation des composants clés :**
```
packages/domain/src/ports/
  sprint-state-port.ts
  narrative-log-port.ts
  resource-monitor-port.ts
  git-port.ts
  llm-gateway-port.ts
  story-file-lock-port.ts
  agent-blockage-port.ts
  bmad-reader-port.ts

packages/infrastructure/src/adapters/
  yaml-sprint-state-adapter.ts
  jsonl-narrative-log-adapter.ts
  bmad-reader-adapter.ts
  git-adapter.ts
  resource-monitor-adapter.ts
  story-file-lock-adapter.ts

packages/infrastructure/src/utils/
  parse-jsonl-safe.ts              ← utilitaire de recovery JSONL

packages/agent-core/src/use-cases/
  start-night-sprint.ts
  assign-story-to-agent.ts
  handle-agent-blocked.ts
  request-llm-upgrade.ts
  recover-sprint-state.ts          ← RecoveryProtocol

packages/ceremony-engine/src/entities/
  ceremony-round.ts                ← entité domain round-table
```

**Barrel exports restrictifs — `@cop1/infrastructure` :**
```typescript
// packages/infrastructure/src/index.ts — UNIQUEMENT les types/ports
export type { SprintStatePort } from './ports/sprint-state-port.js'
// ❌ Les adapters ne sont PAS exportés depuis le barrel
// ❌ export { YamlSprintStateAdapter } — INTERDIT dans index.ts
```

**Composition root unique — seul endroit d'instanciation des adapters :**
```
packages/app/src/main.ts          ← composition root
  instancie YamlSprintStateAdapter
  instancie JsonlNarrativeLogAdapter
  instancie BMADReaderAdapter
  injecte via constructors dans les use cases
```

**Imports ESM — extension `.js` obligatoire :**
```typescript
// ✅
import { SprintStatePort } from '../../ports/sprint-state-port.js'
import { StoryId } from '@cop1/domain/entities/story.js'
// ❌
import { SprintStatePort } from '../../ports/sprint-state-port'
```

---

### 3. Format Patterns

**NarrativeEvent (JSONL) — format canonique :**
```typescript
interface NarrativeEvent {
  timestamp: string                          // ISO 8601 : "2026-02-13T02:15:00.000Z"
  eventType: string                          // "story.status.transitioned"
  agentId: AgentId | 'system'
  storyId: StoryId | null
  sprintId: SprintId
  payload: Record<string, unknown>
  severity: 'info' | 'warning' | 'error' | 'critical'
}
```

**SprintStatus YAML — structure canonique :**
```yaml
sprint_id: "sprint-2026-02-13"
started_at: "2026-02-13T22:00:00Z"
stories:
  US-42:
    status: "in-progress"          # todo | in-progress | review | done | blocked
    assigned_to: "dev-agent"
    llm_tier: "standard"
    blocked_since: null
    transitions:
      - from: "todo"
        to: "in-progress"
        at: "2026-02-13T22:05:00Z"
```

**Sections story enrichie — ordre canonique (figé) :**
```markdown
## Story (snapshot figé — ne pas modifier)
[contenu original]

## PM Analysis
[écrit par PMAgent]

## Dev Notes
[écrit par DevAgent]

## Review
[écrit par ReviewerAgent]

## QA Report
[écrit par QAAgent]

## Blocages
[écrit par tout agent bloqué]

## Status
done | blocked | review
```

**SSE Events — format canonique :**
```typescript
interface SSEMessage {
  event: string           // "narrative" | "sprint-status" | "alert" | "kpi"
  data: NarrativeEvent | SprintStatusUpdate | AlertPayload
  id: string              // timestamp ms stringifié
  retry?: number          // 3000ms par défaut
}
```

**Erreurs — deux niveaux distincts :**
```typescript
// Erreurs métier prévisibles → Result<T> pattern
type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }

interface AppError {
  code: string             // "AGENT_BLOCKED" | "LLM_TIER_DENIED" | "RESOURCE_LIMIT" | ...
  message: string          // lisible humain
  context?: Record<string, unknown>
}

// Erreurs système critiques → AppCriticalError (throw — arrêt daemon justifié)
class AppCriticalError extends Error {
  constructor(
    message: string,
    public readonly code: 'DISK_FULL' | 'LOG_CORRUPT' | 'LOCK_FAILED' | 'PID_CONFLICT',
    public readonly context: Record<string, unknown>
  ) { super(message) }
}
// ⚠️ AppCriticalError ne doit JAMAIS être thrown depuis un agent pendant une story
// → utiliser safeAppend() pour le narrative log (voir Process Patterns)
```

**iamthelaw YAML — schéma structuré (1 fichier par agent) :**
```yaml
# iamthelaw/dev-agent.yaml
agent_id: "dev-agent"
version: "1.0"
llm_tiers:
  default: "ollama/llama3.2"
  elevated: "anthropic/claude-3-5-sonnet"
  super_saiyan: "anthropic/claude-opus-4-5"
capabilities:
  can_write_code: true
  can_commit_git: true
  can_request_llm_upgrade: true
  can_approve_skills: false
constraints:
  max_stories_parallel: 1
  blocked_after_timeout_min: 30
  max_llm_upgrade_requests_per_sprint: 3
escalation:
  on_block: "pm-agent"
  on_super_saiyan: "developer"
rules:
  - "Ne jamais modifier les fichiers _bmad-output/ directement"
  - "Toujours écrire la section Dev Notes avant de passer en review"
  - "Déclarer tout blocage dans les 30 minutes"
```

```typescript
// Schema TypeScript correspondant — validé au démarrage daemon
interface IamTheLawConfig {
  agent_id: AgentId
  version: string
  llm_tiers: { default: string; elevated: string; super_saiyan: string }
  capabilities: Record<string, boolean>
  constraints: {
    max_stories_parallel: number
    blocked_after_timeout_min: number
    max_llm_upgrade_requests_per_sprint: number
  }
  escalation: { on_block: AgentId | 'developer'; on_super_saiyan: AgentId | 'developer' }
  rules: string[]
}
```

---

### 4. Communication Patterns

**Déclaration de blocage agent — protocole obligatoire :**
```typescript
interface AgentBlockagePort {
  declare(blocage: AgentBlockage): Promise<void>
}

interface AgentBlockage {
  agentId: AgentId
  storyId: StoryId
  type: 'missing_access' | 'missing_secret' | 'technical' | 'ambiguous_spec' | 'timeout'
  description: string
  requiresDeveloper: boolean
  retryAfter?: Date
}
```

**Demande d'upgrade LLM — protocole obligatoire :**
```typescript
// Les agents n'ont JAMAIS accès à process.env pour les LLMs
// Seul LLMGatewayPort est le point d'entrée
const request: LLMAccessRequest = {
  agentId: agentId('dev-agent'),
  requestedTier: 'elevated',
  reason: "Analyse d'architecture complexe : choix entre 3 patterns",
  requiresManagerApproval: true
}
const grant = await llmGateway.requestTierUpgrade(request)
```

**Callbacks orchestrateur — protocole file-centric :**
```typescript
interface AgentExecutionCallback {
  onSectionWritten(agentId: AgentId, section: string, storyPath: string): Promise<void>
  onCompleted(agentId: AgentId, result: AgentResult): Promise<void>
  onBlocked(agentId: AgentId, blocage: AgentBlockage): Promise<void>
}
```

**Injection via constructor — pattern obligatoire (pas de DI container en MVP) :**
```typescript
class AssignStoryUseCase {
  constructor(
    private readonly sprintState: SprintStatePort,
    private readonly narrativeLog: NarrativeLogPort,
    private readonly resourceMonitor: ResourceMonitorPort,
    private readonly storyFileLock: StoryFileLockPort,
  ) {}
}
```

**Ceremony round-table — protocole :**
```typescript
interface CeremonyRound {
  ceremonyType: 'sprint-planning' | 'daily' | 'retro' | 'review' | 'grooming'
  participants: AgentId[]          // défini par type de cérémonie dans cop1.config.yaml
  sharedContext: string[]          // contributions append-only
  currentTurn: number
  status: 'running' | 'completed' | 'forced-closed'
}

interface AgentCeremonyContribution {
  agentId: AgentId
  role: string
  position: string                 // max 500 chars
  votes?: Record<string, 'for' | 'against' | 'abstain'>
  blockers?: string[]
}
```

```yaml
# cop1.config.yaml — turn_order par type de cérémonie
ceremonies:
  sprint-planning:
    turn_order: ["pm-agent", "dev-agent", "reviewer-agent", "qa-agent", "sm-agent"]
  daily:
    turn_order: ["dev-agent", "reviewer-agent", "qa-agent", "sm-agent"]
  retro:
    turn_order: ["dev-agent", "reviewer-agent", "qa-agent", "pm-agent", "sm-agent"]
  review:
    turn_order: ["dev-agent", "qa-agent", "pm-agent", "sm-agent"]
  grooming:
    turn_order: ["pm-agent", "dev-agent", "reviewer-agent", "sm-agent"]
  shared_context:
    strategy: "append-only"
    max_context_tokens: 8000
  timeouts:
    turn_ms: 120_000              # 2 min par tour
    ceremony_ms: 3_600_000        # 1h max par cérémonie
# Règle invariante : sm-agent est TOUJOURS le dernier — synthèse et clôture
```

---

### 5. Process Patterns

**Séquence crash-safe obligatoire (checkpoint) :**
```typescript
// Ordre strict : intention → transition → confirmation
await narrativeLog.append({ eventType: 'agent.slot.reserved',          ... })
await narrativeLog.append({ eventType: 'story.status.transitioning',   ... })
await sprintState.transition(storyId, to)                               // atomic rename YAML
await narrativeLog.append({ eventType: 'story.status.transitioned',    ... })
await narrativeLog.append({ eventType: 'agent.started',                 ... })

// Recovery au démarrage daemon :
// Toute transition sans "story.status.transitioned" = rollback au statut précédent
```

**Resource Guard — réservation atomique obligatoire :**
```typescript
interface ResourceMonitorPort {
  canStart(request: AgentStartRequest): Promise<ResourceCheck>
  reserveSlot(agentId: AgentId, estimatedRamMB: number): Promise<ReservationGrant>
  releaseSlot(reservationId: string): Promise<void>
}
// canStart() + reserveSlot() sont TOUJOURS appelés ensemble — jamais l'un sans l'autre
// Empêche le race condition entre deux agents qui passent le check simultanément
```

**StoryFileLock — TTL + cleanup au démarrage :**
```typescript
interface StoryFileLockPort {
  acquire(storyId: StoryId, agentId: AgentId, ttlMs?: number): Promise<Result<LockGrant>>
  release(lockId: string): Promise<void>
  releaseStaleLocks(): Promise<StoryId[]>   // appelé au démarrage daemon
}

interface LockGrant {
  lockId: string
  expiresAt: Date              // TTL défaut : 10 min
  storyId: StoryId
  agentId: AgentId
}
// Implémentation : fichier stories/US-42.lock + atomic write .tmp → rename POSIX
// Daemon cop1 = processus unique (PID file) — pas de multi-processus
```

**Log obligatoire — 3 points par use case :**
```typescript
await log.append({ eventType: 'use-case.started',   agentId, storyId, ... })
// ... logique métier ...
await log.append({ eventType: 'use-case.completed', agentId, storyId, ... })
// OU si erreur :
await log.append({ eventType: 'use-case.failed',    agentId, storyId, severity: 'error', ... })
```

**safeAppend() — le narrative log ne crashe JAMAIS un agent :**
```typescript
// Wrapper obligatoire pour NarrativeLogPort dans les agents
async function safeAppend(log: NarrativeLogPort, event: NarrativeEvent): Promise<void> {
  try {
    await log.append(event)
  } catch (err) {
    // Log critique vers stderr uniquement — l'agent continue sa story
    process.stderr.write(`[CRITICAL] narrative log failed: ${String(err)}\n`)
  }
}
```

**LLM — timeout, retry, validation :**
```typescript
interface LLMCallOptions {
  timeoutMs: number              // défaut : 30_000 (30s)
  maxRetries: number             // défaut : 2
  backoffMs: number              // défaut : 1_000 (exponentiel : 1s, 2s)
}

// Validation schema via Zod — dans @cop1/domain
interface LLMOutputValidator<T> {
  validate(raw: string): Result<T>
}
// Usage : PMAgent valide JSON WSJF, SMAgent valide CR de cérémonie

// Health check avant cérémonie (NFR2 : 15 t/s minimum)
interface LLMGatewayPort {
  complete(prompt: string, options?: LLMCallOptions): Promise<Result<string>>
  requestTierUpgrade(request: LLMAccessRequest): Promise<Result<LLMAccessGrant>>
  checkHealth(agentId: AgentId): Promise<{ tokensPerSec: number; healthy: boolean }>
}
```

**Recovery JSONL — lignes corrompues ignorées :**
```typescript
// packages/infrastructure/src/utils/parse-jsonl-safe.ts
function parseJSONLSafe(line: string): NarrativeEvent | null {
  try { return JSON.parse(line) as NarrativeEvent }
  catch { return null }   // ligne corrompue : ignorée, recovery continue
}
```

**TypeScript strict — règles additionnelles :**
```typescript
// ✅ Pas de `as any` ni `// @ts-ignore` (exceptions documentées explicitement)
// ✅ Optional chaining partout : story?.assignedTo ?? 'unassigned'
// ✅ `satisfies` operator préféré à `as` pour les casts de config
const config = rawConfig satisfies CopConfig
// ✅ Zod pour validation runtime des outputs LLM et des fichiers YAML chargés
```

---

### 6. BMAD Read-Only Enforcement

```typescript
// BMADReaderPort — aucune méthode d'écriture exposée
interface BMADReaderPort {
  readonly listStories(): Promise<BMAdStory[]>
  readonly getStory(id: StoryId): Promise<BMAdStory>
  readonly getSnapshot(id: StoryId): Promise<StorySnapshot>
}

// Règles vérifiables par grep (CI) :
// grep "_bmad-output/" packages/agent-core/src/  → doit être vide
// grep "_bmad-output/" packages/ceremony-engine/ → doit être vide
// grep "OLLAMA_BASE_URL\|ANTHROPIC_API_KEY" packages/agent-core/ → doit être vide
// grep "sprint-status.yaml" packages/agent-core/ → doit être vide
```

---

### Enforcement Guidelines

**Tous les agents AI et développeurs DOIVENT :**

1. Importer depuis des ports domain — jamais depuis les adapters directement
2. Utiliser l'extension `.js` dans tous les imports TypeScript (NodeNext)
3. Déclarer les blocages via `AgentBlockagePort` avant toute décision d'abandon
4. Logger via `safeAppend()` aux 3 points obligatoires (started / completed / failed)
5. Appeler `reserveSlot()` + `canStart()` ensemble avant de démarrer un agent
6. Acquérir un `StoryFileLock` avant toute écriture dans un fichier story enrichi
7. Utiliser le `Result<T>` pattern pour les erreurs métier — pas de `throw` pour les erreurs prévisibles
8. Écrire les sections story dans l'ordre canonique défini
9. Utiliser les branded types + constructors helper pour tous les identifiants domain
10. Ne jamais accéder à `process.env` pour les LLMs — utiliser `LLMGatewayPort` uniquement

**Vérification automatique :**
- `pnpm typecheck` — strict mode (noUncheckedIndexedAccess, noUnusedLocals)
- `pnpm test` — ports validés via InMemory adapters
- Pre-commit hook : `pnpm typecheck && pnpm test` obligatoire avant tout commit agent
- Grep rules en CI : chemins BMAD et env vars LLM absents des packages agents

## Project Structure & Boundaries

### ADR-006 — Organisation Feature First Hexagonal

**Décision :** 6 packages npm organisés en Feature First hexagonal interne + shared-kernel minimal.

**Graphe de dépendances (acyclique garanti) :**
```
shared-kernel
    ↓
observability
    ↓
llm-intelligence
    ↓
sprint-core
    ↓
ceremony-engine
    ↓
app  ← composition root (importe tous les packages)
web  ← importe shared-kernel + app via HTTP uniquement
```

**Règle de graduation feature → package :**
> Si une feature-dossier : (a) dépasse ~800 lignes OU (b) est importée par 3+ packages → elle devient son propre package npm avec le même graphe de dépendances.

---

### ADR-008 — BMAD Execution Gateway : cop1 Orchestrator / BMAD Executor (Phase A)

> Added 2026-02-22. Sprint Change Proposal approved. See [Phase A Course Correction Brief](phase-a-course-correction-brief.md).

**Context:** After Sprints 0-7, a global retrospective revealed that cop1's custom LLM prompts (14-line DevAgent, 25-char ReviewerAgent) were inferior to BMAD's battle-tested workflows (10-step dev-story, 50+ check code-review). cop1 should orchestrate BMAD commands, not replicate them.

**Décision:** New hexagonal port `BMADCommandPort` with Strategy pattern adapter. cop1 is the **Orchestrator** (scheduling, budget, governance, checkpoint/resume), BMAD is the **Executor** (dev-story, code-review, QA, retro workflows).

**Pattern: Execution Gateway**

```
cop1 SprintRunner
    │
    ▼
BMADCommandPort (interface)
    │
    ├── LocalCliAdapter        ← Phase A: spawns `claude -p "/bmad-bmm-dev-story" --output-format json`
    ├── ContainerAdapter       ← Future: runs in isolated Docker container
    ├── RemoteAdapter          ← Future: delegates to remote Claude Code instance
    └── OllamaProxyAdapter     ← Future (Phase B): routes to local LLM via Ollama API
```

**Interface:**

```typescript
interface BMADCommandPort {
  execute(command: BMADCommand): Promise<BMADCommandResult>
}

interface BMADCommand {
  workflow: '/bmad-bmm-dev-story' | '/bmad-bmm-code-review' | '/bmad-bmm-retro' | string
  context: string          // Story markdown + project context
  timeout?: number         // ms, default 300_000
  budgetCheck?: boolean    // Pre-check budget before execution
}

interface BMADCommandResult {
  success: boolean
  output: string           // JSON or markdown output from BMAD
  tokensUsed: number
  durationMs: number
  model: string
}
```

**cop1 responsibilities (Orchestrator):**
1. **Scheduling** — pick next story, build pipeline, manage sprint lifecycle
2. **Budget** — track token consumption, enforce limits, emit alerts
3. **Governance** — iamthelaw rules, retro outputs, rule proposals
4. **Resilience** — checkpoint/resume, timeout/retry, error handling
5. **Observability** — JSONL event logging, SSE streaming, dashboard

**BMAD responsibilities (Executor):**
1. **Dev workflow** — 10-step dev-story with AC validation
2. **Code review** — adversarial checklist with 50+ checks
3. **QA validation** — test execution and coverage verification
4. **Retro** — structured retrospective with action items
5. **Sprint-status transitions** — `ready-for-dev → in-progress → review` (Steps 4 & 9 of dev-story)

**sprint-status.yaml ownership:**
- **BMAD** manages transitions (dev-story Steps 4 & 9)
- **cop1** reads from `_bmad-output/implementation-artifacts/sprint-status.yaml` (read-only `SprintStatusReader`)
- cop1 writes only its own execution history to `.cop1/sprint-log-*.jsonl`

**Rationale:**
- BMAD workflows are battle-tested (10-step dev-story > 14-line DevAgent prompt)
- Hexagonal architecture makes the swap trivial (new port + adapter)
- Strategy pattern allows future Docker/Ollama/Remote adapters without changing orchestration code
- ADR-005 (LLM Routing) suspended for Phase A — all execution via Claude Code CLI

**Files (already implemented, Sprint 8):**
- `packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADCommandPort.ts`
- `packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts`
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADDevStoryStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADReviewStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/domain/StoryContextBuilder.ts`

---

### Structure de packages complète

```
cop1/                                    ← monorepo root
│
├── packages/
│   │
│   ├── shared-kernel/                   ← @cop1/shared-kernel (fondation pure)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── branded-types.ts         ← StoryId, AgentId, SprintId + helpers storyId()
│   │       ├── result.ts                ← Result<T>, AppError, AppCriticalError
│   │       ├── fibonacci.ts             ← FibonacciPoint (1,2,3,5,8,13)
│   │       └── ports/
│   │           └── config-port.ts       ← ConfigPort (interface uniquement)
│   │   # ⚠️ MAX 10 fichiers en MVP — liste blanche stricte
│   │   # ❌ Interdit : logique métier, adapters, types spécifiques à une feature
│   │
│   ├── observability/                   ← @cop1/observability
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── narrative-log/
│   │       │   ├── index.ts             ← barrel public (API de la feature)
│   │       │   ├── domain/              → NarrativeEvent, EventType, Severity
│   │       │   ├── ports/               → NarrativeLogPort
│   │       │   ├── application/         → append-event.ts, recover-sprint-state.ts
│   │       │   └── infrastructure/      → JsonlNarrativeLogAdapter, parseJSONLSafe.ts
│   │       ├── reporting/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → MorningReport, KPISnapshot, BurndownPoint
│   │       │   ├── application/         → generate-morning-report.ts, compute-kpis.ts
│   │       │   └── infrastructure/      → MarkdownReportWriter
│   │       └── sse-stream/
│   │           ├── index.ts
│   │           ├── domain/              → SSEMessage, SSEEventType
│   │           ├── application/         → stream-narrative-events.ts
│   │           └── infrastructure/      → FastifySSEAdapter
│   │
│   ├── llm-intelligence/                ← @cop1/llm-intelligence
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── llm-routing/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → LLMAccessRequest, LLMAccessGrant, LLMTier
│   │       │   ├── ports/               → LLMGatewayPort
│   │       │   ├── application/         → request-tier-upgrade.ts, check-llm-health.ts
│   │       │   └── infrastructure/      → OllamaAdapter, ClaudeApiAdapter, LiteLLMProxyAdapter
│   │       └── resource-guard/
│   │           ├── index.ts
│   │           ├── domain/              → ResourceSlot, ReservationGrant, RamThreshold
│   │           ├── ports/               → ResourceMonitorPort
│   │           ├── application/         → reserve-agent-slot.ts, release-slot.ts, check-ram.ts
│   │           └── infrastructure/      → ResourceMonitorAdapter (si/ps, RAM polling)
│   │
│   ├── sprint-core/                     ← @cop1/sprint-core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── backlog-management/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → StoryStatus, WSJFScore, DoRCheck
│   │       │   ├── ports/               → BMADReaderPort, SprintStatePort, StoryFileLockPort
│   │       │   ├── application/         → select-next-story.ts, validate-dor.ts, score-wsjf.ts
│   │       │   │                          reorder-sprint-backlog.ts  ← FR80 WSJF re-scoring
│   │       │   └── infrastructure/      → BMADReaderAdapter, YamlSprintStateAdapter
│   │       │                              StoryFileLockAdapter
│   │       ├── sprint-lifecycle/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → SprintSnapshot, SprintPhase
│   │       │   ├── application/         → start-night-sprint.ts, assign-story-to-agent.ts
│   │       │   │                          recover-sprint-state.ts
│   │       │   └── infrastructure/      → PidFileAdapter
│   │       ├── story-enrichment/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → StorySection, EnrichedStory
│   │       │   ├── application/         → enrich-story.ts, snapshot-story.ts
│   │       │   └── infrastructure/      → StoryFileWriter
│   │       ├── agent-execution/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → AgentInterface, AgentResult, AgentRegistry
│   │       │   ├── ports/               → GitPort, AgentBlockagePort
│   │       │   ├── application/         → run-dev-agent.ts, run-reviewer-agent.ts
│   │       │   │                          run-qa-agent.ts, run-pm-agent.ts
│   │       │   │                          commit-story-work.ts
│   │       │   └── infrastructure/      → GitAdapter (worktrees, branches agent/)
│   │       └── blocage-resolution/
│   │           ├── index.ts
│   │           ├── domain/              → AgentBlockage, BlockageType, EscalationChain
│   │           ├── ports/               → AgentBlockagePort
│   │           ├── application/         → handle-agent-blocked.ts, escalate-to-pm.ts
│   │           │                          notify-developer.ts
│   │           └── infrastructure/      → (utilise NarrativeLogPort de observability)
│   │
│   ├── ceremony-engine/                 ← @cop1/ceremony-engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── round-table/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → CeremonyRound, AgentCeremonyContribution, TurnOrder
│   │       │   ├── application/         → run-round-table.ts, manage-turns.ts, force-close.ts
│   │       │   └── infrastructure/      → CeremonyFileAdapter (ceremony-{type}-{date}.md)
│   │       ├── sprint-planning/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → SprintPlanningSession, PlanningDecision
│   │       │   └── application/         → run-sprint-planning.ts
│   │       │   # PlanningDecision retourné à sprint-core — ceremony-engine n'écrit PAS sprint-status
│   │       ├── daily-standup/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → StandupReport, AgentDailyStatus
│   │       │   └── application/         → run-daily-standup.ts
│   │       ├── retrospective/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → RetroItem, RetrospectiveOutput
│   │       │   │                          ArchitectureRuleProposal, RefactoringStoryProposal
│   │       │   └── application/         → run-retrospective.ts, propose-agent-skill.ts
│   │       │   # Output obligatoire : ≥1 ArchitectureRuleProposal + ≥1 RefactoringStoryProposal
│   │       ├── sprint-review/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → ReviewSession, StoryDemonstration
│   │       │   └── application/         → run-sprint-review.ts
│   │       └── backlog-grooming/
│   │           ├── index.ts
│   │           ├── domain/              → GroomingSession, InvestCheck
│   │           └── application/         → run-backlog-grooming.ts
│   │
│   ├── app/                             ← @cop1/app (composition root)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── daemon/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → DaemonStatus
│   │       │   ├── application/         → start-daemon.ts, stop-daemon.ts
│   │       │   └── infrastructure/      → PidFileAdapter
│   │       ├── config/
│   │       │   ├── index.ts
│   │       │   ├── domain/              → CopSystemConfig, IamTheLawConfig (Zod schema)
│   │       │   ├── ports/               → (ConfigPort défini dans shared-kernel)
│   │       │   ├── application/         → load-config.ts, hot-reload-config.ts
│   │       │   │                          watch-iamthelaw.ts  ← IamTheLawWatcherPort (FR56-57)
│   │       │   └── infrastructure/      → YamlConfigAdapter, IamTheLawFileWatcher
│   │       ├── api/
│   │       │   ├── routes/
│   │       │   │   ├── sprint.ts        ← REST : start/stop/status sprint (FR36-40)
│   │       │   │   ├── config.ts        ← REST : hot reload config (FR34)
│   │       │   │   └── agent-skills.ts  ← REST : approbations (FR62, FR87)
│   │       │   └── sse/
│   │       │       └── narrative-stream.ts ← SSE endpoint (ADR-002)
│   │       ├── integration-tests/       ← tests cross-packages (convention Murat)
│   │       │   ├── complete-story.test.ts
│   │       │   └── night-sprint.test.ts
│   │       ├── composition-root.ts      ← instanciation adapters + injection
│   │       └── main.ts                  ← entrée daemon
│   │
│   └── web/                             ← @cop1/web (Feature First React)
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── dashboard/               ← sprint status, narrative log (FR27, FR36-40)
│           │   ├── components/
│           │   └── hooks/
│           ├── backlog/                 ← backlog view, WSJF (FR67-68)
│           │   ├── components/
│           │   └── hooks/
│           ├── agent-skills/            ← approbation skills (FR62, FR87)
│           │   ├── components/
│           │   └── hooks/
│           ├── iamthelaw-viewer/        ← visualiser règles actives + historique
│           │   ├── components/
│           │   └── hooks/
│           └── shared/                  ← composants/hooks vraiment génériques
│               ├── components/          ← boutons, layouts, etc.
│               └── hooks/
│                   └── useSSE.ts        ← connexion SSE unique, filtrage par eventType
│   # Règles web : pas de state global cross-features, SSE = 1 hook partagé dans shared/
│
├── iamthelaw/                           ← registre centralisé de toutes les règles
│   ├── global.yaml                      ← règles applicables à tous les agents
│   ├── scrum.yaml                       ← règles du processus agile
│   ├── architecture.yaml                ← règles d'archi et de dev
│   ├── agents/
│   │   ├── dev-agent.yaml
│   │   ├── reviewer-agent.yaml
│   │   ├── qa-agent.yaml
│   │   ├── pm-agent.yaml
│   │   ├── sm-agent.yaml
│   │   └── resource-monitor-agent.yaml
│   └── history.jsonl                    ← audit trail append-only (quand/pourquoi chaque règle)
│   # Format règle : id, rule, rationale, added_at, added_by, source, status
│
├── .cop1/                               ← runtime state (gitignored)
│   ├── sprint-status.yaml
│   ├── sprint-log-{date}.jsonl
│   ├── stories/
│   │   ├── US-xx-snapshot.md
│   │   ├── US-xx-enriched.md
│   │   └── US-xx.lock
│   ├── morning-report-{date}.md
│   ├── ceremony-{type}-{date}.md
│   ├── worktrees/
│   │   └── US-xx-agent-{timestamp}/
│   └── cop1.pid
│
├── cop1.config.yaml                     ← config système principale
├── docker-compose.yml                   ← Ollama + LiteLLM
├── package.json                         ← pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.json                        ← base config (NodeNext, strict)
├── biome.json                           ← linter/formatter
├── vitest.config.ts
├── .env                                 ← secrets (jamais committé)
├── .env.example
└── scripts/
    ├── cop1-start.sh
    ├── cop1-stop.sh
    ├── docker-up.sh
    ├── check-feature-size.sh            ← graduation check (lancé à chaque retro)
    ├── check-shared-kernel-size.sh      ← max 10 fichiers (lancé en CI)
    └── check-iamthelaw.sh               ← validation YAML schema au démarrage + CI
```

---

### Architectural Boundaries

**Boundary 1 — Feature isolation (barrel enforcement) :**
```typescript
// ✅ Import via barrel public uniquement
import type { NarrativeLogPort } from '@cop1/observability'
import { selectNextStory } from '@cop1/sprint-core'

// ❌ Import interne cross-feature interdit
import { YamlSprintStateAdapter } from '@cop1/sprint-core/backlog-management/infrastructure'
```

**Boundary 2 — ceremony-engine n'écrit jamais dans sprint-core :**
```typescript
// ceremony-engine retourne des décisions — sprint-core les applique
const decision: PlanningDecision = await ceremonyEngine.runSprintPlanning(ctx)
await sprintState.applyPlanningDecision(decision)  // seul sprint-core écrit
```

**Boundary 3 — shared-kernel liste blanche stricte :**
```
✅ Autorisé : branded-types, Result<T>, AppError, FibonacciPoint, ConfigPort
❌ Interdit : logique métier, adapters, types spécifiques à une feature
Enforcement : check-shared-kernel-size.sh (max 10 fichiers) en CI
```

**Boundary 4 — Web UI state management :**
```
Règle : pas de state global cross-features (pas de Zustand/Redux global)
Règle : 1 seul hook SSE partagé → shared/hooks/useSSE.ts
        chaque feature filtre les events par eventType
```

**Boundary 5 — iamthelaw = source de vérité unique pour toutes les règles :**
```
global.yaml       → règles tous agents
scrum.yaml        → processus agile
architecture.yaml → règles dev/archi
agents/*.yaml     → règles par agent
history.jsonl     → audit trail (quand, pourquoi, qui)
Flux : retro → ArchitectureRuleProposal → approbation Developer → hot reload agents
```

---

### Requirements → Structure Mapping (87 FRs)

| Capability Area | FRs | Package / Feature |
|---|---|---|
| Backlog Management | FR1-5, FR63-68, FR71, FR80 | `sprint-core/backlog-management/` + `web/backlog/` |
| Agent Orchestration | FR6-12, FR83-84 | `sprint-core/sprint-lifecycle/` |
| Blocage & Escalade | FR41-44 | `sprint-core/blocage-resolution/` |
| LLM Infrastructure | FR13-17, FR47, FR49, FR52 | `llm-intelligence/llm-routing/` |
| Resource Management | FR18-21 | `llm-intelligence/resource-guard/` |
| Code Production & Git | FR22-26, FR48 | `sprint-core/agent-execution/` |
| Monitoring & Reporting | FR27-31, FR53, FR55, FR58, FR70 | `observability/` + `web/dashboard/` |
| Agile Ceremony Engine | FR45-46, FR50-51, FR54, FR79, FR81-86 | `ceremony-engine/` |
| Config & Rules Engine | FR32-35, FR56-57, FR59-62 | `app/config/` + `iamthelaw/` + `web/iamthelaw-viewer/` |
| BMAD Interface | FR72-78 | `sprint-core/backlog-management/` (BMADReaderAdapter) |
| Developer Control | FR36-40 | `app/api/routes/` + `web/dashboard/` |
| Team Self-Improvement | FR87 | `ceremony-engine/retrospective/` + `web/agent-skills/` |

**Couverture : 87/87 FRs ✅**

---

### Scripts de vérification automatique

```bash
# check-feature-size.sh — graduation candidate detection (lancé à chaque retro)
find packages/*/src -type d -name "application" | while read dir; do
  feature=$(dirname "$dir")
  lines=$(find "$feature" -name "*.ts" | xargs wc -l | tail -1 | awk '{print $1}')
  if [ "$lines" -gt 800 ]; then
    echo "⚠️  GRADUATION CANDIDATE: $feature ($lines lines)"
  fi
done

# check-shared-kernel-size.sh — liste blanche enforcement (CI)
count=$(find packages/shared-kernel/src -name "*.ts" | wc -l)
if [ "$count" -gt 10 ]; then
  echo "❌ shared-kernel dépasse 10 fichiers ($count) — PR review obligatoire"
  exit 1
fi

# check-iamthelaw.sh — validation YAML schema (démarrage daemon + CI)
# Valide chaque fichier iamthelaw/ contre IamTheLawConfig schema (Zod)
```

## Architecture Validation Results

### Coherence Validation ✅

| Décision | Compatible avec | Verdict |
|---|---|---|
| ADR-001 (YAML + JSONL) | ADR-003 (file-centric) | ✅ fichier = source de vérité dans les deux |
| ADR-002 (SSE + REST) | observability/sse-stream + app/api | ✅ séparation propre |
| ADR-003 (callbacks in-process) | sprint-core/agent-execution + sprint-lifecycle | ✅ même package, cohérent |
| ADR-005 (LLM tiers) | llm-intelligence/llm-routing + iamthelaw/agents/*.yaml | ✅ config YAML → runtime grant |
| ADR-006 (Feature First) | Tous les packages | ✅ graphe acyclique vérifié |
| Feature First + ESM NodeNext | Barrel index.ts + imports `.js` | ✅ cohérents |
| Result<T> + AppCriticalError | safeAppend() + use cases | ✅ deux niveaux d'erreur distincts |
| iamthelaw centralisé | hot reload (IamTheLawWatcherPort) + Web UI viewer | ✅ flux complet défini |

**Tensions résolues :**
- YAGNI 2 packages vs Feature First → ADR-006 : 6 packages thématiques
- shared-kernel vs Feature First → liste blanche stricte (max 10 fichiers)
- ceremony-engine écrivait dans sprint-core → protocole PlanningDecision

---

### Requirements Coverage Validation ✅

**NFRs structurantes :**

| NFR | Exigence | Couverture | Verdict |
|---|---|---|---|
| NFR1 | 500ms Web UI | Fastify SSE + React Vite + state local | ✅ |
| NFR2 | 15 t/s minimum en cérémonie | `llm-routing/checkHealth()` avant participation | ✅ |
| NFR5 | Local-first, zéro cloud | `.env` local, LiteLLM proxy, pas de télémétrie | ✅ |
| NFR9 | Crash recovery | Séquence log crash-safe + `recover-sprint-state.ts` | ✅ |
| NFR10 | Checkpoint à chaque transition | `transitioning` → transition → `transitioned` | ✅ |
| NFR11 | 75% RAM hard limit | `resource-guard/reserve-slot.ts` atomique | ✅ |
| NFR13 | Resource Monitor continu | `ResourceMonitorAgent` + polling + slots | ✅ |
| NFR17 | Narrative log append-only | `JsonlNarrativeLogAdapter` + `parseJSONLSafe` | ✅ |
| NFR21 | Hot reload config | `IamTheLawWatcherPort` dans `app/config/` | ✅ |

**FRs : 87/87 couverts ✅**

---

### Implementation Readiness Validation ✅

| Question agent AI | Réponse documentée |
|---|---|
| Où créer un nouveau fichier ? | Feature-dossier explicite dans chaque package |
| Comment nommer une interface ? | PascalCase + suffixe Port/Adapter/Agent |
| Comment importer entre packages ? | Via barrel index.ts public uniquement |
| Comment gérer une erreur métier ? | Result<T> pattern avec exemples |
| Comment logger ? | safeAppend() + 3 points obligatoires |
| Comment accéder au LLM ? | LLMGatewayPort injecté — jamais process.env |
| Comment déclarer un blocage ? | AgentBlockagePort.declare() |
| Où vivent les règles du projet ? | iamthelaw/ centralisé + history.jsonl |
| Comment contribuer en cérémonie ? | AgentCeremonyContribution format canonique |

---

### Gap Analysis

**Aucun gap critique bloquant l'implémentation.**

**Gaps mineurs (post-MVP) :**

| # | Gap | Priorité | Résolution |
|---|---|---|---|
| G1 | ceremony-engine → sprint-core dépendance peut grossir | 🟡 Mineur | Surveiller à la graduation |
| G2 | Zod non encore déclaré dans package.json | 🟡 Mineur | Ajouter au setup shared-kernel |
| G3 | Tests E2E Web UI non définis | 🟡 Mineur | Post-MVP — Playwright si nécessaire |
| G4 | Déploiement cloud hors scope | 🟢 Info | MVP = local uniquement (NFR5) |

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] 87 FRs analysées et mappées à des composants architecturaux
- [x] 24 NFRs couverts architecturalement
- [x] Contraintes techniques identifiées (M3 Max, Docker, ESM, TypeScript strict)
- [x] 7 cross-cutting concerns documentés

**✅ Architectural Decisions**
- [x] ADR-001 — Persistance : YAML + JSONL derrière ports domain
- [x] ADR-002 — Communication daemon ↔ Web UI : SSE + REST
- [x] ADR-003 — Agent Protocol : file-centric + callbacks
- [x] ADR-005 — LLM Routing : Config YAML + PM Agent + domain interface
- [x] ADR-006 — Structure : Feature First Hexagonal, 6 packages thématiques

**✅ Implementation Patterns**
- [x] Naming : kebab-case fichiers, PascalCase types, branded types + helpers
- [x] Structure : Feature First dossiers, barrel index.ts, composition root unique
- [x] Format : NarrativeEvent, SprintStatus YAML, SSEMessage, iamthelaw YAML
- [x] Communication : AgentBlockagePort, LLMGatewayPort, CeremonyRound, callbacks
- [x] Process : crash-safe sequence, safeAppend(), LockGrant TTL, RecoveryProtocol
- [x] Enforcement : scripts CI, ESLint boundaries, grep rules, pre-commit hook

**✅ Project Structure**
- [x] 6 packages npm définis avec Feature First interne
- [x] Graphe de dépendances acyclique vérifié
- [x] iamthelaw/ centralisé avec historisation (history.jsonl)
- [x] Runtime state isolé dans .cop1/ (gitignored)
- [x] Scripts de vérification automatique définis

**✅ Règles métier spécifiques cop1**
- [x] Retrospective → outputs obligatoires (ArchitectureRuleProposal + RefactoringStoryProposal)
- [x] Ceremony round-table : ordre fixe par type, SM Agent toujours dernier
- [x] BMAD read-only strict : grep CI, BMADReaderPort sans méthodes d'écriture
- [x] Graduation feature → package : règle définie + script automatique

---

### Architecture Readiness Assessment

**Statut global : 🟢 READY FOR IMPLEMENTATION**

**Niveau de confiance : Élevé**

**Points forts :**
- Architecture hexagonale Feature First cohérente — zéro ambiguïté sur où mettre le code
- Graphe de dépendances acyclique garanti structurellement
- Patterns crash-safe complets (checkpoint, lock TTL, recovery, safeAppend)
- iamthelaw = source de vérité unique pour toutes les règles — historisé, évolutif
- 87/87 FRs et 24 NFRs couverts architecturalement
- Enforcement automatique : CI scripts, ESLint, pre-commit, grep rules

**Axes d'évolution post-MVP :**
- Graduation features volumineuses en packages séparés (règle 800 lignes)
- SQLite si volume JSONL ou concurrence le justifient (SprintStatePort prêt)
- WebSocket si SSE insuffisant pour cérémonies live
- Tests E2E Web UI (Playwright)

---

### Implementation Handoff — Séquence recommandée

```
Sprint 1 — Fondations
  1. @cop1/shared-kernel : branded-types, Result<T>, ConfigPort
  2. @cop1/observability : narrative-log (NarrativeLogPort + JsonlNarrativeLogAdapter)
  3. @cop1/sprint-core : backlog-management (BMADReaderAdapter + YamlSprintStateAdapter)

Sprint 2 — LLM + Resource
  4. @cop1/llm-intelligence : llm-routing + resource-guard
  5. @cop1/sprint-core : sprint-lifecycle + agent-execution

Sprint 3 — Orchestration nocturne
  6. @cop1/sprint-core : story-enrichment + blocage-resolution
  7. @cop1/app : composition-root + daemon + config + api

Sprint 4 — Cérémonies + Web
  8. @cop1/ceremony-engine : round-table + sprint-planning + retrospective
  9. @cop1/web : dashboard + iamthelaw-viewer
```

**Règle absolue pour tous les agents AI :**
> *Avant d'écrire du code : identifier la feature-dossier cible, travailler uniquement dedans, importer uniquement via les barrels publics des autres packages.*

