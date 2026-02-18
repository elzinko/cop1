# Story E2.S2: Story Status Tracker

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to track and persist story statuses across sessions,
so that the system knows which stories are in progress, done, or waiting.

## Acceptance Criteria

1. `StoryStatusTracker.setStatus(storyId, status)` persiste le statut dans `.cop1/sprint-status.yaml` avec timestamp — statuts valides : `backlog | ready | in-progress | review | done`.
2. Transition invalide (ex. `done → in-progress`) lève une `InvalidTransitionError` avec les statuts source et cible indiqués.

## Tasks / Subtasks

- [ ] Définir les transitions valides dans le domain
  - [ ] `domain/StoryStatus.ts` — enum des statuts + matrice de transitions
  - [ ] `domain/errors/InvalidTransitionError.ts`

- [ ] Créer `StoryStatusTracker` application service
  - [ ] `application/StoryStatusTracker.ts`
  - [ ] `setStatus(storyId, status)` — valide la transition, persiste dans YAML
  - [ ] `getStatus(storyId)` — lit depuis `.cop1/sprint-status.yaml`
  - [ ] `getAllStatuses()` — retourne Map<storyId, {status, updatedAt}>

- [ ] Infrastructure : YAML persistence
  - [ ] `infrastructure/YamlStatusStore.ts` — read/write `.cop1/sprint-status.yaml`

- [ ] Tests
  - [ ] setStatus valid transition → persisted
  - [ ] setStatus invalid transition → InvalidTransitionError
  - [ ] getAllStatuses retourne toutes les entrées

## Dev Notes

- **Package** : `@cop1/sprint-core`
- **Transitions valides** : backlog→ready, ready→in-progress, in-progress→review, review→done, review→in-progress (rework)
- **Persistence** : YAML simple, conforme ADR-001.
