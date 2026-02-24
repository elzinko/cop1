# Story E5.S1: LLM Gateway — Interface Unifiée Ollama

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to connect to a local Ollama instance via a unified OpenAI-compatible interface,
so that all agents can send LLM requests through a single abstraction layer without knowing the underlying provider.

## Acceptance Criteria

1. `LLMGateway.complete(prompt, model)` envoie une requête OpenAI-compatible à Ollama local (port 11434) et retourne la réponse en streaming.
2. Si Ollama n'est pas disponible, `LLMGateway` lève une `LLMUnavailableError` typée — pas de crash non géré.

## Tasks / Subtasks

- [ ] Définir le port domain `LLMProvider` dans `packages/llm-intelligence/` (AC: #1)
  - [ ] `src/features/llm-gateway/domain/ports/LLMProvider.ts`
  - [ ] Interface : `complete(request: LLMRequest): AsyncIterable<LLMChunk>`
  - [ ] Types : `LLMRequest { prompt: string, model: string, options?: LLMOptions }`, `LLMChunk { text: string, done: boolean }`
  - [ ] `LLMUnavailableError` dans `domain/errors/`

- [ ] Créer `OllamaAdapter` dans l'infrastructure (AC: #1, #2)
  - [ ] `src/features/llm-gateway/infrastructure/OllamaAdapter.ts`
  - [ ] Implémente `LLMProvider`
  - [ ] Endpoint : `POST http://localhost:11434/api/generate` (format Ollama natif, compatible OpenAI)
  - [ ] Streaming : utiliser `fetch()` + `ReadableStream` — parser les lignes JSON NDJSON d'Ollama
  - [ ] Timeout configurable (défaut 60s) — lève `LLMUnavailableError` si timeout ou `ECONNREFUSED`

- [ ] Créer `LLMGateway` application service (AC: #1)
  - [ ] `src/features/llm-gateway/application/LLMGateway.ts`
  - [ ] `LLMGateway.complete(prompt, model, options?)` → délègue à `LLMProvider` injecté
  - [ ] `LLMGateway.health()` → `GET http://localhost:11434/api/tags` → retourne `{available: boolean, models: string[]}`

- [ ] Barrel `src/index.ts` (AC: #1)
  - [ ] Exporter uniquement : `LLMGateway`, `LLMProvider`, `LLMRequest`, `LLMChunk`, `LLMUnavailableError`
  - [ ] Ne pas exporter `OllamaAdapter` (implémentation interne)

- [ ] Tests (AC: #1, #2)
  - [ ] Mock Ollama server (MSW ou `http` natif) : test `complete()` reçoit les chunks en streaming
  - [ ] `ECONNREFUSED` → `LLMUnavailableError` levée (pas d'exception non typée)
  - [ ] Test `health()` : Ollama disponible → `{available: true}`, indisponible → `{available: false}`

## Dev Notes

- **Package** : `@cop1/llm-intelligence` — feature `llm-gateway/`
- **Dépendances** : `@cop1/llm-intelligence` ne dépend d'aucun autre package cop1 (feuille de gauche dans le graphe, sauf shared-kernel pour les types communs éventuels).
- **NDJSON streaming** : Ollama retourne des lignes JSON séparées par `\n`. Chaque ligne est `{"model":..., "response":"token", "done":false}`. La dernière ligne a `"done":true`. Parser avec `TextDecoder` + split `\n`.
- **Port Ollama** : configurable via la config (E1-S3) plutôt que hardcodé à 11434. Lire depuis `ConfigPort` injecté.
- **Pas de dépendance SDK Ollama** : utiliser `fetch()` natif (Node 18+) pour garder le contrôle du streaming. Les SDKs Ollama/OpenAI introduisent des dépendances lourdes à éviter en Sprint 0.
- **Tests sans Ollama réel** : utiliser `vi.mock()` sur `fetch` ou un mock server léger (package `msw` si déjà présent, sinon mock natif).

### Project Structure Notes

```
packages/llm-intelligence/
  src/
    features/
      llm-gateway/
        domain/
          ports/
            LLMProvider.ts
          errors/
            LLMUnavailableError.ts
          types/
            LLMRequest.ts
            LLMChunk.ts
        application/
          LLMGateway.ts
        infrastructure/
          OllamaAdapter.ts
    index.ts                    # barrel public
```

### References

- [Source: architecture.md#ADR-005] — LLM Routing (LLMGateway est l'implémentation du port)
- [Source: architecture.md#Feature First Hexagonal] — barrel index.ts isolation
- [Source: epics.md#E5-S1] — ACs et points

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
