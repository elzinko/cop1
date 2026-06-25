---
id: 0017
title: E2E Playwright — dark-mode cobaye (post-FEAT-S1)
type: chore
priority: P3
status: blocked
pr:
created: 2026-06-25
---

# 0017 — E2E Playwright — dark-mode cobaye (post-FEAT-S1)

## Contexte / Problème

Détaché de la fiche 0003. La validation E2E du dark-mode du banc d'essai
`~/git/bacasable/cop1-cobaye` (FEAT-S1 : toggle 🌙/☀️ + persistance) **présuppose que
FEAT-S1 existe** dans le cobaye. Or le banc réutilisable est dans son état **vierge de seed**
(commit `397b78a`) : `src/index.html` et `src/app.js` ne contiennent que des placeholders
`<!-- cop1 ajoutera ici … FEAT-S1 -->`. Rien à valider tant que la feature n'est pas construite.

## Proposition

D'abord construire FEAT-S1 dans le cobaye (idéalement via un run cop1 dogfood, sinon
manuellement), puis scénario Playwright : bascule de thème, persistance au reload, icône 🌙/☀️.

## Critères d'acceptation

- [ ] FEAT-S1 (dark-mode) présente dans le cobaye.
- [ ] Test Playwright vert : bascule + persistance (localStorage) + icône 🌙/☀️.
- [ ] Documenté comme E2E manuel reproductible (compléter `docs/e2e/`).

## Notes / décisions

Bloquée tant que le cobaye reste vierge. Source : split de la fiche 0003 (E2E 2026-06-25).
Le scénario auth est livré séparément (0003 + `docs/e2e/auth-panel.md`).
