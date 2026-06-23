---
id: 0001
title: Story B — lanceur de run + mission-control live
type: feature
priority: P1
status: todo
pr:
created: 2026-06-23
---

# 0001 — Story B — lanceur de run + mission-control live

## Contexte / Problème

La tech-spec web-UI prévoit 2 stories. Story A (panneau auth, feu tricolore) est livrée
sur `main` (PR #11, panneau 3 états 🟢/🟡/🔴 livré via #17). Story B — le **lanceur de
run** + le **mission-control live** — n'existe pas encore : `packages/web/src` n'a aucun
composant `RunLauncher`/`mission` (vérifié). C'est la prochaine feature produit.

## Proposition

Front : un écran pour déclencher un run cop1 sur un projet/épopée et suivre l'avancement
en direct (états de commandes, budget, garde-fous, `claude.status`). Le backend émet déjà
`claude.status` (ok/degraded/unavailable) sur l'EventBus → à consommer ici.
POC fonctionnel d'abord (déclenchement + flux d'événements), polish ensuite.

## Critères d'acceptation

- [ ] Déclencher un run depuis l'UI (sélection projet/épopée).
- [ ] Affichage live de l'avancement (commande courante, budget, verify-gate).
- [ ] Branchement du feu `claude.status` au flux du run.
- [ ] Gate locale verte (typecheck/lint/tests) puis E2E Playwright.

## Notes / décisions

Source : [SPRINT.md](../SPRINT.md), tech-spec `_bmad-output/.../tech-spec-web-ui-auth-and-run-launcher.md`.
