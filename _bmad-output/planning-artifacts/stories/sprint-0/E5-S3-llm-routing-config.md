# Story E5.S3: LLM Routing Config

Status: ready-for-dev

## Story

As a Developer,
I want to configure which LLM model handles each type of agent command in `cop1.config.yaml`,
so that I can route complex tasks to powerful models and simple tasks to fast models without touching code.

## Acceptance Criteria

1. `cop1.config.yaml` accepte une section `llm_routing` avec des règles `{command_type: model_id}` — chaque type de commande agent est routé vers le LLM configuré.
2. Changement de routing à chaud (hot-reload E1-S3) → la prochaine commande agent utilise le nouveau modèle sans redémarrage.

## Tasks / Subtasks

- [ ] Étendre le schéma Zod de `cop1.config.yaml` (AC: #1) — dépend de E1-S3
  - [ ] Section `llm_routing: Record<string, string>` — ex. `{ dev: 'mistral:7b', review: 'llama3:8b', ceremony: 'mistral:7b' }`
  - [ ] Section `llm_fallback: Record<string, string>` — modèle de fallback par type (pour E5-S6 en Sprint 4)
  - [ ] Valeur par défaut : `{}` (aucun routing configuré = tous les agents utilisent `llm_routing.default`)
  - [ ] Champ `llm_routing.default` obligatoire si la section est présente

- [ ] Créer `LLMRouter` dans `packages/llm-intelligence/` (AC: #1, #2)
  - [ ] `src/features/llm-gateway/application/LLMRouter.ts`
  - [ ] `LLMRouter.route(commandType: string): string` — retourne le `model_id` configuré pour ce type
  - [ ] Fallback : si `commandType` absent dans la config → utilise `llm_routing.default`
  - [ ] `LLMRouter` consomme `ConfigPort` (injecté) — chaque appel à `route()` lit la config courante (hot-reload transparent)

- [ ] Intégrer `LLMRouter` dans `LLMGateway` (AC: #2) — dépend de E5-S1
  - [ ] `LLMGateway.completeForAgent(commandType, prompt, options?)` → appelle `LLMRouter.route(commandType)` pour obtenir le modèle → délègue à `LLMProvider`
  - [ ] Conserver `LLMGateway.complete(prompt, model)` pour les appels directs (tests, overrides)

- [ ] Exporter `LLMRouter` depuis le barrel `src/index.ts`

- [ ] Tests (AC: #1, #2)
  - [ ] Config avec `llm_routing: { dev: 'modelA', default: 'modelB' }` → `route('dev')` retourne `'modelA'`
  - [ ] `route('unknown-type')` → retourne `'modelB'` (fallback sur `default`)
  - [ ] Hot-reload : config modifiée (mock ConfigPort) → `route('dev')` retourne le nouveau modèle immédiatement

## Dev Notes

- **Package** : `@cop1/llm-intelligence` — feature `llm-gateway/`, même feature qu'E5-S1.
- **ConfigPort** : `LLMRouter` dépend de `ConfigPort` défini dans `@cop1/shared-kernel` (E1-S3). Cette dépendance est autorisée : `llm-intelligence` peut importer `shared-kernel`.
- **Command types standard** : définir les types dans un enum/const partagé dans `shared-kernel` : `LLMCommandType = { DEV: 'dev', REVIEW: 'review', CEREMONY: 'ceremony', QA: 'qa', PM: 'pm' }`. Les agents utilisent ces constantes plutôt que des strings libres.
- **Hot-reload** : `LLMRouter.route()` lit `ConfigPort.get()` à chaque appel — pas de cache interne. La config est déjà en mémoire dans `ConfigPort` (E1-S3), donc pas de I/O sur chaque appel.

### Project Structure Notes

```
packages/
  shared-kernel/
    src/
      features/
        llm/
          domain/
            LLMCommandType.ts   # enum des types de commandes

  llm-intelligence/
    src/
      features/
        llm-gateway/
          application/
            LLMGateway.ts       # étendu avec completeForAgent()
            LLMRouter.ts        # NOUVEAU
```

### References

- [Source: architecture.md#ADR-005] — LLM Routing via Config YAML + PM Agent
- [Source: epics.md#E5-S3] — ACs et points
- [Source: stories/sprint-0/E1-S3-config-hot-reload.md] — ConfigPort (dépendance directe)
- [Source: stories/sprint-0/E5-S1-llm-gateway-ollama.md] — LLMGateway (dépendance directe)

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
