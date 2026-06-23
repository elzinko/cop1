---
id: 0005
title: Résorber les warnings biome
type: chore
priority: P3
status: todo
pr:
created: 2026-06-23
---

# 0005 — Résorber les warnings biome

## Contexte / Problème

La mémoire note ~26 warnings biome restants après l'ajout de la CI lint. (Compte exact à
reconfirmer : `biome` 2.5.1 sort une erreur de config dans le worktree courant — à corriger
au passage si la config a divergé.)

## Proposition

Lancer `pnpm lint`, lister les warnings, les corriger par lots ; viser
`--error-on-warnings` propre.

## Critères d'acceptation

- [ ] `pnpm lint` (avec `--error-on-warnings`) vert.
- [ ] Config biome valide (plus d'erreur de configuration).

## Notes / décisions

Source : mémoire `project_controlled_overnight_run`.
