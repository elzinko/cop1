---
id: 0007
title: V1.1 — format de session log + discipline de commit
type: chore
priority: P3
status: todo
pr:
created: 2026-06-23
---

# 0007 — V1.1 — format de session log + discipline de commit

## Contexte / Problème

La clôture de V1-light (Plan B) a révélé des lacunes : discipline de commit (anchor réel,
déjà partiellement adressé en opt-in via `COP1_COMMIT_ANCHOR=1`) et **format de session log**
à définir. Inputs d'agenda architecte D3 (écrire ADR-009) / D4 (format session log).

## Proposition

Définir un format de session log exploitable + verrouiller la discipline de commit ;
écrire l'ADR-009 manquant ; trancher le pin de version BMAD (D1) et l'automatisation qa (D2).

## Critères d'acceptation

- [ ] Format de session log décidé et documenté.
- [ ] ADR-009 rédigé.
- [ ] Décisions D1 (pin BMAD) / D2 (qa-automate) tranchées.

## Notes / décisions

Source : mémoire `project_v1_light_closure`, `project_v1_1_architect_agenda`.
