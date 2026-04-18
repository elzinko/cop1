# Sprint 14 — Technical Log (2026-04-16)

Epic: EA13 — Orchestrator Wiring & Build Fix
Baseline commit: `c9a2d99`
Final commit: `ed4a079`

---

## Build fix (EA13-S1)

### Erreurs TS corrigées (20 → 0)

**Catégorie A — Export manquant (1 erreur, 1 fichier)**

`InterCommandApprovalResolver.ts:3` importait `ApprovalResolver` depuis `@cop1/sprint-core`, mais le type (défini dans `StepByStepController.ts`) n'était pas ré-exporté par le barrel.

Fix : ajout de `export type { ApprovalResolver } from './features/workflow/application/StepByStepController.js';` dans `sprint-core/src/index.ts` (ligne 283).

**Catégorie B — Strict-null en production (3 fichiers, 5 erreurs)**

| Fichier | Ligne | Erreur | Fix |
|---|---|---|---|
| `SessionTranscriptGenerator.ts` | 40-41 | `sorted[0]` et `sorted[sorted.length-1]` possibly undefined | Guard explicite : `const firstFile = sorted[0]; if (!firstFile) throw` |
| `OrchestratorService.ts` | 238, 240 | `match[1]` (key) possibly undefined | `if (!key) continue;` après extraction |
| `SupervisorPlaybookLoader.ts` | 87 | `commandMatch[1]` possibly undefined | Variable locale `command` + truthiness guard, `commandMatch[0] ?? ''` |

**Catégorie C — Strict-null en tests (5 fichiers, 14 erreurs)**

| Fichier | Fix |
|---|---|
| `ExchangeHistoryReader.test.ts:49,59,69` | `!` (3 sites) |
| `MetricsWriter.test.ts:37-38` | `!` (2 sites) |
| `orchestrator.test.ts:33` | Type élargi `null \| undefined` pour `process.exitCode` |
| `OrchestratorService.test.ts:179,214,260` | `!` (2), side-effect array (1 — contourne `vi.fn<>` tuple-0) |
| `orchestrator-e2e.test.ts:121,132` | `!` (2 sites) |

### Vérification baseline

```
git stash → pnpm test → 9 fail (identiques) → pnpm lint → 13 errors (identiques) → git stash pop
```

Confirmation : 0 régression S1.

---

## Real runner wiring (EA13-S2)

### Architecture

```
orchestrator.ts
  └─ resolveRunner()
       ├─ options.runner === 'stub' → stubBMADCommandRunner (testing/)
       └─ default → createDefaultBMADCommandRunner(deps)
            ├─ deps.sessionPort = AgentSdkSessionAdapter | ClaudeResumeSessionAdapter
            ├─ deps.supervisorService = SupervisorService(AgentSdkSupervisorAdapter, SessionLogger)
            └─ questionHandler = supervisorService.createQuestionHandler()
```

### Session lifecycle (DefaultBMADCommandRunner.ts)

```
1. Build SupervisorAnswerContext (workflowCommand, storyId, stubs)
2. Pre-wire supervisor: setWorkflowContext(command, storyKey, ctx)
3. startSession(command, {projectPath, storyId})
4. Post-wire supervisor: setWorkflowContext(..., handle.sessionId)
5. Drain first turn → check error
6. Follow-up loop (max 3 turns) → continueSession(sessionId, 'C')
7. Translate to {success, nextStatus: inferNextStatus(command), note}
```

`inferNextStatus` : `create-story → ready-for-dev`, `dev-story → in-review`, else → `done`.

### Type clash résolu

Deux `SupervisorContext` dans `@cop1/sprint-core` :
- `domain/SupervisorContext.ts` (EA11-S6 bootstrap) : `{prd, architecture, projectMetadata, iamthelaw, loadedAt}`
- `domain/ports/SupervisorLLMPort.ts` (per-question) : `{workflowCommand, storyId, storyContent, ...}`

Le barrel exporte #1 uniquement. #2 n'est pas exporté ("import directly from module if needed" — mais cross-package import impossible).

Fix : `export type { SupervisorContext as SupervisorAnswerContext } from '.../SupervisorLLMPort.js'` dans le barrel.

### Guard stub (adversarial fix)

```typescript
if (options.runner === 'stub') {
  if (process.env.COP1_ALLOW_STUB_RUNNER !== '1') {
    throw new Error('--runner stub produces fake success...');
  }
  console.warn('[WARN] Orchestrator runner: stub...');
  return stubBMADCommandRunner;
}
```

`resolveRunner` throw capté par le `try/catch` global → `process.exitCode = 2`.

---

## Story body mirror (EA13-S4)

### Regex

```typescript
const re = /^##\s+Status:\s*[^\n]*$/m;
```

- `/m` multiline : `^` matche le début de chaque ligne
- Pas de `/g` : first match only
- `[^\n]*` : capture tout jusqu'à fin de ligne (inclut trailing whitespace)
- Remplacement : `## Status: ${nextStatus}` (pas de trailing space)

### Wiring dans persistStatus

```typescript
const bodyPath = join(dirname(path), `${storyKey}.md`);
try {
  const body = await readFile(bodyPath, 'utf-8');
  const mirrored = mirrorStoryStatusInBody(body, nextStatus);
  if (mirrored !== body) await writeFile(bodyPath, mirrored, 'utf-8');
} catch (err) {
  if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
}
```

Guard ENOENT = no-op. Guard `mirrored !== body` = idempotent (pas de write inutile).

---

## Fichiers modifiés — liste complète

### sprint-core (4 modifiés)
- `src/index.ts` — +2 exports (ApprovalResolver, SupervisorAnswerContext)
- `src/features/bmad-orchestration/application/SessionTranscriptGenerator.ts` — narrowing sorted[0]/last
- `src/features/bmad-orchestration/__tests__/ExchangeHistoryReader.test.ts` — `!` x3
- `src/features/bmad-orchestration/__tests__/MetricsWriter.test.ts` — `!` x2

### app (9 modifiés, 5 nouveaux)
- `src/cli/commands/orchestrator.ts` — **rewrite** (resolveRunner, real default, --runner, guard)
- `src/cli/index.ts` — Option import + --runner
- `src/features/orchestrator/application/OrchestratorService.ts` — key narrowing + mirrorStoryStatusInBody + dirname import
- `src/features/orchestrator/application/SupervisorPlaybookLoader.ts` — command narrowing
- `src/features/orchestrator/__tests__/OrchestratorService.test.ts` — BMADCommandRunner type + side-effect array
- `src/cli/commands/__tests__/orchestrator.test.ts` — null type + stub guard tests
- `src/integration-tests/orchestrator-e2e.test.ts` — `!` x2
- **NEW** `src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts`
- **NEW** `src/features/orchestrator/infrastructure/testing/StubBMADCommandRunner.ts`
- **NEW** `src/features/orchestrator/infrastructure/__tests__/DefaultBMADCommandRunner.test.ts` (12 tests)
- **NEW** `src/integration-tests/orchestrator-real-run.test.ts` (2 tests)
- **NEW** `src/features/orchestrator/__tests__/mirrorStoryStatusInBody.test.ts` (6 tests)

### scripts (1 nouveau)
- `scripts/ea13-real-run.sh` — reproduction procedure

---

## Métriques

| Métrique | Avant (c9a2d99) | Après (ed4a079) | Delta |
|---|---|---|---|
| Erreurs TS build | 20 | 0 | -20 |
| Tests pass | 786 | 806 | +20 |
| Tests fail | 9 | 9 | 0 (pré-existants) |
| Lint errors | 13 | 13 | 0 (pré-existants) |
| Lint warnings | 21 | 33 | +12 (test `!`) |
| Fichiers source modifiés | — | 13 | — |
| Fichiers nouveaux | — | 5 | — |
| Commits | — | 7 | — |

---

## Deferred items (19 total)

Référence complète : `_bmad-output/implementation-artifacts/deferred-EA13.md`

### De S1 (11 items, all ≤ MEDIUM)
- `OrchestratorService.ts:238` : dead guard `if (!key) continue;` (devrait throw)
- Pas de tests pour les 3 narrowings production
- 9 tests pré-existants SprintRunner (path fixture incorrect)
- 13 lint errors pré-existants (noNonNullAssertion + formatting)
- Pas de lock test pour l'export `ApprovalResolver`

### De S2 (10 items, 1 applied + 9 parked)
- **APPLIED** : `--runner stub` guard (HIGH)
- Session lifecycle dupliquée BMADSessionStep ↔ DefaultBMADCommandRunner
- SupervisorService recréé par commande (pas par epic)
- `epicId` ignoré par le runner
- `MAX_FOLLOWUP_TURNS = 3` hardcodé
- `inferNextStatus` substring match (collision potentielle)
- Pas de test pour `resolveRunner` choice logic
- `InMemorySupervisorAdapter(new Map())` ne teste pas la question interception
- `console.log/warn` uncontrolled output
- `SupervisorAnswerContext` naming ad hoc
