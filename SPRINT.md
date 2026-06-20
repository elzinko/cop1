# Sprint 1 — Model tiering sur le chemin de run live
Périmètre : 1 feature (POC), borné.   Statut : en attente de validation (checkpoint sprint 1)

## Backlog  (1 ligne = 1 feature = 1 PR)
- [x] feat: model tiering Opus/Sonnet par commande BMAD      (committé — gate verte, revue GO, en attente PR)
- [ ] feat: gate de vérif tests/lint avant transition         (sprint 2)
- [ ] feat: budget + kill-switch                              (sprint 3)
- [ ] feat: isolation worktree dans la boucle                 (sprint 4)
- [ ] chore: run réel contrôlé sur petit epic                 (sprint 5)
- [ ] feat: NightScheduler + tier B local (LiteLLM→Ollama)    (sprint 6)

## Definition of Done (sprint 1)
- `ModelTierRouter` (domaine, testé) : commande BMAD → tier modèle.
- `AgentSdkSessionAdapter` applique `options.model` par session (réutilisé sur les tours de suivi).
- Wiring par défaut dans l'orchestrateur (run réel tiéré).
- Rétro-compatible : sans router, aucun champ `model` (comportement inchangé).
- Gate locale verte : typecheck + test + lint.
- Revue GO. 1 PR, squash-merge, conventional commit.

## Notes / décisions  (ADR courts)
- ADR-015 (docs/adr) : la *politique* de tier vit dans le domaine (pure, BMAD-aware) ;
  l'*application* (`options.model`) dans l'adapter SDK. `BMADSessionPort` inchangé → orchestrateur model-agnostic.
- Tier par défaut cost-aware : create-story/code-review → opus ; dev-story/qa + inconnu → sonnet (fallback).
- Tier B (LLM local via LiteLLM) hors scope sprint 1 (décidé au niveau session, plus tard).
- PR base = `claude/zen-gauss-49a61e` (branche d'intégration, 6 commits devant origin/main) — à confirmer au checkpoint.

## Suivi backlog (issu de la revue GO — non bloquant)
- [ ] recovery: `restoreSession` ne repose pas le tier modèle (`sessionModels`) → le tiering serait perdu sur le chemin de reprise après crash. Latent (aucun appelant prod). À corriger quand le recovery sera câblé dans l'orchestrateur (sprint 3/4).
- [ ] policy: confirmer l'intention produit pour `/bmad-bmm-review-story` (route vers sonnet via le fallback ; seul `code-review` monte en opus). OK pour le cycle orchestrateur actuel (create-story / dev-story / code-review).
- [ ] tooling (pré-existant, hors feature) : `pnpm typecheck` cassé (TS6310, `tsc -b --noEmit` + TS 5.9.3). Gate de type assurée par `pnpm build` en attendant. À réparer (sprint 2 ou chore dédié).
