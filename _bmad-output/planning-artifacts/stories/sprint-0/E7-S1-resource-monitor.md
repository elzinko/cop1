# Story E7.S1: Resource Monitor

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to continuously monitor RAM and CPU usage on my machine,
so that the system can adapt agent load dynamically and never exceed my resource budget.

## Acceptance Criteria

1. `ResourceMonitor.snapshot()` retourne `{ramUsedGB, ramTotalGB, ramPercent, cpuPercent}` avec une latence < 1s (NFR4).
2. `ResourceMonitor.startPolling(intervalMs)` émet des événements `resource.snapshot` en continu — les tests vérifient que le polling s'arrête proprement sur `stop()`.

## Tasks / Subtasks

- [ ] Définir `ResourceMonitorPort` dans `packages/shared-kernel/` (AC: #1)
  - [ ] `src/features/resources/domain/ports/ResourceMonitorPort.ts`
  - [ ] Interface : `snapshot(): Promise<ResourceSnapshot>`, `startPolling(intervalMs: number): void`, `stop(): void`
  - [ ] Type `ResourceSnapshot { ramUsedGB: number, ramTotalGB: number, ramPercent: number, cpuPercent: number, timestamp: Date }`
  - [ ] Événement `resource.snapshot` dans un `ResourceEventType` enum

- [ ] Créer `SystemResourceAdapter` dans `packages/app/` (AC: #1, #2)
  - [ ] `src/features/resources/infrastructure/SystemResourceAdapter.ts`
  - [ ] Implémente `ResourceMonitorPort`
  - [ ] `snapshot()` : RAM via `process.memoryUsage()` + `os.totalmem()` / `os.freemem()`. CPU via `os.cpus()` (moyenne des loadavg sur 1 min)
  - [ ] `startPolling(intervalMs)` : `setInterval()` → appelle `snapshot()` → émet événement sur `EventBus`
  - [ ] `stop()` : `clearInterval()` — vérifié par test

- [ ] Créer `EventBus` interne dans `packages/shared-kernel/` (AC: #2)
  - [ ] `src/features/events/domain/EventBus.ts` — `EventEmitter` Node.js typé
  - [ ] `emit(eventType, payload)` et `on(eventType, handler)`
  - [ ] Singleton injectable via DI (pas de singleton global)

- [ ] Créer `ResourceMonitorService` application dans `packages/app/` (AC: #1, #2)
  - [ ] `src/features/resources/application/ResourceMonitorService.ts`
  - [ ] Orchestre `SystemResourceAdapter` + `EventBus`
  - [ ] Démarre le polling au démarrage du daemon (appelé par `DaemonService`)

- [ ] Tests (AC: #1, #2)
  - [ ] `snapshot()` retourne des valeurs numériques cohérentes (ramUsedGB > 0, ramTotalGB > ramUsedGB)
  - [ ] `startPolling(100)` → après 300ms → au moins 2 événements `resource.snapshot` reçus
  - [ ] `stop()` → après stop → plus aucun événement émis (vérifier avec vi.useFakeTimers)
  - [ ] Latence : `snapshot()` complète en < 100ms (bien en-dessous du seuil 1s)

## Dev Notes

- **Package** : `ResourceMonitorPort` dans `@cop1/shared-kernel`, `SystemResourceAdapter` et `ResourceMonitorService` dans `@cop1/app`.
- **RAM measurement** : `os.totalmem()` donne la RAM totale, `os.freemem()` la RAM libre. `ramUsedGB = (totalmem - freemem) / 1e9`. Note : cela inclut la RAM utilisée par tous les process, pas seulement cop1.
- **CPU measurement** : `os.cpus()` retourne les ticks par core. Pour le pourcentage CPU, calculer la différence entre deux snapshots (idle vs total ticks). Alternative simple pour Sprint 0 : utiliser `os.loadavg()[0]` / `os.cpus().length` × 100 comme approximation.
- **EventBus** : utiliser `EventEmitter` de Node.js plutôt qu'une lib externe. Typer les événements avec des génériques pour éviter les strings libres.
- **DaemonService integration** : `ResourceMonitorService.startPolling()` est appelé dans `DaemonService.start()` juste après le démarrage du serveur HTTP.

### Project Structure Notes

```
packages/
  shared-kernel/
    src/
      features/
        resources/
          domain/
            ports/
              ResourceMonitorPort.ts
            types/
              ResourceSnapshot.ts
        events/
          domain/
            EventBus.ts
            EventType.ts

  app/
    src/
      features/
        resources/
          application/
            ResourceMonitorService.ts
          infrastructure/
            SystemResourceAdapter.ts
```

### References

- [Source: architecture.md#Feature First Hexagonal] — ResourceMonitorPort dans shared-kernel, adapter dans app
- [Source: epics.md#E7-S1] — ACs, NFR4, NFR13
- [Source: stories/sprint-0/E1-S2-cop1-cli-daemon.md] — DaemonService (point d'intégration)

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
