---
id: 0014
title: iamthelaw enforced — Rule.check → DoDCheck, advisory dans le prompt
type: feature
priority: P2
status: shipped
pr: "#36"
created: 2026-06-25
---

# 0014 — iamthelaw enforced

## Contexte / Problème

ADR-020 : les règles `iamthelaw` sont aujourd'hui purement advisory (prose
`{id, description, source}`), et côté orchestrateur elles ne sont même pas injectées
(`iamtheLawRules: ''` dans `DefaultBMADCommandRunner`). Pas d'enforcement mécanique.

## Proposition

Étendre `Rule` (sprint-core/iamthelaw `RuleSet.ts`) d'un champ optionnel `check?: string`
(id d'un `DoDCheck` enregistré). Règle **avec** `check` → entre dans la liste DoD enforcée
(via le registry de la fiche 0013). Règle **sans** `check` → reste advisory et est injectée
dans le contexte du superviseur (corrige `iamtheLawRules: ''`). Pas de moteur de règles
générique. Unifier la source des critères (`global.yaml` clé `dod` + `Rule.check`).

## Critères d'acceptation

- [ ] Une règle `check:` violée bloque la story.
- [ ] Une règle advisory apparaît dans le contexte du prompt superviseur.
- [ ] L'audit `history.jsonl` trace le verdict de la règle.
- [ ] Gate locale verte.

## Notes / décisions

Source : ADR-020. Dépend de la fiche 0013 (registry DoDCheck).
