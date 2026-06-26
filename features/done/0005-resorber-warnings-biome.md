---
id: 0005
title: Résorber les warnings biome
type: chore
priority: P3
status: shipped
pr: "#45"
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

**Résolu en no-op (vérifié 2026-06-26)** : aucun changement de code nécessaire. `biome` est
pinné en **1.9.4** (pas la 2.5.1 → aucune erreur de config) et `pnpm lint`
(`biome check --error-on-warnings .`) sort **exit 0 — 0 warning, 0 erreur** (451 fichiers).
Les ~26 warnings de la vieille mémoire ont été résorbés au fil des PRs de la session, qui
exigeaient toutes `--error-on-warnings` vert. Les 2 AC sont remplies.
