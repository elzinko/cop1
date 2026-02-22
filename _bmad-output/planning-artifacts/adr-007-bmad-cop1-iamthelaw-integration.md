# ADR-007 — Intégration BMAD / cop1 / iamthelaw : Architecture 2 couches

**Date :** 2026-02-22
**Statut :** Proposé
**Auteurs :** elzinko, Claude Opus 4.6
**Contexte :** Idéation Phase 2+ de cop1

---

## Contexte

cop1 est un orchestrateur autonome d'agents IA qui exécute des sprints de développement. Il coexiste avec BMAD (v6.0.0), un framework de context-engineering interactif utilisé pour la planification (PRD, architecture, epics/stories).

Trois systèmes doivent cohabiter :
- **BMAD** : framework interactif, prompts riches, workflows humain-dans-la-boucle
- **cop1** : daemon autonome, exécution overnight, pipeline Dev→Review→QA→PM
- **iamthelaw** : système de règles évolutif par agent, CRUD, audit trail

La question architecturale : comment ces trois systèmes s'intègrent-ils sans créer d'adhérence forte, tout en maximisant la valeur de chacun ?

---

## Décision

### Principe fondateur : Architecture 2 couches avec fichiers partagés

```
┌─────────────────────────────────────────────────────────────┐
│  COUCHE 1 — INTERACTIVE (BMAD natif)                        │
│                                                              │
│  Exécution : Humain + LLM dans IDE (Claude Code, Cursor)    │
│  Rôle : Planning, solutioning, cérémonies interactives       │
│  Commandes : /bmad-bmm-sprint-planning, /bmad-bmm-dev-story │
│  Extension : customize.yaml + sidecar mémoire                │
│                                                              │
│  Le Developer reste le Product Owner.                        │
│  BMAD n'est JAMAIS modifié (core, bmm, bmb, tea).           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    Fichiers partagés
                    (zones de lecture/écriture définies)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  COUCHE 2 — AUTONOME (cop1 daemon)                           │
│                                                              │
│  Exécution : SprintRunner, agents TypeScript, LLM local/cloud│
│  Rôle : Exécution sprint, auto-amélioration, observabilité   │
│  Pipeline : PromptComposer → Dev → Review → QA → PM → Rétro │
│  Extension : iamthelaw rules, AgentScoringService            │
│                                                              │
│  Fonctionne 100% sans humain (mode nuit).                    │
│  Peut aussi fonctionner en mode interactif (pause/resume).   │
└──────────────────────────────────────────────────────────────┘
```

### Zones de fichiers : Contrat de lecture/écriture

| Zone | cop1 lit | cop1 écrit | BMAD lit | BMAD écrit | Propriétaire |
|------|----------|------------|----------|------------|-------------|
| `_bmad/core/`, `_bmad/bmm/`, `_bmad/bmb/`, `_bmad/tea/` | Non | **JAMAIS** | Oui | Non (installeur) | BMAD |
| `_bmad/_config/agents/*.customize.yaml` | Oui | Oui (sync rules) | Oui | Oui (humain) | Partagé |
| `_bmad/_memory/iamthelaw-sidecar/` | Oui | Oui | Oui | Oui (via agent) | cop1 |
| `_bmad-output/project-context.md` | Oui | Non | Oui | Oui (workflow) | BMAD |
| `_bmad-output/planning-artifacts/stories/` | Oui (lecture seule) | **JAMAIS** | Oui | Oui | BMAD |
| `.cop1/rules/` | Oui | Oui | Non | Non | cop1 |
| `.cop1/sprint-log-*.jsonl` | Oui | Oui | Non | Non | cop1 |
| `.cop1/scores/` | Oui | Oui | Non | Non | cop1 |
| `cop1.config.yaml` | Oui | Non | Non | Non | Humain |

### Mécanisme d'intégration : Option B (Sidecar Memory)

L'intégration repose sur un **sidecar mémoire BMAD** contrôlé par cop1 :

```
_bmad/_memory/iamthelaw-sidecar/
├── rules.md              # Règles actives (format LLM-friendly)
├── instructions.md       # Comment les agents doivent appliquer les règles
├── history.md            # Évolution narrative des règles
└── agent-scores.md       # Scores des agents (pour info BMAD)
```

**Synchronisation :**
1. cop1 maintient ses règles dans `.cop1/rules/active-rules.yaml` (format machine)
2. Après chaque rétro auto, cop1 synchronise vers `_bmad/_memory/iamthelaw-sidecar/rules.md` (format LLM)
3. Les customize.yaml des agents BMAD chargent le sidecar via `critical_actions`
4. Les agents BMAD bénéficient des règles évolutives sans modification BMAD

**Injection dans les agents BMAD :**
```yaml
# _bmad/_config/agents/bmm-dev.customize.yaml
critical_actions:
  - "MANDATORY: Load {project-root}/_bmad/_memory/iamthelaw-sidecar/rules.md"
  - "MANDATORY: Load {project-root}/_bmad/_memory/iamthelaw-sidecar/instructions.md"
  - "Verify ALL planned changes comply with active rules before implementing"

memories:
  - "Ce projet utilise iamthelaw: un système de règles évolutif géré par cop1"
  - "Les règles sont apprises des rétrospectives et code reviews sprint après sprint"
```

### Composition des prompts agents cop1 : PromptComposer

```
┌──────────────────────────────────────────────────────┐
│                    PROMPT FINAL                       │
├──────────────────────────────────────────────────────┤
│  TEMPLATE DE BASE (versionné)                        │
│  - Rôle de l'agent (persona simplifiée)              │
│  - Structure de sortie attendue                      │
│  - Format de réponse                                 │
├──────────────────────────────────────────────────────┤
│  AGRÉGAT: PROJECT CONTEXT                            │
│  - Lu depuis _bmad-output/project-context.md         │
│  - Tech stack, conventions, patterns                 │
├──────────────────────────────────────────────────────┤
│  AGRÉGAT: RULES (iamthelaw)                          │
│  - Lu depuis .cop1/rules/active-rules.yaml           │
│  - Règles globales + règles spécifiques à l'agent    │
│  - Inclut les lessons learned des rétros             │
├──────────────────────────────────────────────────────┤
│  AGRÉGAT: MÉMOIRE AGENT                              │
│  - Erreurs fréquentes de cet agent                   │
│  - Patterns préférés du reviewer                     │
│  - Feedback des sprints précédents                   │
├──────────────────────────────────────────────────────┤
│  STORY CONTENT (snapshot BMAD structuré)             │
│  - Acceptance Criteria extraits                      │
│  - Tasks / Subtasks                                  │
│  - Dev Notes                                         │
└──────────────────────────────────────────────────────┘
```

**Interface TypeScript :**
```typescript
interface PromptComposer {
  compose(params: {
    template: PromptTemplate;
    projectContext: string;
    rules: RuleSet;
    agentMemory: AgentMemory;
    storyContent: string;
  }): string;
}
```

### Escalade cloud avec contrôle budgétaire

```
┌──────────────────────────────────────────────┐
│          TokenBudgetService                   │
├──────────────────────────────────────────────┤
│ Limites configurables :                       │
│   - Par sprint (token_budget_per_sprint)      │
│   - Par agent (per_agent_limits.dev: 50000)   │
│   - Par session (session_max_tokens)          │
│   - Hebdomadaire cloud (cloud_weekly_limit)   │
│                                               │
│ Alertes :                                     │
│   - 50% → log                                 │
│   - 80% → notification (dashboard/telegram)   │
│   - 95% → pause_and_ask                       │
│                                               │
│ Escalade :                                    │
│   - Vérifier budget AVANT chaque appel cloud  │
│   - Si budget épuisé → rester en local        │
│   - Si local échoue 2x → demander override PO │
│                                               │
│ Forçage (sous llm_routing: dans config) :     │
│   - force_provider: cloud/local/auto          │
│   - force_model: claude-opus-4-6              │
│   - optimize_weekly_usage: true               │
└──────────────────────────────────────────────┘
```

### Évolution future : Module BMAD iamthelaw (Option C)

Quand le système sera mature, packager iamthelaw comme module BMAD :
- Module type : **Extension** de BMM
- Agent : "Judge" (persona règles)
- Workflows intégrés au phase sequence BMM (seq 42: rule-check, seq 52: rule-review, seq 58: rule-retro)
- Publiable sur npm pour le marketplace BMAD
- Pilotable par cop1 via lecture/écriture des fichiers du module

Cette évolution **ne bloque pas** l'Option B qui fonctionne immédiatement.

---

## Alternatives considérées

### Alternative 1 : Fork BMAD

- **Avantage** : Contrôle total, modification directe des workflows
- **Rejeté car** : Maintenance lourde, divergence rapide avec upstream, perte des mises à jour BMAD, communauté fragmentée

### Alternative 2 : Remplacement total de BMAD par cop1

- **Avantage** : Architecture unifiée, pas de double système
- **Rejeté car** : BMAD excelle en planification interactive (60+ commandes, personas riches, rétro 1400 lignes). Reconstruire cela serait un effort disproportionné sans valeur ajoutée.

### Alternative 3 : Injection directe dans project-context.md

- **Avantage** : Zéro config, tous les workflows BMAD le chargent déjà
- **Rejeté car** : Risque d'écrasement si `generate-project-context` est relancé. Mélange de préoccupations (conventions stables vs règles évolutives).

### Alternative 4 : MCP Server BMAD (bmad-mcp-server)

- **Considéré pour plus tard** : Le package npm `bmad-mcp-server` de mkellerman fournit un `BMADEngine` qui assemble les prompts BMAD programmatiquement. cop1 pourrait l'utiliser pour enrichir ses prompts avec le contexte BMAD complet.
- **Pas retenu en MVP** car : dépendance externe, API pas encore stable, cop1 peut lire les fichiers directement.
- **À réévaluer** quand BMAD aura un MCP officiel.

### Alternative 5 : Claude Code Agent Teams

- **Considéré pour le futur** : Issue #1584 BMAD valide un pattern où des teammates Claude Code exécutent les slash commands BMAD nativement.
- **Pas retenu en MVP** car : nécessite Claude Code comme runtime (pas de modèles locaux), coût élevé, feature expérimentale.
- **Pertinent quand** : cop1 voudra exécuter les workflows BMAD interactifs en autonome.

---

## Conséquences

### Positives
- **Zéro adhérence** avec BMAD core : cop1 ne modifie jamais les fichiers BMAD installés
- **Survit aux mises à jour BMAD** : customize.yaml et _memory/ sont dans les zones safe
- **Double bénéfice** : les agents BMAD interactifs ET les agents cop1 autonomes profitent des règles iamthelaw
- **Évolutif** : le chemin vers un module BMAD complet (Option C) est tracé sans bloquer le MVP
- **Local-first** : cop1 gère l'exécution locale (Ollama), BMAD gère la planification interactive

### Négatives
- **Double format de règles** : `.cop1/rules/` (YAML machine) + `_bmad/_memory/iamthelaw-sidecar/rules.md` (markdown LLM) nécessitent une synchronisation
- **Pas de hook natif** : cop1 ne peut pas s'insérer "dans" un workflow BMAD (limitation BMAD : pas d'events, pas de plugins inline)
- **Complexité cognitive** : l'utilisateur doit comprendre quand utiliser BMAD (interactif) vs cop1 (automatique)

### Risques
- **BMAD évolue rapidement** : les zones safe (customize.yaml, _memory/) pourraient changer dans une future version majeure → mitigation : verrouiller une version BMAD dans package.json, tester les mises à jour avant adoption
- **Divergence des règles** : si l'utilisateur modifie project-context.md manuellement ET cop1 modifie le sidecar → mitigation : le PromptComposer fusionne les deux sources, project-context a priorité (stable > évolutif)

---

## Métriques de validation

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Aucun fichier BMAD core modifié par cop1 | 0 modifications | `grep -r "writeFile.*_bmad/bmm\|_bmad/core" packages/` |
| Customize.yaml survivent à `npx bmad-method install` | 100% conservés | Test : installer BMAD, vérifier presence customize.yaml |
| Sidecar sync après rétro auto | < 5s latence | Timestamp diff entre `.cop1/rules/` et sidecar |
| Prompts enrichis vs prompts simples : taux rejet reviewer | < 30% (vs > 60% actuel) | AgentScoringService |
| Budget cloud respecté | 0 dépassement non-autorisé | TokenBudgetService logs |

---

## Références

- ADR-001, ADR-002, ADR-003, ADR-005, ADR-006 : `_bmad-output/planning-artifacts/architecture.md`
- BMAD Method v6.0.0 : https://docs.bmad-method.org
- BMAD Builder : https://github.com/bmad-code-org/bmad-builder
- BMAD MCP Server (community) : https://github.com/mkellerman/bmad-mcp-server
- Claude Code Agent Teams : https://github.com/bmad-code-org/BMAD-METHOD/issues/1584
- iamthelaw domain : `packages/sprint-core/src/features/iamthelaw/`
- RuleApplicationService : `packages/app/src/features/rule-application/`
