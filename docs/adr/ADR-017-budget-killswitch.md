# ADR-017 — Budget + kill-switch du run orchestrateur

Statut : Accepté (2026-06-20, sprint-builder — sprint 3)

## Contexte

Un run de nuit non surveillé peut brûler des tokens sans plafond et ne peut pas
être arrêté proprement de l'extérieur. La machinerie budget existante
(`TokenBudgetService`) est dormante et abonnée à un event mort
(`llm.call.completed`).

## Décision

- `RunBudget` (domaine, pur) implémente `BudgetGuard` : accumule les tokens et
  expose `status() → {tripped, reason, spentTokens, elapsedMs}`. Priorité
  `tokens > wallclock > abort-file`. Horloge (`now`) et `externalAbort` injectés
  (déterministe, zéro IO).
- `createAbortFilePredicate(path)` (infra) : kill-switch externe via présence du
  fichier `.cop1/abort`, évalué paresseusement à chaque check.
- `OrchestratorService` reçoit un `budgetGuard?` optionnel et vérifie `status()`
  AU DÉBUT de chaque commande (avant le gate step-by-step). Si `tripped` → run
  `aborted`, aucune story avancée (`nextStatus = previousStatus`), event
  `orchestrator.run.aborted`, arrêt propre.
- Wiring CLI : caps depuis l'env (`COP1_MAX_TOKENS`, `COP1_DEADLINE_MIN`,
  `COP1_MAX_USD_PER_SESSION`), abonnement à `session.workflow.completed`
  (l'adapter émet désormais `tokensUsed`) pour alimenter le budget. `maxBudgetUsd`
  passé à l'adapter SDK (plafond USD par session, nativement supporté).

## Conséquences

- Le run s'arrête proprement sur plafond tokens / temps / fichier d'abort.
- Rétro-compatible : sans `budgetGuard`, comportement inchangé.
- Kill au niveau **boucle** seulement : une commande déjà lancée va à son terme
  avant la coupure. Le timeout / `AbortSignal` intra-commande (threading d'un
  `AbortController` dans la query SDK) est un suivi dédié.
- `TokenBudgetService` (dormant, mal abonné) reste à retirer séparément.
