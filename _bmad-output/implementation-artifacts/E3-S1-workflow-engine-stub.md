# Story E3.S1: Workflow Engine — Orchestration Stub

Status: ready-for-dev

## Story

As a Developer,
I want a working Workflow Engine that orchestrates agent steps sequentially and calls a QualityGate between each step,
so that Sprint 1's DevAgent and ReviewerAgent have a reliable execution framework to plug into.

## Acceptance Criteria

1. `WorkflowEngine.run(storyId)` exécute une séquence configurable d'étapes (Dev → Reviewer → QA → PM) et appelle `QualityGateService` entre chaque étape — chaque étape est un stub retournant `{status: 'ok'}` en Sprint 0.
2. `WorkflowEngine` émet des événements dot-notation à chaque transition : `story.workflow.started`, `story.step.completed`, `story.workflow.completed`.
3. Un test d'intégration exécute le workflow complet sur une story fictive et vérifie que toutes les étapes sont appelées dans l'ordre.

## Tasks / Subtasks

- [ ] Définir les types du domaine dans `packages/sprint-core/` (AC: #1)
  - [ ] `src/features/workflow/domain/WorkflowStep.ts` — interface `WorkflowStep { name: string, run(context: WorkflowContext): Promise<StepResult> }`
  - [ ] `src/features/workflow/domain/WorkflowContext.ts` — `{ storyId: string, projectPath: string, config: Cop1Config }`
  - [ ] `src/features/workflow/domain/StepResult.ts` — `{ status: 'ok' | 'failed' | 'blocked', error?: Error }`
  - [ ] `src/features/workflow/domain/WorkflowEvent.ts` — constantes dot-notation : `story.workflow.started`, `story.step.started`, `story.step.completed`, `story.workflow.completed`, `story.workflow.failed`

- [ ] Créer `WorkflowEngine` dans l'application (AC: #1, #2)
  - [ ] `src/features/workflow/application/WorkflowEngine.ts`
  - [ ] `WorkflowEngine.run(storyId, steps)` : boucle sur les steps, appelle `QualityGateService.runAll()` après chaque step (sauf le dernier)
  - [ ] Émet `story.workflow.started` avant la première étape
  - [ ] Émet `story.step.completed` après chaque étape réussie
  - [ ] Émet `story.workflow.completed` à la fin (ou `story.workflow.failed` en cas d'erreur)
  - [ ] Si un step retourne `{status: 'failed'}` → arrêt immédiat, `story.workflow.failed` émis

- [ ] Créer `QualityGateService` stub dans `packages/quality-intelligence/` (AC: #1)
  - [ ] `src/features/quality-gate/application/QualityGateService.ts`
  - [ ] Interface `QualityGatePort` dans `domain/ports/`
  - [ ] En Sprint 0 : `runAll(context)` retourne toujours `{passed: true, gates: []}` (stub)
  - [ ] En Sprint 2 (E10-S6) : remplacé par l'implémentation réelle

- [ ] Créer les stubs d'agents (AC: #1, #3)
  - [ ] `DevAgentStep` dans `sprint-core` (stub) : `run()` → log + retourne `{status: 'ok'}` après 100ms
  - [ ] `ReviewerAgentStep` stub : idem
  - [ ] `QAAgentStep` stub : idem
  - [ ] `PMAgentStep` stub : idem
  - [ ] Configuration de la séquence dans `cop1.config.yaml` : `workflow.steps: ['dev', 'reviewer', 'qa', 'pm']`

- [ ] Intégrer dans le daemon (AC: #2)
  - [ ] `DaemonService` expose `POST /api/workflow/run` → reçoit `{storyId}` → démarre `WorkflowEngine.run()`
  - [ ] Les événements `WorkflowEngine` sont propagés vers `EventBus` (E7-S1) → disponibles sur SSE en Sprint 1

- [ ] Tests (AC: #1, #2, #3)
  - [ ] Test unitaire `WorkflowEngine` : 3 steps stubs → appelés dans l'ordre, `QualityGateService` appelé 2 fois (entre step 1-2 et step 2-3)
  - [ ] Test : step 2 retourne `{status: 'failed'}` → step 3 non appelé, `story.workflow.failed` émis
  - [ ] Test d'intégration : workflow complet sur story fictive, vérifier l'ordre exact des événements émis

## Dev Notes

- **Package** : `@cop1/sprint-core` pour `WorkflowEngine` et les stubs d'agents. `@cop1/quality-intelligence` pour `QualityGateService`.
- **PlanningDecision protocol** : `WorkflowEngine` ne fait jamais de cross-package writes. Il appelle des services via leurs ports injectés uniquement.
- **Injection de dépendances** : `WorkflowEngine` reçoit `QualityGatePort`, `EventBus`, et la liste des `WorkflowStep` par injection dans son constructeur (pas de singletons globaux).
- **Séquence crash-safe** : la séquence complète `agent.slot.reserved → story.status.transitioning → transition → story.status.transitioned → agent.started` sera implémentée en E3-S3 (Sprint 1). En Sprint 0, les stubs n'ont pas besoin de cette séquence.
- **Extension future** : la liste des steps est configurable (Sprint 0 : tableau fixe dans la config). En Sprint 2, chaque step sera une vraie implémentation d'agent LLM. L'interface `WorkflowStep` ne change pas.

### Project Structure Notes

```
packages/
  quality-intelligence/
    src/
      features/
        quality-gate/
          domain/
            ports/
              QualityGatePort.ts
          application/
            QualityGateService.ts   # stub Sprint 0

  sprint-core/
    src/
      features/
        workflow/
          domain/
            WorkflowStep.ts
            WorkflowContext.ts
            StepResult.ts
            WorkflowEvent.ts
          application/
            WorkflowEngine.ts
          infrastructure/
            steps/
              DevAgentStep.ts       # stub
              ReviewerAgentStep.ts  # stub
              QAAgentStep.ts        # stub
              PMAgentStep.ts        # stub
    index.ts
```

### References

- [Source: architecture.md#Implementation Patterns] — Séquence crash-safe, QualityGateService
- [Source: architecture.md#ADR-006] — PlanningDecision protocol, zéro cross-package writes
- [Source: epics.md#E3-S1] — ACs et points
- [Source: stories/sprint-0/E7-S1-resource-monitor.md] — EventBus (point d'intégration)

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
