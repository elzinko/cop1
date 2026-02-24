# Story E2.S4: Story Enrichment

Status: ready-for-dev

## Story

As a Developer,
I want agents to append sections to story snapshots (Dev Notes, Agent Record, Change Log),
so that each story accumulates context from the development process.

## Acceptance Criteria

1. `EnrichmentService.append(snapshotId, section, content)` ajoute une section au snapshot sans écraser le contenu existant (`safeAppend()`).
2. `safeAppend()` : crash simulé en cours d'écriture (mock) → le fichier snapshot reste lisible et non corrompu.

## Tasks / Subtasks

- [ ] Créer `EnrichmentService` dans sprint-core
  - [ ] `application/EnrichmentService.ts`
  - [ ] `append(snapshotPath, section, content)` — ajoute sous la section existante
  - [ ] `safeAppend()` — write to .tmp → rename atomique (POSIX)

- [ ] Tests
  - [ ] append ajoute bien la section au fichier existant
  - [ ] safeAppend crash simulation → fichier intact
  - [ ] Contenu existant préservé après append

## Dev Notes

- **Package** : `@cop1/sprint-core`
- **Atomic write** : write to `.tmp` file, then `rename()`. Sur crash, le `.tmp` est abandonné et le fichier original est intact.
