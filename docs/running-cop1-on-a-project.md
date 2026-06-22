# Running cop1 on a project

How to point cop1 at a target project and let it drive an epic end-to-end
(`create-story → dev-story → code-review`), with the safety gates that keep
"done" honest. Written from the first real dogfood run (2026-06-22).

## 1. Prerequisites

- **A built cop1** — `pnpm install && pnpm build` at the repo root.
- **Claude auth** — cop1 drives the Claude Agent SDK, which needs credentials in
  the environment. Use a Claude Max OAuth token (`claude setup-token` →
  `sk-ant-oat01-…`) or `ANTHROPIC_API_KEY`.
- **SDK ≥ 0.3.x** — older `0.1.x` is broken for cop1's session path (a
  `canUseTool` bug throws `400 "tool_use ids must be unique"` on the first
  tool turn). The repo now pins `^0.3.185`; don't downgrade.
- **A target project** with a BMAD install (`_bmad/`, `.claude/commands/`), a
  `supervisor-playbook.md`, and `_bmad-output/implementation-artifacts/sprint-status.yaml`.

### Auth setup (the gotcha)

cop1 does **not** auto-load `.env`. Put the token on a **single line** (a
pasted token wrapped across lines is silently truncated → 401), then export it
into the shell before running:

```bash
# .env  (single line, no wrapping)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxxxxx...

# load it, then verify auth works before any run:
export $(grep '^CLAUDE_CODE_OAUTH_TOKEN=' .env | xargs)
claude -p "say OK"        # must print OK
```

## 2. Run an epic

```bash
export $(grep '^CLAUDE_CODE_OAUTH_TOKEN=' .env | xargs)

COP1_MAX_TOKENS=500000 COP1_DEADLINE_MIN=30 COP1_MAX_USD_PER_SESSION=3 \
  node packages/app/dist/cli/index.js orchestrator run \
    --epic FEAT \
    --project-root /path/to/target-project \
    --abort-on-escalation
```

Exit codes: `0` clean · `2` runtime error · `3` aborted (budget / escalation).

### Controls

| Env / flag | Effect |
|---|---|
| `COP1_MAX_TOKENS` | Token ceiling for the whole run; checked between commands. |
| `COP1_DEADLINE_MIN` | Wall-clock deadline (minutes); checked between commands. |
| `COP1_MAX_USD_PER_SESSION` | Per-session SDK cost cap (`maxBudgetUsd`). |
| `COP1_WORKTREE_ISOLATION=1` | Run each story in its own git worktree (off by default). |
| `--abort-on-escalation` | Stop cleanly and mark the story `blocked` on supervisor escalation. |
| `--step-by-step` | Pause for continue/skip/abort between commands. |
| `.cop1/abort` (file) | **Kill-switch**: create this file in the project root to stop the run between commands. |

## 3. What keeps "done" honest

Per `(story, command)` the runner runs: **select → execute → verify → advance**.
A story only advances when the work is real:

- **Evidence gate** — a code-producing command (`dev-story`) must actually
  change source files (via `git status`, ignoring `_bmad-output/` and `.cop1/`).
  If the session only printed a plan, the runner sends a corrective
  "implement now" continuation; if still nothing changed, the story is
  **blocked**, not marked done.
- **Verification gate** — runs the project's tests/lint/build before advancing.
  (Placeholder scripts pass trivially — give the target real `test`/`lint`.)
- **Review-verdict gate** — an explicit blocking `code-review` verdict
  (e.g. `Verdict: FAIL`, "changes requested", "not implemented") blocks the
  story instead of advancing to `done`. Approved/ambiguous reviews advance.

## 4. When Claude is temporarily blocked

A transient blockage (overloaded `529`, rate-limit `429`, `5xx`, network) is
**retried with exponential backoff** inside the session adapter instead of
failing the story. The run surfaces it as a `claude.status` signal:

- `degraded` — a transient error occurred and the session is retrying;
- `unavailable` — retries exhausted (Claude effectively unreachable);
- `ok` — recovered after a retry.

These are logged to `.cop1/sprint-log-<date>.jsonl` (`event: "claude-status"`)
and printed to the console, so a temporary blockage is visible rather than a
silent stall. A genuine hard error (auth, invalid request) is **not** retried.

## 5. Observe a run

- **Status ledger** — `_bmad-output/implementation-artifacts/sprint-status.yaml`
  (and each story body's `## Status:` line).
- **Decision log** — `.cop1/sprint-log-<date>.jsonl` (auto-decisions +
  `claude-status` events).
- **Exchange history (Track 2)** — `.cop1/history/<epic>/<story>/…md`.
- **Transcript** — `node packages/app/dist/cli/index.js transcript <sessionId>`.

## 6. Reset a disposable test bed

For a reusable cobaye project, keep the blank state in git and reset between runs:

```bash
git checkout -- . && git clean -fdq src && rm -rf .cop1
```
