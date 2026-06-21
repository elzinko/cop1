# Sprint — Web UI (depuis la tech-spec BMAD)
Périmètre : 1 feature (POC) par sprint.   Statut : Story A en cours

## Backlog  (1 ligne = 1 feature = 1 PR)
- [~] feat: Story A — panneau auth (auth-check + feu tricolore)   <- en cours
- [ ] feat: Story B — lanceur de run + mission-control live

## Definition of Done (Story A)
- `AuthChecker.checkAuth()` (backend, import SDK propre, modèle lu sur le message `system`/init) — AC-A1/A4
- `GET /api/auth/check` + DI `setAuthChecker` (toujours 200, zéro secret) — AC-A2
- `AuthPanel.tsx` (🟢/🔴 + modèle) branché dans `App.tsx` — AC-A3
- Gate locale verte : `pnpm build` + `pnpm test` + `pnpm lint` (--error-on-warnings)
- Revue GO. 1 PR (base main), squash-merge, conventional commit.

## Notes / décisions  (ADR courts)
- Source : `_bmad-output/implementation-artifacts/tech-spec-web-ui-auth-and-run-launcher.md` (branche docs/web-ui-spec) + résolutions R1.
- F1 : `AuthChecker` fait son propre `await import('@anthropic-ai/claude-agent-sdk')` (pas le `private static loadSdkQuery`).
- F5 : modèle lu sur `SDKSystemMessage.model` (le `result` n'a pas de `model`).
- `packages/web` est ignoré par biome (lint) ; validé par vitest + testing-library.
- Story A est buildable/testable SANS auth Claude (faux `queryFn` injecté).
- Blocage env : auth Claude machine cassée (401) → run réel cop1 sur le cobaye différé jusqu'à `claude setup-token` / `ANTHROPIC_API_KEY`.
