# Sprint 1 — Model tiering sur le chemin de run live
Périmètre : 1 feature (POC) par sprint.   Statut : sprint 3 en cours (S1+S2 mergés)

## Backlog  (1 ligne = 1 feature = 1 PR)
- [x] feat: model tiering Opus/Sonnet par commande BMAD      (mergée — PR #1)
- [x] feat: gate de vérif tests/lint avant transition         (mergée — PR #3)
- [x] feat: budget + kill-switch                              (sprint 3 — gate verte, revue GO, PR)
- [x] feat: isolation worktree dans la boucle                 (sprint 4 — gate verte, revue GO, PR)
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
- [ ] tooling (pré-existant, hors feature) : `pnpm typecheck` cassé (TS6310, `tsc -b --noEmit` + TS 5.9.3). Gate de type assurée par `pnpm build` en attendant. À réparer (chore dédié).
- [ ] test placement : `VerificationGatePolicy.test.ts` (teste le domaine) à ranger sous `domain/__tests__/` (revue S2, non bloquant).
- [ ] test intégration orchestrateur↔gate : « dev-story + gate KO ⇒ status fichier = blocked » bout-à-bout (revue S2 ceinture-bretelles, S3).
- [ ] verify gate : checks par défaut codés en dur → lire depuis `cop1.config` ; timeout/kill par check (à coupler au budget S3).
- [ ] budget (S3) : kill au niveau BOUCLE seulement ; timeout/`AbortSignal` intra-commande (threading `AbortController` dans la query SDK) → story dédiée. `TokenBudgetService` dormant à retirer.
- [ ] budget (revue S3, prioritaire) : les tokens des commandes ÉCHOUÉES ne sont pas comptés → sous-comptage du cap. Compter aussi les sessions en échec.
- [ ] budget (revue S3) : `tokensUsed` absent silencieusement ignoré (ajouter un warn) ; cap tokens hors cache (`maxBudgetUsd` couvre le coût $) ; test d'intégration du wiring CLI (abonnement event + parse env).
- [ ] **worktree (revue S4, PRÉREQUIS sprint 5)** : `WorktreeManager` place les worktrees sous `<projectRoot>/agent/...` = DANS l'arbre versionné → keep-on-failure pollue `git status`. Déplacer hors arbre (`../.cop1-worktrees/`) ou gitignore `agent/` AVANT le 1er vrai run avec isolation activée.
- [ ] worktree (revue S4) : ADR-018 dit « escalade → keep » mais le code cleanup une story qui escalade ET réussit (comportement voulu) → clarifier l'ADR (keep = échec/abort uniquement).
- [ ] worktree (revue S4) : deny Bash `rm` trop large/contournable (best-effort ; l'isolation est la vraie barrière) → calibrer `rm -r…` ou documenter.
