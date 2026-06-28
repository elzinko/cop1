---
id: 0020
title: AgentSessionPort — prouver l'indépendance à l'agent (StubExecutor, puis LLM local)
type: feature
priority: P2
status: todo
pr:
created: 2026-06-28
---

# 0020 — AgentSessionPort : prouver l'indépendance à l'agent

## Contexte / Problème

Enabler **stratégique** (cf. mémoire « control-plane positioning » + ADR de cadrage à venir).
Le plan de contrôle cop1 est déjà ~85 % agnostique à l'agent : la boucle orchestrateur, le
budget, les gates DoD, les worktrees et l'EventBus ne connaissent rien à Claude. Claude n'est
couplé que dans **2 fichiers** (`AgentSdkSessionAdapter`, `AgentSdkSupervisorAdapter`), derrière
le port `BMADSessionPort` (mal nommé : c'est en réalité le *seam d'exécuteur*, rien de BMAD).

Tant qu'aucun exécuteur **non-Claude** n'a tourné de bout en bout, la thèse produit
« cop1 ≠ surcouche Claude » n'est pas prouvée — et c'est le risque existentiel n°1.

## Proposition

1. Renommer `BMADSessionPort` → **`AgentSessionPort`** (et extraire un `ExecutorPort` fin si utile).
2. Écrire un **`StubExecutor`** (zéro LLM, réponses scriptées) implémentant le port.
3. Lancer un epic-jouet **de bout en bout** : budget qui s'incrémente, gates DoD qui se
   déclenchent, events SSE, escalade, worktrees — **sans une seule ligne de Claude**.
4. (Étape 2, ultérieure) un **`OllamaExecutor`** (LLM local) = même port → 1ʳᵉ brique local-LLM.

## Critères d'acceptation

- [ ] Un run complet passe via un exécuteur **non-Claude** (Stub), control plane intact.
- [ ] Sélection d'exécuteur par variable d'env (comme l'existant `COP1_BMAD_ADAPTER`).
- [ ] Aucun import `@anthropic-ai/claude-agent-sdk` hors des adapters d'exécuteur.
- [ ] Renommage `BMADSessionPort → AgentSessionPort` sans régression de gate.

## Notes / décisions

Enabler du positionnement « control plane agent-agnostique » (vs Devin / surcouche Claude).
Dépend de l'ADR de cadrage (à créer). **Ne pas confondre** avec le couplage *méthode* (BMAD),
qui est un sujet distinct (le port méthode / process-driver).
