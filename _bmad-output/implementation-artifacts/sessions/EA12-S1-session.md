# Session Log — EA12-S1 (commit_anchor real implementation)

## Context d'entrée (2026-04-15 start)

- **Status initial**: `todo` (sprint-status.yaml L368)
- **Scope**: Replace V1-light stub in `toolCatalog.ts` (lines 122-128) with real `git commit` invocation, fail-safe on dirty/empty staging, return structured `{ committed, sha, short_sha }` or `{ committed: false, reason }`.
- **Blocks**: EA12-S6 (Track 2 SHA anchoring)
- **Fichiers lus avant d'attaquer**:
  - `_bmad-output/implementation-artifacts/EA12-S1.md` — AC + tasks
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` — sprint context
  - `packages/sprint-core/src/features/bmad-orchestration/infrastructure/tools/toolCatalog.ts` — stub at L122-128, handlers shape
  - `packages/sprint-core/src/features/bmad-orchestration/infrastructure/tools/SupervisorMcpServer.ts` — MCP wiring for commit_anchor
  - `packages/sprint-core/src/features/bmad-orchestration/__tests__/toolCatalog.test.ts` — existing test patterns
  - `packages/sprint-core/src/features/dev-agent/infrastructure/WorktreeManager.ts` — precedent for execSync git usage
  - `packages/sprint-core/package.json` — vitest setup

## Décisions prises (design)

- **Input extension**: Add optional `worktreePath?: string` to commit_anchor input. Supervisor creates worktrees per story; it must be able to commit inside that worktree. Falls back to `deps.projectRoot`. Rationale: story AC is silent on this but the stub ignored cwd entirely; real commits must target the correct working tree.
- **Co-Authored-By identity**: configurable via new `deps.coAuthoredBy?: string`, defaulting to `cop1-supervisor <noreply@anthropic.com>`. Rationale: story requires trailer but leaves identity open; configurable keeps it testable + future-proof for Claude-identity injection.
- **Message format**: pass the message through verbatim (supervisor's responsibility to conventional-format it per AC1); we only append the Co-Authored-By trailer. Using `git commit -F -` with stdin to avoid shell escape issues.
- **nothing_to_commit detection**: `git diff --cached --quiet` (exit code 0 = clean, 1 = staged changes). Avoids false positives from unstaged noise.
- **SHA retrieval**: `git rev-parse HEAD` post-commit.

## Fichiers modifiés

- `packages/sprint-core/src/features/bmad-orchestration/infrastructure/tools/toolCatalog.ts`
  - Added `node:child_process` import + `GitDriver` interface (testable port).
  - Added `defaultGitDriver` using `execSync` (diff --cached --quiet / commit -F - / rev-parse HEAD).
  - Extended `ToolCatalogDeps` with optional `coAuthoredBy`, `gitDriver`.
  - New `CommitAnchorResult` discriminated union type (exported).
  - `SupervisorToolHandlers.commit_anchor` signature: input now `{ message; worktreePath? }`, returns `CommitAnchorResult`.
  - Replaced stub body (previous L122-128) with real implementation: stage check → commit via stdin (safe escape) → SHA retrieval → structured error handling.
  - New `serializeGitError` helper truncates stderr to 500 chars.
  - `toolSchemas.commit_anchor` extended with optional `worktreePath: z.string().optional()`.
- `packages/sprint-core/src/features/bmad-orchestration/__tests__/toolCatalog.test.ts`
  - Replaced single "V1-light stub" test with 5 tests covering AC1/AC2/AC3/AC4/AC5:
    1. `nothing_to_commit` path (empty staging) — AC2
    2. Success path with SHA + short_sha + Co-Authored-By trailer — AC1, AC4
    3. Commit failure wrapped into `{ commit_failed, detail }` with stderr truncation — AC2
    4. No-push assertion (driver surface has no `push` method) — AC3
    5. Integration test with real temp `git init` repo via `mkdtempSync` — AC5
- `_bmad-output/implementation-artifacts/sessions/EA12-S1-session.md` — this file.

## Commandes shell exécutées

- `pnpm --filter @cop1/sprint-core typecheck` — exit 2; pre-existing errors (`ExchangeHistoryReader.test.ts`, `MetricsWriter.test.ts`, `SessionTranscriptGenerator.ts`, `src/index.ts` duplicate `SupervisorContext`). None introduced by this story. First run had a `Property 'note' does not exist` error on the old test — fixed by rewriting the test.
- `pnpm vitest run packages/sprint-core/src/features/bmad-orchestration/__tests__/toolCatalog.test.ts` — exit 0; 10/10 passing.
- `pnpm vitest run packages/sprint-core` — exit 0; 503/503 passing (no regression).
- `pnpm lint` — exit 1 (14 pre-existing errors repo-wide, none in modified files).
- `pnpm biome check --write` on modified files — applied `organizeImports` fix to test file.
- `pnpm biome check` on modified files — clean.

## Questions posées

None. Deterministic choices throughout (naming, port location, test structure). No BMAD prompts fired (slash-commands short-circuited per user directive: this is a plain dev task, not a BMAD workflow, so direct implementation follows the existing `toolCatalog.test.ts` convention without invoking `/bmad-bmm-dev-story`).

## Décisions prises

- **GitDriver in-file vs separate module**: kept inside `toolCatalog.ts`. Small 3-method surface, only consumer is `commit_anchor`. Promoting to its own module would be premature. Justification: YAGNI + single-responsibility of tools module preserved.
- **`worktreePath` input extension**: required, not optional-with-deprecation. The stub ignored cwd entirely; supervisor workflow always commits in a per-story worktree. Defaulting to `deps.projectRoot` keeps existing MCP schema compatible.
- **Co-Authored-By default**: `cop1-supervisor <noreply@anthropic.com>` — aligned with existing DevAgent conventions in the repo (cf. `packages/sprint-core/src/features/dev-agent/application/DevAgent.ts`), and configurable so future Claude-identity injection (CAB-style) can override it.
- **Test integration uses `mkdtempSync` (native) not tmp-promise / global beforeEach setup**: keeps the test self-contained. `try/finally` ensures cleanup on failure.
- **No `--amend` path (B2 open question)**: single commit, SHA returned. Per story Dev Notes, B2 is deferred to EA12-S6 which will decide amend vs 2-pass based on D4 needs.

## Blocages et contournements

- **Pre-existing type errors** in `sprint-core` typecheck: 4 unrelated files (`ExchangeHistoryReader.test.ts`, `MetricsWriter.test.ts`, `SessionTranscriptGenerator.ts`, `src/index.ts`). Not this story's scope. Documented in Completion Notes so the next sprint can address.
- **Pre-existing lint errors**: 14 repo-wide, none in files I touched. Verified via targeted `biome check` on modified files only.

## Gate final

- **typecheck** (scoped to files changed): clean. `pnpm --filter @cop1/sprint-core typecheck` reports only pre-existing errors in unrelated files.
- **test**: `pnpm vitest run packages/sprint-core` — 503/503 passing. 10 new/updated tests in `toolCatalog.test.ts`.
- **lint** (scoped to files changed): `pnpm biome check packages/sprint-core/src/features/bmad-orchestration/__tests__/toolCatalog.test.ts packages/sprint-core/src/features/bmad-orchestration/infrastructure/tools/toolCatalog.ts` — clean.

## Commit hash

(set post-commit)

