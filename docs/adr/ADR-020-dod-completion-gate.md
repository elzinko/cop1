# ADR-020 — DoD automatisée comme gate de complétion (DoD / iamthelaw / budget par story)

Statut : Accepté (2026-06-25, session architecte — EPIC 0006 / V1.1)

## Contexte

`DefaultBMADCommandRunner` enchaîne déjà, EN DUR, trois gates avant de faire avancer
une story (evidence-gate, verification-gate ADR-016, review-verdict) — voir
`packages/app/src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts`
(séquence ~201-262). En parallèle, `DoDService`
(`packages/sprint-core/src/features/dod-validator/application/DoDService.ts`) décrit
ces mêmes critères de façon déclarative (`tests_pass`, `code_reviewed`, …) mais **n'est
appelé par personne** en production : son `DoDSnapshot` booléen est orphelin (aucun
collecteur ne le produit). Les règles `iamthelaw` sont purement advisory (prose
`{id, description, source}`) et même pas injectées côté orchestrateur
(`iamtheLawRules: ''`). Le budget (ADR-017) ne coupe qu'au niveau RUN, jamais par story.

Trois manques V1.1 — qui sont en réalité une seule absence : un point de décision
déclaratif unifié au seam de transition d'une story.

## Décision

- La séquence de gates du runner devient un `DoDService.evaluate(ctx, criteria)` piloté
  par la clé `dod` de `iamthelaw/global.yaml` (déjà lue par `DoDService`). Chaque critère
  résout vers un `DoDCheck` (port domaine pur : `evaluate(DoDContext) → { satisfied, detail }`)
  via un registry `id → check`.
- Les gates existants deviennent des **adapters** `DoDCheck` (VerificationCheck →
  `VerificationGate`, ReviewVerdictCheck → `classifyReviewVerdict`, EvidenceCheck →
  `WorkspaceInspectionPort`). Aucune logique de gate réécrite : on déplace, on n'invente pas.
- **iamthelaw** : `Rule` gagne un champ optionnel `check?: string`. Règle avec `check`
  ⇒ critère DoD **enforcé**. Règle sans `check` ⇒ advisory, injectée dans le prompt
  superviseur (corrige `iamtheLawRules: ''`). Pas de moteur de règles générique (YAGNI).
- **Budget** : `StoryBudget` (réutilise le port `BudgetGuard`) réinitialisé par story dans
  la `storyLoop` d'`OrchestratorService` ; trip ⇒ `nextStatus='blocked'` pour CETTE story
  (pas `aborted` du run). `DoDLimiter` câblé : N rejets DoD ⇒ `blocked` + escalade.
- Tout est **opt-in par injection** : sans registry/budget injectés, le comportement
  ADR-016/017 est inchangé.

## Conséquences

- Une seule vérité de complétion, déclarative et testable ; ajouter un critère = config,
  pas code (OCP).
- DIP : le runner dépend de `DoDService` (abstraction), plus des gates concrets.
- iamthelaw passe d'advisory à enforced sans moteur de règles (frontière nette :
  `check` ⇒ DoD, sinon prompt-context).
- Une story pathologique est isolée (budget + limiter par story) sans tuer le run.
- Hors-scope (suivi) : kill intra-commande (AbortSignal SDK, risqué — déjà noté ADR-017) ;
  checks custom projet au-delà du registry built-in ; UI mission-control des violations DoD
  (fiche 0016).
- Risque : le registry doit rester le SEUL chemin de transition, sinon on duplique les
  gates. Un test d'invariant garde que le runner n'appelle plus les gates en direct.

## Découpage

Cet épic est découpé en fiches **0013** (DoDCheck port + registry + refactor du seam — POC,
P1), **0014** (iamthelaw enforced, P2), **0015** (StoryBudget + DoDLimiter, P2),
**0016** (surfaçage des violations en mission-control, P3, optionnel).

## Décision ouverte (à trancher avant impl de 0013)

Politique par défaut quand `iamthelaw/global.yaml` est absent (cas d'un projet vierge,
ex. cobaye) : appliquer les critères built-in par défaut (posture actuelle de
`DoDService`, **enforcement sûr**, cohérent ADR-016) **ou** démarrer permissif (opt-in).
Recommandation : garder le comportement actuel (built-in defaults appliqués).
