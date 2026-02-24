# Story E3-S2: LLM Routing per Command

Status: done
Sprint: 0

## Story

As a System, I want to route each agent command to a specific LLM model based on configuration rules, so that each agent type uses the optimal LLM for its task (dev → Mistral, reviewer → Llama, etc.).

## Acceptance Criteria

- AC1: Le LLMRouter lit la configuration `llm_routing` depuis ConfigPort
- AC2: Chaque type de commande (dev, reviewer, qa, pm) peut être associé à un modèle LLM différent
- AC3: Un modèle `default` est utilisé si aucun routing spécifique n'est configuré pour un type
- AC4: Erreur explicite si aucun routing et aucun default ne sont définis
- AC5: Le routing supporte le hot-reload de configuration

## Dev Notes

- Package: `@cop1/llm-intelligence`
- Fichiers principaux :
  - `packages/llm-intelligence/src/features/llm-gateway/application/LLMRouter.ts`
  - `packages/llm-intelligence/src/features/llm-gateway/__tests__/LLMRouter.test.ts`
- Configuration : section `llm_routing` dans `cop1.config.yaml` (ex: `{ dev: 'mistral:7b', reviewer: 'llama3.2', default: 'llama3:8b' }`)
- FR associés : FR7, FR15

## Dev Agent Record

Story implémentée sans fichier story formel. Fichier créé rétroactivement le 2026-02-24 pour cohérence du backlog.
