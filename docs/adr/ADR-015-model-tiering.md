# ADR-015 — Model tiering par commande sur la session BMAD

Statut : Accepté (2026-06-20, sprint-builder — sprint 1)

## Contexte

Le chemin de run live (`AgentSdkSessionAdapter`) appelle `query()` sans champ
`model`, donc toutes les phases tournent sur le modèle Claude par défaut. On veut
un gros modèle (opus) pour le raisonnement (création de story, revue) et un
modèle moins cher (sonnet) pour l'implémentation mécanique (dev-story), pour le
coût et la vitesse.

## Décision

- Introduire `ModelTierRouter` (domaine, pur) : `resolve(command) → 'opus' | 'sonnet' | 'haiku'`.
  Implémentation par défaut data-driven (`DefaultModelTierRouter`), cost-aware :
  `create-story` / `code-review` → opus ; fallback (dev-story, qa, inconnu) → sonnet.
- `AgentSdkSessionAdapter` reçoit le router en option, résout le tier au
  `startSession` (par `sessionId`), et le pose dans `options.model` ; les tours de
  suivi réutilisent le même tier.
- Le port `BMADSessionPort` reste inchangé : « model » est un concept du SDK
  Claude, donc la sélection vit dans l'adapter ; l'orchestrateur reste
  model-agnostic.

## Conséquences

- Gain coût/vitesse immédiat, risque ~0 (pur Anthropic, pas d'Ollama/proxy).
- Rétro-compatible : sans router injecté, aucun `model` posé (comportement inchangé).
- Ouvert/fermé : nouvelles règles sans changement de code (config).
- Le tier local (LiteLLM→Ollama) se décidera au niveau session (ADR ultérieur),
  contraint par `ANTHROPIC_BASE_URL` global-session.
- Conforme aux normes SDK : `options.model` accepte les alias opus/sonnet/haiku
  (https://code.claude.com/docs/en/agent-sdk/typescript).
