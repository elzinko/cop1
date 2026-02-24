# Story E3.S15: Worktree Execution Mode

Status: ready-for-dev

## Story

As a Developer,
I want to run a sprint with `--simulate` in an isolated git worktree with real LLM agents,
so that I can verify the full sprint execution (real code generation, real code review) without auto-merging to main — I inspect the result and merge manually.

## Acceptance Criteria

1. `cop1 sprint run --simulate` crée un git worktree isolé via `WorktreeManager`, exécute le sprint complet avec vrais agents LLM (DevAgent via Ollama, ReviewerAgent via Ollama) — le code est réellement généré et commité dans le worktree.
2. `git.auto_merge: false` est respecté — aucun merge automatique vers main. Le worktree reste intact pour inspection manuelle. `cop1 sprint status` indique les branches worktree en attente de merge.
3. Un log d'exécution détaillé est affiché en console : chaque story traitée avec transitions, chaque workflow step avec résultat (code généré, verdict review), résumé final (done/failed/skipped, durée).

## Tasks / Subtasks

- [ ] Modifier commande CLI `sprint-run.ts`
  - [ ] Ajouter option `--simulate` (boolean flag)
  - [ ] Si `--simulate` + `--dry-run` → erreur (mutuellement exclusifs)
  - [ ] Si `--simulate` : afficher message "Worktree execution mode — running in isolated worktree"

- [ ] Modifier `SprintRunner`
  - [ ] Si `--simulate` : créer un worktree dédié pour la session sprint (pas par story, pour la session entière)
  - [ ] Passer le worktree path comme `projectPath` au workflow
  - [ ] Après exécution : NE PAS merger, NE PAS cleanup le worktree
  - [ ] Afficher le chemin du worktree pour inspection

- [ ] Intégrer avec `WorktreeManager`
  - [ ] Créer worktree nommé `simulate-{timestamp}` sous `agent/`
  - [ ] Copier `.cop1/sprint-status.yaml` dans le worktree
  - [ ] S'assurer que les stories BMAD sont accessibles depuis le worktree

- [ ] Log d'exécution détaillé
  - [ ] Chaque story : transitions de statut affichées
  - [ ] Chaque step : résultat affiché (code files generated, review verdict)
  - [ ] Résumé final : done/failed/skipped counts, durée totale

- [ ] Gestion `--simulate` + `--filter`
  - [ ] Compatible : simuler un subset de stories

- [ ] Tests
  - [ ] `--simulate` crée un worktree et exécute le sprint dedans
  - [ ] Aucun merge automatique vers main
  - [ ] `--simulate` + `--dry-run` → erreur
  - [ ] `--simulate` + `--filter` → fonctionne sur le subset
  - [ ] Le worktree est préservé après exécution

## Dev Notes

- **Package** : `@cop1/app` pour CLI + `SprintRunner`, `@cop1/sprint-core` pour `WorktreeManager`
- **Key insight** : `SprintRunner` prend `projectPath` — le simulate mode passe le worktree path. Le vrai `DevAgent` crée déjà des worktrees par story. En mode simulate, le worktree de session sert de "project root" et DevAgent crée des sub-worktrees dedans.
- **Différence avec --dry-run** : `--dry-run` = liste seulement. `--simulate` = exécution réelle en isolation.
- **Merge flow** : Le dev inspecte `agent/simulate-{timestamp}/`, review le code, puis `git merge` manuellement ou via un futur agent de merge qui demande validation.
- **Dépendance** : E3-S16 (Wire Real Agents) doit être complété avant — sinon on simule avec des stubs, ce qui n'a pas de valeur.
