# cop1 / Morpheus

> Autonomous AI-agents orchestration system for solo developers.
> *Pendant que tu rêves, le code se construit.*

Local-first CLI that drives Claude Code + BMAD installations in a target project: agents pick up stories from a BMAD backlog and advance them (create-story → dev-story → code-review → QA → retro) with transcript + step-by-step gates, producing committable artefacts.

## Status

**V1-light MVP closed 2026-04-14** — `cop1 orchestrator run --epic <id>` drives an epic end-to-end with transcripts (`cop1 transcript <sessionId>`). Two stubs (`commit_anchor`, `BMADCommandRunner`) remain before unassisted dogfooding — see V1.1 scope in the retro below.

## Start here

- **Onboarding** → [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md)
- **State of the system (snapshot 2026-04-15)** → [`docs/brownfield-snapshot.md`](docs/brownfield-snapshot.md)
- **Doc index (PRD / architecture / ADRs / epics / SCPs)** → [`docs/index.md`](docs/index.md)
- **Latest retro closing V1-light** → [`_bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md`](_bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md)

## Stack

Node ≥ 20 · pnpm ≥ 9 · TypeScript 5.7 (strict + `noUncheckedIndexedAccess`) · Vitest · Biome · Claude Agent SDK.

Monorepo — 8 packages, feature-first hexagonal. Dependency graph in the brownfield snapshot §3.

## Scripts

```bash
pnpm install
pnpm build        # tsc -b across compiled packages
pnpm typecheck    # strict, no emit
pnpm test         # vitest — ~850 tests
pnpm lint         # biome check .
pnpm lint:fix
```

No CI, no pre-commit hooks — the agents are the quality gate. Run the three checks before every commit.

## License

MIT © elzinko
