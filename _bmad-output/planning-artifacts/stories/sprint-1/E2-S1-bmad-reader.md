# Story E2.S1: BMAD Reader

Status: ready-for-dev

## Story

As a Developer,
I want cop1 to read and parse BMAD story files (markdown) from a project directory,
so that the system can list available stories with their metadata and verify file integrity.

## Acceptance Criteria

1. `BMADReader.listStories(projectPath)` retourne la liste des stories BMAD (fichiers markdown) avec leurs métadonnées (id, title, status, priority) — les fichiers source ne sont jamais modifiés.
2. Après lecture, un checksum SHA-256 des fichiers BMAD est calculé et stocké — `BMADReader.verifyIntegrity()` lève une erreur si un fichier a été modifié.

## Tasks / Subtasks

- [ ] Créer le domain dans `packages/sprint-core/src/features/bmad-reader/`
  - [ ] `domain/StoryMetadata.ts` — `{id, title, status, priority, filePath, checksum}`
  - [ ] `domain/ports/BMADReaderPort.ts` — interface
  - [ ] `domain/errors/IntegrityError.ts`

- [ ] Créer `BMADReader` application service
  - [ ] `application/BMADReader.ts`
  - [ ] `listStories(projectPath)` — scanne `_bmad-output/planning-artifacts/stories/` récursivement
  - [ ] Parse le frontmatter YAML (Status, title) de chaque fichier .md
  - [ ] Calcule SHA-256 du contenu de chaque fichier et le stocke
  - [ ] `verifyIntegrity()` — recalcule les checksums et compare

- [ ] Tests
  - [ ] `listStories()` sur un répertoire avec 3 fichiers .md → retourne 3 StoryMetadata
  - [ ] `verifyIntegrity()` après modification d'un fichier → lève IntegrityError
  - [ ] Fichiers source jamais modifiés (vérifier checksum avant/après)

## Dev Notes

- **Package** : `@cop1/sprint-core`
- **Parsing frontmatter** : le status est sur la ligne `Status: <value>` dans le markdown (pas de YAML frontmatter standard). Parser manuellement avec regex.
- **SHA-256** : utiliser `crypto.createHash('sha256')` natif Node.js.

### Project Structure Notes

```
packages/sprint-core/
  src/features/bmad-reader/
    domain/
      StoryMetadata.ts
      ports/BMADReaderPort.ts
      errors/IntegrityError.ts
    application/
      BMADReader.ts
    __tests__/
      BMADReader.test.ts
```
