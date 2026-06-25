---
id: 0011
title: Buffer `frames` non borné dans la mission-control
type: refactor
priority: P3
status: shipped
pr: "#41"
created: 2026-06-24
---

# 0011 — Buffer `frames` non borné dans la mission-control

## Contexte / Problème

`packages/web/src/OrchestratorRunView.tsx` bufferise tous les frames SSE dans un état
`frames` qui croît sans limite sur une session longue enchaînant plusieurs runs.
Trade-off POC assumé et documenté en commentaire ; sans impact pour "un run à la fois,
faible volume", mais à borner pour une session durable. Repéré en revue de la Story B.

## Proposition

Au lancement d'un nouveau run, purger les frames dont le `runId` ne correspond plus au
run actif (ou garder une fenêtre glissante). Conserver le filtrage par `runId`.

## Critères d'acceptation

- [ ] Le buffer ne croît pas indéfiniment sur plusieurs runs successifs.
- [ ] Le rendu live (story/commande, jauge tokens, terminal) reste correct.
- [ ] Tests web verts.

## Notes / décisions

Source : revue senior Story B (PR #24).
