---
id: 0008
title: Proxy Vite cible :3000 alors que le daemon écoute :4242
type: bug
priority: P2
status: shipped
pr: "#28"
created: 2026-06-24
---

# 0008 — Proxy Vite cible :3000 alors que le daemon écoute :4242

## Contexte / Problème

Le dev server Vite proxifie `/api` + `/events` vers `http://localhost:3000`
(`packages/web/vite.config.ts:10,14`), mais le daemon écoute par défaut sur
`4242` (`DEFAULT_PORT`, `packages/app/src/features/daemon/domain/DaemonState.ts`).
Du coup l'UI web ne joint pas le backend out-of-the-box : repéré pendant l'E2E de
la Story B (la QA a dû lancer le daemon sur un port custom + un `vite.config` temporaire).

## Proposition

Aligner les deux. Options : (a) pointer le proxy Vite sur `4242` (le défaut du daemon) ;
(b) variabiliser le port proxy via env (`VITE_DAEMON_PORT`) avec défaut `4242`.
Recommandé : (a) en POC (une ligne), (b) si on veut configurer le port proprement.

## Critères d'acceptation

- [ ] `cop1 start` (port défaut) + `pnpm dev` → l'UI joint `/api/*` et `/events` sans config manuelle.
- [ ] Pas de port hardcodé divergent entre front et back.
- [ ] Gate locale verte.

## Notes / décisions

Source : E2E Story B (PR #24). Incohérence pré-existante, hors scope de #24.
