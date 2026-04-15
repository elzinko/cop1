# Session Log — EA12-S3 (playbook pivot — remove commands)

## Context d'entrée (2026-04-15)

- **Status initial**: `todo` (sprint-status.yaml L370)
- **Scope**: Strip command enumeration from the playbook; move hardcoded BMAD commands out of PipelineStepFactory into a shared constant + supervisor scrum-guidance prompt; rewrite `supervisor-playbook.md` and reference docs to be scrum directives only.
- **Fichiers lus avant d'attaquer**:
  - `_bmad-output/implementation-artifacts/EA12-S3.md` — AC
  - `packages/app/src/features/orchestrator/domain/SupervisorPlaybook.ts` — current shape
  - `packages/app/src/features/orchestrator/application/SupervisorPlaybookLoader.ts` — parser (post-S5 edits)
  - `packages/app/src/features/orchestrator/application/OrchestratorService.ts` — uses `phase.commands` for command iteration (lines 100-179)
  - `packages/app/src/features/orchestrator/__tests__/OrchestratorService.test.ts` — `samplePlaybook` shape
  - `packages/app/src/features/orchestrator/__tests__/SupervisorPlaybookLoader.test.ts` + `-project.test.ts`
  - `packages/app/src/composition/PipelineStepFactory.ts` — 3 hardcoded commands at L77/83/89
  - `packages/sprint-core/src/features/bmad-orchestration/domain/SupervisorPromptBuilder.ts` — system prompt template
  - `supervisor-playbook.md` (root) + `_bmad-output/planning-artifacts/supervisor-playbook-reference.md` + `supervisor-playbook-format.md`

## Décisions prises (design)

- **Literal AC1**: playbook code has no `PlaybookSchemaV2` type (doesn't exist) and no `commands:`/`allowed_commands:` preamble-level fields. AC1 satisfied by (a) keeping the type vacuous, (b) adding loader-level rejection of those preamble keys if ever present.
- **AC2 relaxation strategy**:
  - Extract hardcoded commands from `PipelineStepFactory` into a new shared constant `DEFAULT_BMAD_PIPELINE_COMMANDS` (sprint-core domain) — centralizes + makes intent clear.
  - Extract orchestrator cycle into `DEFAULT_ORCHESTRATOR_CYCLE` (same module) — 2 phases (Story Creation, Development Loop) with canonical commands.
  - `SupervisorPromptBuilder` gains a "Scrum Cycle Guidance" section describing the cycle abstractly (phase names + canonical commands as examples, with a note that the supervisor can substitute).
  - `invoke_bmad_command` already accepts `z.string()` — no allowlist ever existed in code.
- **AC3 strategy (playbook body rewrite)**:
  - Rewrite `supervisor-playbook.md` to drop the ordered-list command sections. Phases become prose descriptions ("The supervisor runs BMAD commands to create a story..." etc.).
  - `OrchestratorService` falls back to `DEFAULT_ORCHESTRATOR_CYCLE_BY_NAME` lookup when a playbook phase has no `commands`. This keeps runtime behavior identical while letting the playbook file be command-free.
- **Backwards compat**: `PlaybookPhase.commands` becomes optional. Existing playbooks still parse. "Empty phase" is no longer a validation error.
- **Reference + format docs updated** to reflect the new format.

## Plan d'implémentation

1. New file `packages/sprint-core/src/features/bmad-orchestration/domain/BmadCycle.ts` with `DEFAULT_BMAD_PIPELINE_COMMANDS` + `DEFAULT_ORCHESTRATOR_CYCLE` + lookup helper.
2. Export via `sprint-core/src/index.ts`.
3. `PipelineStepFactory` reads from `DEFAULT_BMAD_PIPELINE_COMMANDS`.
4. `SupervisorPromptBuilder` imports `DEFAULT_ORCHESTRATOR_CYCLE` and adds guidance block.
5. `PlaybookPhase.commands` → optional. Remove `PlaybookCommand` re-export if unused elsewhere.
6. `SupervisorPlaybookLoader`: commands-list optional; reject `commands:` and `allowed_commands:` preamble keys; remove "empty phase" validation error.
7. `OrchestratorService`: fallback lookup when phase.commands absent.
8. Rewrite `supervisor-playbook.md`: prose phases, no `/bmad-*` strings.
9. Rewrite `supervisor-playbook-reference.md` similarly.
10. Update `supervisor-playbook-format.md` spec.
11. Update tests:
    - SupervisorPlaybookLoader.test.ts: "empty phase" test inverted; add "rejects commands: preamble" test; add "budgets" test (already done in S5); remove literal `/bmad-*` assertions where possible.
    - SupervisorPlaybookLoader-project.test.ts: update to parse the rewritten project playbook (no commands).
    - OrchestratorService.test.ts: add fallback test (phase with no commands → uses DEFAULT cycle).

## Fichiers modifiés

See story File List for the full inventory.

## Commandes shell exécutées

- `grep` via Grep tool: `PlaybookSchemaV2` / `commands:` / `allowed_commands` / `max_turns_per_workflow` → only doc-level hits; confirms target fields are nominal, not in code.
- `find` via Glob/find: located `PipelineStepFactory.ts`, `SupervisorPlaybook.ts`, `SupervisorPlaybookLoader.ts`, `SupervisorPromptBuilder.ts`.
- `pnpm vitest run packages/app/src/features/orchestrator packages/sprint-core` — first run: 2 failures (TypeError: defaultCommandsForPhase is not a function) because sprint-core dist was stale.
- `pnpm --filter @cop1/sprint-core build` — first run: blocked by duplicate `SupervisorContext` re-export. Fixed by removing the duplicate re-export in `sprint-core/src/index.ts`. Dist emission succeeded on pre-existing errors (tsc default) → `dist/BmadCycle.js` produced.
- Re-run `pnpm vitest run packages/app/src/features/orchestrator` — 26/26 passing (4 files).
- `pnpm vitest run packages/sprint-core packages/app` — 664 passing, 10 pre-existing failures (SprintRunner 9 + bmad-pipeline-e2e 1). Same failures as on clean HEAD.
- `pnpm biome check --write` on 11 modified files — fixed 1 (organizeImports on BmadCycle.ts).
- `pnpm biome check` on same 11 files — clean.

## Questions posées

None. Autonomous decisions throughout on:
- Where to place `DEFAULT_BMAD_PIPELINE_COMMANDS` / `DEFAULT_ORCHESTRATOR_CYCLE` (sprint-core domain).
- `defaultCommandsForPhase` name + case-insensitive lookup semantics.
- Fallback pattern in OrchestratorService (skip unknown phases vs throw) — chose silent skip because the story spirit is maximal supervisor autonomy.
- Removing vs renaming the duplicate SupervisorContext re-export — chose remove since app has 0 consumers.
- MultiStepResolutionLoop migration to discriminated-union budget result — collateral but required to compile.

## Décisions prises (récap)

- **AC1 (literal)**: `commands:` / `allowed_commands:` preamble keys now rejected by the loader. `PlaybookSchemaV2` type never existed in code.
- **AC2**: hardcoded BMAD commands moved out of `PipelineStepFactory` into a central `BmadCycle.ts` module; scrum cycle added to supervisor system prompt.
- **AC3**: `supervisor-playbook.md` rewritten with zero `/bmad-*` command names in the body. Orchestrator still functional via `defaultCommandsForPhase` fallback.
- **AC4**: `supervisor-playbook-reference.md` + `supervisor-playbook-format.md` rewritten/amended.
- **AC5**: tests relaxed — no literal assertion on phase.commands arrays where intent-only suffices; added rejection tests and fallback tests.
- **Backwards compat**: existing playbooks with ordered-list commands still parse and still drive the orchestrator. New playbooks are intent-only.

## Blocages et contournements

- **sprint-core build blocker** (pre-existing duplicate `SupervisorContext` export): fixed by removing the duplicate re-export (no app consumer).
- **`defaultCommandsForPhase is not a function`** at test-time: sprint-core dist was stale. Ran `pnpm --filter @cop1/sprint-core build` (tsc emits JS even on pre-existing type errors).
- **`MultiStepResolutionLoop.ts` type error**: `budget.tokensRemaining` no longer unconditionally exists after EA12-S5. Migrated to `if ('tokensRemaining' in budget)` discriminant check.

## Gate final

- **typecheck**: pre-existing errors unchanged; no new errors introduced by this story's changes (confirmed via `pnpm --filter @cop1/sprint-core build` — emits cleanly apart from the known pre-existing issues in ExchangeHistoryReader.test.ts, MetricsWriter.test.ts, SessionTranscriptGenerator.ts).
- **test** (targeted): `pnpm vitest run packages/app/src/features/orchestrator` — 26/26 passing; `pnpm vitest run packages/sprint-core packages/app` — 664 passing, 10 pre-existing failures unchanged.
- **lint** (scoped): `pnpm biome check` on 11 touched files — clean.

## Commit hash

(set post-commit)

