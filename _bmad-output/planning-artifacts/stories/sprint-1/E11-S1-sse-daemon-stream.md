# Story E11.S1: SSE Daemon Stream

Status: ready-for-dev

## Story

As a Developer,
I want the cop1 daemon to expose a Server-Sent Events (SSE) endpoint,
so that clients can subscribe to real-time events from the daemon.

## Acceptance Criteria

1. `GET /events` (SSE) diffuse tous les événements dot-notation du daemon (ex. `story.workflow.started`) avec `data: {eventType, timestamp, payload}` en JSON.
2. Reconnexion client SSE (déconnexion simulée) → le stream reprend sans perte d'état du daemon.

## Tasks / Subtasks

- [ ] Ajouter route SSE dans HttpServer
  - [ ] `GET /events` — SSE endpoint
  - [ ] Headers : `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
  - [ ] Chaque événement EventBus → envoyé comme `data: JSON\n\n` au client

- [ ] Bridge EventBus → SSE
  - [ ] `SSEBridge` écoute tous les événements EventBus et les forward aux clients SSE connectés
  - [ ] Gestion multi-clients (Set de Response objects)
  - [ ] Cleanup sur déconnexion client

- [ ] Tests
  - [ ] GET /events retourne SSE headers
  - [ ] Événement émis sur EventBus → reçu par client SSE
  - [ ] Déconnexion client → pas de crash serveur

## Dev Notes

- **Package** : `@cop1/app` — feature daemon
- **SSE format** : `data: {"eventType":"story.workflow.started","timestamp":"...","payload":{...}}\n\n`
- **Pas de Last-Event-ID** en Sprint 1 (pas de replay). La reconnexion reprend le stream courant.
