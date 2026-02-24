# Story E8-S4: Daily Async Ceremony

Status: done
Sprint: 5

## Story

As a System, I want to conduct daily async ceremonies where agents can submit their positions asynchronously, so that ceremonies don't require all LLMs to run simultaneously.

## Acceptance Criteria

- AC1: Le type de cérémonie `DAILY` est défini dans CeremonyTypes
- AC2: L'AsyncChannelService peut collecter des réponses asynchrones par ceremonyId
- AC3: Chaque réponse contient : ceremonyId, agentName, position, submittedAt
- AC4: Les réponses sont récupérables par ceremonyId après soumission

## Dev Notes

- Package: `@cop1/ceremony-engine`
- Fichiers principaux :
  - `packages/ceremony-engine/src/features/async-channel/application/AsyncChannelService.ts`
  - `packages/ceremony-engine/src/features/async-channel/domain/AsyncChannelTypes.ts`
  - `packages/ceremony-engine/src/features/scrum-master/domain/CeremonyTypes.ts` (enum DAILY)
- Lié à E8-S8 (Developer Async Channel) dans le même sprint
- FR associés : FR82, FR85

## Dev Agent Record

Story implémentée sans fichier story formel. Fichier créé rétroactivement le 2026-02-24 pour cohérence du backlog.
