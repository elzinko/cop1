# Story E11.S3: Session Report Generator

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to generate a session report at the end of each sprint,
so that I can review what was accomplished, what blocked, and key metrics.

## Acceptance Criteria

1. En fin de session sprint, `SessionReportService.generate()` crée `.cop1/reports/{date}-{time}-session.md` en < 5 min (NFR18) avec : stories livrées, blocages, métriques clés.
2. Le rapport est généré même si le daemon a crashé (lecture depuis `.cop1/sprint-log-{date}.jsonl`) — aucune perte de rapport sur crash.

## Tasks / Subtasks

- [ ] Créer `SessionReportService` dans observability
  - [ ] `application/SessionReportService.ts`
  - [ ] `generate(projectPath, sessionDate)` — lit les logs JSONL, agrège les métriques
  - [ ] Produit un markdown structuré avec sections : Summary, Stories Completed, Blockers, Metrics

- [ ] Créer `JSONLReader` infrastructure
  - [ ] `infrastructure/JSONLReader.ts` — lit et parse un fichier JSONL ligne par ligne

- [ ] Tests
  - [ ] generate() avec logs JSONL → rapport markdown créé
  - [ ] Rapport contient les stories terminées
  - [ ] Rapport généré même sans session active (depuis logs)

## Dev Notes

- **Package** : `@cop1/observability`
- **Dépendance** : E11-S4 (StructuredLogger) pour le format JSONL.
