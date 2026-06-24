---
id: 0009
title: Durcir les appels git worktree (execFileSync, anti-injection shell)
type: refactor
priority: P2
status: todo
pr:
created: 2026-06-24
---

# 0009 — Durcir les appels git worktree (execFileSync, anti-injection shell)

## Contexte / Problème

`WorktreeManager` (et les autres appels `git`) utilisent `execSync` avec un chemin
interpolé dans la chaîne shell (`git worktree add "${path}" HEAD`,
`packages/sprint-core/src/features/dev-agent/infrastructure/WorktreeManager.ts`).
Le chemin contient `projectPath` + `storyId`. Aujourd'hui `storyId` vient des clés
`sprint-status.yaml` (format `EA99-S1`, source interne de confiance) et le quoting
couvre les espaces — mais pas `$()`/backticks. Surface d'injection latente, signalée
en revue de la fiche 0002 (non-bloquant, pré-existant).

## Proposition

Remplacer les `execSync('git worktree …')` par `execFileSync('git', ['worktree', …])`
(pas de shell → plus d'interpolation). Couvrir tous les sites git de `WorktreeManager`
(add / remove / prune / list) et auditer les autres `execSync` git du repo.

## Critères d'acceptation

- [ ] Plus aucun chemin/argument utilisateur interpolé dans une string shell pour les commandes git worktree.
- [ ] Comportement identique (tests worktree existants verts, dont l'integration test concurrence).
- [ ] Gate locale verte.

## Notes / décisions

Source : revue senior fiche 0002 (PR #26). Durcissement global, volontairement hors scope de #26.
