# Story EA2.S0b: ADR-009 BmadStatusReader Refactoring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want cop1 to read sprint-status.yaml from the BMAD path via a read-only port,
so that the sprint runner works in production and cop1 never writes to BMAD-owned artifacts.

## Acceptance Criteria

1. `SprintStatusReaderPort` interface exposed from `@cop1/sprint-core` with `getStoryStatus(storyId: string): string | null` and `getAllStatuses(): Map<string, string>`
2. `BmadStatusReader` implements `SprintStatusReaderPort`, reads from `_bmad-output/implementation-artifacts/sprint-status.yaml`, parses the BMAD hierarchical format (`development_status.{storyId}: {status}`)
3. `InMemoryStatusReader` implements `SprintStatusReaderPort` for all unit tests
4. No `setStatus()` calls remain in `SprintRunner` — all `transitionToInProgress()`, `execTracker.setStatus(REVIEW)`, `execTracker.setStatus(DONE)` calls removed
5. cop1 NEVER writes to `sprint-status.yaml` — execution history goes to `.cop1/sprint-log-*.jsonl` via existing `StructuredLogger`
6. All existing tests pass with the new reader (0 regressions)
7. `YamlStatusStore` deprecated but kept temporarily for `StoryStatusTracker` unit tests

## Tasks / Subtasks

- [x] Task 1: Create `SprintStatusReaderPort` interface (AC: #1)
  - [x] Create `packages/sprint-core/src/features/story-tracker/domain/ports/SprintStatusReaderPort.ts`
  - [x] Interface: `getStoryStatus(storyId: string): string | null` and `getAllStatuses(): Map<string, string>`
  - [x] Note: returns plain `string` status (not `StatusEntry`), no `updatedAt` needed — that's in JSONL
  - [x] Export from `packages/sprint-core/src/index.ts`

- [x] Task 2: Create `BmadStatusReader` implementation (AC: #2)
  - [x] Create `packages/sprint-core/src/features/story-tracker/infrastructure/BmadStatusReader.ts`
  - [x] Constructor takes `projectPath: string`
  - [x] File path: `join(projectPath, '_bmad-output/implementation-artifacts/sprint-status.yaml')`
  - [x] Parse BMAD format: YAML with `development_status:` top-level key containing `{storyId}: {status}` entries
  - [x] Skip non-story keys: `epic-*`, `*-retrospective` entries (filter by pattern)
  - [x] Return `Map<string, string>` — key is storyId (e.g., "EA2-S3"), value is status string (e.g., "backlog")
  - [x] Handle missing file gracefully (return empty Map)
  - [x] NO write methods — class is strictly read-only
  - [x] Export from `packages/sprint-core/src/index.ts`

- [x] Task 3: Create `InMemoryStatusReader` for tests (AC: #3)
  - [x] Create `packages/sprint-core/src/features/story-tracker/infrastructure/InMemoryStatusReader.ts`
  - [x] Implements `SprintStatusReaderPort`
  - [x] Constructor accepts `Map<string, string>` or empty
  - [x] Provides `setStatus(storyId, status)` for test setup (not part of port interface)
  - [x] Export from `packages/sprint-core/src/index.ts`

- [x] Task 4: Write unit tests for `BmadStatusReader` (AC: #2, #6)
  - [x] Create `packages/sprint-core/src/features/story-tracker/__tests__/BmadStatusReader.test.ts`
  - [x] Test: reads BMAD-format YAML correctly (development_status section)
  - [x] Test: filters out epic-* and *-retrospective keys
  - [x] Test: missing file returns empty Map
  - [x] Test: empty development_status returns empty Map
  - [x] Test: handles all status values (backlog, ready-for-dev, in-progress, review, done)
  - [x] Use temp directory with real filesystem (project pattern — no mocking fs)

- [x] Task 5: Refactor `SprintRunner` (AC: #4, #5)
  - [x] File: `packages/app/src/composition/SprintRunner.ts`
  - [x] Add `statusReader?: SprintStatusReaderPort` to `SprintRunnerDeps`
  - [x] Replace `new YamlStatusStore(this.projectPath)` with `this.statusReader ?? new BmadStatusReader(this.projectPath)`
  - [x] Remove `execStatusStore` and `execTracker` — no write path
  - [x] Remove `transitionToInProgress()` call and the method itself
  - [x] Remove `execTracker.setStatus(StoryStatus.REVIEW)` and `execTracker.setStatus(StoryStatus.DONE)`
  - [x] Instead emit events: `this.eventBus.emit('story.completed', { storyId: story.id })` — StructuredLogger already captures these
  - [x] In `filterEligible()`: adapt to use `SprintStatusReaderPort.getStoryStatus()` returning `string | null` instead of `StatusEntry | null`
  - [x] In `filterEligible()`: add `'ready-for-dev'` to eligible statuses (BMAD format uses `ready-for-dev`, not `ready`)
  - [x] In `listEligible()`: use `this.statusReader` directly
  - [x] Remove `YamlStatusStore` import

- [x] Task 6: Refactor `DaemonService` (AC: #4)
  - [x] File: `packages/app/src/features/daemon/application/DaemonService.ts`
  - [x] Replace `new YamlStatusStore(projectPath)` with `new BmadStatusReader(projectPath)`
  - [x] Replace `StoryStatusTracker` usage with direct `SprintStatusReaderPort.getAllStatuses()`
  - [x] Result is already `Map<string, string>` — simplifies the provider callback
  - [x] Remove `YamlStatusStore` and `StoryStatusTracker` imports, add `BmadStatusReader` import

- [x] Task 7: Refactor `sprint-status` CLI (AC: #4)
  - [x] File: `packages/app/src/cli/commands/sprint-status.ts`
  - [x] Replace `new YamlStatusStore(projectPath)` with `new BmadStatusReader(projectPath)`
  - [x] Replace `StoryStatusTracker` usage with direct `SprintStatusReaderPort` calls
  - [x] `getAllStatuses()` now returns `Map<string, string>` — adapt the byStatus grouping loop (use value directly, not `entry.status`)
  - [x] Remove `YamlStatusStore` and `StoryStatusTracker` imports, add `BmadStatusReader` import

- [x] Task 8: Adapt `bmad-pipeline-e2e.test.ts` (AC: #6)
  - [x] File: `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts`
  - [x] Replace `YamlStatusStore` with `InMemoryStatusReader` for assertions
  - [x] Write BMAD-format sprint-status.yaml to `{tmpDir}/_bmad-output/implementation-artifacts/sprint-status.yaml`
  - [x] Inject `InMemoryStatusReader` via `SprintRunnerDeps.statusReader` for status assertions
  - [x] Verify that `SprintRunner` no longer calls `setStatus()` — stories go through BMAD pipeline only

- [x] Task 9: Adapt `StoriesApiHandler.test.ts` (AC: #6)
  - [x] File: `packages/app/src/features/stories-api/__tests__/StoriesApiHandler.test.ts`
  - [x] Replace `YamlStatusStore` mock with `InMemoryStatusReader` mock
  - [x] Adapt assertions to `SprintStatusReaderPort` interface (plain string status, no `updatedAt`)
  - [x] Also refactored `StoriesApiHandler` itself to use `SprintStatusReaderPort` instead of `StoryStatusTracker`

- [x] Task 10: Adapt `SprintRunner.test.ts` (AC: #6)
  - [x] File: `packages/app/src/composition/__tests__/SprintRunner.test.ts`
  - [x] Inject `InMemoryStatusReader` via `SprintRunnerDeps.statusReader`
  - [x] Remove any assertions on `setStatus()` calls — SprintRunner no longer transitions statuses
  - [x] Verify event emissions instead (`story.completed` event)

- [x] Task 11: Update barrel exports and deprecation (AC: #7)
  - [x] In `packages/sprint-core/src/index.ts`: add `/** @deprecated Use BmadStatusReader + SprintStatusReaderPort instead */` to `YamlStatusStore` export
  - [x] Export new: `SprintStatusReaderPort`, `BmadStatusReader`, `InMemoryStatusReader`
  - [x] Keep `StoryStatusTracker` export (still used by its own unit tests, deprecated path)

- [x] Task 12: Verify all tests pass (AC: #6)
  - [x] Run `pnpm test` — 609 tests, 0 failures
  - [x] Run `pnpm build` — pre-existing TS errors from EA2-S2 (missing `budget` in test configs), no new errors
  - [x] Run `pnpm lint` — pre-existing warnings only (noNonNullAssertion, useTemplate), no new issues

## Dev Notes

### Architecture Pattern — ADR-009

cop1 is **strictly read-only** on `sprint-status.yaml`. BMAD is the sole writer. This ADR resolves the path mismatch identified in the EA1 retro: `YamlStatusStore` reads from `.cop1/sprint-status.yaml` but the real file lives at `_bmad-output/implementation-artifacts/sprint-status.yaml`.

**Before (dual-write — incorrect):**
```
SprintRunner → YamlStatusStore.readAll() → filter eligible
SprintRunner → execTracker.setStatus(backlog → ready → in-progress)  ← REMOVE
SprintRunner → engine.run() → BMAD executes dev-story
SprintRunner → execTracker.setStatus(review → done)                  ← REMOVE
```

**After (read-only — correct):**
```
SprintRunner → BmadStatusReader.getAllStatuses() → filter eligible
SprintRunner → engine.run() → BMAD executes dev-story (BMAD manages transitions)
SprintRunner → eventBus.emit('story.completed') → logged to .cop1/sprint-log-*.jsonl
```

### BMAD YAML Format (what BmadStatusReader must parse)

```yaml
# sprint-status.yaml — BMAD format
development_status:
  epic-1: done           # ← skip (epic key)
  E1-S1: done            # ← include
  EA2-S3: backlog        # ← include
  epic-1-retrospective: done  # ← skip (retrospective key)
```

Key differences from cop1's old format:
- Top-level `development_status:` section (not flat entries)
- Values are plain strings (`"done"`, `"backlog"`), NOT objects with `{ status, updatedAt }`
- Contains epic-level and retrospective entries that must be filtered out
- Uses `ready-for-dev` (not `ready`) as the status for created stories

### Status Value Mapping

| BMAD Status | cop1 StoryStatus | Eligible for sprint? |
|-------------|-----------------|---------------------|
| `backlog` | BACKLOG | YES |
| `ready-for-dev` | READY | YES |
| `in-progress` | IN_PROGRESS | NO |
| `review` | REVIEW | NO |
| `done` | DONE | NO |

### Key Files to Modify

| File | Action |
|------|--------|
| `packages/sprint-core/src/features/story-tracker/domain/ports/SprintStatusReaderPort.ts` | **CREATE** |
| `packages/sprint-core/src/features/story-tracker/infrastructure/BmadStatusReader.ts` | **CREATE** |
| `packages/sprint-core/src/features/story-tracker/infrastructure/InMemoryStatusReader.ts` | **CREATE** |
| `packages/sprint-core/src/features/story-tracker/__tests__/BmadStatusReader.test.ts` | **CREATE** |
| `packages/sprint-core/src/index.ts` | MODIFY (add exports) |
| `packages/app/src/composition/SprintRunner.ts` | MODIFY (major refactor) |
| `packages/app/src/features/daemon/application/DaemonService.ts` | MODIFY |
| `packages/app/src/cli/commands/sprint-status.ts` | MODIFY |
| `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts` | MODIFY |
| `packages/app/src/features/stories-api/__tests__/StoriesApiHandler.test.ts` | MODIFY |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | MODIFY |

### Critical Implementation Notes

1. **TypeScript strict mode** — all files use `.js` extensions in imports (NodeNext resolution)
2. **Hexagonal pattern** — port in `domain/ports/`, adapters in `infrastructure/`
3. **No new dependencies** — `yaml` package already in sprint-core dependencies
4. **StoryStatusTracker still exists** — it wraps `YamlStatusStore` with state machine logic. After this refactor, `SprintRunner` bypasses `StoryStatusTracker` entirely and uses `SprintStatusReaderPort` directly (no state machine needed for read-only)
5. **`filterEligible()` change** — current code checks for `StoryStatus.BACKLOG` and `StoryStatus.READY`. Must add `'ready-for-dev'` since BMAD uses that instead of `'ready'`
6. **Simulate worktree** — `createSimulateWorktree()` currently copies `.cop1/` dir. After refactor, it should work with `_bmad-output/` path since `BmadStatusReader` reads from project root's `_bmad-output/`

### Previous Story Learnings (EA2-S2)

- Config changes cascade through test fixtures — adding new DI params to `SprintRunnerDeps` will require updating all test instantiations
- Budget section in Cop1Config uses Zod `.default()` pattern — follow same for new optional deps
- All 603+ tests must pass with 0 regressions

### Git Intelligence

Recent commits show consistent pattern: `feat: Implement {story} with code review fixes`. Last commit `113df71` (EA1-S8) added integration tests for the BMAD pipeline — the `bmad-pipeline-e2e.test.ts` file that needs adaptation here.

### Project Structure Notes

- Port location follows existing pattern: `packages/sprint-core/src/features/story-tracker/domain/ports/` (create `ports/` dir if needed — check `bmad-reader/domain/ports/` for reference)
- Adapter location: `packages/sprint-core/src/features/story-tracker/infrastructure/`
- Test location: `packages/sprint-core/src/features/story-tracker/__tests__/`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-009 (line 979)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-09.md#C1]
- [Source: _bmad-output/implementation-artifacts/epic-ea1-retro-2026-03-07.md#Action-Items]
- [Source: packages/sprint-core/src/features/story-tracker/infrastructure/YamlStatusStore.ts]
- [Source: packages/app/src/composition/SprintRunner.ts]
- [Source: packages/app/src/features/daemon/application/DaemonService.ts]
- [Source: packages/app/src/cli/commands/sprint-status.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 12 tasks completed successfully
- 609 tests pass (6 new BmadStatusReader tests + adapted existing tests)
- cop1 is now strictly read-only on sprint-status.yaml (ADR-009)
- SprintRunner emits `story.completed` events instead of writing to YamlStatusStore
- StoriesApiHandler also refactored to use SprintStatusReaderPort (cleaner DI)
- Pre-existing build errors from EA2-S2 (missing `budget` in test configs) unrelated to this story
- Biome formatter broke `import()` type cast syntax in e2e test — fixed with biome-ignore comment

### Change Log

- 2026-03-09: All tasks implemented, 609 tests pass, story set to review
- 2026-03-09: Code review fixes applied (2 issues fixed, 611 tests pass):
  - [H1] Fixed N×file reads in filterEligible() — now calls getAllStatuses() once before loop
  - [M1] Added 2 GET endpoint tests for StoriesApiHandler (known + unknown story)

### File List

- packages/sprint-core/src/features/story-tracker/domain/ports/SprintStatusReaderPort.ts (CREATE)
- packages/sprint-core/src/features/story-tracker/infrastructure/BmadStatusReader.ts (CREATE)
- packages/sprint-core/src/features/story-tracker/infrastructure/InMemoryStatusReader.ts (CREATE)
- packages/sprint-core/src/features/story-tracker/__tests__/BmadStatusReader.test.ts (CREATE)
- packages/sprint-core/src/index.ts (MODIFY — new exports, deprecated YamlStatusStore)
- packages/app/src/composition/SprintRunner.ts (MODIFY — major refactor, read-only)
- packages/app/src/features/daemon/application/DaemonService.ts (MODIFY)
- packages/app/src/cli/commands/sprint-status.ts (MODIFY)
- packages/app/src/features/stories-api/application/StoriesApiHandler.ts (MODIFY — uses SprintStatusReaderPort)
- packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts (MODIFY)
- packages/app/src/features/stories-api/__tests__/StoriesApiHandler.test.ts (MODIFY)
- packages/app/src/composition/__tests__/SprintRunner.test.ts (MODIFY)
