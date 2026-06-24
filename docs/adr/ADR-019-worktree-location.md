# ADR-019 — Emplacement des worktrees (sûr en session concurrente)

Statut : Accepté (2026-06-24, architecte) — affine ADR-018, ne le remplace pas.

## Contexte

ADR-018 a posé l'isolation par story via `git worktree`, mais a laissé un point
ouvert (cf. ses Conséquences : « à confirmer hors arbre versionné »).
`WorktreeManager.create` crée le worktree **dans l'arbre de travail** à
`join(projectPath, 'agent', <storyId>-<Date.now()>)`. Deux défauts pour la
concurrence :

1. **Emplacement in-tree et partagé.** Le dossier `agent/` vit sous l'arbre du
   repo. Deux sessions concurrentes sur le même `projectPath` (deux runs cop1,
   ou un humain/Claude dans le même repo) se voient, se scannent et se nettoient
   mutuellement, et le dossier pollue l'arbre versionné. Des band-aids existent
   déjà dans `.gitignore` (`agent/simulate-*/`, `.worktree/`) — symptôme du
   problème, pas une solution.
2. **Nommage `Date.now()` non collision-safe.** Deux `create()` quasi simultanés
   dans la même milliseconde produisent le même chemin.

Second site dupliquant le motif : `SprintRunner.createSimulateWorktree()`
(`join(this.projectPath, 'agent', simulate-<Date.now()>)`), pour
`cop1 sprint run --simulate`.

## Décision

- **Emplacement : option (b) — `<projectPath>/.cop1/worktrees/<runId>/<story>-<rand>`.**
  `.cop1/` est déjà la convention du projet pour l'état runtime (abort, logs,
  state, stories) et est **déjà gitignoré** (`.gitignore:27`). Les worktrees y
  vivent donc hors arbre versionné, restent sur le même filesystem (pas de
  copie cross-FS, `git worktree add` fiable), et restent **découvrables** au
  même endroit que les autres artefacts de debug — précieux pour les worktrees
  conservés on-failure (ADR-018). On écarte (a) `os.tmpdir()` (chemins
  illisibles, purges OS surprises, risque cross-FS) et (c) dossier frère hors
  repo (hors `.gitignore`, pollue le parent, surprenant).

- **Isolation par run : un `runId` unique calculé à la construction du
  `WorktreeManager`.** Le manager devient stateful : son constructeur fige une
  **base run-scoped** `<projectPath>/.cop1/worktrees/<runId>/` où
  `runId = crypto.randomUUID()`. Deux runs concurrents (chacun son
  `new WorktreeService()` dans `buildOrchestratorRun`) ne partagent jamais de
  base. C'est la racine de la sûreté concurrente : même collision de `storyId`,
  les chemins divergent par `runId`.

- **Nommage collision-proof : `crypto.randomUUID()` par story** en plus du
  `runId`. On supprime `Date.now()`. Suffixe court (`uuid.slice(0,8)`) suffit,
  collision négligeable et déjà cloisonnée par `runId`.

- **`WorktreePort` inchangé.** Signatures `create(projectPath, storyId)` /
  `cleanup(projectPath, worktreePath)` / `list(projectPath)` conservées : aucun
  churn côté `OrchestratorService` / `DevAgent`. Le `runId` est un détail
  d'implémentation du manager, pas du contrat.

- **Single source of truth du chemin.** Une fonction pure
  `worktreeBaseDir(projectPath, runId)` + `worktreePath(base, storyId)` dans
  l'infra dev-agent. `WorktreeManager` ET `SprintRunner.createSimulateWorktree`
  l'utilisent. `SprintRunner` cesse de dupliquer le `git worktree add` : il
  délègue à un `WorktreeManager` (storyId = `"simulate"`), supprimant le 2e site.

- **Contrat de cleanup / zéro orphelin (AC2).** `cleanup` doit : (1)
  `git worktree remove --force`, (2) `git worktree prune`, (3) supprimer la
  **base de run** si vide (`rmdir`, best-effort). Cohabitation avec le
  keep-on-failure d'ADR-018 : « zéro orphelin » signifie **zéro orphelin
  involontaire** — succès → cleanup intégral ; échec/escalade/abort → conservé
  **délibérément** sous `.cop1/worktrees/<runId>/` et tracé via
  `orchestrator.worktree.kept`. Les keeps sont donc localisés, gitignorés, et
  purgeables d'un `rm -rf .cop1/worktrees`. La base run-scoped n'est jamais
  supprimée tant qu'un worktree conservé y subsiste.

## Conséquences

- Deux sessions concurrentes sur le même repo n'entrent plus en collision :
  bases disjointes par `runId`, chemins par story uniques, plus rien dans
  l'arbre versionné.
- `.gitignore` peut être nettoyé (`agent/simulate-*/`, `.worktree/`,
  `agent/`) une fois les deux sites migrés — band-aids devenus inutiles.
- Un worktree conservé reste trouvable sous `.cop1/worktrees/<runId>/` ;
  purge groupée triviale.
- `WorktreeManager` devient stateful (base par instance) : il **doit** être
  construit une fois par run (déjà le cas). Documenté pour éviter qu'un appelant
  le partage entre runs.
- Contrat `WorktreePort` stable → migration sans toucher aux appelants.
