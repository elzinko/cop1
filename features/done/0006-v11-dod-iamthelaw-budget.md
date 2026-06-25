---
id: 0006
title: V1.1 — DoD automatisée, iamthelaw et enforcement budget
type: feature
priority: P2
status: shipped
pr: "#32"
created: 2026-06-23
---

# 0006 — V1.1 — DoD automatisée, iamthelaw et enforcement budget

## Contexte / Problème

Périmètre explicitement reporté de V1-light vers V1.1 (mémoire `v1_light_scope`) :
Definition of Done automatisée, mécanisme « iamthelaw » (application des règles), et
enforcement du budget — au-delà du simple kill déjà en place.

## Proposition

Cadrer en session architecte puis implémenter incrémentalement. POC d'une DoD vérifiable
automatiquement par story, gate budget plus fin.

## Critères d'acceptation

- [ ] Décision d'archi documentée (ADR) sur DoD/iamthelaw/budget.
- [ ] POC d'une DoD automatique appliquée à une story.
- [ ] Gate locale verte.

## Notes / décisions

Source : mémoire `project_v1_light_scope`, `project_v1_1_architect_agenda`. À découper.

**Livré (2026-06-25)** : cadré en session architecte → **ADR-020** (#32), puis cœur des 3
concerns livré : DoD automatisée = **0013** (#33), iamthelaw enforced = **0014** (#36),
enforcement budget par story = **0015** (#38). Restent en suivi : **0016** (UI violations
DoD, P3) et le câblage **DoDLimiter** (fiche 0018, bloqué tant que la boucle de retry
ADR-016 n'existe pas).
