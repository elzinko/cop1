# Session Log — EA12-S7 (aspirational features audit)

## Context d'entrée (2026-04-15)

- **Status initial**: `todo`
- **Scope**: audit `kpis-dashboard/`, `burndown/`, `velocity-projector/` — delete unwired modules and file V1.2 backlog entries for those with future consumer potential.
- **Files read**:
  - `_bmad-output/implementation-artifacts/EA12-S7.md` — AC
  - Discovery via `find`: all three modules live in `packages/sprint-core/src/features/` (NOT in `packages/observability/` as the story referenced — story Dev Notes are stale).
  - `grep` for each class name: `KPIsDashboardService`, `BurndownCalculator`, `VelocityProjector` — zero external consumers. Barrel re-exports in `sprint-core/src/index.ts` only.

## Audit results

| Module              | External consumers | Decision     | Rationale                                                                                                    |
| ------------------- | ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `kpis-dashboard/`   | 0                  | DELETE       | Pure barrel re-export. AC1 explicit.                                                                         |
| `burndown/`         | 0                  | DELETE + backlog item | Pure barrel re-export. Hookable to `/bmad-bmm-sprint-status` later but no consumer now. V1.2 backlog. |
| `velocity-projector/` | 0                | DELETE + backlog item | Pure barrel re-export. Hookable later but no consumer now. V1.2 backlog.                                     |

## Plan

1. Delete the three feature directories under `packages/sprint-core/src/features/`.
2. Remove the 4 barrel re-exports from `packages/sprint-core/src/index.ts`.
3. Run `pnpm build` + `pnpm test` to verify no import errors + tests pass (AC4).
4. Record V1.2 backlog notes in the sprint-status.yaml / a planning doc.

## Fichiers modifiés

See story File List.

## Commandes shell exécutées

- `find -type d -name` survey: located the 3 modules at `packages/sprint-core/src/features/{kpis-dashboard,burndown,velocity-projector}/`.
- `grep` for class names `KPIsDashboardService|BurndownCalculator|VelocityProjector` across `packages/`: only self-references (class definitions + tests) + 3 barrel re-exports in `sprint-core/src/index.ts`. Zero external consumers.
- `rm -rf` on the 3 src directories + their dist counterparts.
- Barrel re-exports removed from `sprint-core/src/index.ts` (4 lines across 3 features), replaced with 1-line comment markers pointing to V1.2 backlog.
- `pnpm --filter @cop1/sprint-core build` — emits cleanly (pre-existing unrelated type errors remain; no new errors from deletions).
- `pnpm vitest run packages/sprint-core packages/app` — 648 passing, 9 pre-existing failures. Delta = -11 tests corresponding to the deleted modules; no regressions.
- `pnpm biome check packages/sprint-core/src/index.ts` — clean.

## Questions posées

None. Decision for burndown/velocity-projector is delete per the story's option (b); documented V1.2 backlog note in Completion Notes.

## Décisions prises (récap)

- All three modules deleted (no wiring). V1.2 re-introduction gated by EA12-S4 follow-up (BmadCommandStatusAdapter).
- Barrel comments in `index.ts` point forward to the V1.2 path so the deletion is discoverable.

## Blocages et contournements

None.

## Gate final

- **typecheck**: only pre-existing errors remain (unrelated modules).
- **test**: 648 passing. Delta -11 from deleted tests. 9 pre-existing failures unchanged.
- **lint**: clean on modified file.

## Commit hash

(set post-commit)

