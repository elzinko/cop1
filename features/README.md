# Backlog features & bugs

Source de vérité = le front-matter de chaque fiche `features/NNNN-slug.md`. Cet index est
**régénéré** depuis les fiches (ne pas l'éditer à la main). Fiches livrées → `features/done/`.

Règles : 1 PR par feature, squash-merge quand la CI est verte.

Dernière mise à jour : 2026-06-25

| # | Titre | Type | Prio | Statut | PR |
|---|-------|------|------|--------|----|
| 0001 | Story B — lanceur de run + mission-control live | feature | P1 | ✅ shipped | #24 |
| 0002 | Fix emplacement du worktree en session concurrente | bug | P1 | ✅ shipped | #26 |
| 0013 | DoDCheck port + registry + refactor du seam (POC DoD automatisée) | feature | P1 | 🔴 todo | |
| 0003 | E2E Playwright — panneau auth (🟢 + modèle) | chore | P2 | ✅ shipped | #34 |
| 0004 | Sanitiser/tronquer le champ error de /api/auth/check | bug | P2 | ✅ shipped | #29 |
| 0006 | V1.1 — DoD automatisée, iamthelaw et enforcement budget (épic → ADR-020) | feature | P2 | 🔴 todo | |
| 0008 | Proxy Vite cible :3000 alors que le daemon écoute :4242 | bug | P2 | ✅ shipped | #28 |
| 0009 | Durcir les appels git worktree (execFileSync, anti-injection shell) | refactor | P2 | ✅ shipped | #30 |
| 0014 | iamthelaw enforced — Rule.check → DoDCheck, advisory dans le prompt | feature | P2 | 🔴 todo | |
| 0015 | StoryBudget par story + câblage DoDLimiter (enforcement budget fin) | feature | P2 | 🔴 todo | |
| 0005 | Résorber les warnings biome | chore | P3 | 🔴 todo | |
| 0007 | V1.1 — format de session log + discipline de commit | chore | P3 | 🔴 todo | |
| 0010 | Heartbeat mission-control — setInterval recréé à chaque frame SSE | refactor | P3 | 🔴 todo | |
| 0011 | Buffer frames non borné dans la mission-control | refactor | P3 | 🔴 todo | |
| 0012 | Rafraîchir brownfield-snapshot.md (ancien emplacement worktree agent/) | chore | P3 | 🔴 todo | |
| 0016 | Surfaçage des violations DoD dans la mission-control (web) | feature | P3 | 🔴 todo | |
| 0017 | E2E Playwright — dark-mode cobaye (post-FEAT-S1) | chore | P3 | ⛔ blocked | |
