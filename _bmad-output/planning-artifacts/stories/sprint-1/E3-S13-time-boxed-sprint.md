# Story E3.S13: Time-Boxed Sprint

Status: ready-for-dev

## Story

As a Developer,
I want to start time-boxed sprint sessions with a configurable duration,
so that cop1 runs autonomously for a set period and stops gracefully.

## Acceptance Criteria

1. `cop1 sprint start --duration 2h` démarre une session et crée `.cop1/session.yaml` avec `{started_at, duration_minutes, deadline}`.
2. Quand `elapsed >= duration`, le Workflow Engine finit la story en cours et s'arrête proprement — aucune story n'est interrompue en milieu d'exécution.
3. `cop1 sprint start` sans `--duration` utilise la valeur par défaut de `cop1.config.yaml` (`sprint.default_duration_hours`).

## Tasks / Subtasks

- [ ] Créer `SprintSession` domain dans sprint-core
  - [ ] `domain/SprintSession.ts` — `{startedAt, durationMinutes, deadline, status}`
  - [ ] `isExpired()` method

- [ ] Créer `SprintSessionService` application
  - [ ] `start(durationMinutes)` — crée session.yaml
  - [ ] `check()` — vérifie si deadline atteinte
  - [ ] `stop()` — marque la session comme terminée

- [ ] Intégrer dans WorkflowEngine
  - [ ] Avant chaque nouvelle story : vérifier `SprintSession.isExpired()`
  - [ ] Si expiré : finir la story en cours, ne pas en démarrer de nouvelle

- [ ] Commande CLI `cop1 sprint start`
  - [ ] Option `--duration <duration>` (ex: `1h`, `2h`, `4h`, `30m`)
  - [ ] Parse la durée en minutes
  - [ ] Fallback sur config si pas de --duration

- [ ] Tests
  - [ ] sprint start crée session.yaml
  - [ ] isExpired() true quand deadline passée
  - [ ] WorkflowEngine s'arrête après expiration (mock timer)
  - [ ] Default duration depuis config

## Dev Notes

- **Package** : `@cop1/sprint-core` pour SprintSession, `@cop1/app` pour CLI
- **Duration parsing** : regex simple `(\d+)(h|m)` → minutes.
