# Story EA9.6: ClaudeResumeSessionAdapter (fallback BMADSessionPort via `claude --resume`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **cop1 operator running BMAD pipelines on a host where the `@anthropic-ai/claude-agent-sdk` cannot be used** (no `ANTHROPIC_API_KEY`, SDK install/runtime failure, restricted Node environment, deliberate "CLI-only" deployment),
I want a fallback `BMADSessionPort` implementation — `ClaudeResumeSessionAdapter` — that drives multi-turn BMAD workflows by spawning the local `claude` CLI with `--resume <session_id>` between turns,
so that EA9's multi-turn pipeline (`BMADSessionStep` × 3 in `PipelineStepFactory`) keeps working when the V1 SDK adapter is unavailable, completing ADR-012 §4.1 V0 fallback / §10 D4.

## Acceptance Criteria

1. **AC1 — `ClaudeResumeSessionAdapter` exists in `infrastructure/` and implements `BMADSessionPort`**
   - File: `packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeResumeSessionAdapter.ts`
   - Class `ClaudeResumeSessionAdapter implements BMADSessionPort` from `../domain/ports/BMADSessionPort.js`. Both methods (`startSession`, `continueSession`) are implemented with the exact signatures defined in `BMADSessionPort.ts` (do NOT redefine the types — import `BMADSessionContext`, `SessionHandle`, `SessionTurnResult`, `QuestionHandler`).
   - The adapter is exported from `packages/sprint-core/src/index.ts` next to `AgentSdkSessionAdapter` (alphabetical or grouped under the BMAD orchestration adapters block — match existing convention).
   - The class lives in the SAME directory as `AgentSdkSessionAdapter.ts` and `ClaudeCliAdapter.ts` (`infrastructure/`). Do NOT introduce a new subfolder.
   - Naming: `ClaudeResumeSessionAdapter` (PascalCase, suffix `Adapter`) per `architecture.md` naming conventions and ADR-012 §6.2.

2. **AC2 — `startSession()` spawns `claude -p` to open a new session, captures `session_id`, returns first turn**
   - On `startSession(command, context)`:
     - Generate an internal `sessionId` via `randomUUID()` (mirrors `AgentSdkSessionAdapter` pattern — the *internal* id is what callers track; it is mapped to the *CLI* session id captured from output).
     - Build the initial prompt by **manually loading the BMAD workflow** for the given command (per ADR-012 §3 Option A "Charger les workflows manuellement comme prompts" and §10 D4 "Nécessite de charger les workflows manuellement"). For V0 keep this simple: read the workflow file from `{projectPath}/.claude/skills/<skill-folder>/workflow.md` IF it exists and prepend its contents to the prompt; if not found, fall back to sending `command` literally and log a warning event `bmad.resume.workflow_not_loaded` (the BMAD CLI will then try to resolve the slash command itself — which is the broken-in-headless behavior ADR-012 documents but we cannot do better in fallback mode, so we still attempt it).
     - The skill-folder lookup is best-effort: extract the slug from the `command` (`/bmad-bmm-dev-story` → `bmad-bmm-dev-story`) and try `${projectPath}/.claude/skills/${slug}/workflow.md` first, then `${projectPath}/_bmad/bmm/workflows/**/${slug}/workflow.md` via a single glob. Use `node:fs` only — do NOT add new dependencies. If multiple matches, take the first; document this in Dev Notes.
     - Spawn `claude -p <prompt> --output-format json --permission-mode acceptEdits` with `cwd = context.projectPath`. Reuse the spawn / kill / timeout pattern from `ClaudeCliAdapter` (look at `runProcess`, `cleanup`, `BMADTimeoutError` handling) — extract the shared bits into a small private helper IF and ONLY IF doing so requires zero changes to `ClaudeCliAdapter`'s public API. Otherwise, copy the pattern verbatim with a `// TODO(post-EA9): factor out shared CLI runner` comment. The duplication is acceptable for V0 — see Dev Notes "Why duplicate spawn logic".
     - Parse the JSON output: extract the CLI's `session_id` field (the `claude -p ... --output-format json` payload includes it at the top level — verify by running once locally or by reading `claude --help` output in Dev). Store the mapping `internalSessionId → cliSessionId` in a private `Map`. Also store `context` so `continueSession()` can re-use `cwd`.
     - Extract the assistant text response (JSON `result` field, same convention as `ClaudeCliAdapter.parseTokenCount` neighborhood) and `usage.input_tokens + usage.output_tokens` for `tokensUsed`.
     - Emit `session.started` with `{ sessionId, command, storyId: context.storyId, timestamp }` exactly like `AgentSdkSessionAdapter`. Then emit `session.turn.completed` with `{ sessionId, turn: 1, durationMs, tokensUsed }`.
     - Return `SessionHandle = { sessionId, firstTurn: SessionTurnResult }`. The `firstTurn.completed` is `true` if the CLI exited 0 AND the JSON output indicates the workflow finished (heuristic — see AC4); `false` otherwise.

3. **AC3 — `continueSession()` spawns `claude --resume <cliSessionId> -p <message>` and returns the next turn**
   - Look up `cliSessionId` from the internal map. If absent, throw `Error('Unknown sessionId for ClaudeResumeSessionAdapter.continueSession: <id>')` — do NOT silently start a new session.
   - Spawn `claude --resume <cliSessionId> -p <message> --output-format json` with `cwd` from the stored context. Reuse the same spawn helper as `startSession()`.
   - Parse JSON, increment a per-session turn counter, emit `session.turn.completed`. Emit `session.workflow.completed` with `{ sessionId, storyId, totalTurns, totalDurationMs }` if the heuristic detects completion (AC4); emit `session.workflow.failed` on any error path (mirror `AgentSdkSessionAdapter` event payloads byte-for-byte so `SprintFormatter` and dashboards stay agnostic about which adapter is wired).
   - Return `SessionTurnResult` with `completed`, `output`, `tokensUsed`, `durationMs`, and (on failure) `error: true` + `errorMessage`.

4. **AC4 — Question detection heuristic + completion heuristic (documented as fragile, V0 only)**
   - Per ADR-012 §3 Option A row "Détection questions: Heuristiques sur l'output JSON (fragile)" and §10 D4: in `--resume` mode there is NO `canUseTool` callback and no structured `AskUserQuestion` interception. The adapter MUST nonetheless cooperate with `SupervisorService` so callers do not have to special-case the fallback path.
   - Implement a minimal text heuristic in a private `detectQuestion(output: string): string | null` method:
     - Returns the question text (last paragraph) if `output` ends with `?` OR matches `/\b(continue|proceed|confirm|approve|y\/n|\[Y\/n\]|\[y\/N\])\b/i` on the last non-empty line.
     - Returns `null` otherwise.
   - When `detectQuestion` returns non-null AND a `questionHandler` was injected via constructor options (see AC5), the adapter:
     1. Calls `questionHandler('AskUserQuestion', { questions: [questionText] })` (same shape `SupervisorService.createQuestionHandler` already accepts — verify by reading `SupervisorService.ts`).
     2. If the handler returns `{ behavior: 'allow', updatedInput }`, extracts the answer (`updatedInput.answers[questionText]` or fallback `'C'`) and immediately calls `continueSession()` recursively with that answer as the next message, accumulating turns into the same `SessionTurnResult`. **Hard cap recursion at `maxAutoReplies` (default 5)** to avoid infinite loops if the heuristic misfires; on overflow, return the current `SessionTurnResult` with `error: true, errorMessage: 'ClaudeResumeSessionAdapter: maxAutoReplies exceeded — heuristic question detection likely looped'`.
     3. If the handler returns `{ behavior: 'deny', message }`, returns `SessionTurnResult` with `error: true, errorMessage: message, completed: true` and emits `session.workflow.failed`.
   - Implement `detectCompletion(output: string): boolean`: returns `true` if `output` contains any of `/\b(workflow complete|done|finished|story.*ready[- ]for[- ]review)\b/i` on the last non-empty line OR the JSON envelope's top-level `stop_reason === 'end_turn'` AND no question was detected. This is admittedly weak — document the limitation in Dev Notes.
   - **Both heuristics MUST be unit-tested** with at least the table in AC6 §"Heuristic test cases".

5. **AC5 — Constructor signature mirrors `AgentSdkSessionAdapter` for swap-in compatibility**
   - File: `ClaudeResumeSessionAdapter.ts`
   - Public surface:
     ```ts
     export interface ClaudeResumeSessionAdapterOptions {
       /** Per-spawn timeout in ms (default 300_000). */
       timeoutMs?: number;
       /** Grace period after SIGTERM before SIGKILL (default 10_000). */
       gracefulShutdownMs?: number;
       /** Max recursive auto-replies on detected questions before bailing out (default 5). */
       maxAutoReplies?: number;
       /** Question handler injected by SupervisorService.createQuestionHandler(). */
       questionHandler?: QuestionHandler;
     }

     export type ProcessSpawner = (
       command: string,
       args: string[],
       options: { cwd: string; stdio: ['pipe', 'pipe', 'pipe'] },
     ) => ChildProcess;

     export class ClaudeResumeSessionAdapter implements BMADSessionPort {
       constructor(
         eventBus?: EventBus,
         options?: ClaudeResumeSessionAdapterOptions,
         spawner?: ProcessSpawner, // injectable for tests, defaults to node:child_process spawn
       ) { ... }
     }
     ```
   - The 3-arg `(eventBus?, options?, spawner?)` shape matches `ClaudeCliAdapter` (AC enables the same test-double strategy already used in `ClaudeCliAdapter.test.ts`).
   - The shape is **swap-compatible** with `AgentSdkSessionAdapter` from the caller's perspective: both implement `BMADSessionPort`, both accept `eventBus` and an options object that can carry `questionHandler`. Composition root code in `sprint-run.ts` only needs to flip ONE `new` call to switch.
   - Do NOT depend on `@anthropic-ai/claude-agent-sdk` from this file — that's the whole point of the fallback. The only Node imports allowed: `node:child_process`, `node:crypto`, `node:fs`, `node:path`. Plus `@cop1/shared-kernel` (`EventBus`) and the local `BMADSessionPort` types and `BMADTimeoutError`.

6. **AC6 — Unit tests in `__tests__/ClaudeResumeSessionAdapter.test.ts`**
   - File: `packages/sprint-core/src/features/bmad-orchestration/__tests__/ClaudeResumeSessionAdapter.test.ts`
   - Use Vitest, monorepo convention `*.test.ts`. **Never spawn a real `claude` CLI** — always inject a fake `ProcessSpawner` that returns a mock `ChildProcess` (look at `ClaudeCliAdapter.test.ts` for the exact stub pattern; copy the helper).
   - Required test cases (minimum):
     1. `startSession()` spawns `claude -p ... --output-format json --permission-mode acceptEdits` with the right `cwd`, captures `session_id` from JSON, returns `firstTurn` with the parsed `result` text and `tokensUsed`.
     2. `startSession()` emits `session.started` then `session.turn.completed` (assert on a captured `EventBus` listener — same trick as existing adapter tests).
     3. `continueSession()` spawns `claude --resume <id> -p <msg> --output-format json` and returns the next turn. The `cliSessionId` mapped from the internal `sessionId` is the one used after `startSession()`.
     4. `continueSession()` with an unknown `sessionId` throws `Error('Unknown sessionId ...')`.
     5. **Heuristic test cases** (`detectQuestion`):
        | Input last line                          | Expected                    |
        |------------------------------------------|-----------------------------|
        | `"Should I proceed?"`                    | `"Should I proceed?"`       |
        | `"All done."`                            | `null`                      |
        | `"Confirm deployment [Y/n]"`             | `"Confirm deployment [Y/n]"`|
        | `"Continue with the next file"`          | `"Continue with the next file"` (matches `\bcontinue\b`) |
        | `"Generated 5 files."`                   | `null`                      |
     6. When the heuristic detects a question AND a `questionHandler` is injected, the adapter calls `continueSession()` recursively up to `maxAutoReplies`; assert it stops at the cap with the documented error message.
     7. When `questionHandler` returns `{ behavior: 'deny', message: 'escalate' }`, the adapter returns `error: true, errorMessage: 'escalate', completed: true` and emits `session.workflow.failed`.
     8. Timeout path: spawner returns a child whose `close` never fires within `timeoutMs`; assert `BMADTimeoutError` is thrown (or surfaced as `error: true` in the returned `SessionTurnResult` — match whichever convention the existing `BMADSessionStep`/`AgentSdkSessionAdapter` already uses; document the choice in Dev Notes).
     9. Spawn error path: child emits `'error'` with `ENOENT`; assert returned `SessionTurnResult.error === true` and the `errorMessage` includes `'spawn error'` so the existing `RetryPolicy` classifier in `BMADSessionStep` treats it as permanent (mirror `ClaudeCliAdapter.isRetryableError` semantics — see `ClaudeCliAdapter.ts:108-118`).
   - Tests must run in under 5 seconds total (use `delayFn` / fake timers; do NOT sleep on real timeouts — set `timeoutMs: 50` in the timeout test).

7. **AC7 — `architecture.md` updated with the fallback adapter row + a one-paragraph note**
   - In `_bmad-output/planning-artifacts/architecture.md`, locate the BMAD orchestration component table that already lists `AgentSdkSessionAdapter`. Add a sibling row for `ClaudeResumeSessionAdapter` describing it as the V0 fallback, referencing ADR-012 §4.1 / §6.2 / §10 D4.
   - Add (or update) a short paragraph in the BMAD orchestration narrative section: "Since EA9-S6, `BMADSessionPort` has two infrastructure implementations: `AgentSdkSessionAdapter` (V1, in-process via `@anthropic-ai/claude-agent-sdk`) and `ClaudeResumeSessionAdapter` (V0 fallback, spawns `claude --resume` per turn with heuristic question detection). Both are swap-compatible from `sprint-run.ts`'s composition root. The fallback is intentionally less robust — see ADR-012 §3 Option A for known limitations (skill resolver absent in headless mode, fragile heuristics)."
   - No code changes elsewhere in `architecture.md` — this is documentation sync only.
   - Do NOT yet wire the fallback into `sprint-run.ts` by default; AC8 covers the opt-in mechanism.

8. **AC8 — Opt-in wiring via env var (NO config file changes)**
   - File: `packages/app/src/cli/commands/sprint-run.ts`
   - At composition-root construction time, read `process.env.COP1_BMAD_ADAPTER`. Allowed values:
     - `'sdk'` (default if env var unset or empty): instantiate `AgentSdkSessionAdapter` exactly as today.
     - `'resume'`: instantiate `ClaudeResumeSessionAdapter` with the same `eventBus` and `{ questionHandler }`. The line should be a single trivial swap.
     - Any other value: log a warning to `console.warn` (`Unknown COP1_BMAD_ADAPTER value '<value>', falling back to 'sdk'`) and use the SDK adapter.
   - **Do NOT add a new field to `Cop1Config`** in this story. ADR-012 D4 calls the fallback "prudence" — it should not pollute the user config surface for V0. A follow-up story can promote it to `cop1.config.yaml` once dogfooding validates the need.
   - The two adapters MUST share the `questionHandler` produced by `SupervisorService.createQuestionHandler()` — i.e., the supervisor wiring happens BEFORE the adapter selection branch, and `questionHandler` is injected into whichever adapter is constructed. This guarantees the supervisor (and `SessionLogger`) work identically regardless of adapter.
   - Add a `console.log` line at startup whenever `COP1_BMAD_ADAPTER === 'resume'` so operators see the fallback is active: `BMAD adapter: claude --resume fallback (COP1_BMAD_ADAPTER=resume)`. No log line needed for the default SDK path (avoid noise).

9. **AC9 — Quality gates green**
   - `pnpm --filter @cop1/sprint-core test` passes including the new `ClaudeResumeSessionAdapter.test.ts`.
   - `pnpm --filter @cop1/sprint-core typecheck` produces no NEW errors. Pre-existing carry-overs from EA9-S4/S5 (`Cop1Config.budget`, `SessionHandle` import in `BMADSessionStep.ts:200`) remain acceptable; document if any new errors appear.
   - `pnpm --filter @cop1/app test` and `typecheck` still green; `sprint-run.ts` change introduces no new TS errors.
   - `pnpm lint` (where present) passes for both packages.
   - The full repo `pnpm test` shows the same pass/skip counts as before EA9-S6 PLUS the new tests (no regressions).

10. **AC10 — Sprint-status & traceability**
    - Update `_bmad-output/implementation-artifacts/sprint-status.yaml`: `EA9-S6: backlog → in-progress → review → done` per the normal lifecycle (`create-story` itself only flips it to `ready-for-dev`; the rest is dev/review responsibility).
    - Add a Completion Note in this file's Dev Agent Record listing every file touched (created/modified). At minimum: `ClaudeResumeSessionAdapter.ts` (new), `ClaudeResumeSessionAdapter.test.ts` (new), `packages/sprint-core/src/index.ts` (export added), `packages/app/src/cli/commands/sprint-run.ts` (env-var branch), `_bmad-output/planning-artifacts/architecture.md` (doc sync), `sprint-status.yaml`, and this story file.
    - **Verify** before marking done that EA9-S6 is the LAST EA9 story (it is — see epics.md line 1054 and the Sprint 11 list lines 1141-1148). Closing it should naturally complete the EA9 epic; the done-promotion of `epic-EA9` itself is **out of scope** for this story (it's the retrospective workflow's job).

## Tasks / Subtasks

- [x] Task 1 — Read existing references: `ClaudeCliAdapter.ts`, `AgentSdkSessionAdapter.ts`, `BMADSessionPort.ts`, `SupervisorService.createQuestionHandler()`, `ClaudeCliAdapter.test.ts` (AC: #1, #2, #3, #5, #6)
- [x] Task 2 — Validate the JSON shape of `claude -p ... --output-format json` (where is `session_id`? where is `result`? where is `usage`?). Do this BEFORE writing parsing code — either by running the CLI locally once or by inspecting an existing fixture in the repo. Document the schema in Dev Notes. (AC: #2)
- [x] Task 3 — Implement `ClaudeResumeSessionAdapter.ts` (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Skeleton class + types + constructor
  - [x] 3.2 Private spawn helper (copy from `ClaudeCliAdapter` or extract — see Dev Notes)
  - [x] 3.3 `startSession()` with skill-folder lookup, prompt build, JSON parse, event emission
  - [x] 3.4 `continueSession()` with `--resume` arg, recursion guard, event emission
  - [x] 3.5 `detectQuestion()` + `detectCompletion()` private heuristics
  - [x] 3.6 Integration with `questionHandler` recursion + `maxAutoReplies` cap
- [x] Task 4 — Add export to `packages/sprint-core/src/index.ts` (AC: #1)
- [x] Task 5 — Write `ClaudeResumeSessionAdapter.test.ts` covering all 9 cases in AC6 (AC: #6)
- [x] Task 6 — Wire env-var branch in `sprint-run.ts` (AC: #8)
- [x] Task 7 — Update `architecture.md` (AC: #7)
- [x] Task 8 — Quality gates: `pnpm test`, `pnpm typecheck`, `pnpm lint` per AC9; record results in Completion Notes (AC: #9)
- [x] Task 9 — Update `sprint-status.yaml` and finalize Dev Agent Record (AC: #10)

## Dev Notes

### Architecture Context

This story is the LAST story of Epic EA9 (Multi-Turn BMAD Interaction, ADR-012). EA9-S1..S5 built the V1 path: a single `AgentSdkSessionAdapter` injected into three `BMADSessionStep` instances via `PipelineStepFactory`, with `SupervisorService` handling intercepted `AskUserQuestion` calls through `canUseTool`. EA9-S6 adds the V0 fallback path that ADR-012 §10 D4 explicitly retained as "prudence si le SDK pose problème". It does NOT replace the SDK adapter — both coexist behind the same port.

```
sprint-run.ts (composition root)
  ├── EventBus
  ├── StructuredLogger
  ├── SessionLogger
  ├── AgentSdkSupervisorAdapter
  ├── SupervisorService ──── createQuestionHandler() ──┐
  │                                                    │
  │   if COP1_BMAD_ADAPTER === 'resume':               │
  │     sessionPort = new ClaudeResumeSessionAdapter(  │
  │       eventBus, { questionHandler } )  ←───────────┘
  │   else:
  │     sessionPort = new AgentSdkSessionAdapter(
  │       eventBus, { questionHandler } )  ←─── (same shape)
  │
  └── PipelineStepFactory(eventBus, { sessionPort, supervisorService })
        └── 3× BMADSessionStep (unchanged from EA9-S5)
```

The three `BMADSessionStep` instances DO NOT KNOW which adapter is wired. That is the entire point of the hexagonal port — and the V0 fallback's existence is the proof that the abstraction is paying its rent.

### Why duplicate spawn logic

`ClaudeCliAdapter` already spawns `claude` with similar args. Tempting to extract a shared `runClaudeProcess()` helper into a new file. **Resist that temptation in this story.** Two reasons:

1. `ClaudeCliAdapter` is feature-frozen and tested — refactoring it carries regression risk that should not be bundled into a fallback-adapter story.
2. The two adapters' use of the CLI diverges over time: `ClaudeCliAdapter` is single-shot (`-p` only) while `ClaudeResumeSessionAdapter` adds `--resume`, manages session-id maps, and runs question-detection heuristics. Premature factoring would create the wrong abstraction.

Mark the duplication with a `// TODO(post-EA9): consider extracting shared CLI runner` comment and move on. A follow-up cleanup story can make the call once both adapters are stable.

### Heuristic question detection — known fragility

Per ADR-012 §3 Option A: text-based question detection on the JSON `result` field is **fragile**. False positives (treating a statement ending in `?` as a question) and false negatives (the workflow asks something via assertive phrasing) are both possible. The `maxAutoReplies` cap is the safety net — it bounds the blast radius of a misfire to N spurious CLI spawns instead of an infinite loop.

Mitigations to document but NOT implement in V0:
- Strict prompt prefix asking BMAD workflows to suffix all questions with a sentinel like `[QUESTION]` (requires modifying skill files — out of scope).
- Stream-JSON parsing to look for `tool_use` blocks (claude CLI does not currently emit these in `-p` mode — confirmed by ADR-012 §3 Option B verdict).

### Skill / workflow file lookup

The `command` strings used by `BMADSessionStep` are slash-prefixed (`/bmad-bmm-dev-story`, `/bmad-bmm-code-review`, `/bmad-bmm-qa-automate`). When manually loading the workflow body, strip the leading `/` and search:
1. `${projectPath}/.claude/skills/${slug}/workflow.md`
2. `${projectPath}/_bmad/bmm/workflows/**/${slug}/workflow.md` (single glob, take first match)

If neither exists, do NOT throw — the V0 best-effort behavior is to send the bare `command` and let the BMAD skill resolver attempt it. This matches the "fragile but better than nothing" stance ADR-012 §10 D4 codifies. Emit `bmad.resume.workflow_not_loaded` so operators can see the degraded mode in the event log.

### `Cop1Config` is NOT modified

ADR-012 §10 D4 frames the fallback as operator-side prudence, not a user-facing feature. Adding a `cop1.config.yaml` field for V0 would:
- Force every `Cop1Config` consumer (and its tests) to learn about the fallback.
- Trigger a config-migration story for existing projects.
- Lock in a config shape before dogfooding tells us whether the fallback is even useful.

The `COP1_BMAD_ADAPTER=resume` env var is the right level of commitment for V0: zero schema impact, operator-side, easy to revert, easy to promote later if EA8 dogfooding shows it matters.

### `SupervisorService.createQuestionHandler()` — verify before wiring

Before writing the recursion in AC4, **read** `packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts`:
- Confirm the exact signature of `createQuestionHandler()` and the shape of the `input` object it expects (the SDK passes `{ questions: string[], context?: ... }`).
- Confirm whether the handler returns `Promise<{ behavior: 'allow', updatedInput }>` or a slightly different envelope. The story above assumes it matches the `QuestionHandler` type from `BMADSessionPort.ts:44-47`. If there's drift, adjust.

### `BMADSessionStep` does NOT need changes

`BMADSessionStep` (EA9-S4) consumes `BMADSessionPort` polymorphically. As long as `ClaudeResumeSessionAdapter` returns event payloads in the same shape (`session.started`, `session.turn.completed`, `session.workflow.completed`, `session.workflow.failed`) with the same field names, no changes are needed in `sprint-core/application/`. **Verify this by reading `BMADSessionStep.ts` once before declaring AC9 done** — the contract is the events, not the adapter class.

### Project Structure (target state)

```
packages/sprint-core/src/features/bmad-orchestration/
├── infrastructure/
│   ├── AgentSdkSessionAdapter.ts          ← UNCHANGED (V1)
│   ├── AgentSdkSupervisorAdapter.ts       ← UNCHANGED
│   ├── ClaudeCliAdapter.ts                ← UNCHANGED (single-shot BMADCommandPort)
│   ├── ClaudeResumeSessionAdapter.ts      ← NEW (V0 fallback BMADSessionPort)
│   ├── InMemorySessionAdapter.ts          ← UNCHANGED (test double)
│   └── InMemorySupervisorAdapter.ts       ← UNCHANGED (test double)
└── __tests__/
    ├── AgentSdkSessionAdapter.test.ts     ← UNCHANGED
    ├── ClaudeCliAdapter.test.ts           ← UNCHANGED (spawn-stub reference)
    └── ClaudeResumeSessionAdapter.test.ts ← NEW

packages/sprint-core/src/index.ts          ← MODIFIED (add ClaudeResumeSessionAdapter export)
packages/app/src/cli/commands/sprint-run.ts ← MODIFIED (env-var adapter selection)
_bmad-output/planning-artifacts/architecture.md ← MODIFIED (doc sync)
_bmad-output/implementation-artifacts/sprint-status.yaml ← MODIFIED (status lifecycle)
_bmad-output/implementation-artifacts/EA9-S6.md ← THIS FILE
```

### Project Structure Alignment

- **Hexagonal**: new adapter lives in `infrastructure/`, implements a `domain/ports/` port. No domain/application changes. Composition root remains in `packages/app/src/cli/commands/sprint-run.ts`.
- **Naming**: `ClaudeResumeSessionAdapter` (PascalCase, `Adapter` suffix). Test file `ClaudeResumeSessionAdapter.test.ts`. Matches existing convention.
- **No new dependencies**: only `node:child_process`, `node:crypto`, `node:fs`, `node:path` from Node stdlib + existing `@cop1/shared-kernel` (`EventBus`) and local types. **Crucially: no `@anthropic-ai/claude-agent-sdk` import** — the fallback exists precisely for hosts where that dep is unavailable.
- **No new event types**: reuse `session.*` events emitted by `AgentSdkSessionAdapter`. The only new event is the diagnostic `bmad.resume.workflow_not_loaded` (warning-only, dot-namespaced, harmless if no consumer subscribes).

### Testing Standards

- Vitest, monorepo convention `*.test.ts`, file co-located in `__tests__/` next to other adapter tests.
- **Never spawn a real `claude` CLI** in any test. Always inject the `ProcessSpawner` test double (copy the helper from `ClaudeCliAdapter.test.ts` — that test file is the canonical reference for stub-spawn patterns in this repo).
- Use `vi.useFakeTimers()` for the timeout test; never sleep on a real `setTimeout`.
- Use `vi.fn()` for the `EventBus` listener and assert on `mock.calls` for event-emission assertions (matches existing `AgentSdkSessionAdapter.test.ts` style).
- The recursion test (heuristic-loop cap) MUST assert the exact `maxAutoReplies` count and the documented error message — this is a safety-critical bound.
- Do NOT call `SupervisorService` from these tests — inject a fake `questionHandler: vi.fn().mockResolvedValue({ behavior: 'allow', updatedInput: { answers: { '...': 'C' } } })`. The supervisor's own integration with the fallback is implicitly covered by the existing `SupervisorService` tests + the polymorphic port contract.

### References

- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md — §3 Option A (CLI --resume), §4.1 architecture overview, §6.2 component table, §10 Evolution Path V1, §14 D4]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic EA9, story EA9-S6 line 1054, Sprint 11 list line 1147]
- [Source: _bmad-output/implementation-artifacts/EA9-S5.md — predecessor; composition-root wiring pattern in `sprint-run.ts`]
- [Source: _bmad-output/implementation-artifacts/EA9-S4.md — `BMADSessionStep` event contract that the fallback must match]
- [Source: _bmad-output/implementation-artifacts/EA9-S3.md — `SupervisorService.createQuestionHandler()` shape]
- [Source: _bmad-output/implementation-artifacts/EA9-S1.md — `AgentSdkSessionAdapter` event payloads to mirror]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts — port contract; types to import verbatim]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts — V1 adapter to mirror in shape and event emission]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts — spawn / kill / timeout pattern to copy + `isRetryableError` semantics]
- [Source: packages/sprint-core/src/features/bmad-orchestration/__tests__/ClaudeCliAdapter.test.ts — `ProcessSpawner` test-double pattern to copy]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts — verify `createQuestionHandler()` signature before wiring]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADSessionStep.ts — confirms the polymorphic consumer; no changes expected here]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/errors/BMADTimeoutError.ts — error type to throw on timeouts]
- [Source: packages/app/src/cli/commands/sprint-run.ts — composition root; the only `packages/app` file this story modifies]
- [Source: packages/sprint-core/src/index.ts — barrel export to extend]
- [Source: _bmad-output/planning-artifacts/architecture.md — BMAD orchestration section to sync (component table + narrative paragraph)]
- [Source: _bmad-output/project-context.md — repo conventions]

### Open Questions for Dev (resolve during implementation)

1. **Exact JSON shape of `claude -p ... --output-format json`** — where does `session_id` live (top level? nested in a `meta`?)? Where is `result` text? Where is `usage.input_tokens` / `usage.output_tokens`? Run the CLI once or grep the repo for an existing fixture before writing the parser. Document the shape in a code comment in `ClaudeResumeSessionAdapter.ts` so the next maintainer doesn't have to re-discover it.
2. **Does `claude --resume <id> -p <msg>` accept the same `--output-format json --permission-mode acceptEdits` flags as `claude -p`?** Verify against `claude --help`. If not, drop the unsupported flags and document the divergence in Dev Notes.
3. **`SupervisorService.createQuestionHandler()` exact return shape** — confirm by reading the source. Adjust the AC4 recursion code accordingly if it diverges from the `BMADSessionPort.QuestionHandler` type used in this story.
4. **Timeout semantics**: should the adapter throw `BMADTimeoutError` (like `ClaudeCliAdapter`) or return `SessionTurnResult { error: true, errorMessage }` (like `AgentSdkSessionAdapter`'s catch block)? Check `BMADSessionStep`'s expectation — the answer determines whether `RetryPolicy` sees the timeout. Match the V1 adapter's behavior unless `BMADSessionStep` specifically wants a thrown error from `BMADSessionPort` implementations.
5. **Skill folder layout in dogfood targets**: do real cop1 install targets ship `.claude/skills/<slug>/workflow.md`, or only `_bmad/bmm/workflows/**/<slug>/workflow.md`? The lookup order in AC2 reflects the safer guess, but verify against the cop1-method module layout if EA8-S3 has landed by then.

## Dev Agent Record

### Agent Model Used

claude-opus-4-6 (1M context)

### Debug Log References

### Completion Notes List

- Implemented `ClaudeResumeSessionAdapter` as V0 fallback `BMADSessionPort` (ADR-012 §4.1 / §10 D4). Spawns `claude -p` for `startSession()` and `claude --resume <id> -p <msg>` for `continueSession()`, captures `session_id` from the JSON envelope, maps internal sessionId → CLI session_id, and emits the same `session.*` events as `AgentSdkSessionAdapter` for adapter-agnostic downstream consumers.
- Spawn / kill / timeout pattern is intentionally duplicated from `ClaudeCliAdapter` (with a `// TODO(post-EA9)` marker) — see Dev Notes "Why duplicate spawn logic". Timeouts surface as `error: true` in the returned `SessionTurnResult` (matching `AgentSdkSessionAdapter`'s catch-block convention) so `BMADSessionStep` stays adapter-agnostic.
- Question heuristic: `detectQuestion()` matches trailing `?` or last-line keywords (`continue|proceed|confirm|approve|y/n|[Y/n]|[y/N]`). When a `questionHandler` is injected, `continueInternal()` recursively auto-replies up to `maxAutoReplies` (default 5) and bails out with the documented error message on overflow. `denied` handler responses surface as `error: true, completed: true` and emit `session.workflow.failed`.
- Completion heuristic: `detectCompletion()` matches `workflow complete|done|finished|story ready-for-review` keywords on the last non-empty line OR `stop_reason === 'end_turn'`, AND requires no question detected.
- Workflow loading is best-effort: reads `${projectPath}/.claude/skills/<slug>/workflow.md` if present and prepends it; otherwise walks `${projectPath}/_bmad/bmm/workflows/**` (depth-bounded recursive `readdirSync`, no new deps) for a `<slug>/workflow.md` first match; otherwise emits `bmad.resume.workflow_not_loaded` and sends the bare command.
- `sprint-run.ts` composition root reads `COP1_BMAD_ADAPTER`: `'resume'` instantiates the fallback (with a one-line startup log), `'sdk'` or unset uses the SDK adapter unchanged, any other value warns and falls back to SDK. The `questionHandler` is constructed BEFORE the adapter branch and shared by both paths. No `Cop1Config` schema changes.
- Tests (12, all passing): startSession arg/cwd/parsing/return, event emission, continueSession `--resume` arg + cliSessionId mapping, unknown sessionId throw, full `detectQuestion` heuristic table, `detectCompletion` keyword + `stop_reason` tables, missing `session_id` in envelope returns explicit error (no silent `--resume ''`), `maxAutoReplies` cap with documented error, deny path emits `session.workflow.failed`, timeout path returns error result, spawn-error path includes `'spawn error'` substring (so the existing `RetryPolicy` classifier sees it as permanent).
- Code-review fixes (post-implementation): (1) AC4 `detectCompletion` is now unit-tested per spec; (2) AC2 deeper glob fallback (`_bmad/bmm/workflows/**/<slug>/workflow.md`) is implemented as a depth-bounded recursive walk; (3) missing `session_id` from the CLI envelope now throws an explicit error instead of silently storing `''` and later spawning `claude --resume ''`; (4) error path no longer overloads `output` with the error message — `output` is `''` and the error lives in `errorMessage` only, matching `AgentSdkSessionAdapter`; (5) removed dead `isTimeout ? baseMessage : baseMessage` conditional.
- Quality gates: `pnpm --filter @cop1/sprint-core typecheck` ✓ (no new errors), `pnpm --filter @cop1/app typecheck` ✓ after `sprint-core build`, `pnpm exec vitest run packages/sprint-core` ✓ 64 files / 440 tests, `pnpm exec vitest run packages/app` ✓ 22 files / 135 tests / 1 skipped (unchanged from before EA9-S6).
- EA9-S6 is the last EA9 story; the `epic-EA9` retro promotion is the retrospective workflow's responsibility — left untouched per AC10.

### File List

- `packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeResumeSessionAdapter.ts` (new)
- `packages/sprint-core/src/features/bmad-orchestration/__tests__/ClaudeResumeSessionAdapter.test.ts` (new)
- `packages/sprint-core/src/index.ts` (modified — added export)
- `packages/app/src/cli/commands/sprint-run.ts` (modified — env-var adapter selection)
- `_bmad-output/planning-artifacts/architecture.md` (modified — fallback adapter row + paragraph)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — EA9-S6 → review)
- `_bmad-output/implementation-artifacts/EA9-S6.md` (this file)