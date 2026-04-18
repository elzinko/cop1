# Sprint 15 — Conversation Log (2026-04-18)

Epic: EA14 — Real-Run Closure & Hygiene
Participants: elzinko (opérateur), Claude Opus 4.6 (pilote)
Mode: continuation de la session EA13 (même fenêtre de conversation, 2 jours après)

---

## 12:15 — Reprise

**elzinko** revient 2 jours après le Sprint 14. Il invoque `/bmad-help` pour voir les prochaines étapes.

**Claude** détecte l'état courant : EA13 done, retro done, real-run analysé. Recommande le flow Correct Course (CC) → Sprint Planning (SP) → boucle stories. Détaille les commandes BMAD avec leur agent, description et outputs.

## 12:20 — L'opérateur demande l'automatisation complète

**elzinko** : "ok peux tu m'indiquer les commandes bmad prochaines avec les prompt adaptés ? Peux tu ensuite les lancer depuis ce prompt et faire les clear si nécessaire pour lancer chaque sous-agent avec un contexte neuf ? sais tu faire ca ? merci d'automatiser tout et d'accepter toutes les modifications. Tu dois être le pilote des commandes bmad et faire au mieux pour atteindre l'objectif des prochaines epics / story faites. Tu peux demander à des agents de conseils si tu es bloqué. Referes toi aux conseils prodigués par la commande bmad-help si besoin."

→ Claude prend le rôle de pilote BMAD complet. Stratégie : substituer les `/clear` par des sous-agents dédiés qui démarrent avec un contexte neuf (équivalent fonctionnel).

## 12:25 — Phase 1 : SCP EA14 (sous-agent)

**Claude** lance un sous-agent `general-purpose` avec un prompt self-contained briefant le contexte EA13 retro + real-run. Le sous-agent produit le SCP à `sprint-change-proposal-2026-04-18.md` avec 6 stories en ~2 minutes.

Pas d'intervention opérateur.

## 12:30 — Phase 1 : epics.md + sprint-status (sous-agent)

Second sous-agent qui insère la section EA14 dans epics.md et ajoute les 6 stories en backlog dans sprint-status.yaml. Met à jour les récapitulatifs (Sprint 15 row, totaux).

Commit de planning : `c9bbace`.

## 12:35 — Phase 2 : S1-S3 séquentiels (sous-agents)

Claude lance les 3 stories HIGH séquentiellement, chacune via un sous-agent autonome :

**EA14-S1** (~3 min) : pre-flight guard `_bmad/`. Le sous-agent lit l'orchestrator, ajoute `existsSync`, écrit 3 tests. Commit : `1bc1745`.

**EA14-S2** (~7 min) : le plus gros du sprint. Le sous-agent investigue, découvre que `ExchangeHistoryWriter` existe mais n'est câblé nulle part dans le flow orchestrator. Crée `SessionInteractionCollector` (extends SessionLogger, collecte en mémoire), enrichit `DefaultBMADCommandRunner` avec Track 2 write, rewire orchestrator.ts. 9 tests. Commit : `e4794d8`.

**EA14-S3** (~5 min) : le sous-agent lit `SupervisorPromptBuilder.ts` et `SupervisorMcpServer.ts`. Constate que le tool `commit_anchor` est enregistré MCP mais jamais mentionné dans le prompt. Ajoute une section conditionnelle "Commit Anchor" quand `workflowCommand` contient `dev-story`. 4 tests. Commit : `c9fda74`.

Pas d'intervention opérateur sur S1-S3.

## 13:15 — Phase 2 : S4/S5/S6 en parallèle (3 sous-agents)

**Claude** décide de lancer les 3 stories hygiene en parallèle (fichiers a priori disjoints). 3 sous-agents `general-purpose` lancés dans le même message.

**S4** (SupervisorContext rename) : renomme `SupervisorContext` → `SupervisorQuestionContext` dans ~13 fichiers. Succès.

**S5** (SprintRunner tests) : identifie la root cause (fixture path `planning-artifacts/stories/sprint-0/` vs attendu `implementation-artifacts/`). Dit avoir corrigé. Succès rapporté.

**S6** (lint hygiene) : corrige 28 violations dans 14 fichiers (import sorting, formatting, règles manuelles). Succès rapporté.

## 13:30 — Réconciliation post-parallèle

**Claude** vérifie l'état combiné. Constat :
- Build : **vert**
- Tests : **9 toujours en échec** — le fix S5 n'a pas pris (probablement écrasé par S4 ou S6 qui touchaient les mêmes fichiers). Le sous-agent a rapporté succès mais le fichier n'a pas été modifié.
- Lint : **12 erreurs** — import sorting + formatting réintroduits par les sous-agents parallèles.

→ **Résolution manuelle par Claude** :
1. Fix SprintRunner.test.ts : path corrigé manuellement (confirmed par lecture du fichier : toujours l'ancien path)
2. Fix bmad-pipeline-e2e.test.ts : même correction
3. `biome check --fix` pour l'import sorting → réduit mais le `--unsafe` a converti des `!` en `?.` → TS build cassé (SprintRunner.ts + ExchangeHistoryReader.test.ts)
4. Fix SprintRunner.ts : pattern guard-after-assignment au lieu de `?.`
5. Fix ExchangeHistoryReader.test.ts : narrowing explicite (`toBeDefined()` + local var + `!`)

Gate finale : build 0 erreurs, 828 tests / 0 fails, lint 0 erreurs / 26 warnings.

## 13:45 — Clôture

Epic EA14 marqué done. Commit bundled : `52c7822` (37 fichiers).

---

## Observations sur le mode de travail

### Ce qui a bien fonctionné
- **Sous-agents séquentiels pour S1-S3** : chaque agent a un contexte neuf, produit un résultat isolé. Pas de conflit. Rythme rapide (~15 min pour 3 stories).
- **Pilotage BMAD sans les slash commands** : la substitution "sous-agent avec prompt briefé" fonctionne. L'agent produit les mêmes artefacts qu'un `/bmad-bmm-create-story` + `/bmad-bmm-dev-story` combinés.
- **Continuité cross-session** : la reprise 2 jours après fonctionne grâce aux artefacts persistants (retro, deferred.md, sprint-status.yaml).

### Ce qui n'a pas fonctionné
- **Sous-agents parallèles sur fichiers partagés (S4/S5/S6)** : 3 agents touchent le même barrel (`sprint-core/src/index.ts`) et des fichiers voisins. Le résultat est un merge implicite avec des pertes. Le fix de S5 a été écrasé. S6 a réintroduit des problèmes de formatting. Leçon : le parallélisme fonctionne uniquement si les scopes fichier sont **strictement disjoints**.
- **`biome check --fix --unsafe` en automatique** : la conversion `!` → `?.` est sémantiquement dangereuse quand TypeScript strict-null est actif. L'unsafe fix a cassé le build sur 2 fichiers. Leçon : toujours vérifier le build après un auto-fix biome.

### Confiance dans les rapports de sous-agents
L'agent S5 a rapporté "13/13 tests pass" mais le fix n'était pas effectivement dans le fichier. Rappel : les sous-agents rapportent ce qu'ils **ont fait**, pas ce qui a **survécu** à la combinaison. Le parent doit toujours vérifier le résultat combiné.

### Moments de pivot
1. **13:15** : décision de paralléliser S4/S5/S6 au lieu de séquentialiser (gain de temps, risque accepté)
2. **13:30** : découverte que le parallélisme a cassé les choses → passage en résolution manuelle
3. **13:40** : `biome --unsafe` casse le build → fix manuel des conversions `!`→`?.`
