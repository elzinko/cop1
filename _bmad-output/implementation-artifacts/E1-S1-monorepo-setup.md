# Story E1.S1: Monorepo Setup

Status: ready-for-dev

## Story

As a Developer,
I want a fully configured pnpm monorepo with 8 Feature First Hexagonal packages,
so that all subsequent cop1 development has a consistent, strict TypeScript build environment with linting and test coverage from day one.

## Acceptance Criteria

1. `pnpm build` réussit sans erreur TypeScript strict (NodeNext, noUncheckedIndexedAccess, noUnusedLocals) sur les 8 packages : shared-kernel, observability, llm-intelligence, quality-intelligence, sprint-core, ceremony-engine, app, web.
2. `pnpm test` lance Vitest sur tous les packages et génère un rapport de couverture LCOV agrégé dans `coverage/`.
3. `pnpm lint` (Biome) passe sans warning sur l'ensemble du monorepo.

## Tasks / Subtasks

- [ ] Initialiser le workspace pnpm (AC: #1)
  - [ ] Créer `pnpm-workspace.yaml` avec `packages: ['packages/*']`
  - [ ] Créer `package.json` racine avec scripts `build`, `test`, `lint` récursifs
  - [ ] Créer `.npmrc` avec `shamefully-hoist=false`, `strict-peer-dependencies=false`

- [ ] Créer `tsconfig.base.json` racine (AC: #1)
  - [ ] `module: NodeNext`, `moduleResolution: NodeNext`
  - [ ] `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
  - [ ] `target: ES2022`, `lib: ['ES2022']`

- [ ] Créer les 8 packages stubs (AC: #1)
  - [ ] Pour chaque package : `packages/{name}/package.json` (name `@cop1/{name}`, type `module`)
  - [ ] Pour chaque package : `packages/{name}/tsconfig.json` extends `../../tsconfig.base.json`
  - [ ] Pour chaque package : `packages/{name}/src/index.ts` barrel vide (export commenté)
  - [ ] Ordre packages : shared-kernel, observability, llm-intelligence, quality-intelligence, sprint-core, ceremony-engine, app, web

- [ ] Configurer Biome (AC: #3)
  - [ ] `biome.json` à la racine : lint + format, règles recommandées
  - [ ] Ajouter script `lint` dans `package.json` racine : `biome check .`
  - [ ] Vérifier que `pnpm lint` passe sur les stubs vides

- [ ] Configurer Vitest (AC: #2)
  - [ ] `vitest.config.ts` racine en workspace mode (référence tous les packages)
  - [ ] Coverage provider `v8`, reporters `['text', 'lcov', 'html']`, outputDir `coverage/`
  - [ ] Ajouter un test stub dans chaque package (`src/index.test.ts`) pour valider le setup

- [ ] Vérifier la chaîne complète (AC: #1, #2, #3)
  - [ ] `pnpm install` sans erreur
  - [ ] `pnpm build` sans erreur TypeScript
  - [ ] `pnpm test` rapport couverture généré
  - [ ] `pnpm lint` sans warning

## Dev Notes

- **Architecture** : Feature First Hexagonal — chaque package aura plus tard une structure `src/features/{feature-name}/{domain,ports,application,infrastructure}/`. Pour Sprint 0, les packages sont des stubs avec `src/index.ts` uniquement.
- **Dépendances inter-packages** : graphe acyclique strict — `shared-kernel` ne dépend de rien dans le monorepo. Configurer les dépendances dans les `package.json` de chaque package en suivant le graphe : `shared-kernel ← observability ← llm-intelligence ← quality-intelligence ← sprint-core ← ceremony-engine ← app`. `web` dépend de `app` pour les types API uniquement.
- **NodeNext** : tous les imports TypeScript doivent inclure l'extension `.js` (ex. `import { foo } from './foo.js'`).
- **Testing** : les tests stubs doivent juste vérifier que `index.ts` s'importe sans erreur.

### Project Structure Notes

```
cop1/
  package.json              # scripts récursifs
  pnpm-workspace.yaml
  tsconfig.base.json
  biome.json
  vitest.config.ts
  packages/
    shared-kernel/
      package.json          # @cop1/shared-kernel
      tsconfig.json
      src/index.ts
    observability/          # idem
    llm-intelligence/       # idem
    quality-intelligence/   # idem
    sprint-core/            # idem
    ceremony-engine/        # idem
    app/                    # idem
    web/                    # idem
```

### References

- [Source: architecture.md#Project Structure] — arbre complet des packages
- [Source: architecture.md#ADR-006] — Feature First Hexagonal, barrel index.ts
- [Source: epics.md#E1-S1] — ACs et points

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
