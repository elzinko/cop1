# Story E3.S5: DevAgent

Status: ready-for-dev

## Story

As a Developer,
I want a DevAgent that generates code in an isolated git worktree using LLM,
so that cop1 can autonomously produce code for stories without affecting the main branch.

## Acceptance Criteria

1. `DevAgent.run(snapshot)` crée un git worktree isolé `agent/{storyId}-{timestamp}`, produit du code, et crée des commits avec messages conventionnels (`feat:`, `fix:`, `chore:`).
2. Le worktree est créé à partir de `HEAD` de la branche principale — `git log` dans le worktree montre l'historique récent de main.
3. DevAgent ne modifie aucun fichier en dehors de son worktree — vérifié par test d'isolation filesystem.

## Tasks / Subtasks

- [ ] Créer `DevAgent` comme WorkflowStep dans sprint-core
  - [ ] `infrastructure/steps/DevAgentStep.ts` — remplace le stub Sprint 0
  - [ ] Crée un worktree git : `git worktree add agent/{storyId}-{ts} HEAD`
  - [ ] Analyse la story snapshot pour comprendre les tâches
  - [ ] Appelle LLMGateway.completeForAgent('dev', prompt) pour générer du code
  - [ ] Écrit les fichiers dans le worktree
  - [ ] Commit avec messages conventionnels

- [ ] Créer `WorktreeManager` infrastructure
  - [ ] `create(projectPath, storyId)` — crée le worktree isolé
  - [ ] `cleanup(worktreePath)` — supprime le worktree
  - [ ] `list()` — liste les worktrees existants

- [ ] Prompt engineering
  - [ ] Template de prompt pour le DevAgent (story → code)
  - [ ] Parse la réponse LLM pour extraire les fichiers à créer/modifier

- [ ] Tests (sans LLM réel — mock LLMGateway)
  - [ ] DevAgent crée un worktree et y fait un commit
  - [ ] Le worktree est basé sur HEAD
  - [ ] Aucun fichier modifié en dehors du worktree (isolation test)
  - [ ] Commit message suit la convention conventionnelle

## Dev Notes

- **Package** : `@cop1/sprint-core` pour DevAgent, `@cop1/app` pour WorktreeManager
- **LLM** : mock en Sprint 1 pour les tests. En situation réelle, nécessite Ollama running.
- **Git worktree** : `child_process.execSync('git worktree add ...')`. Cleanup avec `git worktree remove`.
- **Isolation** : le worktree est dans un sous-répertoire `agent/` — jamais dans le répertoire du projet principal.
