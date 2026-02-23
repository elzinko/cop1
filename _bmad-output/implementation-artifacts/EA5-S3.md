# Story EA5.3: Auto-Sync on Rule Change

Status: done

## Story

As a cop1 Orchestrator,
I want rules to be automatically synced to BMAD sidecar when they change,
so that BMAD agents always see the latest governance rules without manual intervention.

## Acceptance Criteria

1. EventBus listener on `rule.applied` / `rule.rejected` events triggers `SidecarSyncService.sync()` automatically
2. Sync completed within same event processing cycle — BMAD agents see updated rules on next command invocation
3. Sync failure does not block rule application — error logged, retry on next rule change

## Tasks / Subtasks

- [x] Task 1: EventBus listener setup (AC: #1)
  - [x] Create `SidecarSyncListener` in `packages/sprint-core/src/features/iamthelaw/application/`
  - [x] Subscribe to `rule.applied` event via `eventBus.on('rule.applied', handler)`
  - [x] Subscribe to `rule.rejected` event (to keep sidecar in sync with current state)
  - [x] Handler calls `SidecarSyncService.sync()`
- [x] Task 2: Sync timing (AC: #2)
  - [x] Ensure sync is synchronous with event processing (sync call in handler)
  - [x] No debouncing needed — rule changes are infrequent
- [x] Task 3: Error resilience (AC: #3)
  - [x] Wrap sync call in try/catch — log error but don't rethrow
  - [x] Emit `sidecar.sync.failed` event for monitoring
  - [x] Next rule change will trigger another sync attempt (natural retry)
- [x] Task 4: Tests
  - [x] Test: emit `rule.applied` -> SidecarSyncService.sync() called
  - [x] Test: emit `rule.rejected` -> SidecarSyncService.sync() called
  - [x] Test: sync failure -> error logged, no exception propagated
  - [x] Test: multiple events -> each triggers sync

## Dev Notes

### Architecture Patterns

- **EventBus** (`packages/shared-kernel/src/features/events/domain/EventBus.ts`): `on(eventType, handler)` / `emit(eventType, payload)`. Handlers are synchronous callbacks but can be async.
- **SidecarSyncService** (from EA5-S1): Must be created first. This story wires it to EventBus.
- **Composition root**: The listener wiring should happen in `DaemonService` or equivalent initialization code.
- **RuleProposalService** (`packages/sprint-core/src/features/rule-proposal/application/RuleProposalService.ts`): Currently emits `rule.proposal.submitted`. The `rule.applied` event may need to be added when status changes to 'approved'.

### Dependency on EA5-S1

This story depends on `SidecarSyncService` from EA5-S1. If implementing in parallel, mock the service interface.

### Project Structure Notes

- Listener: `packages/sprint-core/src/features/iamthelaw/application/SidecarSyncListener.ts` or inline in composition root
- Wire in: `packages/app/src/features/daemon/application/DaemonService.ts`
- TypeScript strict, `.js` extensions, kebab-case files

### References

- [Source: packages/shared-kernel/src/features/events/domain/EventBus.ts]
- [Source: packages/sprint-core/src/features/rule-proposal/application/RuleProposalService.ts]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA5 — EA5-S3]

## Senior Developer Review (AI)

### Review Date
2026-02-23

### Review Outcome
Approve (after fixes)

### Findings (2 fixed, 2 low accepted)

- [x] [MEDIUM] Depended on concrete SidecarSyncService — introduced `Syncable` interface
- [x] [MEDIUM] `lastError` missing JSDoc — added documentation
- [LOW] No unsubscribe/dispose mechanism — acceptable for singleton daemon listener
- [LOW] Tests used real SidecarSyncService — switched to type-safe Syncable mock

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- SidecarSyncListener subscribes to `rule.applied` and `rule.rejected` EventBus events
- Sync is synchronous within event handler (no debouncing, no async)
- Error resilient: try/catch, console.error, emits `sidecar.sync.failed` event
- Code review: introduced `Syncable` interface for decoupling, added JSDoc, simplified test mocks
- 5 tests covering all ACs, 0 regressions (493 total pass)

### Change Log

- 2026-02-23: Initial implementation — all 4 tasks complete
- 2026-02-23: Code review fixes — Syncable interface, JSDoc, type-safe mocks

### File List

- packages/sprint-core/src/features/iamthelaw/application/SidecarSyncListener.ts (new)
- packages/sprint-core/src/features/iamthelaw/__tests__/SidecarSyncListener.test.ts (new)
- packages/sprint-core/src/index.ts (modified — added SidecarSyncListener export)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — EA5-S3 status)
