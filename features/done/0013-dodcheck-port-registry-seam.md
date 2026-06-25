---
id: 0013
title: DoDCheck port + registry + refactor du seam de transition (POC DoD automatisée)
type: feature
priority: P1
status: shipped
pr: "#33"
created: 2026-06-25
---

# 0013 — DoDCheck port + registry + refactor du seam de transition

## Contexte / Problème

ADR-020 : `DefaultBMADCommandRunner` enchaîne 3 gates EN DUR (evidence → verification →
review-verdict, ~lignes 201-262) avant de faire avancer une story, tandis que `DoDService`
(sprint-core/dod-validator) décrit ces critères de façon déclarative mais **n'est appelé
par personne**. C'est le POC de « DoD automatisée » : brancher l'évaluateur déclaratif au seam.

## Proposition

Extraire la séquence de gates derrière `DoDService.evaluate(ctx, criteria)` + un registry
`id → DoDCheck` (port domaine pur `evaluate(DoDContext) → { satisfied, detail }`). Les gates
existants deviennent des **adapters** (`VerificationCheck`, `ReviewVerdictCheck`,
`EvidenceCheck`). Critères lus depuis `iamthelaw/global.yaml` (clé `dod`, déjà supportée).
Aucune logique de gate réécrite — on déplace.

## Critères d'acceptation

- [ ] Le runner ne référence plus aucun gate concret, seulement `DoDService`.
- [ ] Test d'invariant : aucune transition `in-review`/`done` sans `evaluate` vert.
- [ ] Comportement ADR-016 préservé (golden test sur les 3 gates avant/après extraction).
- [ ] Gate locale verte.

## Notes / décisions

Source : ADR-020 (session architecte 0006). POC = première tranche de valeur, socle de 0014/0015.
Décision ouverte à trancher : politique DoD par défaut si `iamthelaw/global.yaml` absent
(recommandé : garder les built-in defaults appliqués).
