---
id: 0004
title: Sanitiser/tronquer le champ error de /api/auth/check
type: bug
priority: P2
status: todo
pr:
created: 2026-06-23
---

# 0004 — Sanitiser/tronquer le champ error de /api/auth/check

## Contexte / Problème

Revue Story A (non bloquant) : l'endpoint `GET /api/auth/check` peut renvoyer un champ
`error` brut. Défense en profondeur : éviter de propager un message d'erreur potentiellement
verbeux/sensible côté client.

## Proposition

Tronquer et nettoyer le champ `error` avant sérialisation (longueur max + retrait de tout
détail interne). Toujours 200, zéro secret (invariant existant de l'endpoint).

## Critères d'acceptation

- [ ] `error` tronqué à une longueur bornée.
- [ ] Aucune fuite de détail interne/secret dans la réponse.
- [ ] Test couvrant le cas d'erreur.

## Notes / décisions

Source : ex-`SPRINT.md` (Suivi revue Story A).
