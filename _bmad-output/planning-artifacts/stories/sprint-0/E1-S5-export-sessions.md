# Story E1-S5: Export Sessions

Status: done
Sprint: 0

## Story

As a Developer, I want to export session data (stories, logs, reports) for archiving or post-sprint review, so that I can track what happened during each autonomous session.

## Acceptance Criteria

- AC1: Le System peut générer un rapport markdown de session à partir des logs JSONL
- AC2: Le rapport inclut les métriques clés : stories complétées/échouées, steps exécutés, total événements
- AC3: Les rapports sont persistés dans `.cop1/reports/` avec un nom horodaté (ISO timestamp)
- AC4: Le JSONLReader peut parser les fichiers de log structurés

## Dev Notes

- Package: `@cop1/observability`
- Fichiers principaux :
  - `packages/observability/src/features/report/application/SessionReportService.ts`
  - `packages/observability/src/features/report/infrastructure/JSONLReader.ts`
- FR associé : FR40

## Dev Agent Record

Story implémentée sans fichier story formel. Fichier créé rétroactivement le 2026-02-24 pour cohérence du backlog.
