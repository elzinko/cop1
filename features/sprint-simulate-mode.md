# Feature Proposal: Sprint Simulate Mode (v2 — revised vision)

## Context — Current State

cop1 is an autonomous AI agents scrum team system. All 92 planned stories (Sprints 0-5, 410 story points) have been implemented across 7 backend packages with 394 passing tests, clean build, clean lint.

The latest integration work (commit `407c79f`) wired all 83 services together via a `SprintRunner` composition root and added CLI commands:

- `cop1 sprint run` — runs a sprint on eligible stories (executes workflow: dev → reviewer → qa → pm)
- `cop1 sprint run --dry-run` — lists eligible stories without executing
- `cop1 sprint run --filter <pattern>` — filters stories by ID pattern
- `cop1 sprint status` — shows sprint session and story statuses

### Existing LLM/Agent components (already implemented)

| Component | File | Status |
|-----------|------|--------|
| `OllamaAdapter` | `packages/llm-intelligence/src/features/llm-gateway/infrastructure/OllamaAdapter.ts` | Implemented — streaming HTTP to `localhost:11434/api/generate` |
| `LLMGateway` | `packages/llm-intelligence/src/features/llm-gateway/application/LLMGateway.ts` | Implemented — `complete()` + `completeForAgent()` with routing |
| `LLMRouter` | `packages/llm-intelligence/src/features/llm-gateway/application/LLMRouter.ts` | Implemented — routes by commandType via `cop1.config.yaml` |
| `OllamaManagementAdapter` | `packages/llm-intelligence/src/features/ollama-management/application/OllamaManagementAdapter.ts` | Implemented — `listModels()`, `pullModel()`, `deleteModel()` |
| `DevAgent` | `packages/sprint-core/src/features/dev-agent/application/DevAgent.ts` | Implemented — creates git worktree, calls `CodeGeneratorPort`, parses LLM response, commits |
| `ReviewerAgent` | `packages/sprint-core/src/features/reviewer-agent/application/ReviewerAgent.ts` | Implemented — calls `ReviewerPort`, handles rejections with max 3 |
| `WorktreeManager` | `packages/sprint-core/src/features/dev-agent/infrastructure/WorktreeManager.ts` | Implemented — `git worktree add/remove` |
| `DevPromptTemplate` | `packages/sprint-core/src/features/dev-agent/domain/DevPromptTemplate.ts` | Implemented — structured prompt + parsing `file:path` blocks |
| `CodeGeneratorPort` | `packages/sprint-core/src/features/dev-agent/domain/ports/CodeGeneratorPort.ts` | Interface — `generate(prompt: string): Promise<string>` |
| `ReviewerPort` | `packages/sprint-core/src/features/reviewer-agent/domain/ports/ReviewerPort.ts` | Interface — `review(qualityReport: string): Promise<ReviewResult>` |

### What's missing

The `SprintRunner` composition root currently uses **stub steps** (`DevAgentStep`, `ReviewerAgentStep`, `QAAgentStep`, `PMAgentStep`) that return `{ status: 'ok' }` after 100ms. It does NOT use the real `DevAgent` or `ReviewerAgent`.

### Architecture

- Feature First Hexagonal, 8 packages (shared-kernel → observability → llm-intelligence → quality-intelligence → sprint-core → ceremony-engine → app + web)
- ADR-001: YAML + JSONL persistence (no DB in MVP)
- Quality: Biome lint, Vitest + v8, TypeScript strict (NodeNext, noUncheckedIndexedAccess)
- Target hardware: MacBook Pro M3 Max 64GB RAM

## Revised Vision: `--simulate` = Real Execution in Isolated Git Worktree

**Key insight:** `--simulate` is NOT a fake/mock execution. It is a **real sprint with real LLM agents** but in a git worktree (isolated branch) so the developer can inspect results before merging.

This is essentially a PR-based workflow:

1. `cop1 sprint run --simulate` creates a **git worktree** on a new branch (e.g., `sprint/2026-02-18`)
2. Real agents execute: DevAgent calls Ollama to generate code, ReviewerAgent reviews, QA validates, PM approves
3. Each story's work is committed in the worktree (on the sprint branch)
4. At the end, the developer inspects the branch (code diffs, test results, quality metrics)
5. **No auto-merge ever** — the developer validates and merges manually (or via a merge agent that itself asks for validation)
6. If not satisfied → `git worktree remove` and delete the branch

Without `--simulate`, `cop1 sprint run` does the same thing but on the **current branch** directly (still no auto-merge — all merges require validation).

### CLI usage

```bash
# Real sprint in isolated worktree (safe — can be discarded)
cop1 sprint run --simulate

# Same with filter
cop1 sprint run --simulate --filter "E8-*"

# Inspect results
cd .worktree/sprint-2026-02-18/
git log --oneline
git diff main..HEAD

# If satisfied → merge
git checkout main && git merge sprint/2026-02-18

# If not satisfied → discard
cop1 sprint cleanup   # or: git worktree remove .worktree/sprint-xxx
```

### Acceptance Criteria (revised)

- AC1: `--simulate` creates a git worktree on a new branch — if worktree already exists, error
- AC2: Sprint executes with **real LLM agents** (same agents as without `--simulate`)
- AC3: All code changes are committed on the sprint branch, never on main
- AC4: Detailed execution log printed to console (stories, steps, results, summary)
- AC5: Worktree preserved after execution for inspection
- AC6: No auto-merge — ever. Merge is always a developer decision
- AC7: `.worktree/` added to `.gitignore`

## Prerequisites — Wire Real Agents

Before `--simulate` makes sense, the agents need to actually work. This requires:

### 1. Wire SprintRunner to use real agents instead of stubs

Replace stub steps in `SprintRunner` with:
- `DevAgent(ollamaCodeGenerator)` — real code generation via Ollama
- `ReviewerAgent(ollamaReviewer)` — real code review via Ollama
- QA step that runs actual tests (`pnpm test`)
- PM step that validates story completion

### 2. Create `OllamaCodeGenerator` adapter

An implementation of `CodeGeneratorPort` that:
- Uses `LLMGateway.completeForAgent('dev', prompt)` to call Ollama
- Collects the streaming response into a complete string
- Returns it for `DevPromptTemplate.parseLLMResponse()` to parse

### 3. Create `OllamaReviewer` adapter

An implementation of `ReviewerPort` that:
- Uses `LLMGateway.completeForAgent('reviewer', prompt)` to call Ollama
- Parses the response into `ReviewResult { verdict, comments }`

### 4. Create `cop1.config.yaml` with LLM routing

```yaml
project:
  name: cop1
  path: .
daemon:
  port: 4242
sprint:
  default_duration_hours: 0.17  # 10 minutes for testing
llm_routing:
  default: "deepseek-coder-v2:16b"
  dev: "deepseek-coder-v2:16b"
  reviewer: "deepseek-coder-v2:16b"
  qa: "llama3.1:8b"
  pm: "llama3.1:8b"
git:
  auto_merge: false  # NEVER auto-merge
```

### 5. Ollama provisioning

Ensure Ollama is running and models are pulled:
```bash
ollama pull deepseek-coder-v2:16b   # ~10GB, excellent for code
ollama pull llama3.1:8b              # ~5GB, good for review/QA/PM
```

On M3 Max 64GB, both models fit comfortably with room to spare.

## Suggested Epic/Story Placement

Story E3-S15 (already created) needs re-grooming to reflect this revised vision. Additional stories may be needed for:
- Wiring real agents in SprintRunner
- OllamaCodeGenerator and OllamaReviewer adapters
- cop1.config.yaml creation
- Ollama provisioning tooling
