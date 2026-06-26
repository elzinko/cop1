---
id: 0012
title: Rafraîchir brownfield-snapshot.md (ancien emplacement worktree agent/)
type: chore
priority: P3
status: shipped
pr: "#43"
created: 2026-06-24
---

# 0012 — Rafraîchir brownfield-snapshot.md (ancien emplacement worktree agent/)

## Contexte / Problème

`docs/brownfield-snapshot.md` (≈ lignes 59 et 241) décrit encore l'ancien emplacement
des worktrees `agent/simulate-…`, périmé depuis la fiche 0002 (worktrees déplacés sous
`.cop1/worktrees/<runId>/`, cf. ADR-019). Doc descriptive désynchronisée du code.

## Proposition

Mettre à jour les références de `docs/brownfield-snapshot.md` vers le nouvel emplacement
`.cop1/worktrees/<runId>/<storyId>-<uuid>` et renvoyer vers ADR-019.

## Critères d'acceptation

- [ ] Plus de référence à `agent/simulate-` dans `docs/brownfield-snapshot.md`.
- [ ] Cohérence avec ADR-019.

## Notes / décisions

Source : revue senior fiche 0002 (PR #26).
