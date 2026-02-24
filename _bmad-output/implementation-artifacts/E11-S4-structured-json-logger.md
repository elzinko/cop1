# Story E11.S4: Structured JSON Logger

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to log all agent events as structured JSON lines,
so that I can analyze sprint activity and generate reports from logs.

## Acceptance Criteria

1. `Logger.event(type, payload)` appende une ligne JSON dans `.cop1/sprint-log-{date}.jsonl` avec `{timestamp, eventType, agentName, storyId, action, durationMs}` (NFR17).
2. `Logger.event()` ne lève jamais d'exception — erreur d'écriture loggée en stderr et ignorée (jamais de crash agent sur log failure).

## Tasks / Subtasks

- [ ] Créer `StructuredLogger` dans observability
  - [ ] `application/StructuredLogger.ts`
  - [ ] `event(type, payload)` — append JSONL line
  - [ ] Filename : `.cop1/sprint-log-{YYYY-MM-DD}.jsonl`
  - [ ] Never throws — try/catch with stderr fallback

- [ ] Intégrer avec EventBus
  - [ ] `LoggerBridge` écoute tous les événements et appelle `Logger.event()`

- [ ] Tests
  - [ ] event() crée un fichier JSONL avec une ligne valide
  - [ ] Multiple events → multiple lines in order
  - [ ] Write error (permission denied mock) → no exception thrown

## Dev Notes

- **Package** : `@cop1/observability`
- **JSONL** : une ligne JSON par événement, appendable, pas de parsing du fichier complet.
- **Thread safety** : `appendFileSync` est atomique pour les petites écritures sur la plupart des OS.
