---
id: 0003
title: E2E Playwright — panneau auth (🟢 + modèle)
type: chore
priority: P2
status: shipped
pr: "#34"
created: 2026-06-23
---

# 0003 — E2E Playwright — panneau auth (🟢 + modèle)

## Contexte / Problème

La revue de Story A a laissé en suspens la validation E2E navigateur du feu 🟢 du panneau
auth. C'était bloqué par l'auth Claude (401), débloquée depuis le 2026-06-22.

> **Re-scopée 2026-06-25** : la fiche couvrait aussi le dark-mode du cobaye, mais le banc
> `cop1-cobaye` est vierge (FEAT-S1 jamais construite). La partie dark-mode est déplacée
> dans la fiche **0017** (à rejouer une fois FEAT-S1 construite). Cette fiche ne couvre plus
> que le panneau auth.

## Proposition

Scénario Playwright : le panneau auth affiche 🟢 + modèle quand l'auth est OK.

## Critères d'acceptation

- [x] Test Playwright vert sur le panneau auth (🟢 + modèle) — validé 2026-06-25, modèle `claude-sonnet-4-6`.
- [x] Documenté comme E2E manuel reproductible — `docs/e2e/auth-panel.md`.

## Notes / décisions

Source : ex-`SPRINT.md` (section Suivi). Auth débloquée — mémoire `web_ui_and_cobaye_handoff`.
Runbook : `docs/e2e/auth-panel.md`. Partie dark-mode → fiche 0017.
