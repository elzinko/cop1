---
id: 0010
title: Heartbeat mission-control — setInterval recréé à chaque frame SSE
type: refactor
priority: P3
status: shipped
pr: "#40"
created: 2026-06-24
---

# 0010 — Heartbeat mission-control — setInterval recréé à chaque frame SSE

# Contexte / Problème

Dans `packages/web/src/OrchestratorRunView.tsx`, l'effet du heartbeat dépend de
`lastEventAt`, qui change à chaque frame SSE → le `setInterval` est détruit/recréé
très fréquemment. Fonctionnellement correct (cleanup propre) mais inutilement nerveux.
Repéré en revue de la Story B (non-bloquant, cosmétique).

## Proposition

Calculer `silentMs` à partir d'une ref `lastEventAt` et retirer `lastEventAt` des
dépendances de l'effet (un seul interval stable pour la vie du composant), ou dériver
`silentMs` sans state.

## Critères d'acceptation

- [ ] Un seul `setInterval` stable tant que la vue est montée (pas de recréation par frame).
- [ ] Heartbeat toujours correct ("en cours… silencieux depuis Ns").
- [ ] Tests web verts.

## Notes / décisions

Source : revue senior Story B (PR #24).
