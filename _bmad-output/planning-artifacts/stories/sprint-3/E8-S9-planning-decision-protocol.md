# Story E8-S9: PlanningDecision Protocol

Status: done
Sprint: 3

## Story

As a System, I want a formal PlanningDecision protocol that captures sprint planning outputs (selected stories, total points, capacity, timestamp), so that planning decisions are structured and traceable.

## Acceptance Criteria

- AC1: L'interface PlanningDecision capture : sprintId, engagedStories[], totalPoints, capacity, decidedAt
- AC2: SprintPlanningCeremony sélectionne les stories par algorithme glouton (greedy) selon la capacité
- AC3: La sélection s'arrête quand la capacité est atteinte
- AC4: Le sprintId est généré avec un timestamp unique

## Dev Notes

- Package: `@cop1/ceremony-engine`
- Fichiers principaux :
  - `packages/ceremony-engine/src/features/planning/domain/PlanningDecision.ts`
  - `packages/ceremony-engine/src/features/planning/application/SprintPlanningCeremony.ts`
  - `packages/ceremony-engine/src/features/planning/__tests__/SprintPlanningCeremony.test.ts`
- Lié à E8-S3 (Sprint Planning Ceremony) dans le même sprint
- FR associés : FR50, FR76

## Dev Agent Record

Story implémentée sans fichier story formel. Fichier créé rétroactivement le 2026-02-24 pour cohérence du backlog.
