# Story E2.S3: Story Snapshot

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to create immutable snapshots of BMAD stories before working on them,
so that the original files are never modified and agents work on isolated copies.

## Acceptance Criteria

1. `SnapshotService.createSnapshot(storyId)` crée `.cop1/stories/{storyId}-snapshot.md` copie exacte du fichier BMAD source — le snapshot inclut un header `snapshot_at` + `source_checksum`.
2. Le workflow ne travaille jamais sur le fichier BMAD original mais uniquement sur le snapshot — vérifié par un test qui mock `BMADReader` et vérifie que seul le snapshot est passé aux agents.

## Tasks / Subtasks

- [ ] Créer `SnapshotService` dans sprint-core
  - [ ] `application/SnapshotService.ts`
  - [ ] `createSnapshot(storyId, projectPath)` — lit via BMADReader, copie dans `.cop1/stories/`
  - [ ] Ajoute header YAML : `snapshot_at`, `source_checksum`, `story_id`
  - [ ] `getSnapshot(storyId, projectPath)` — lit le snapshot existant

- [ ] Tests
  - [ ] createSnapshot → fichier créé avec header correct
  - [ ] Workflow reçoit le snapshot path, pas l'original
  - [ ] Source checksum dans le header correspond au SHA-256 du fichier original

## Dev Notes

- **Package** : `@cop1/sprint-core`
- **Header format** : les lignes `<!-- snapshot_at: ... -->` en commentaire HTML au début du fichier.
