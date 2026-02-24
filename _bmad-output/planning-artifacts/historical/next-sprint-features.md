# Feature Brief: Next Sprint Features

**Date:** 2026-02-23
**Author:** elzinko
**Status:** Draft — Input for Edit PRD workflow
**Context:** cop1 project is mature (91/98 stories done). These features represent the next evolution directions.

---

## Feature 1: Quality Dashboard Web UI (Priority: HIGH)

**Existing story:** E10-S9 (backlog, deferred Phase B) + EA3-S3 (backlog Sprint 11)

**Need:** The backend services already compute KPIs (velocity, blocage rate, DoD rejection, coverage via KPIsDashboardService, SonarQube adapter). But there's no Web UI to visualize them. The developer needs a quality dashboard visible from the cop1 project UI at the end of each sprint to quickly see where the code stands.

**Scope:**
- Prioritize E10-S9 and EA3-S3 from backlog into next sprint
- Quality metrics per agent + evolution graphs
- Sprint-level KPI scorecard with trend arrows
- SonarQube integration display (code smells, bugs, vulnerabilities)

**Action:** Reprioritize existing backlog stories, possibly add new stories for real-time updates.

---

## Feature 2: Worktree Preview Environment (Priority: MEDIUM — Needs grooming)

**Existing coverage:** None. E3-S15 (--simulate) creates worktrees but no preview.

**Need:** When agents work in a worktree (via `cop1 sprint run --simulate`), they should be able to visualize the results of their work — not just generate code blindly. This enables:
- Agents calling Playwright MCP to verify visual output
- QA agent doing visual regression testing
- Reviewer agent seeing actual rendered results

**Open questions (to groom):**
- **Option A: Environment at worktree start** — Spin up a local dev server (or container) when the worktree is created, so agents can interact with it during the sprint. More powerful but heavier.
- **Option B: Demo at end of dev** — Only spin up after DevAgent finishes, for verification/screenshots. Simpler but agents can't iterate visually.
- **Recommendation:** Start with Option B (demo post-dev) for MVP, evolve to Option A later.
- Container vs local process? Docker container is more isolated and allows multi-version comparison, but adds complexity.

**Scope (MVP):**
- After DevAgent commits, spin up a preview of the worktree output
- Make the preview URL available to downstream agents (Reviewer, QA, DemoAgent)
- Simple: `pnpm dev` or equivalent in the worktree, expose a local port

---

## Feature 3: Demo Agent with Playwright Screenshots (Priority: MEDIUM — Future sprints)

**Existing coverage:** None. Deferred to Phase B+ in architecture.

**Need:** A DemoAgent that runs after QA passes, uses Playwright MCP to:
- Navigate the running application (from Feature 2's preview environment)
- Take screenshots of interesting pages/states
- Generate a visual sprint report (before/after, key features)
- Potentially run visual regression tests

**Dependencies:** Feature 2 (preview environment must exist for DemoAgent to screenshot)

**Scope:**
- New agent implementing WorkflowStep interface
- Playwright MCP access for browser automation
- Screenshot storage in `.cop1/demos/{sprint}/{story}/`
- Visual report generation (markdown with embedded images)

**Not in scope for MVP:** Video recording, animated GIFs, cross-browser testing.

---

## Feature 4: MCP Access Control per Agent (Priority: MEDIUM — Progressive approach)

**Existing coverage:** E5-S5 MCP Server Registry (DONE) — MCPRegistry.getToolsForAgent() with role-based isolation.

**Need:** The MCP isolation mechanism exists in code but needs to be wired to real MCP servers (Docker Desktop MCP, Playwright MCP, etc.). Today Docker Desktop can connect Claude Code to Docker MCP but doesn't limit per agent.

**Progressive approach (user preference):**

### Phase 1 — MVP (Simple)
- Give Claude Code / cop1 full access to all MCP servers (Docker Desktop, Playwright, etc.)
- All agents inherit the same MCP access
- Simple config: just connect and verify it works
- Use iamthelaw rules or agent-specific prompts to soft-limit what each agent should use

### Phase 2 — Per-agent configuration
- Local project configuration (`cop1.config.yaml`) defines MCP permissions per agent role
- Example: DevAgent gets filesystem + git MCP, QAAgent gets Playwright MCP, DemoAgent gets Playwright + screenshot MCP
- MCPRegistry enforces these rules (mechanism already exists in E5-S5)

### Phase 3 — Secured isolation (long-term)
- MCP proxy that enforces access at runtime
- Audit log of MCP calls per agent
- Approval workflow for sensitive MCP operations

**Open questions:**
- Docker Desktop MCP vs local project-scoped MCP config? User prefers local project config (less risky, more portable) but Docker Desktop could work as a starting point.
- How does cop1 CLI pass MCP context to agents when calling LLMs? Current architecture routes through LLMGateway — MCP tools would need to be injected at the agent level.

---

## Feature 5: Sprint Workflow Execution Visibility (Priority: HIGH)

**Existing coverage:** Partial.
- `SprintFormatter` (DONE) affiche les événements en CLI temps réel (story started/completed, step results)
- `LoggerBridge` (DONE) persiste les événements en JSONL
- `EventBus` émet déjà les événements `story.step.started`, `story.step.completed`, `llm.call.completed`
- EA3-S3 (Sprint Overview, BACKLOG) prévoit un dashboard mais pas le détail des étapes workflow

**Need:** Le developer veut voir dans l'UI Web les macro-commandes BMAD / étapes du workflow en cours d'exécution, en temps réel :
- Quelle story est en cours de traitement
- Quel agent/step est actif (DevAgent, ReviewerAgent, QAAgent, PMAgent)
- Le statut de chaque step (pending → running → ok/failed)
- Les commandes lancées (ex: "BMAD Dev Agent generating code...", "BMAD Review Agent analyzing...", "Running pnpm test...", "Running biome check...")
- Timeline visuelle du sprint avec durées par step

**Scope (MVP):**
- SSE endpoint streaming les événements workflow en temps réel (E11-S1 SSE daemon stream est DONE)
- Vue Web UI type "pipeline view" montrant le flux Dev → Reviewer → QA → PM par story
- Chaque step affiche : nom de l'agent, statut (spinner/ok/failed), durée, résumé (modèle LLM utilisé, tokens, fichiers générés)
- Historique consultable après le sprint (pas juste temps réel)

**Architecture notes:**
- Les événements existent déjà sur l'EventBus — il s'agit de les exposer via SSE (infrastructure en place) et les afficher dans une vue Web
- Le `SprintFormatter` fait déjà ce travail pour le CLI — la Web UI serait l'équivalent visuel
- Possibilité de réutiliser le JSONL log (StructuredLogger) comme source pour l'historique

**Lien avec les autres features:**
- Feature 1 (Quality Dashboard) pourrait être un onglet du même dashboard
- Feature 3 (DemoAgent) apparaîtrait comme un step supplémentaire dans le pipeline view

---

## Summary for Edit PRD

| Feature | Priority | Type | Action |
|---------|----------|------|--------|
| Quality Dashboard Web UI | HIGH | Reprioritize backlog | Move E10-S9/EA3-S3 up, add stories |
| Sprint Workflow Execution Visibility | HIGH | New stories in E11 | Expose workflow events to Web UI |
| Worktree Preview Environment | MEDIUM | New epic | Needs grooming, start with post-dev demo |
| Demo Agent + Playwright | MEDIUM | New epic | Future sprints, depends on preview env |
| MCP Access Control | MEDIUM | Extend E5 | Progressive 3-phase approach |
