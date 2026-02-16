---
project_name: 'cop1'
user_name: 'elzinko'
date: '2026-02-11'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Technologies
- **Node.js** >= 20.0.0 (required for native ESM support)
- **pnpm** >= 9.0.0 (monorepo workspace manager)
- **TypeScript** 5.7.0 (strict mode fully enabled)
- **tsx** 4.19.0 (fast TypeScript execution in development)
- **Vitest** 2.1.0 (testing framework)

### API Framework
- **Fastify** 5.2.0 (high-performance web server)
- **@fastify/cors** 10.0.1 (CORS middleware)
- **dotenv** 16.4.7 (environment variables management)
- **better-sqlite3** 11.7.0 (local SQLite database — infrastructure layer only)

### Architecture
- **Pattern:** Hexagonal Architecture + pnpm Monorepo Workspace
- **Module System:** Native ESM (NodeNext)
- **Packages:** 6 workspace packages under `@cop1/*` scope
  - `@cop1/domain` — Pure business logic (entities, use-cases, ports)
  - `@cop1/rules-engine` — YAML-based rules management
  - `@cop1/llm-gateway` — LLM provider abstraction (local/cloud/hybrid)
  - `@cop1/infrastructure` — Adapters (SQLite, HTTP, Docker)
  - `@cop1/api` — Fastify REST API
  - `@cop1/web` — React web interface

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Strict Mode — All flags active in `tsconfig.base.json`:**
- **CRITICAL:** `noUncheckedIndexedAccess: true` — all array/object index access returns `T | undefined`
  - ❌ FORBIDDEN: `array[0].property` (won't compile)
  - ✅ REQUIRED: `array[0]?.property` or explicit undefined guard
- `noUnusedLocals` and `noUnusedParameters` — no unused variables or params allowed
- `noFallthroughCasesInSwitch` — explicit `break` or `return` in every switch case

**Native ESM — `.js` extensions mandatory in all imports:**
- ❌ FORBIDDEN: `import { Task } from './entities/Task'`
- ✅ REQUIRED: `import { Task } from './entities/Task.js'`
- All packages must have `"type": "module"` in `package.json`
- Module resolution: `NodeNext`

**Error Handling:**
- Domain errors: `throw new Error(\`${Entity} ${id} cannot ${action} (${context})\`)`
- Always validate with `can*()` guard methods before mutating entity state
- Convert unknown errors: `error instanceof Error ? error.message : String(error)`

**Type Safety:**
- Enums for state machines: PascalCase name, lowercase string values (`TaskStatus.PENDING = 'pending'`)
- Extensible metadata: `[key: string]: unknown` index signature
- Prefer `unknown` over `any`; use `import type` for type-only imports

### Framework-Specific Rules

**Fastify API:**
- Create instance with `{ logger: true }` (structured logging via pino)
- CORS: `{ origin: true }` in dev (permissive); restrict in production
- Route organization: one file per resource in `routes/` (`projects.ts`, `agents.ts`, `tasks.ts`)
- All API routes use `/api` prefix
- DI: pass custom `Container` instance to routes via Fastify plugin options
- Health check: always include `/health` → `{ status: 'ok', timestamp: ISO8601 }`

**Hexagonal Architecture (CRITICAL):**
- `@cop1/domain` has **ZERO** infrastructure dependencies — pure business logic only
  - Entities hold business rules as methods (`canBeAssigned()`, `canBeStarted()`, `canBeCompleted()`)
  - Ports are interfaces defined in domain (`TaskRepository`, `LLMProvider`, `RulesProvider`)
- Infrastructure implements domain ports (adapters pattern)
- **Dependency flow:** Domain ← Infrastructure (NEVER the reverse)
- ❌ FORBIDDEN: importing `@cop1/infrastructure`, `@cop1/api`, or `@cop1/web` from `@cop1/domain`

**React Web (`@cop1/web`):**
- Conventions to be established when code is developed
- Expected: functional components with hooks (modern React)

### Testing Rules

**Framework:** Vitest 2.1.0 — `pnpm test` runs all packages via `pnpm -r test`

**File Organization:**
- Test files: `*.test.ts` co-located with source (`Task.ts` → `Task.test.ts`)
- Tests excluded from build: `"exclude": ["**/*.test.ts"]` in `tsconfig.json`

**Test Structure:**
- Pattern: Arrange-Act-Assert (AAA) in every test
- Naming: `it('should [expected behavior] when [condition]')`
- Describe hierarchy: `describe('ClassName') > describe('methodName') > it(...)`

**Test Boundaries:**
- **Unit:** Domain entities and use-cases — pure logic, no I/O, mock all ports
- **Integration:** API routes with real Container/DI — test that adapters work together
- **E2E:** To be defined as needed

**Test Isolation:**
- Each test independent — no shared mutable state between tests
- Clean up in `afterEach`/`afterAll`
- Mock `TaskRepository`, `LLMProvider`, `RulesProvider` in domain unit tests

### Code Quality & Style Rules

**Naming Conventions:**
- **Packages:** `@cop1/{package-name}` (kebab-case, scoped)
- **Files:** PascalCase for entities/classes (`Task.ts`), kebab-case for routes/utils (`projects.ts`)
- **Directories:** kebab-case (`use-cases/`, `ports/repositories/`)
- **Classes/Interfaces:** PascalCase (`Task`, `TaskRepository`, `LLMProvider`)
- **Enums:** PascalCase name + UPPERCASE keys + lowercase string values
- **Functions/Variables:** camelCase

**File Organization:**
- Domain: `entities/`, `use-cases/`, `ports/`, `ports/repositories/`
- Each package exposes its public API through `src/index.ts`
- Co-locate test files with their source

**Import Order:**
1. External packages (`fastify`, `@fastify/cors`)
2. Internal workspace packages (`@cop1/domain`)
3. Local relative imports (`./container.js`, `./routes/projects.js`)

**Documentation:**
- JSDoc for all public classes and interfaces
- Inline `/** Business rule: ... */` comments on entity methods
- Mark architectural constraints explicitly: `PURE BUSINESS LOGIC - No infrastructure dependencies`
- Prefer self-documenting code — avoid noisy comments

### Development Workflow Rules

**Commit Messages (Conventional Commits):**
- Format: `type: short description` (lowercase, imperative)
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Breaking change: `feat!: description`
- Example: `feat: Add autonomous work mode to agent runner`

**Branches:**
- Feature: `feat/short-description` (kebab-case)
- Bug fix: `fix/short-description`
- Never push directly to `main`

**Key pnpm Commands:**
- `pnpm dev` — API + Web in parallel
- `pnpm build` — build all packages (`pnpm -r build`)
- `pnpm typecheck` — TypeScript check all (`pnpm -r typecheck`)
- `pnpm test` — run all tests (`pnpm -r test`)
- `pnpm clean` — remove all `dist/` and `node_modules/`

**Adding a New Package:**
1. Create `packages/{name}/` with `package.json` (`"type": "module"`, `"name": "@cop1/{name}"`)
2. Add `tsconfig.json` extending `../../tsconfig.base.json`
3. Already covered by `pnpm-workspace.yaml` (`packages/*`)
4. Reference internals with `workspace:*` — ❌ NEVER fixed version for internal packages

**Build Order (managed by TypeScript project references):**
`domain` → `rules-engine`, `llm-gateway` → `infrastructure` → `api`, `web`

### Critical Don't-Miss Rules

**Architecture violations to prevent:**
- ❌ Domain importing from infrastructure/api/web — breaks hexagonal model
- ❌ Adding I/O libraries (`better-sqlite3`, `fastify`) to `@cop1/domain`
- ❌ Concrete implementations injected directly — always inject port interfaces
- ✅ Infrastructure allowed deps: `@cop1/domain`, `@cop1/rules-engine`, `@cop1/llm-gateway`, `better-sqlite3`

**Use-Case implementation pattern:**
```typescript
// 1. Null-check immediately after retrieval
const task = await this.taskRepository.findById(id);
if (!task) throw new Error(`Task ${id} not found`);

// 2. Persist immediately after entity mutation
task.start();
await this.taskRepository.save(task);  // ← right after mutation

// 3. Parallel persist when saving multiple entities
await Promise.all([this.taskRepository.save(task), this.agentRepository.save(agent)]);

// 4. Always record failure then rethrow
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  task.fail(msg);
  await this.taskRepository.save(task);
  throw error;  // ← always rethrow
}
```

**LLM Integration:**
- Prompt structure: `system` (agent type + formatted rules) + `user` (task title + description)
- Rules injected via `RulesProvider.formatRulesForLLM(agent.rulesModules)`
- Check `isAvailable()` before LLM calls in resource-constrained contexts
- `getResourceUsage()` returns MB — use for agent capacity management

**SQLite (better-sqlite3):**
- Synchronous API — do NOT use `await` directly on better-sqlite3 calls
- Wrap in async functions at the infrastructure adapter level

**Security:**
- Secrets in `.env` only — never commit `.env` files
- CORS `{ origin: true }` is dev-only — restrict for production deployments
- Validate all external input at API boundary (Fastify handlers), not in domain layer

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in this project
- Follow ALL rules exactly as documented — especially ESM extensions and architecture boundaries
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge during implementation

**For Humans:**
- Keep this file lean and focused on agent needs — remove rules that become obvious over time
- Update when technology stack changes (new packages, version upgrades)
- Review periodically for outdated or redundant rules

---

_Last Updated: 2026-02-11_
