---
id: 0002
title: Fix emplacement du worktree en session concurrente
type: bug
priority: P1
status: todo
pr:
created: 2026-06-23
---

# 0002 — Fix emplacement du worktree en session concurrente

## Contexte / Problème

Identifié pendant la conception du run contrôlé de nuit (mémoire `controlled_overnight_run`) :
l'emplacement où l'orchestrateur crée/écrit le worktree pose problème quand une **session
concurrente** tourne en parallèle (collision / mauvais répertoire). Reste ouvert après le
batch de blockers (tiering / verify-gate / budget-kill / worktree) mergé via #6.

## Proposition

Isoler l'emplacement du worktree par run (chemin dédié, non partagé) pour que deux sessions
simultanées n'entrent pas en conflit. À cadrer : chemin cible + nettoyage.

## Critères d'acceptation

- [ ] Deux runs concurrents n'écrivent pas dans le même worktree.
- [ ] Nettoyage correct en fin de run (pas de worktree orphelin).
- [ ] Gate locale verte (tests couvrant le cas concurrent).

## Notes / décisions

Source : mémoire `project_controlled_overnight_run` (section « open »).
