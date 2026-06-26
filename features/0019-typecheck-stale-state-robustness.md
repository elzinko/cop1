---
id: 0019
title: Rendre `pnpm typecheck` robuste sur état stale (TS6310)
type: chore
priority: P3
status: todo
pr:
created: 2026-06-26
---

# 0019 — Rendre `pnpm typecheck` robuste sur état stale (TS6310)

## Contexte / Problème

`pnpm typecheck` = `tsc -b --noEmit packages/...`. Quand un projet est **stale** (une source
modifiée, sans `pnpm build` préalable), `tsc -b` doit le reconstruire et propage `--noEmit`
aux **projets composites référencés** → erreur **TS6310** :
`Referenced project '.../packages/ceremony-engine' may not disable emit` (un projet composite
ne peut pas émettre sans déclarations). Un projet composite ne supporte pas `--noEmit`.

Conséquence : `pnpm typecheck` lancé seul (sans `pnpm build` avant) échoue à tort. Repéré
le 2026-06-26 (fiche cleanup #46). **Absent de la CI** (`ci.yml` fait `pnpm build` qui émet,
pas de root typecheck), donc non bloquant — mais c'est un footgun de DX local.

## Proposition

Options (à trancher) :
1. `typecheck` = `pnpm build` (émet) **puis** `tsc -b --noEmit` — simple, mais build à chaque fois.
2. Retirer `--noEmit` du script (`tsc -b` seul type-check **et** émet) et renommer en
   `build`/`check` — un seul chemin.
3. Un tsconfig dédié au type-check (sans composite/références) qui type-check sans `-b`.

Recommandé : option 1 ou 2 (cohérent avec ce que fait la CI = `pnpm build`).

## Critères d'acceptation

- [ ] `pnpm typecheck` vert depuis un état stale (sans `pnpm build` manuel préalable).
- [ ] Pas de régression CI (le build reste le type-check de référence).
- [ ] Comportement documenté (README/CONTRIBUTING si pertinent).

## Notes / décisions

Source : observation PR #46 (alignement des stubs DoDService). `tsc -b --noEmit` + projets
composites = incompatible quand un projet est reconstruit.
