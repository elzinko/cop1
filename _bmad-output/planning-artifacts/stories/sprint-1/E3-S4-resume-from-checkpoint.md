# Story E3.S4: Resume from Checkpoint

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to resume a workflow from the last checkpoint after a crash or restart,
so that no story is processed twice and work is never lost.

## Acceptance Criteria

1. `WorkflowEngine.resume()` lit `.cop1/checkpoint.yaml` et reprend le workflow à l'étape indiquée sans re-exécuter les étapes précédentes.
2. Simulation kill -9 du daemon (mock) + redémarrage → `WorkflowEngine.resume()` reprend correctement, aucune story n'est traitée deux fois.

## Tasks / Subtasks

- [ ] Étendre WorkflowEngine avec `resume()`
  - [ ] Lire le checkpoint, déterminer l'étape de reprise
  - [ ] Skip les étapes déjà complétées
  - [ ] Émettre `story.workflow.resumed` event

- [ ] Tests
  - [ ] resume() avec checkpoint à step 2 → steps 0,1 non appelés, step 2 reprend
  - [ ] resume() sans checkpoint → démarre normalement
  - [ ] Simulation crash + resume → aucune story traitée deux fois

## Dev Notes

- **Package** : `@cop1/sprint-core`
- **Dépendance** : E3-S3 (CheckpointService)
