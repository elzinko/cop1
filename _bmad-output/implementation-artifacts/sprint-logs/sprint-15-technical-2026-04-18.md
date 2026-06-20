# Sprint 15 — Technical Log (2026-04-18)

Epic: EA14 — Real-Run Closure & Hygiene
Baseline commit: `ed4a079` (fin EA13)
Final commit: `52c7822`

---

## BMAD bundle detection (EA14-S1)

### Implémentation

```typescript
// orchestrator.ts — resolveRunner(), après le check stub
const bmadDir = join(projectRoot, '_bmad');
if (!existsSync(bmadDir)) {
  throw new Error(
    `No BMAD installation found at ${bmadDir}. ` +
    'The orchestrator requires BMAD workflows to execute real sprint commands. ' +
    'Install BMAD or use --runner stub (with COP1_ALLOW_STUB_RUNNER=1) for testing.',
  );
}
```

Positionné **après** le check stub (le stub n'a pas besoin de `_bmad/`). Le throw est capté par le `try/catch` global → exit code 2.

### Tests ajoutés (3)

1. `_bmad/` absent + default runner → exit code 2
2. `_bmad/` absent + `overrides.runner` fourni → exit code 0 (bypass)
3. `--runner stub` sans `_bmad/` → exit code 0 (stub n'a pas besoin de BMAD)

---

## ExchangeHistoryWriter wiring (EA14-S2)

### Problème

Le flow orchestrator instanciait `SessionLogger` (JSONL plat) mais pas `ExchangeHistoryWriter` (Track 2 markdown). La 3-track history (EA11-S8) était du code mort dans le contexte orchestrator.

### Architecture de la solution

```
orchestrator.ts
  └─ resolveRunner()
       ├─ SessionInteractionCollector (extends SessionLogger)
       │    └─ logInteraction() override → collecte en mémoire
       │    └─ drain() → retourne + vide le buffer
       ├─ ExchangeHistoryWriter(projectRoot)
       └─ createDefaultBMADCommandRunner({
            sessionPort,
            supervisorService,
            exchangeHistoryWriter,   // NEW
            interactionCollector,    // NEW
          })
```

### SessionInteractionCollector

```typescript
export class SessionInteractionCollector extends SessionLogger {
  private collected: SessionInteraction[] = [];

  logInteraction(interaction: SessionInteraction): void {
    super.logInteraction(interaction);
    this.collected.push(interaction);
  }

  drain(): SessionInteraction[] {
    const result = [...this.collected];
    this.collected = [];
    return result;
  }
}
```

Étend `SessionLogger` (backwards compatible). Le `super.logInteraction()` préserve le JSONL existant. `drain()` vide le buffer (important : appelé au début de chaque commande pour purger les stale).

### writeExchangeRecord dans DefaultBMADCommandRunner

Appelé à **chaque point de sortie** (5 sites : success, first-turn error, follow-up error, follow-up exception, timeout). Fire-and-forget :

```typescript
async function writeExchangeRecord(deps, meta): Promise<void> {
  if (!deps.exchangeHistoryWriter || !deps.interactionCollector) return;
  try {
    const interactions = deps.interactionCollector.drain();
    const frontMatter: ExchangeFrontMatter = { /* ... */ };
    await deps.exchangeHistoryWriter.write({ frontMatter, interactions });
  } catch (err) {
    console.warn('[EA14-S2] Failed to write exchange history:', err);
  }
}
```

### Tests ajoutés (9)

- 3 `SessionInteractionCollector` : collect, drain-clears, empty-drain
- 3 writer integration : Track 2 created on success, Track 2 on failure, backwards compat sans writer
- 3 existants runner tests inchangés (vérifient la backwards compat)

---

## Supervisor prompt commit_anchor guidance (EA14-S3)

### Investigation

| Composant | État |
|---|---|
| `commit_anchor` tool dans `SupervisorMcpServer.ts` | ✅ Registré (EA12-S1, lignes 62-69) |
| `commit_anchor` dans `toolSchemas` | ✅ Schema Zod défini |
| `commit_anchor` dans `SupervisorPromptBuilder.ts` | ❌ **Jamais mentionné** |
| `commit_anchor` dans `supervisor-playbook.md` | ❌ Non mentionné |

Le tool existe mais le LLM n'a aucune instruction pour l'appeler → il ne l'appelle jamais.

### Fix

```typescript
// SupervisorPromptBuilder.ts
function commitAnchorGuidance(workflowCommand: string): string {
  if (!workflowCommand.includes('dev-story')) return '';
  return `
## Commit Anchor (post-implementation)

After successful implementation of the story's acceptance criteria:
1. Stage the changed files with \`git add\`
2. Call the \`commit_anchor\` tool with a conventional commit message:
   - Format: \`<type>(<scope>): <description>\`
   - The tool handles Co-Authored-By trailer automatically
3. Do NOT push — commit_anchor only creates local commits

Only call commit_anchor when you are confident the implementation is correct
and tests pass. If unsure, skip — the orchestrator will not fail without it.
`;
}
```

Intégré dans `buildSupervisorPrompt()` entre le Scrum Cycle Guidance et le Story Content.

### Tests ajoutés (4)

- dev-story command → guidance présente
- code-review command → guidance absente
- create-story command → guidance absente
- custom `/my-dev-story` → guidance présente (substring match)

---

## SupervisorContext rename (EA14-S4)

### Mapping

| Avant | Après | Localisation |
|---|---|---|
| `SupervisorContext` (LLMPort) | `SupervisorQuestionContext` | `domain/ports/SupervisorLLMPort.ts` |
| `SupervisorAnswerContext` (alias barrel) | supprimé | `sprint-core/src/index.ts` |
| `SupervisorContext` (bootstrap) | inchangé | `domain/SupervisorContext.ts` |

### Fichiers modifiés

Source (7) : `SupervisorLLMPort.ts`, `SupervisorService.ts`, `SupervisorPromptBuilder.ts`, `BMADSessionStep.ts`, `AgentSdkSupervisorAdapter.ts`, `InMemorySupervisorAdapter.ts`, `DefaultBMADCommandRunner.ts`

Tests (6) : correspondants

---

## SprintRunner test fix (EA14-S5)

### Root cause

`BMADReader.listStories()` scanne `_bmad-output/implementation-artifacts/` (hardcodé dans `BMADReader.ts:10`).

Les tests créaient les fixtures à `_bmad-output/planning-artifacts/stories/sprint-0/` — l'ancien layout pré-EA9. BMADReader retournait 0 stories → `eligibleStories` vide → `storiesDone = 0`.

### Fix

```diff
- const storiesDir = join(dir, '_bmad-output', 'planning-artifacts', 'stories', 'sprint-0');
+ const storiesDir = join(dir, '_bmad-output', 'implementation-artifacts');
```

Appliqué dans :
- `packages/app/src/composition/__tests__/SprintRunner.test.ts` (ligne 28)
- `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts` (ligne 53-58, restructuré pour écrire la story dans `implDir` au lieu de `storiesDir`)

---

## Lint hygiene (EA14-S6)

### Violations corrigées (28 dans 14 fichiers)

| Règle | Count | Fix |
|---|---|---|
| Import sorting (`organizeImports`) | 7 | `biome check --fix` |
| Formatting (`formatter`) | 5 | `biome format --write` |
| `noDelete` | 3 | `delete process.env.X` → `process.env.X = undefined` |
| `noImplicitAnyLet` | 1 | `let playbook` → `let playbook: SupervisorPlaybook` |
| `useTemplate` | 2 | String concatenation → template literals |
| `noUselessConstructor` | 1 | Constructor + 3 unused imports supprimés |
| `noParameterAssign` | 1 | `context = {...}` → `const enrichedContext = {...}` |
| `useExponentiationOperator` | 1 | `Math.pow(a, b)` → `a ** b` |
| `useLiteralKeys` | 5 | `raw['key']` → `raw.key` |
| `useOptionalChain` | 1 | `a && a[k]` → `a?.[k]` |

### Post-fix incident

`biome check --fix --unsafe` a converti des `!` en `?.` dans 2 fichiers, cassant le build :
- `SprintRunner.ts:130` : `this.stepFactory!.build()` → `this.stepFactory?.build()` → type `WorkflowStep[] | undefined` inacceptable
- `ExchangeHistoryReader.test.ts:49` : `all[0]!.frontMatter` → `all[0]?.frontMatter` → `Object is possibly 'undefined'`

Fix manuel :
- SprintRunner : guard post-assignment (`if (!steps) throw`)
- ExchangeHistoryReader : narrowing (`const first = all[0]; expect(first).toBeDefined(); first!.frontMatter`)

---

## Fichiers modifiés — liste complète

### sprint-core (nouveaux : 2, modifiés : ~15)
- **NEW** `src/features/bmad-orchestration/application/SessionInteractionCollector.ts`
- **NEW** `src/features/bmad-orchestration/__tests__/SessionInteractionCollector.test.ts`
- `src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts` — rename
- `src/features/bmad-orchestration/domain/SupervisorPromptBuilder.ts` — commit_anchor guidance
- `src/features/bmad-orchestration/application/SupervisorService.ts` — rename + noParameterAssign
- `src/features/bmad-orchestration/infrastructure/AgentSdkSupervisorAdapter.ts` — rename
- `src/features/bmad-orchestration/infrastructure/InMemorySupervisorAdapter.ts` — rename
- `src/features/bmad-orchestration/infrastructure/RetryPolicy.ts` — exponentiation
- `src/features/bmad-orchestration/infrastructure/ClaudeResumeSessionAdapter.ts` — optional chain
- `src/features/budget/infrastructure/YamlBudgetStore.ts` — literal keys
- `src/index.ts` — barrel (SessionInteractionCollector export, SupervisorQuestionContext, remove alias)
- Tests : ~6 fichiers (rename + narrowing)

### app (modifiés : ~10)
- `src/cli/commands/orchestrator.ts` — pre-flight guard + ExchangeHistoryWriter wiring + import playbook type
- `src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts` — Track 2 + rename
- `src/composition/SprintRunner.ts` — guard post-assignment
- `src/composition/__tests__/SprintRunner.test.ts` — fixture path fix
- `src/integration-tests/bmad-pipeline-e2e.test.ts` — fixture path fix
- `src/features/orchestrator/__tests__/DefaultBMADCommandRunner.test.ts` — writer tests
- `src/features/orchestrator/__tests__/SupervisorPromptBuilder.test.ts` — commit_anchor tests
- Formatting/import fixes dans ~5 fichiers supplémentaires

---

## Métriques

| Métrique | Avant (ed4a079) | Après (52c7822) | Delta |
|---|---|---|---|
| Erreurs TS build | 0 | 0 | — |
| Tests pass | 806 | 828 | +22 |
| Tests fail | 9 | 0 | -9 |
| Lint errors | 13 | 0 | -13 |
| Lint warnings | 33 | 26 | -7 |
| Fichiers modifiés | — | 37 | — |
| Fichiers nouveaux | — | 5 (3 story md + 2 ts) | — |
| Commits | — | 4 | — |
