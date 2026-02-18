# Story E5.S8: LLM Agent Adapters

Status: ready-for-dev

## Story

As a Developer,
I want concrete implementations of `CodeGeneratorPort` and `ReviewerPort` that use `LLMGateway` with Ollama,
so that DevAgent and ReviewerAgent can generate real code and real reviews via LLM.

## Acceptance Criteria

1. `LLMCodeGenerator` implémente `CodeGeneratorPort.generate(prompt)` en appelant `LLMGateway.completeForAgent('dev', prompt)`, collectant le stream complet, et retournant la réponse string.
2. `LLMReviewer` implémente `ReviewerPort.review(qualityReport)` en appelant `LLMGateway.completeForAgent('reviewer', qualityReport)`, parsant la réponse en `ReviewResult { verdict, comments }`.
3. Les deux adapters sont testés avec un `LLMProvider` mock retournant des réponses prédéfinies — aucune dépendance Ollama réelle dans les tests unitaires.

## Tasks / Subtasks

- [ ] Créer `LLMCodeGenerator` dans `@cop1/llm-intelligence`
  - [ ] Fichier : `packages/llm-intelligence/src/features/llm-gateway/infrastructure/LLMCodeGenerator.ts`
  - [ ] Implémente `CodeGeneratorPort` (importé depuis `@cop1/sprint-core`)
  - [ ] Constructor prend `LLMGateway`
  - [ ] `generate(prompt)` : appelle `gateway.completeForAgent('dev', prompt)`, itère le stream async, concatène les chunks `.text`, retourne le string complet

- [ ] Créer `LLMReviewer` dans `@cop1/llm-intelligence`
  - [ ] Fichier : `packages/llm-intelligence/src/features/llm-gateway/infrastructure/LLMReviewer.ts`
  - [ ] Implémente `ReviewerPort` (importé depuis `@cop1/sprint-core`)
  - [ ] Constructor prend `LLMGateway`
  - [ ] `review(qualityReport)` : appelle `gateway.completeForAgent('reviewer', qualityReport)`, itère le stream async, concatène, parse la réponse en `ReviewResult`
  - [ ] Parsing : chercher "approve" ou "request-changes" dans la réponse LLM, extraire les commentaires

- [ ] Exporter les deux adapters depuis `@cop1/llm-intelligence` barrel index

- [ ] Tests unitaires
  - [ ] Mock `LLMProvider` qui retourne des chunks prédéfinis
  - [ ] Test `LLMCodeGenerator.generate()` → retourne la réponse concaténée
  - [ ] Test `LLMReviewer.review()` → parse correctement approve/request-changes
  - [ ] Test `LLMReviewer.review()` avec réponse malformée → default approve avec warning

## Dev Notes

- **Package** : `@cop1/llm-intelligence` pour les adapters (côté infrastructure LLM)
- **Import cross-package** : `CodeGeneratorPort` et `ReviewerPort` sont dans `@cop1/sprint-core` — les adapters dans `@cop1/llm-intelligence` importent ces interfaces. C'est le sens correct de la dépendance (infra → domain ports).
- **Stream collection** : `LLMGateway.completeForAgent()` retourne `AsyncIterable<LLMChunk>` — utiliser `for await (const chunk of stream) { result += chunk.text; }` pour collecter.
- **Review parsing** : Garder simple — regex ou string matching sur la réponse LLM. Si la réponse ne contient pas de verdict clair, default à `approve` avec un commentaire `"LLM response did not contain clear verdict"`.
- **Pas de re-export des adapters dans le barrel public** — ils sont instanciés uniquement dans la composition root (`SprintRunner`).
