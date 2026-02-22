# Story E1.S6: cop1.config.yaml for M3 Max

Status: ready-for-dev

## Story

As a Developer,
I want a `cop1.config.yaml` file at the project root with LLM routing configured for my MacBook Pro M3 Max 64GB,
so that the LLMRouter can route agent commands to Ollama models.

## Acceptance Criteria

1. `cop1.config.yaml` existe à la racine du projet avec `llm_routing: { default: "llama3.2", dev: "llama3.2", reviewer: "llama3.2" }` — `ConfigLoader.load()` le charge sans erreur de validation.
2. Les budgets RAM sont configurés pour M3 Max 64GB : `ram_budget_night_gb: 48`, `ram_budget_day_gb: 20`, `git.auto_merge: false`.

## Tasks / Subtasks

- [ ] Créer `cop1.config.yaml` à la racine du projet
  - [ ] Section `project: { name: cop1, path: "." }`
  - [ ] Section `sprint: { default_duration_hours: 2 }` (sessions courtes pour itérer)
  - [ ] Section `resources: { ram_budget_night_gb: 48, ram_budget_day_gb: 20, suspension_threshold_percent: 75, polling_interval_ms: 1000 }`
  - [ ] Section `llm_routing: { default: "llama3.2", dev: "llama3.2", reviewer: "llama3.2" }`
  - [ ] Section `llm_fallback: { default: "llama3.2" }`
  - [ ] Section `git: { auto_merge: false }`

- [ ] Vérifier que ConfigLoader + ConfigSchema (Zod) valident sans erreur
  - [ ] `pnpm test` continue de passer (les tests existants utilisent `skipRamValidation: true`)

- [ ] Ajouter `cop1.config.yaml` dans `.gitignore` (contient potentiellement des paths locaux)
  - [ ] Ou alternativement, commiter un `cop1.config.example.yaml` et gitignorer le vrai

## Dev Notes

- **Package** : racine du projet (fichier de config)
- **ConfigSchema** : déjà défini dans `packages/app/src/features/config/domain/ConfigSchema.ts` — tous les champs ont des defaults Zod, donc un fichier minimal suffit
- **Modèle LLM** : `llama3.2` est le choix par défaut — peut être changé selon les modèles Ollama installés (`ollama list` pour vérifier)
- **Validation** : le schema Zod exige `llm_routing.default` si `llm_routing` est non-vide (voir refine dans ConfigSchema)
