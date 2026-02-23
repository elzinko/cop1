# Story EA5.3: Auto-Sync on Rule Change

Status: ready-for-dev

## Story

As a cop1 Orchestrator,
I want rules to be automatically synced to BMAD sidecar when they change,
so that BMAD agents always see the latest governance rules without manual intervention.

## Acceptance Criteria

1. EventBus listener on `rule.applied` / `rule.rejected` events triggers `SidecarSyncService.sync()` automatically
2. Sync completed within same event processing cycle — BMAD agents see updated rules on next command invocation
3. Sync failure does not block rule application — error logged, retry on next rule change

## Tasks / Subtasks

- [ ] Task 1: EventBus listener setup (AC: #1)
  - [ ] Create `SidecarSyncListener` or add listener in composition root
  - [ ] Subscribe to `rule.applied` event via `eventBus.on('rule.applied', handler)`
  - [ ] Subscribe to `rule.rejected` event (to keep sidecar in sync with current state)
  - [ ] Handler calls `SidecarSyncService.sync()`
- [ ] Task 2: Sync timing (AC: #2)
  - [ ] Ensure sync is synchronous with event processing (await the sync call)
  - [ ] No debouncing needed — rule changes are infrequent
- [ ] Task 3: Error resilience (AC: #3)
  - [ ] Wrap sync call in try/catch — log error but don't rethrow
  - [ ] Emit `sidecar.sync.failed` event for monitoring
  - [ ] Next rule change will trigger another sync attempt (natural retry)
- [ ] Task 4: Tests
  - [ ] Test: emit `rule.applied` -> SidecarSyncService.sync() called
  - [ ] Test: emit `rule.rejected` -> SidecarSyncService.sync() called
  - [ ] Test: sync failure -> error logged, no exception propagated
  - [ ] Test: multiple events -> each triggers sync

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

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
