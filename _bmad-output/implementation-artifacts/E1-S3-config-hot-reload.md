# Story E1.S3: cop1.config.yaml — Chargement et Hot-Reload

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to load and validate its configuration from `cop1.config.yaml` at startup and reload it automatically when I modify the file,
so that I can adjust settings (LLM routing, RAM budgets, schedules) without restarting the daemon.

## Acceptance Criteria

1. Au démarrage, `cop1.config.yaml` est chargé et validé (Zod schema) — erreur explicite avec le champ manquant si un champ obligatoire est absent.
2. Modification de `cop1.config.yaml` pendant que le daemon tourne → configuration rechargée en < 2s sans redémarrage (FR38).

## Tasks / Subtasks

- [ ] Définir le schéma Zod de `cop1.config.yaml` (AC: #1)
  - [ ] Section `project` : `name` (string), `path` (string)
  - [ ] Section `daemon` : `port` (number, défaut 4242)
  - [ ] Section `sprint` : `default_duration_hours` (number, défaut 8)
  - [ ] Section `resources` : `ram_budget_night_gb` (number, min 4, défaut 48), `ram_budget_day_gb` (number, min 4, défaut 20)
  - [ ] Section `llm_routing` : `Record<string, string>` (commandType → modelId) — optionnel en Sprint 0
  - [ ] Section `schedule` : `auto_start` (array optionnel)
  - [ ] Exporter le type `Cop1Config` depuis le schéma Zod

- [ ] Créer `ConfigLoader` dans `packages/app/src/features/config/` (AC: #1, #2)
  - [ ] `ConfigLoader.load(projectPath: string): Promise<Cop1Config>` — lit + parse YAML + valide Zod
  - [ ] Erreur de validation → `ConfigValidationError` avec le path du champ invalide et le message Zod
  - [ ] `ConfigLoader.watch(projectPath, callback)` — `fs.watch` sur `cop1.config.yaml` → debounce 500ms → reload + appel callback

- [ ] Exposer la config via un port domain (AC: #1)
  - [ ] Interface `ConfigPort` dans `shared-kernel/src/features/config/domain/ports/ConfigPort.ts`
  - [ ] `ConfigPort.get(): Cop1Config` — retourne la config courante (en mémoire, déjà validée)
  - [ ] `DaemonService` injecte `ConfigPort` au démarrage

- [ ] Intégrer le hot-reload dans le daemon (AC: #2)
  - [ ] `DaemonService.start()` appelle `ConfigLoader.watch()` et met à jour la config en mémoire
  - [ ] Événement `config.reloaded` émis sur l'EventBus interne à chaque rechargement réussi
  - [ ] Rechargement avec erreur de validation → log d'erreur, config précédente conservée (pas de crash)

- [ ] Installer dépendance YAML (AC: #1)
  - [ ] Ajouter `js-yaml` (ou `yaml`) dans `@cop1/app`
  - [ ] Typer le parsing YAML → Zod (pas de `as any`)

- [ ] Tests (AC: #1, #2)
  - [ ] Config valide → chargement correct, tous les champs accessibles avec les bonnes valeurs par défaut
  - [ ] Config invalide (champ manquant) → `ConfigValidationError` avec message lisible
  - [ ] Hot-reload : modifier le fichier (mock `fs.watch`) → callback appelé avec la nouvelle config en < 2s

## Dev Notes

- **Package** : `@cop1/app` pour `ConfigLoader`, `@cop1/shared-kernel` pour `ConfigPort`
- **Dépendance YAML** : préférer `yaml` (npm) plutôt que `js-yaml` — meilleur support TypeScript, ESM natif.
- **Debounce** : les éditeurs modifient les fichiers en plusieurs passes (save atomique) — debounce 500ms évite les rechargements multiples sur une seule sauvegarde.
- **Config par défaut** : si `cop1.config.yaml` est absent, utiliser des valeurs par défaut sensibles (pas d'erreur au démarrage — log d'avertissement uniquement).
- **Zod** : utiliser `z.infer<typeof ConfigSchema>` pour le type `Cop1Config` — pas de type dupliqué à maintenir.

### Project Structure Notes

```
packages/
  shared-kernel/
    src/
      features/
        config/
          domain/
            ports/
              ConfigPort.ts     # interface ConfigPort
  app/
    src/
      features/
        config/
          domain/
            ConfigValidationError.ts
          application/
            ConfigLoader.ts     # load() + watch()
          infrastructure/
            YamlFileReader.ts   # lecture fichier YAML
```

### References

- [Source: architecture.md#ADR-001] — Persistance YAML (cop1.config.yaml est du même type)
- [Source: architecture.md#ADR-006] — Feature First : ConfigPort dans shared-kernel, ConfigLoader dans app
- [Source: epics.md#E1-S3] — ACs et points

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
