---
id: 0015
title: StoryBudget par story + câblage DoDLimiter (enforcement budget fin)
type: feature
priority: P2
status: shipped
pr: "#38"
created: 2026-06-25
---

# 0015 — StoryBudget par story + câblage DoDLimiter

## Contexte / Problème

ADR-020 / ADR-017 : le budget actuel (`RunBudget`) ne coupe qu'au niveau RUN (token /
wall-clock / abort-file), jamais par story ; et `DoDLimiter` (compteur de rejets DoD par
story) n'est relié ni au budget ni à la boucle. Une story pathologique peut donc consommer
tout le budget du run.

## Proposition

Ajouter un `StoryBudget` (réutilise le port `BudgetGuard`) réinitialisé par story dans la
`storyLoop` d'`OrchestratorService`. Trip → `nextStatus='blocked'` pour CETTE story (pas
`aborted` du run). Câbler `DoDLimiter` : N rejets DoD sur une story → `blocked` + escalade.
Le grain intra-commande (AbortSignal SDK) reste explicitement hors-scope (risqué, ADR-017).

## Critères d'acceptation

- [ ] Une story dépassant son plafond → `blocked`, le run continue.
- [ ] Le run global s'arrête toujours sur `RunBudget` (inchangé).
- [ ] N rejets DoD sur une story → `blocked` + escalade ; event dédié émis.
- [ ] Gate locale verte (tests couvrant le plafond par story).

## Notes / décisions

Source : ADR-020. Dépend de la fiche 0013.

**Livré (#38)** : la **moitié StoryBudget** (cap par story → `blocked`, run continue ; event
`orchestrator.story.budget_exceeded` ; env `COP1_MAX_TOKENS_PER_STORY`/`COP1_DEADLINE_MIN_PER_STORY`).
La **moitié DoDLimiter** est **splittée dans la fiche 0018** : sans boucle de retry (absente,
ADR-016), le seuil « N rejets DoD » n'est jamais atteint dans un run (une story est tentée une fois).
