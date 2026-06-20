# ADR-016 — Gate de vérification avant transition de story

Statut : Accepté (2026-06-20, sprint-builder — sprint 2)

## Contexte

`inferNextStatus(command)` fait avancer une story vers `in-review` / `done`
uniquement d'après le **nom** de la commande, sans jamais exécuter les tests ni
le lint sur le code produit. Un `dev-story` qui casse la build passe quand même
`in-review`. Pour un run de nuit fiable, c'est le plus gros manque : on a besoin
d'un point d'ancrage « ça compile/teste » avant d'avancer.

## Décision

- Port `VerificationGate` (domaine, pur) : `verify({projectRoot, command, storyKey}) → {passed, summary}`.
- Politique `shouldVerify(command)` : ne vérifier que les commandes produisant du
  code (`dev-story` aujourd'hui).
- Implémentation `CommandVerificationGate` (infra) : exécute une liste de checks
  shell configurables (défaut `pnpm -s test`, `pnpm -s lint`) dans `projectRoot`,
  **fail-fast**, exécuteur injectable (testable sans shell réel).
- `DefaultBMADCommandRunner` : après une session réussie, si `shouldVerify`, lance
  le gate. Échec → `{ success: false, escalated: true, note: summary }` : la story
  est marquée `blocked` par l'orchestrateur et **n'avance pas** ; en mode
  `abort-on-escalation` le run s'arrête et la question remonte à l'humain.

## Conséquences

- Plus de transition `done`/`in-review` sur du code cassé : la vérité du gate
  prime sur l'inférence par nom de commande.
- Blast-radius minimal : `OrchestratorService` inchangé (réutilise les chemins
  `escalated` / `!success` existants).
- Rétro-compatible : sans gate injecté, comportement d'avant.
- Le seuil « N échecs → escalade » (stuck-detection) dépend d'une boucle de retry
  encore absente ; aujourd'hui un échec escalade directement. À recâbler avec le
  budget/retry (sprint 3).
- Checks par défaut codés en dur ici ; à terme lus depuis `cop1.config` (suivi).
