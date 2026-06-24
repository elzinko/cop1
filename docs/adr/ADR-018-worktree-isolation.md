# ADR-018 — Isolation worktree par story

Statut : Accepté (2026-06-20, sprint-builder — architecte)

## Contexte

Un run de nuit enchaîne les stories d'un epic dans une seule boucle. Aujourd'hui
chaque commande BMAD s'exécute avec `cwd = projectRoot` (l'arbre de travail
principal). Une story qui dérape (suppression, `git reset`, fichiers corrompus)
contamine donc l'arbre principal ET les stories suivantes. On veut isoler chaque
story dans un **git worktree dédié** : le code part dans le worktree, une mauvaise
story ne touche que le sien.

Tension à trancher : `dev-story` édite à la fois le **code** ET des **artefacts
`_bmad-output`** (statut de la story, sessions). Or `sprint-status.yaml` est
**transverse aux stories** et vit dans l'arbre principal — c'est lui qui pilote la
boucle. L'isoler dans un worktree par story le fragmenterait et imposerait un
merge-back conflictuel.

Briques existantes réutilisables : `WorktreePort` (domaine, `create/cleanup/list`),
`WorktreeService` (application), `WorktreeManager` (infra, `git worktree add/remove`).

## Décision

- **Frontière (b) — isoler le code, garder le statut dans l'arbre principal.**
  Le `worktreePath` est passé au **runner** comme `projectRoot` (donc à
  `bmadContext.projectPath` → `cwd` de la session SDK) : BMAD édite le code et ses
  artefacts de session dans le worktree. Mais `OrchestratorService` continue de
  lire/écrire `sprint-status.yaml` et de mirrorer `<storyKey>.md` depuis
  `options.projectRoot` (arbre principal). Ce découplage existe déjà dans le code :
  la boucle calcule `statusPath` à partir de `options.projectRoot`, indépendamment
  du `projectRoot` transmis au runner. On ne casse aucun invariant.

- **Port injecté, pas de git en dur.** `OrchestratorService` reçoit un
  `worktreePort?: WorktreePort` optionnel (DIP). Aucun `execSync`/`git` dans la
  couche application. Absent → comportement V1.1 inchangé (`projectRoot` direct).

- **Lifecycle : create par story / cleanup-on-success / keep-on-failure.**
  En tête de chaque story : `create(projectRoot, storyKey)`. À la fin : si la story
  finit `done`/succès → `cleanup`. Si échec, escalade ou abort → on **garde** le
  worktree (debug) et on émet `orchestrator.worktree.kept`. La création du worktree
  est dans un `try` ; un échec de `create` bloque la story (status `blocked`) sans
  contaminer l'arbre principal.

- **Merge-back : DIFFÉRÉ.** Le code de la story reste dans la branche du worktree.
  Pas de merge automatique vers l'arbre principal (les conflits transverses entre
  stories sont un sujet à part entière, hors POC). L'intégration reste manuelle /
  sujet d'un ADR ultérieur.

- **Garde-fous : `disallowedTools` SANS `dontAsk`.** On ajoute aux `Options` SDK un
  `disallowedTools` (ex. `Bash(rm *)`, `Bash(git reset --hard *)`,
  `Bash(git clean *)`). On NE passe PAS `permissionMode: 'dontAsk'` : il
  court-circuite `canUseTool`, ce qui casserait l'interception `AskUserQuestion`
  (Q&A superviseur). On garde `canUseTool` et on y ajoute un **deny défensif**
  (refus des patterns destructeurs en plus de `disallowedTools`), ceinture et
  bretelles.

Alternatives écartées :
- (a) Tout dans le worktree + merge-back auto — conflits transverses sur
  `sprint-status.yaml` et le code, trop complexe pour un POC.
- (c) Un worktree par epic (pas par story) — ne protège pas les stories entre elles,
  c'est l'objectif premier.
- `permissionMode: 'dontAsk'` pour les garde-fous — casse la Q&A superviseur.

## Conséquences

- Une mauvaise story est confinée à son worktree ; l'arbre principal et les autres
  stories restent sains. Le statut reste centralisé et lisible en continu.
- Worktrees d'échec conservés = matière à debug, mais nécessitent un `git worktree
  prune` manuel périodique (accepté pour le POC). L'emplacement (`<projectPath>/agent/...`,
  in-tree et non collision-safe) est **affiné par ADR-019** : worktrees sous
  `<projectPath>/.cop1/worktrees/<runId>/...` (gitignoré, run-scoped, sûr en concurrence).
- Le code des stories n'est pas intégré automatiquement (merge-back différé) :
  acceptable pour un run de nuit dont on inspecte les résultats au réveil.
- Rétro-compatible : sans `worktreePort`, la boucle fonctionne comme avant.
- Les garde-fous réduisent le risque destructeur sans sacrifier le Q&A superviseur.
