# Story E7.S4: Resource Config

Status: ready-for-dev

## Story

As a Developer,
I want to configure RAM budget thresholds for night and day sprint sessions in `cop1.config.yaml`,
so that cop1 never consumes more RAM than I've allocated in each context.

## Acceptance Criteria

1. `cop1.config.yaml` accepte `resources.ram_budget_night_gb` (défaut 48) et `resources.ram_budget_day_gb` (défaut 20) — les valeurs sont chargées par ResourceMonitor au démarrage.
2. Budget invalide (< 4 ou > RAM totale détectée) → erreur de validation au démarrage avec message explicite.

## Tasks / Subtasks

- [ ] Étendre le schéma Zod de `cop1.config.yaml` (AC: #1) — dépend de E1-S3
  - [ ] Sous `resources` : `ram_budget_night_gb: z.number().min(4).default(48)`
  - [ ] Sous `resources` : `ram_budget_day_gb: z.number().min(4).default(20)`
  - [ ] Sous `resources` : `suspension_threshold_percent: z.number().min(50).max(95).default(75)`
  - [ ] Sous `resources` : `polling_interval_ms: z.number().min(500).default(1000)`

- [ ] Ajouter la validation RAM totale dans `ConfigLoader` (AC: #2) — dépend de E1-S3, E7-S1
  - [ ] Après parsing Zod, vérifier `ram_budget_night_gb <= os.totalmem() / 1e9` — si non, `ConfigValidationError` avec `"ram_budget_night_gb (${N}GB) dépasse la RAM totale disponible (${total}GB)"`
  - [ ] Même validation pour `ram_budget_day_gb`

- [ ] Exposer le budget actif dans `ResourceMonitorPort` (AC: #1)
  - [ ] Étendre `ResourceMonitorPort` avec `getActiveBudgetGB(): number` — retourne `night` ou `day` selon le mode courant
  - [ ] `ResourceMonitorService` détermine le mode courant (night par défaut en Sprint 0 — day sprint en E7-S5)

- [ ] Intégrer les budgets dans `ResourceMonitorService` (AC: #1)
  - [ ] `ResourceMonitorService` lit `ConfigPort.get().resources` au démarrage et à chaque `config.reloaded`
  - [ ] `getActiveBudgetGB()` retourne le budget correspondant au mode actuel

- [ ] Tests (AC: #1, #2)
  - [ ] Config avec `ram_budget_night_gb: 32` → `ResourceMonitorService.getActiveBudgetGB()` retourne `32`
  - [ ] Config avec `ram_budget_night_gb: 3` → `ConfigValidationError` levée (< 4)
  - [ ] Config avec `ram_budget_night_gb: 9999` → `ConfigValidationError` levée (> RAM totale mockée)
  - [ ] Hot-reload : budget modifié → service retourne le nouveau budget immédiatement

## Dev Notes

- **Package** : extension du schema dans `@cop1/app` (ConfigLoader), extension de port dans `@cop1/shared-kernel` (ResourceMonitorPort).
- **Mode night/day** : en Sprint 0, le mode est toujours `night` (le day sprint mode arrive en E7-S5 Sprint 3). `getActiveBudgetGB()` retourne donc toujours `ram_budget_night_gb` pour l'instant.
- **Validation dynamique** : la validation `> RAM totale` doit utiliser `os.totalmem()` au moment du démarrage (valeur fixe). En CI, la RAM totale peut être faible (4-8GB) — prévoir un mode `SKIP_RAM_VALIDATION=true` pour les environnements CI.
- **Suspension threshold** : `suspension_threshold_percent` (défaut 75%) sera utilisé par E7-S2 (Sprint 2). Le stocker dans la config ici pour ne pas avoir à modifier ce fichier en Sprint 2.

### Project Structure Notes

- Modification de `packages/shared-kernel/src/features/resources/domain/ports/ResourceMonitorPort.ts` (ajout `getActiveBudgetGB()`)
- Modification de `packages/app/src/features/config/application/ConfigLoader.ts` (validation RAM totale)
- Modification de `packages/app/src/features/resources/application/ResourceMonitorService.ts` (lecture budget config)

### References

- [Source: architecture.md#Resource Management] — NFR11, NFR14, NFR15
- [Source: epics.md#E7-S4] — ACs et points
- [Source: stories/sprint-0/E1-S3-config-hot-reload.md] — ConfigLoader (dépendance directe)
- [Source: stories/sprint-0/E7-S1-resource-monitor.md] — ResourceMonitorPort (dépendance directe)

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
