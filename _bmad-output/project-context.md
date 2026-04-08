---
project_name: 'cop1'
user_name: 'elzinko'
date: '2026-04-05'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 67
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Technologies

| Technology | Version | Notes |
|-----------|---------|-------|
| Node.js | >= 20.0.0 | Required for Native ESM |
| pnpm | >= 9.0.0 | Monorepo workspace manager |
| TypeScript | ^5.7.0 | Strict mode + `noUncheckedIndexedAccess: true` |
| Vitest | ^2.1.0 | Root config; web uses ^2.1.9 separately |
| Biome | ^1.9.0 | Linter + formatter (NOT ESLint/Prettier) |
| React | ^18.3.1 | Web package only |
| Vite | ^6.0.5 | Web package only |
| @testing-library/react | ^16.3.2 | Web package only |

### Module System: Native ESM (CRITICAL)

- `"type": "module"` in every `package.json`
- `"module": "NodeNext"` in tsconfig
- **`.js` extension mandatory** in ALL TypeScript imports:
  ```typescript
  // ✅ CORRECT — .js even though file is .ts
  import { EventBus } from '@cop1/shared-kernel';
  import { CheckpointService } from './application/CheckpointService.js';

  // ❌ FORBIDDEN
  import { CheckpointService } from './application/CheckpointService';
  ```
- `require()` is **forbidden** — use `import`
- `__dirname` does **not exist** — use `import.meta.url` + `fileURLToPath`

### Biome Formatting

Single quotes · semicolons · 2-space indent · 100 chars line width · organize imports enabled

### Architecture: Feature-First Hexagonal

Each feature follows this internal structure:
```
feature-name/
├── __tests__/           ← tests (e.g., MyService.test.ts)
├── application/         ← services (e.g., MyService.ts)
├── domain/              ← types, errors, ports/
│   └── ports/           ← interfaces (e.g., MyPort.ts)
└── infrastructure/      ← adapters (e.g., MyAdapter.ts)
```

**File naming: PascalCase** for all TypeScript files (`CheckpointService.ts`, `BmadStatusReader.ts`, `EventBus.ts`).

### Workspace Packages (acyclic dependency graph)

Build order (from root `package.json` `tsc -b` — manual, must update when adding a package):

| # | Package | Role | Dependencies |
|---|---------|------|-------------|
| 1 | `@cop1/shared-kernel` | Branded types, Result<T>, EventBus — **zero external deps** | none |
| 2 | `@cop1/observability` | Narrative log, reporting, SSE stream | shared-kernel |
| 3 | `@cop1/quality-intelligence` | Quality gates (coverage, static analysis, arch drift, review metrics, improvement KPIs) | shared-kernel, observability |
| 4 | `@cop1/sprint-core` | Backlog, sprint lifecycle, BMAD orchestration, story tracker | shared-kernel, observability |
| 5 | `@cop1/llm-intelligence` | LLM routing, resource guard | shared-kernel, observability |
| 6 | `@cop1/ceremony-engine` | Agile ceremonies (round-table, planning, retro, review, grooming) | shared-kernel, observability, sprint-core |
| 7 | `@cop1/app` | Composition root, daemon, API, CLI, config | all packages |
| 8 | `@cop1/web` | React + Vite web interface (separate vitest config, excluded from backend tests) | HTTP only to app |

**Import rules:**
- A package can ONLY import packages **above it** in the build order
- Cross-package imports **must use barrel** (`index.ts`) — never internal paths
- `shared-kernel` imports NOTHING from other @cop1 packages — zero external dependencies

### Planned (not yet installed)
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — ADR-012: multi-turn BMAD interaction. Not in current dependencies.

### Testing Setup

- Single `vitest.config.ts` at root — pattern: `packages/*/src/**/*.test.ts`
- `packages/web/**` excluded from root test runs (has its own vitest.config.ts + jsdom)
- Convention: `import { describe, it, expect, vi } from 'vitest'` (explicit imports despite `globals: true`)
- Test files go in `__tests__/` directory at feature root — NOT co-located with source
- No minimum coverage threshold enforced (MVP)
- Coverage provider: v8 with text, lcov, html reporters

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Strict Mode — All flags active (tsconfig.base.json):**
- `noUncheckedIndexedAccess: true` — ALL indexed access returns `T | undefined`
  - ❌ `array[0].property` (won't compile)
  - ✅ `array[0]?.property` or guard: `const item = array[0]; if (item) { ... }`
  - ⚠️ Applies in test files too — use `!` assertion after confirming length
- `noUnusedLocals` + `noUnusedParameters` — no unused variables or params
- `noFallthroughCasesInSwitch` — explicit break/return in every switch case
- **Zero `any`** — use `unknown` + type narrowing. Biome warns on `noExplicitAny`

**Type Patterns (actual codebase conventions):**
- **No enums** — use `as const` objects + derived types:
  ```typescript
  const CeremonyType = { PLANNING: 'planning', DAILY: 'daily' } as const;
  type CeremonyTypeValue = (typeof CeremonyType)[keyof typeof CeremonyType];
  ```
- **String union types** for simple cases: `type Status = 'pending' | 'approved' | 'rejected'`
- **`import type`** mandatory for type-only imports
- **`export type`** in barrel `index.ts` for interfaces/types; `export` (no type) for classes
  ```typescript
  // index.ts barrel
  export type { SprintStatusReaderPort } from './domain/ports/SprintStatusReaderPort.js';
  export { BmadStatusReader } from './infrastructure/BmadStatusReader.js';
  ```
- ❌ No branded types, no `Result<T>` pattern, no `satisfies` operator in codebase

**Null/Undefined Conventions:**
- Ports return **`null`** for "not found" — NOT `undefined`
- `undefined` is reserved for optional parameters and indexed access (`noUncheckedIndexedAccess`)
- Defaults via nullish coalescing: `this.threshold = options?.threshold ?? 75;`
- Non-null `!` assertion ONLY after a preceding type guard or length check

**Constructor Injection Pattern:**
```typescript
class MyService {
  constructor(
    private readonly statusReader: SprintStatusReaderPort,  // required
    private readonly eventBus?: EventBus,                   // optional
  ) {}

  async execute(): Promise<void> {
    if (this.eventBus) {                    // guard before using optional dep
      this.eventBus.emit('service.started', { ... });
    }
  }
}
```
- `private readonly` for ALL injected dependencies
- Optional deps with `?:` — always guard before use
- For many dependencies: group in a `deps: ServiceDeps` interface

**Error Handling:**
```typescript
// Custom errors per feature — no generic AppError abstraction
export class LLMUnavailableError extends Error {
  constructor(
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(`LLM provider "${provider}" is unavailable`);
    this.name = 'LLMUnavailableError';  // ALWAYS set this.name
  }
}

// Catch pattern
try { await service.execute(); }
catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  throw error; // rethrow after logging
}
```

**Logging:**
- ❌ `console.log/error` forbidden in application/domain layers
- ✅ `console.log` allowed ONLY in `cli/commands/` (presentation layer)
- ✅ Services emit events: `this.eventBus.emit('domain.action', { ... })`
- StructuredLogger (observability) bridges EventBus → JSONL files

**Test Mocking Pattern:**
```typescript
// ✅ Mocks are typed inline objects implementing the interface
function createMockProvider(chunks: LLMChunk[]): LLMProvider {
  return {
    async *complete(_request: LLMRequest): AsyncIterable<LLMChunk> {
      for (const chunk of chunks) { yield chunk; }
    },
    async health() { return { available: true, models: ['llama3'] }; },
  };
}

// ✅ Partial mocks for external types use double cast
const mockReq = { body: { storyId: 'E1-S1' } } as unknown as FastifyRequest;

// ❌ Do NOT use vi.fn() for port methods — use real implementations
```

**Runtime Validation:**
- Zod used for system config validation only (`ConfigSchema.ts` in `@cop1/app`)
- Not a global pattern — do not add Zod schemas everywhere

### Framework-Specific Rules

**Supervisor / Orchestrator Design (core mental model):**
- cop1 is a **thin supervisor** that delegates ALL methodology execution to BMAD agents
- `SprintRunner` doesn't know HOW dev-story or code-review work — only calls `WorkflowStep.run()`
- BMAD agents (dev, reviewer, QA) handle the "how" — cop1 handles the "what" and "when"
- cop1 observes and reports (KPIs, metrics, events) — never implements methodology logic
- **EA10 — Supervisor Orchestrator (Sprint 13, SCP 2026-04-07)**: adds inter-command BMAD sequencing driven by an editable `supervisor-playbook.md`, using EA9 multi-turn sessions. Unblocks the V1 DoD "autonomous sprint". Subsumes the placeholder EA8-S6.

**Hexagonal Architecture — Strict Boundaries:**
- **Domain** (`domain/`, `domain/ports/`): Types, interfaces, business rules — zero I/O
- **Application** (`application/`): Services — inject ports via constructor
- **Infrastructure** (`infrastructure/`): Adapters implementing ports
- **Composition root** (`packages/app/src/composition/`): ONLY place that instantiates adapters
- ❌ NEVER instantiate an adapter inside a service — always inject via constructor

**EventBus — Central Communication:**
- Services communicate via `EventBus.emit(eventType, payload)` — never direct calls
- Event naming: dot-notation `domain.action` (e.g., `sprint.starting`, `story.completed`, `llm.call.failed`)
- `LoggerBridge` (observability) listens → persists to JSONL
- `HttpServer` listens → broadcasts as SSE to web clients
- In tests: use `new EventBus()` directly — do NOT mock it

**Dual Pipeline (BMAD vs Legacy):**
- **BMAD pipeline** (primary, `useBMAD: true`): `BMADDevStoryStep` → `BMADReviewStep` → `BMADQAStep`
  - Each step spawns Claude CLI via `ClaudeCliAdapter`
  - cop1 = Orchestrator, BMAD = Executor (ADR-008)
- **Legacy pipeline** (fallback): `DevAgent` → `ReviewerAgent` → `QAAgent` via LLM Gateway
- New workflow steps implement `WorkflowStep` interface:
  ```typescript
  interface WorkflowStep { name: string; run(context: WorkflowContext): Promise<StepResult>; }
  ```
- Register new steps in `PipelineStepFactory.build()` — not in SprintRunner

**WorkflowEngine — Step Execution:**
- Executes steps sequentially with quality gate (`QualityGatePort.runAll()`) between each step
- Supports resume: `WorkflowEngine.resume(context, steps, checkpoint)`
- Steps can be restarted after crash — design them idempotent when possible

**BMAD Ownership (CRITICAL — ADR-008/009):**
- cop1 **read-only** on `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Reads via `BmadStatusReader` (implements `SprintStatusReaderPort`)
- cop1 **NEVER writes** to sprint-status.yaml — BMAD manages all transitions
- cop1 writes only to `.cop1/sprint-log-*.jsonl` (StructuredLogger)
- Eligible story statuses for processing: `backlog`, `ready`, `ready-for-dev`
- Coupling is minimal and intentional: read status to know WHAT to process, not HOW

**Checkpoint & Recovery:**
- `CheckpointService` saves state before each story (managed by SprintRunner, not steps)
- On crash: `WorkflowEngine.resume()` restarts from exact step index
- Phases: `SLOT_RESERVED → STATUS_TRANSITIONING → TRANSITION → STATUS_TRANSITIONED → AGENT_STARTED`

**Config System:**
- `cop1.config.yaml` validated by Zod (`ConfigSchema.ts` in `@cop1/app`)
- Type defined in `Cop1Config` interface (`@cop1/shared-kernel`)
- ⚠️ Adding a config option requires BOTH `ConfigSchema.ts` AND `Cop1Config` updates
- Supports hot-reload via file watching

**HTTP API & CLI:**
- Handlers are pure functions — testable without Fastify
- SSE endpoint (`/events`) bridges all EventBus events to web clients
- CLI commands in `packages/app/src/cli/commands/` — wire deps then run
- `console.log` acceptable in CLI layer only

### Testing Rules

**Test Organization:**
- Test files in `__tests__/` directory at feature root — NOT co-located with source
- Naming: `ServiceName.test.ts` (PascalCase matching source file)
- 118 test files across 8 packages (sprint-core: 55, app: 23, llm-intelligence: 13)

**Test Structure:**
- `describe('ClassName')` or `describe('FeatureName')` at top level
- `it('should [verb] when [condition]')` — always "should", always present tense
- Arrange-Act-Assert pattern in every test
- No snapshot tests — explicit assertions only

**Mocking Strategy (two patterns coexist):**
```typescript
// Pattern 1: Inline typed object — for simple ports with fixed returns
function createMockProvider(): LLMProvider {
  return {
    async *complete(): AsyncIterable<LLMChunk> { yield { text: 'ok' }; },
    async health() { return { available: true, models: ['llama3'] }; },
  };
}

// Pattern 2: vi.fn() — for behavioral verification (call count, args)
const qualityGate = { runAll: vi.fn(async () => ({ passed: true, gates: [] })) };
// then: expect(qualityGate.runAll).toHaveBeenCalledOnce();
```
- ❌ Do NOT use untyped `vi.fn()` without implementing the port interface
- ✅ `vi.fn(async () => result)` with proper typing is acceptable

**Assertions — Prefer explicit over generic:**
- Primitives: `toBe` (identity)
- Objects/arrays: `toEqual` (deep equality)
- Membership: `toContain`, `toHaveProperty`
- Errors: `expect(() => fn()).toThrow(ErrorType)` — NOT try/catch in test
- Mocks: `toHaveBeenCalledOnce()`, `toHaveBeenCalledTimes(n)`

**Test Isolation & Cleanup:**
```typescript
let testDir: string;
beforeEach(() => {
  testDir = join(tmpdir(), `cop1-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
});
afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  eventBus.removeAllListeners(); // prevent listener leaks
});
```
- Random suffix on temp dirs mandatory (parallel test isolation)
- Always clean up: temp dirs, EventBus listeners, file watchers, HTTP servers

**Async Test Patterns:**
- Polling with deadline (no external `waitFor` utility):
  ```typescript
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !condition) {
    await new Promise(r => setTimeout(r, 200));
  }
  ```
- Timeouts: unit tests = default, integration > 5s = explicit (`}, 15_000)`)
- E2E smoke tests: `}, 180_000)` with `describe.runIf(process.env.RUN_E2E === 'true')`

**Integration Tests (`packages/app/src/integration-tests/`):**
- Use `fake-claude.mjs` fixture to simulate Claude CLI
- Create full project structures in temp dirs (stories, config, sprint-status)
- Test at multiple abstraction levels: adapter → step → pipeline → SprintRunner
- Verify event emission ordering via EventBus listener arrays

### Code Quality & Style Rules

**Biome Linter/Formatter (enforced — not optional):**
- `pnpm lint` = `biome check .` — `pnpm lint:fix` auto-fixes
- Single quotes · semicolons · 2-space indent · 100 chars line width
- `noUnusedImports: error` · `noUnusedVariables: warn` · `noExplicitAny: warn` · `noNonNullAssertion: warn`
- Import organization: automatic (`organizeImports: true`)

**Import Order (enforced by Biome):**
1. `node:` builtins (`import { join } from 'node:path'`)
2. `@cop1/*` workspace packages
3. Relative imports (`./`, `../`)

**Naming Conventions:**
- **PascalCase** for all TypeScript source files: domain, application, infrastructure
- **kebab-case** exception: `cli/commands/` only (`sprint-run.ts`, `daemon-entry.ts`)
- Classes/Interfaces: PascalCase (`CheckpointService`, `SprintStatusReaderPort`)
- Variables/functions: camelCase
- Packages: `@cop1/kebab-case`
- Events: dot-notation (`sprint.starting`, `llm.call.failed`)

**File Size:**
- Implicit convention: no source file exceeds ~300 lines (max observed: 257)
- If a service grows beyond 300 lines, split into multiple services or extract a sub-feature

**Feature Layer Rules:**
- Not all layers are required — use only what the feature needs:
  - No `domain/` = no business logic (pure technical feature)
  - No `infrastructure/` = no I/O
  - `__tests__/` always present
- 100% adherence to this pattern across all packages

**Documentation:**
- JSDoc on **port interfaces** (public contracts) and **complex public methods**
- ❌ Do NOT add JSDoc on obvious methods (`async start(): Promise<void>`)
- ❌ Do NOT add JSDoc on private methods unless truly complex
- Zero TODO/FIXME/HACK in codebase — keep it that way
- `@deprecated` only in barrel exports for migration guidance

**Barrel Export Rules (`index.ts`):**
- Check existing exports before adding — no duplicates
- `export type` for interfaces/types, `export` for classes
- Mark superseded exports with `/** @deprecated Use X instead */`

### Development Workflow Rules

**Commit Conventions:**
- Format: `type: Implement {EPIC_ID}-{STORY_ID} Description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Example: `feat: Implement EA1-S8 Integration Test with code review fixes`
- Story ID mandatory for traceability

**Branch Strategy:**
- Single branch: `main` — no feature branches
- Code review via BMAD (`/bmad-bmm-code-review`), not GitHub PRs

**Pre-Commit Checklist (CRITICAL — no CI, no hooks, agents are the only quality gate):**
```bash
pnpm typecheck    # 1. MANDATORY — tests do NOT verify types (tsx transpiles without checking)
pnpm test          # 2. MANDATORY — all packages
pnpm lint          # 3. MANDATORY — Biome check
pnpm lint:fix      # (optional) Auto-fix formatting
```
- There is NO CI/CD and NO pre-commit hooks — skipping these checks means broken code on main

**Post-Implementation Checklist:**
- [ ] New public service? → Add to barrel `index.ts` with proper `export` or `export type`
- [ ] New config option? → Update BOTH `ConfigSchema.ts` AND `Cop1Config` interface
- [ ] New package dependency? → Verify it appears BEFORE your package in root `tsc -b` order
- [ ] Modified `package.json`? → Run `pnpm install` to resolve workspace deps

**Key pnpm Commands:**
- `pnpm build` — build all packages (`tsc -b` with explicit order)
- `pnpm typecheck` — TypeScript strict check without emitting
- `pnpm test` — Vitest run all packages
- `pnpm lint` / `pnpm lint:fix` — Biome check / auto-fix
- `pnpm clean` — remove dist/ and node_modules/

**Adding a New Package:**
1. Create `packages/{name}/package.json` (`"type": "module"`, `"name": "@cop1/{name}"`)
2. Add `tsconfig.json` extending `../../tsconfig.base.json` with `composite: true`
3. `pnpm-workspace.yaml` covers `packages/*` — no change needed
4. **MANUAL**: Add to `tsc -b` command in root `package.json` at correct position in build order
5. Internal deps: `"@cop1/shared-kernel": "workspace:*"` — NEVER fixed versions
6. Run `pnpm install` to link workspace dependencies

**Environment & Secrets:**
- `.env` files gitignored — secrets stay local
- `dotenv` loaded ONLY in CLI entry points (`daemon-entry.ts`, `start.ts`)
- Services NEVER read `process.env` — inject via config or ports
- Config schema source of truth: `packages/app/src/features/config/domain/ConfigSchema.ts`

**Git Worktree (simulate mode):**
- `SprintRunner` creates `agent/simulate-{timestamp}` worktree for isolated execution
- `.cop1/` state copied into worktree
- Worktrees preserved in simulate mode — clean up manually with `git worktree remove`

### Critical Don't-Miss Rules

**Architecture Violations to Prevent:**
- Domain importing from infrastructure/app — breaks hexagonal model
- Cross-package import via internal path instead of barrel `index.ts`
- `process.env` in any service — only in CLI entry points
- cop1 writing to `sprint-status.yaml` — BMAD is sole writer (ADR-009)
- `ceremony-engine` writing directly into `sprint-core` — return decisions, don't mutate
- Instantiating adapters inside services — only in composition root (`packages/app/`)
- Adding external dependencies to `shared-kernel` — zero external deps

**Feature Graduation Rule:**
- If a feature exceeds ~800 lines OR is imported by 3+ packages → extract to its own npm package

**TypeScript Traps:**
- `array[0].property` → won't compile (`noUncheckedIndexedAccess`)
- `as any` → Biome warns, use `unknown` + narrowing
- `import './Foo'` without `.js` → ESM runtime error
- `require()` or `__dirname` → don't exist in ESM
- Custom Error without `this.name = 'ClassName'` → unidentifiable in stack traces
- Returning `undefined` from a port where convention is `null`
- Incomplete port mocks (missing methods) → runtime crash in tests

**Conventions Agents Must Follow:**
- Tests in `__tests__/` — never co-located with source
- `console.log` only in `cli/commands/` — services use `EventBus.emit()`
- Source files < 300 lines — split if larger
- Commits must include story ID (`feat: Implement EA1-S8 ...`)
- `EventBus.removeAllListeners()` in `afterEach` of every test using EventBus

**BMAD-Specific Rules:**
- `sprint-status.yaml` format: `development_status:` section with `storyId: status` entries
- Eligible statuses for cop1 processing: `backlog`, `ready`, `ready-for-dev` only
- cop1 reads via `BmadStatusReader` — never parses the YAML manually elsewhere
- Biome does NOT lint `_bmad/`, `_bmad-output/`, `packages/web/` (intentional exclusions)

**Edge Cases:**
- Always quote file paths in `execSync`/`spawn` — project path may contain spaces
- Use `import.meta.dirname` for test fixture paths — never hardcoded paths
- Web package has separate typecheck: `cd packages/web && pnpm typecheck`
- `pnpm typecheck` at root does NOT cover web package

---

## Usage Guidelines

**For AI Agents:**
- Load this file before implementing ANY code in this project
- Follow ALL rules exactly — especially ESM extensions, architecture boundaries, and pre-commit checks
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge during implementation

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review periodically for outdated rules

---

_Last Updated: 2026-04-05_
