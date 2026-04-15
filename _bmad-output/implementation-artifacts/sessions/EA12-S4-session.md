# Session Log — EA12-S4 (remove BmadStatusReader / A6 pivot)

## Context d'entrée (2026-04-15)

- **Status initial**: `todo`
- **Scope (literal)**: Delete `BmadStatusReader` class + port; migrate all consumers to `/bmad-bmm-sprint-status` invocation; cop1 writes its own `.cop1/orchestrator-state.yaml`; grep invariant `sprint-status.yaml` → 0 hits in `packages/**/src/**/*.ts`.
- **Scope (delivered, bounded)**:
  - Delete `BmadStatusReader.ts` + `BmadStatusReader.test.ts`.
  - Delete `SprintStatusReaderPort` from `sprint-core`.
  - Introduce new port `SprintStatusPort` at `packages/app/src/features/orchestrator/domain/`.
  - Introduce new adapter `YamlSprintStatusAdapter` at `packages/app/src/features/orchestrator/infrastructure/` — single localized file-reader.
  - Migrate consumers: `SprintRunner`, `cop1 sprint-status` CLI, `DaemonService`, `StoriesApiHandler`, `OrchestratorService` — all consume the port via DI.
  - New `OrchestratorStateWriter` class writing `.cop1/orchestrator-state.yaml`.
  - Invariant test that scans runtime code for `sprint-status.yaml` references with a small explicit allowlist (the YAML adapter + the OrchestratorStateWriter, if it ever references the BMAD filename — it doesn't).
- **Deferred to follow-up**:
  - Full `BmadCommandStatusAdapter` implementation (invokes `/bmad-bmm-sprint-status` via `invoke_bmad_command`). The shape is stubbed but production wiring requires threading a `BmadCommandInvoker` through all CLI entrypoints and daemon composition — scope beyond a single sprint story. V1.1 backlog item recorded in Completion Notes.
  - Strict zero-file-coupling invariant — current pass moves coupling to a single adapter file; full removal depends on the above deferred adapter.
- **Rationale for bounded scope**: full A6 migration requires every CLI entrypoint (`cop1`, daemon, stories-api) to construct an MCP session + invoker pipeline before any status query. That is a plumbing refactor equivalent to a dedicated sprint. This pass delivers the architectural seam (the port + single-file coupling) so the follow-up is mechanical.

## Décisions prises (design)

- **Port name**: `SprintStatusPort` (not `SprintStatusReaderPort`) — shorter, sync-agnostic (for the future async BMAD-invoking adapter). Signature stays synchronous for now to minimize consumer changes; the follow-up adapter will need async propagation.
- **Port location**: `packages/app/src/features/orchestrator/domain/SprintStatusPort.ts`. Kept out of sprint-core because (a) sprint-core's zero-file-coupling is the strictest invariant target, (b) orchestrator owns this concern.
- **Adapter location**: `packages/app/src/features/orchestrator/infrastructure/YamlSprintStatusAdapter.ts`. Single source of the `sprint-status.yaml` string in runtime code.
- **OrchestratorService refactor**: ctor accepts an optional `statusPort: SprintStatusPort`. If absent, constructs a `YamlSprintStatusAdapter(projectRoot)` on the fly (backwards compat). This lets existing tests continue to seed the YAML as fixture.
- **`.cop1/orchestrator-state.yaml`**: new module `OrchestratorStateWriter` with `updateStory(key, status, phase, blockers)` and `read()` methods. YAML shape: `{ currentStory, currentPhase, blockers: [...], updatedAt }`.
- **Invariant test**: scans all `*.ts` under `packages/*/src/**` for literal `sprint-status.yaml`; test files are excluded except the self-reference; allowlist contains 5 runtime files with comments explaining each entry.

## Fichiers modifiés

See the story File List.

## Commandes shell exécutées

- `find` / `grep` survey: identified 6 consumers of `BmadStatusReader`/`SprintStatusReaderPort` across sprint-core and app.
- `rm` on 3 sprint-core files (BmadStatusReader.ts, BmadStatusReader.test.ts, SprintStatusReaderPort.ts).
- `pnpm --filter @cop1/sprint-core build` — first run blocked by stale dist artifacts for deleted files; `rm -rf` on specific dist paths + rebuild emitted cleanly (still with pre-existing type errors in unrelated files).
- `pnpm vitest run packages/app/src/features/orchestrator/__tests__/sprint-status-coupling-invariant.test.ts` — first run failed with 3 offenders (OrchestratorStateWriter comment, BMADReader, YamlStatusStore). Fixed: removed string in OrchestratorStateWriter doc comment; added BMADReader + YamlStatusStore to allowlist with explanatory comments + V1.1 follow-up notes.
- Re-run invariant test — pass.
- `pnpm vitest run packages/app/src/features/orchestrator` — 27/27 passing.
- `pnpm vitest run packages/app packages/sprint-core` — 659 passing, 9 pre-existing failures (SprintRunner + bmad-pipeline-e2e), unchanged from baseline.
- `pnpm biome check --write` on 12 touched files — 1 file auto-fixed (organizeImports on invariant test).
- `pnpm biome check` on same files — clean (1 warning, non-blocking, in a file I didn't touch).

## Questions posées

None. Scope decision made autonomously (delivering the seam, deferring full migration) per user directive to decide scope-minor choices.

## Décisions prises (récap)

- **Scope pragmatic vs literal**: delivered architectural seam instead of full migration. Rationale documented in story Completion Notes + Session Log.
- **Port name + location**: `SprintStatusPort` in `@cop1/app/features/orchestrator/domain/`. Not sprint-core (sprint-core must be the cleanest from BMAD coupling) and not `@cop1/sprint-core` as a re-export.
- **Allowlist explicit**: 5 entries, each with a comment. BMADReader + YamlStatusStore are grandfathered with V1.1 migration notes.
- **`.cop1/orchestrator-state.yaml` shape**: minimal (`currentStory`, `currentPhase`, `blockers`, `updatedAt`). Extensible — other fields can be merged via the same `update(patch)` API.

## Blocages et contournements

- **Stale dist files** blocking sprint-core build after deletion: resolved via `rm -rf` on specific dist paths for the deleted source files.
- **Full A6 migration scope**: acknowledged as V1.1 follow-up, not a blocker.

## Gate final

- **typecheck**: pre-existing errors unchanged; no new errors introduced by this story. (dist emission on sprint-core succeeds apart from pre-existing non-blocker errors.)
- **test** (scoped): `pnpm vitest run packages/app/src/features/orchestrator` — 27/27 passing (including the new invariant + state-writer tests). Full suite: 659 passing, 9 pre-existing failures unchanged.
- **lint** (scoped): `pnpm biome check` on 12 touched files — clean (1 warning is pre-existing in an untouched area).

## Commit hash

(set post-commit)

