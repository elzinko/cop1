# Story E1.S2: cop1 CLI Daemon

Status: ready-for-dev

## Story

As a Developer,
I want to control the cop1 daemon via CLI commands (start, stop, pause, resume, status, health),
so that I can manage autonomous sprint sessions without dealing with process management manually.

## Acceptance Criteria

1. `cop1 start` démarre le daemon en arrière-plan (PID file dans `.cop1/daemon.pid`), retourne 0 en < 30s (NFR3).
2. `cop1 stop` arrête proprement le daemon (SIGTERM → cleanup → exit 0) et supprime le PID file.
3. `cop1 status` retourne `running` ou `stopped` avec le PID. `cop1 health` retourne JSON `{status, uptime, version}`.

## Tasks / Subtasks

- [ ] Créer l'entrée CLI dans `packages/app/src/cli/` (AC: #1, #2, #3)
  - [ ] Installer `commander` comme dépendance de `@cop1/app`
  - [ ] `packages/app/src/cli/index.ts` — point d'entrée principal avec les sous-commandes
  - [ ] Ajouter `bin: { cop1: './dist/cli/index.js' }` dans `package.json` de `@cop1/app`

- [ ] Implémenter `cop1 start` (AC: #1)
  - [ ] Vérifier si un daemon tourne déjà (lire PID file) — si oui, erreur explicite
  - [ ] `spawn()` le process daemon en arrière-plan (détaché, stdio: 'ignore')
  - [ ] Écrire `.cop1/daemon.pid` avec le PID du process fils
  - [ ] Poll `/health` (HTTP) jusqu'à 200 ou timeout 30s — retourner exit code 1 si timeout
  - [ ] Afficher `cop1 started (pid: {N})` au succès

- [ ] Implémenter `DaemonService` dans `packages/app/src/daemon/` (AC: #1, #2)
  - [ ] `DaemonService.start()` — initialise le serveur HTTP interne, écoute sur port configurable (défaut 4242)
  - [ ] Handler SIGTERM : cleanup propre (ferme connexions, flush logs) puis `process.exit(0)`
  - [ ] Supprimer `.cop1/daemon.pid` au shutdown
  - [ ] Uptime tracké depuis le démarrage

- [ ] Implémenter `cop1 stop` (AC: #2)
  - [ ] Lire `.cop1/daemon.pid` — si absent, afficher `cop1 is not running`
  - [ ] Envoyer SIGTERM au PID lu
  - [ ] Attendre la suppression du PID file (poll 100ms, timeout 10s) — confirmer l'arrêt

- [ ] Implémenter `cop1 status` et `cop1 health` (AC: #3)
  - [ ] `cop1 status` : lire PID file + vérifier si le process est vivant → afficher `running (pid: N)` ou `stopped`
  - [ ] `cop1 health` : appel `GET /health` HTTP → afficher JSON `{status: 'ok', uptime: Ns, version: '0.1.0'}`
  - [ ] `GET /health` endpoint dans le serveur HTTP du daemon

- [ ] Tests (AC: #1, #2, #3)
  - [ ] Test unitaire `DaemonService` : démarrage + SIGTERM → cleanup appelé
  - [ ] Test unitaire PID file : write → read → delete
  - [ ] Test d'intégration CLI `cop1 start` + `cop1 stop` (avec daemon mocké)

## Dev Notes

- **Package** : `@cop1/app` — feature `daemon/` dans `src/features/daemon/`
- **Serveur HTTP** : utiliser le module `http` natif Node.js pour le daemon interne (pas d'Express en Sprint 0 — introduit plus tard pour la Web UI). Ce serveur sert uniquement `/health` pour l'instant.
- **PID file** : écrire dans `.cop1/` du répertoire courant (le projet cible). Le répertoire `.cop1/` est créé par `cop1 init` (E1-S4) — ici, le créer si absent.
- **Port** : configurable via `cop1.config.yaml` ou variable d'environnement `COP1_PORT` (défaut 4242).
- **NFR3** : le daemon doit démarrer en < 30s. En Sprint 0 il n'y a pas de modèle LLM à charger, donc le démarrage est immédiat. La contrainte de 30s devient critique en Sprint 1 avec Ollama.

### Project Structure Notes

```
packages/app/
  src/
    features/
      daemon/
        domain/
          DaemonState.ts        # types: DaemonStatus, PidInfo
        application/
          DaemonService.ts      # start(), stop(), health()
        infrastructure/
          PidFileManager.ts     # write/read/delete .cop1/daemon.pid
          HttpServer.ts         # serveur HTTP interne (/health)
    cli/
      index.ts                  # entrypoint CLI (commander)
      commands/
        start.ts
        stop.ts
        status.ts
        health.ts
```

### References

- [Source: architecture.md#ADR-002] — SSE + REST pour daemon ↔ Web UI (le serveur HTTP sera étendu en Sprint 3)
- [Source: architecture.md#Feature First Hexagonal] — structure domain/application/infrastructure
- [Source: epics.md#E1-S2] — ACs et points

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
