---
id: 0003
title: E2E Playwright — panneau auth + dark-mode cobaye
type: chore
priority: P2
status: todo
pr:
created: 2026-06-23
---

# 0003 — E2E Playwright — panneau auth + dark-mode cobaye

## Contexte / Problème

La revue de Story A a laissé en suspens la validation E2E navigateur : feu 🟢 du panneau
auth + bascule dark-mode sur le cobaye. C'était bloqué par l'auth Claude (401), **débloquée
depuis le 2026-06-22** (token `CLAUDE_CODE_OAUTH_TOKEN` remis sur une seule ligne).

## Proposition

Scénario Playwright : (1) panneau auth affiche 🟢 + modèle quand l'auth est OK ;
(2) bascule de thème sur le cobaye, persistance au reload, icône 🌙/☀️.

## Critères d'acceptation

- [ ] Test Playwright vert sur le panneau auth (🟢 + modèle).
- [ ] Test Playwright vert sur dark-mode cobaye (bascule + persistance + icône).
- [ ] Intégré à la CI ou documenté comme E2E manuel reproductible.

## Notes / décisions

Source : ex-`SPRINT.md` (section Suivi). Auth débloquée — mémoire `web_ui_and_cobaye_handoff`.
