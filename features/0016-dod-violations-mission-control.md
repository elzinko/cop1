---
id: 0016
title: Surfaçage des violations DoD dans la mission-control (web)
type: feature
priority: P3
status: todo
pr:
created: 2026-06-25
---

# 0016 — Surfaçage des violations DoD dans la mission-control

## Contexte / Problème

ADR-020 (story optionnelle, polish post-POC) : une fois la DoD automatisée enforcée
(fiches 0013-0015), les échecs de critères devraient être visibles dans le panneau web
mission-control (Story B / fiche 0001), pas seulement dans les logs.

## Proposition

Émettre des événements `dod.check.failed` (avec critère + détail + storyKey) sur l'EventBus
et les afficher dans `OrchestratorRunView` (filtrés par `runId`, comme le reste du flux SSE),
par ex. une liste des critères DoD non satisfaits pour la story courante.

## Critères d'acceptation

- [ ] Un échec de critère DoD émet un event `dod.check.failed` taggé `runId`.
- [ ] La mission-control affiche les violations DoD de la story courante.
- [ ] Tests web verts.

## Notes / décisions

Source : ADR-020 (polish, après POC). Dépend des fiches 0013 et 0001.
