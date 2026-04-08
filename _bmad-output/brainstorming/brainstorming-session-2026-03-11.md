---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'Distribution, installation, dogfooding et orchestration de cop1'
session_goals: 'Explorer les modèles de packaging, isolation worktree/docker, mode step-by-step, agent master, et architecture sidecar'
selected_approach: 'ai-recommended + progressive-flow'
techniques_used: ['Morphological Analysis', 'First Principles Thinking', 'Chaos Engineering', 'Decision Tree Mapping']
ideas_generated: [38]
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** elzinko
**Date:** 2026-03-11

## Session Overview

**Topic:** Distribution, installation, dogfooding et orchestration de cop1
**Goals:** Explorer les modèles de packaging/distribution, l'isolation worktree/docker, le mode step-by-step, l'agent master, et l'architecture sidecar cop1↔projet

### Context Guidance

- cop1 = framework d'agents IA autonomes (TypeScript, monorepo, hexagonal architecture)
- Utilise BMAD comme source de stories (fichiers markdown + YAML)
- Déjà 102+ stories implémentées (Phase 1 complète, Phase A en cours)
- Supporte déjà le mode worktree pour l'exécution isolée du code
- Question centrale : comment cop1 sera distribué et installé sur des projets tiers

### Key Insights from User

- cop1 DOIT être une app isolée du projet (pas embarquée dedans)
- Le sprint tourne dans un worktree → isolation totale du repo source
- Le rendu peut tourner dans un Docker isolé
- cop1 lui-même peut être lancé de façon isolée
- Deux modes d'init : créer un nouveau projet OU ajouter cop1 à un projet existant
- cop1 pilote le projet et a BMAD installé sur lui
- L'intrication cop1↔BMAD↔projet est le nœud central à démêler

### Session Setup

**Approach:** AI-Recommended + Progressive Flow (combiné)

## Technique Selection

**Approach:** AI-Recommended + Progressive Flow
**Journey Design:** Systematic development from exploration to action

**Progressive Techniques:**

- **Phase 1 - Exploration:** Morphological Analysis — cartographier toutes les combinaisons
- **Phase 2 - Patterns:** First Principles Thinking — identifier les vérités fondamentales
- **Phase 3 - Développement:** Chaos Engineering — stress-tester les solutions
- **Phase 4 - Action:** Decision Tree Mapping — tracer le plan de décision

## Technique Execution Results

### Phase 1 — Morphological Analysis

**Matrice des paramètres explorés :**

| Paramètre | Options identifiées | Décision/Tendance |
|-----------|-------------------|-------------------|
| Où vit cop1 | CLI globale, App standalone, Container, Module BMAD | CLI simple d'abord, évolutif vers app/cloud |
| Comment cop1 parle à BMAD | spawn('claude', slash-command) via CLI | Validé — modèle actuel conservé |
| Où vit BMAD | `_bmad/` dans le projet cible | Validé — un contexte BMAD par projet |
| Bootstrap nouveau projet | cop1 vérifie BMAD, bloque si absent | L'utilisateur fait `bmad install` lui-même (V1) |
| Isolation d'exécution | Git worktree | Validé — sandbox totale |
| Livrable d'un sprint | PR GitHub + lien de démo local | Review → merge ou reject |
| Dogfooding | cop1 s'ajoute lui-même comme projet | Même flux que tout projet grâce au worktree |
| Multi-projets (futur) | Interface web, cloud, multi-équipes | Hors scope V1 |

### Phase 2 — First Principles Thinking

**Vérité fondamentale : la frontière cop1 / BMAD**

| Couche | Rôle | Nature |
|--------|------|--------|
| **BMAD** | Définit le QUOI et le COMMENT (workflows, agents, méthode) | Déclaratif — markdown/yaml |
| **cop1** | Exécute le QUAND et le OÙ (spawn sessions, worktrees, orchestration) | Code — TypeScript |

**Un module BMAD ne peut PAS spawner de processus.** C'est purement déclaratif (markdown, YAML, CSV). Vérifié dans le code et la roadmap BMAD.

**Modèle à deux couches validé :**

1. `bmad install cop1-method` → installe la méthode (agent superviseur, règles, config)
2. `npm install -g @cop1/cli` → installe le moteur d'exécution TypeScript

**Validation roadmap BMAD (docs.bmad-method.org/roadmap/) :**

- "Dev Loop Automation" confirmé comme créneau que cop1 remplit
- "Adaptive Skills" supporte l'idée de LLM différents par agent
- Aucune mention de spawn de processus, daemon, ou orchestrateur autonome dans la roadmap
- cop1 est complémentaire à BMAD, pas concurrent

### Phase 3 — Chaos Engineering

**Scénarios stress-testés :**

| Scénario | Verdict | Action V1 |
|----------|---------|-----------|
| Dogfooding modifie cop1 lui-même | Pas un problème — cycle deploy classique | merge → rebuild → restart |
| Crash mid-sprint (worktree fantôme) | Worktree intact, repo safe | Jeter le worktree, relancer from scratch |
| Dérive architecturale silencieuse | Couvert par iamthelaw + DoD | Vérifier la complétude des règles |
| Sprints parallèles multi-projets | Hors scope V1 | Un projet à la fois, rate-limit module plus tard |
| Bootstrap projet vide sans BMAD | cop1 ne fait pas le bmad install | Vérifier présence BMAD, bloquer avec message si absent |
| Worktree divergent (conflit post-hotfix) | Git/GitHub gèrent déjà ça | L'humain résout le conflit sur la PR |

**Constat : le worktree comme sandbox + la PR comme point de validation = architecture très robuste. Aucune faille fondamentale identifiée.**

### Phase 4 — Decision Tree Mapping

**Architecture du superviseur :**

Le superviseur est un **GPS** (guide), pas un **chauffeur** (exécuteur).

**Flux d'exécution d'un sprint :**

```
cop1 lance bmad-help + sprint-status
         │
         ▼
cop1 envoie les résultats au superviseur (agent BMAD)
         │
         ▼
superviseur analyse → répond: "lance /bmad-bmm-code-review sur E1-S3"
         │
         ▼
cop1 exécute la commande (session Claude isolée, dans le worktree)
         │
         ▼
cop1 relance bmad-help + sprint-status (cycle suivant)
         │
         ▼
... boucle jusqu'à condition d'arrêt
```

**Le superviseur est stateless** — bmad-help + sprint-status contiennent déjà l'état du monde. cop1 lui fournit une photo fraîche à chaque itération.

**Conditions d'arrêt (toutes actives, première déclenchée = stop) :**

1. Le superviseur dit "sprint terminé" (toutes stories done)
2. Budget tokens épuisé
3. Erreur non récupérable
4. Interruption manuelle par l'humain
5. Nombre max de boucles atteint (sécurité anti-boucle infinie)

**Arbre de décision — Installation & Lancement :**

```
Q1: Que contient cop1 ?
├── Partie MÉTHODE → Module BMAD "cop1-method"
│   (agent superviseur, règles, config)
└── Partie MOTEUR → Package npm "@cop1/cli"
    (spawn, worktree, orchestration, daemon, web UI)

Q2: Comment installer ?
├── Prérequis: BMAD installé (cop1 vérifie, bloque si absent)
├── bmad install cop1-method
└── npm install -g @cop1/cli

Q3: Comment lancer ?
└── cop1 start --project ~/mon-projet
    ├── Vérifie BMAD ✓
    ├── Vérifie cop1-method ✓
    ├── Lance daemon + web UI
    └── Affiche dashboard

Q4: Comment exécuter un sprint ?
└── Utilisateur déclenche (UI ou CLI)
    ├── cop1 crée worktree depuis HEAD
    ├── Boucle: bmad-help + sprint-status → superviseur → exécution
    ├── Sprint terminé → crée PR GitHub + lien démo local
    └── Conditions d'arrêt: sprint done / budget / erreur / humain / max boucles

Q5: Comment valider ?
├── OK → merge PR → (rebuild si dogfooding)
└── KO → reject PR → worktree nettoyé, rien n'a changé
```

## Session Highlights

**Découvertes clés :**

1. **cop1 = deux couches** : module BMAD (méthode) + CLI TypeScript (moteur)
2. **Le worktree est la clé** : isolation totale, PR comme seul point de contact
3. **Le superviseur est un GPS stateless** : cop1 lui fournit bmad-help + sprint-status, il répond avec la prochaine commande
4. **BMAD ne deviendra pas un orchestrateur** (confirmé par la roadmap) : cop1 est complémentaire
5. **V1 simple** : un projet à la fois, pas de bmad install automatique, worktree jetable en cas de crash

**Points à creuser en architecture (hors brainstorming) :**

- Spécification détaillée de l'agent superviseur cop1-method
- Format exact de la communication cop1 → superviseur
- Mode step-by-step (logs structurés, visualisation terminal)
- Mécanisme de lien de démo local depuis un worktree
- Graceful shutdown de cop1 (checkpoint sprint en cours)
