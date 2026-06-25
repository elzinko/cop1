---
id: 0018
title: Câbler DoDLimiter (N rejets DoD → blocked + escalade)
type: feature
priority: P3
status: blocked
pr:
created: 2026-06-25
---

# 0018 — Câbler DoDLimiter (N rejets DoD → blocked + escalade)

## Contexte / Problème

Splittée de la fiche 0015 (qui n'a livré que la moitié StoryBudget). `DoDLimiter`
(`packages/sprint-core/src/features/dod-validator/application/DoDLimiter.ts`) compte les
rejets DoD par story et émet `dod.max_rejections` au seuil (défaut 3). Mais **sans boucle
de retry** dans l'orchestrateur (absente — notée ADR-016), une story est tentée **une seule
fois** par run et bloque au premier échec : le compteur n'atteint jamais le seuil dans un run.
Câbler le limiter maintenant serait non-fonctionnel.

## Proposition

D'abord introduire la boucle de retry par story dans `OrchestratorService` (ADR-016
follow-up), puis câbler le `DoDLimiter` : chaque rejet DoD incrémente le compteur de la
story ; au seuil → `blocked` + escalade + event dédié.

## Critères d'acceptation

- [ ] Boucle de retry par story en place (pré-requis).
- [ ] N rejets DoD sur une story → `blocked` + escalade ; event émis.
- [ ] Le `DoDLimiter` est reset correctement entre stories/runs.
- [ ] Gate locale verte.

## Notes / décisions

Bloquée tant que la boucle de retry n'existe pas. Source : split de la fiche 0015 + ADR-020 / ADR-016.
