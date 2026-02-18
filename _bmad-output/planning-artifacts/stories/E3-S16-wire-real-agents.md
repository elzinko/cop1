# Story E3.S16: Wire Real Agents in SprintRunner

Status: ready-for-dev

## Story

As a Developer,
I want the SprintRunner composition root to use real DevAgent and ReviewerAgent backed by Ollama LLM instead of stubs,
so that `cop1 sprint run` actually generates code and reviews via LLM.

## Acceptance Criteria

1. `SprintRunner` instancie `OllamaAdapter`, `LLMGateway.withRouter(LLMRouter)`, puis crée `DevAgent(new LLMCodeGenerator(gateway))` et `ReviewerAgent(new LLMReviewer(gateway))` au lieu des stubs — vérifié par inspection du code.
2. `cop1 sprint run --dry-run` continue de fonctionner sans aucun appel LLM.
3. `cop1 sprint run --filter "E3-S15"` sur une story de test appelle réellement Ollama — le DevAgent génère du code dans un worktree, le ReviewerAgent émet un verdict — les événements workflow sont émis sur l'EventBus.

## Tasks / Subtasks

- [ ] Modifier `SprintRunner.ts`
  - [ ] Importer `OllamaAdapter` depuis `@cop1/llm-intelligence`
  - [ ] Importer `LLMGateway`, `LLMRouter` depuis `@cop1/llm-intelligence`
  - [ ] Importer `LLMCodeGenerator`, `LLMReviewer` depuis `@cop1/llm-intelligence`
  - [ ] Importer `DevAgent` depuis `@cop1/sprint-core` (le vrai, pas le stub)
  - [ ] Importer `ReviewerAgent` depuis `@cop1/sprint-core` (le vrai, pas le stub)
  - [ ] Dans `run()` : instancier la chaîne LLM
    ```typescript
    const ollama = new OllamaAdapter();
    const gateway = new LLMGateway(ollama).withRouter(new LLMRouter(configLoader));
    const codeGenerator = new LLMCodeGenerator(gateway);
    const reviewer = new LLMReviewer(gateway);
    ```
  - [ ] Remplacer les stubs dans le tableau `steps` :
    ```typescript
    const steps = [
      new DevAgent(codeGenerator),
      new ReviewerAgent(reviewer),
      new QAAgentStep(),  // reste stub pour l'instant
      new PMAgentStep(),  // reste stub pour l'instant
    ];
    ```

- [ ] Vérifier que `ConfigLoader` implémente `ConfigPort`
  - [ ] `LLMRouter` prend `ConfigPort` — vérifier que `ConfigLoader` satisfait cette interface
  - [ ] Si non, créer un petit adapter ou faire implémenter l'interface

- [ ] S'assurer que dry-run ne touche pas Ollama
  - [ ] Le code existant retourne avant la boucle de stories si `options.dryRun` — donc les agents ne sont jamais appelés en dry-run
  - [ ] Vérifier que l'instanciation de `OllamaAdapter` ne fait pas d'appel réseau au constructeur (c'est le cas — constructeur ne fait rien)

- [ ] Tests
  - [ ] Test d'intégration : `SprintRunner.run()` avec mock LLMProvider → DevAgent génère du code, ReviewerAgent approuve
  - [ ] Test dry-run : aucun appel LLM
  - [ ] Test événements : vérifier que les events workflow sont émis (story.workflow.started, step.completed, etc.)

## Dev Notes

- **Package** : `@cop1/app` — c'est la composition root, le seul endroit autorisé à instancier les adapters concrets
- **QAAgentStep + PMAgentStep** : restent des stubs pour l'instant. Ils seront câblés dans des stories futures.
- **ConfigPort** : `LLMRouter` dépend de `ConfigPort` qui expose `get(): Cop1Config`. Vérifier si `ConfigLoader` peut servir directement ou s'il faut un adapter.
- **Pas de DI container** : tout est instancié manuellement dans `SprintRunner.run()` — c'est le pattern existant, on le conserve.
- **Impact tests existants** : les tests qui utilisent `SprintRunner` directement devront être mis à jour pour fournir un mock LLMProvider ou continuer à utiliser les stubs. Envisager un paramètre optionnel `steps` dans le constructeur pour l'injection en test.
