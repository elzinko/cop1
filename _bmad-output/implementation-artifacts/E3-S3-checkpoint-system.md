# Story E3.S3: Checkpoint System

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to save workflow state checkpoints atomically at each step transition,
so that the system can recover from crashes without losing progress.

## Acceptance Criteria

1. À chaque transition de workflow, `CheckpointService.save(state)` écrit atomiquement `.cop1/checkpoint.yaml` (write .tmp → rename POSIX) avec `{storyId, agentName, step, timestamp, context}`.
2. Séquence crash-safe respectée : `agent.slot.reserved → story.status.transitioning → transition → story.status.transitioned → agent.started` — un test vérifie que chaque flag est écrit avant le suivant.

## Tasks / Subtasks

- [ ] Créer `CheckpointService` dans sprint-core
  - [ ] `application/CheckpointService.ts`
  - [ ] `save(state: CheckpointState)` — atomic write (.tmp → rename)
  - [ ] `read()` — lit checkpoint.yaml, retourne CheckpointState | null
  - [ ] `clear()` — supprime le checkpoint

- [ ] Domain types
  - [ ] `CheckpointState` — `{storyId, agentName, stepIndex, stepName, timestamp, phase}`
  - [ ] `CheckpointPhase` — enum des phases crash-safe

- [ ] Intégrer dans WorkflowEngine
  - [ ] Appeler `checkpointService.save()` à chaque transition d'étape
  - [ ] Respecter la séquence crash-safe

- [ ] Tests
  - [ ] save() crée un checkpoint lisible
  - [ ] Atomic write : crash simulé pendant write → ancien checkpoint intact
  - [ ] Séquence crash-safe : vérifier l'ordre des phases

## Dev Notes

- **Package** : `@cop1/sprint-core`
- **Atomic write** : `writeFileSync(path + '.tmp', data)` puis `renameSync(path + '.tmp', path)`.
