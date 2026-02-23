# UX Design Brief — cop1 Dashboard

**Date:** 2026-02-22
**Project:** cop1 (Autonomous AI Agents Sprint Runner)
**Target Epic:** E16 — Enhanced Dashboard & Sprint Replay
**Stakeholder:** elzinko (Developer / Product Owner)

---

## 1. Product Overview

cop1 is an autonomous AI agent orchestrator that runs software development sprints overnight. It executes a pipeline of 4 agents (Dev, Reviewer, QA, PM) on each story, tracks progress, and self-improves through retrospectives and evolving rules.

The developer launches a sprint before going to bed, and wakes up to find code written, reviewed, tested, and validated. **The dashboard is how the developer sees what happened.**

---

## 2. User Persona

**Name:** The Overnight Developer
**Context:** Launches `cop1 sprint run` before leaving. Returns hours later (or the next morning).
**Primary needs:**
- "What happened while I was away?" (Sprint Replay)
- "How well did the agents perform?" (Agent Performance)
- "Are we on track?" (Scrum Metrics)
- "How much did it cost?" (Budget / Token usage)
- "What decisions were made in ceremonies?" (Ceremony Reports)

**Secondary needs:**
- Monitor a sprint in real-time while it's running
- Compare performance across sprints (trends)
- Identify bottlenecks and regressions

---

## 3. Views to Design

### 3.1 Sprint Overview (Home)

The landing page. At a glance: sprint status, key metrics, alerts.

**Data available:**
- `SprintDashboardService.computeMetrics()` → totalStories, completedStories, inProgressStories, blockedStories, totalPoints, completedPoints, completionPercentage
- `KPIsDashboardService.computeKPIs()` → velocity, blocageRate, dodRejectionRate, coveragePercent
- `KPIsDashboardService.computeTrend()` → velocityTrend (up/down/stable), avgBlockageRate, avgCoverage
- Real-time SSE events via `/events` endpoint

**Key elements:**
- KPI scorecard (4-6 big numbers with trend arrows)
- Story status distribution (done / in-progress / blocked / backlog)
- Current sprint progress bar (points completed / total)
- Active alerts (blocages, budget warnings)
- Quick link to latest sprint replay

---

### 3.2 Sprint Replay

The "DVR" for sprints. Step-by-step timeline of everything that happened.

**Data available:**
- JSONL sprint log (`.cop1/sprint-log-YYYY-MM-DD.jsonl`)
- Events: `sprint.starting`, `story.workflow.started`, `story.step.started`, `llm.call.started`, `llm.call.completed`, `story.step.completed`, `story.workflow.completed/failed`, `sprint.completed`
- Each LLM event includes: model, agentType, promptLength, responseLength, durationMs, tokenCount

**Key elements:**
- Chronological timeline (vertical or horizontal)
- Play / Pause / Step Forward / Step Back controls
- Click on event → detail panel (prompt sent, response received, duration, tokens, score if available)
- Color-coded by agent type (Dev=blue, Reviewer=orange, QA=green, PM=purple)
- Sprint selector (pick which day's log to replay)
- Duration indicators between events (how long each step took)

**Interaction model:**
- Autoplay at configurable speed (1x, 5x, 10x)
- Click on a story in the sidebar → jump to its events
- Filter by event type or agent

---

### 3.3 Scrum Metrics

Burndown, burnup, velocity — the classic Scrum charts.

**Data available:**
- `BurndownCalculator.computeChartData()` → burndown points (ideal vs actual remaining), burnup points (scope vs completed), projectedCompletionDay
- `VelocityProjector.project()` → avgVelocity, estimatedSprints, confidence (low/medium/high)
- Historical data across multiple sprints

**Key elements:**
- Burndown chart (ideal line vs actual line)
- Burnup chart (scope line vs completed line)
- Velocity bar chart (points per sprint, historical)
- Projected completion indicator with confidence badge
- Sprint selector (compare sprints side-by-side)

---

### 3.4 Budget View

Token consumption tracking for Claude API, alerts, projections.

> **Updated 2026-02-22 (Phase A Pivot):** Simplified to Claude API only — no local vs cloud distinction in Phase A. All execution goes through BMAD commands via Claude Code CLI.

**Data available (Phase A, EA2):**
- TokenBudgetService → tokens consumed per BMAD command, per agent, per sprint
- Budget limits from `cop1.config.yaml` section `budget:`
- Alert thresholds: 50% (warning), 80% (notification), 95% (auto-pause)
- `llm.call.completed` events from BMADCommandPort with tokenCount and model

**Key elements:**
- Budget progress bar with threshold markers (50%, 80%, 95%) and current consumption
- Per-BMAD-command consumption breakdown (bar chart): dev-story vs code-review vs QA vs retro
- Active alerts list (budget warnings, exceeded events)
- Projection: "At current rate, budget exhausted in X hours"
- Historical cost trend (per sprint)

**Note:** This view depends on EA2 (Budget & Consumption Tracking). Design it now, populate with mock data initially.

---

### 3.5 Agent Performance

How well each BMAD command performs, based on output metrics.

> **Updated 2026-02-22 (Phase A Pivot):** Agent scoring (E15) deferred to Phase B. Phase A shows basic BMAD command output metrics instead.

**Data available (Phase A):**
- BMAD command duration per workflow type (dev-story, code-review, QA, retro)
- Token consumption per command from `llm.call.completed` events
- Rejection counts from BMADReviewStep
- Story completion rate per sprint

**Key elements:**
- BMAD command cards (dev-story, code-review, QA, retro) with average duration and token cost
- Rejection rate trend (code-review)
- Average step duration by command type (bar chart)
- Cross-sprint comparison (same command over time)

**Note:** Full agent scoring (radar charts, quality/tests/AC breakdown) deferred to Phase B (E15). Phase A shows execution metrics only.

---

### 3.6 Ceremony Reports

Minutes from automated agile ceremonies.

**Data available:**
- Ceremony output files in `.cop1/ceremonies/` (if persisted)
- Ceremony events via EventBus: `ceremony.complete`
- CeremonySummaryService output (markdown reports)
- Types: Sprint Planning, Grooming, Retrospective, Sprint Review, Round Table

**Key elements:**
- List of past ceremonies (date, type, participants)
- Click → full report (markdown rendered)
- Actions extracted from ceremonies with status (pending / done / rejected)
- Filter by ceremony type
- Link to related sprint

---

## 4. Existing Technical Foundation

### Current Stack
- **React 18** + TypeScript + Vite
- **Dark theme** (slate-900 backgrounds, blue accents)
- **Card-based layout** with tab navigation
- **API proxy** to `http://localhost:3000`
- **SSE endpoint** at `/events` for real-time updates

### Existing API Routes
| Route | Method | Returns |
|-------|--------|---------|
| `/health` | GET | status, uptime, version |
| `/api/sprint/status` | GET | stories with statuses, session info |
| `/api/stories/{id}` | GET | story status |
| `/api/blocages` | GET | open blocages list |
| `/events` | GET (SSE) | real-time event stream |

### New API Routes Needed (E16)
| Route | Method | Returns |
|-------|--------|---------|
| `/api/sprint/{id}/replay` | GET | paginated JSONL events for timeline |
| `/api/sprint/metrics` | GET | burndown, burnup, velocity data |
| `/api/sprint/kpis` | GET | KPI scorecard data |
| `/api/agents/performance` | GET | per-agent scores and stats |
| `/api/ceremonies` | GET | ceremony reports list |
| `/api/budget` | GET | token consumption and limits |

### Design System (from existing CSS)
- **Background:** `#0f172a` (slate-900)
- **Cards:** `#1e293b` (slate-800) with `#334155` (slate-700) borders
- **Primary accent:** `#60a5fa` (blue-400)
- **Status colors:**
  - Pending: `#fbbf24` (amber-400)
  - In Progress: `#60a5fa` (blue-400)
  - Completed/Active: `#34d399` (emerald-400)
  - Failed/Blocked: `#f87171` (red-400)
  - Offline/Backlog: `#94a3b8` (slate-400)
- **Font:** System stack (-apple-system, Segoe UI, etc.)
- **Card grid:** Responsive, min 350px per card

---

## 5. Data Flow Architecture

```
                    ┌──────────────────────┐
                    │    EventBus           │
                    │  (real-time events)   │
                    └──────┬───────────────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
              v            v                v
     ┌────────────┐  ┌──────────┐   ┌─────────────┐
     │ LoggerBridge│  │ SSE /events│   │ Dashboard    │
     │ → JSONL log │  │ (stream)  │   │ Services     │
     └────────────┘  └──────────┘   └─────────────┘
              │            │                │
              v            │                v
     ┌────────────┐        │        ┌─────────────┐
     │ Sprint     │        │        │ REST API     │
     │ Replay     │        │        │ /api/*       │
     └────────────┘        │        └─────────────┘
                           │                │
                           v                v
                    ┌──────────────────────┐
                    │   React Dashboard    │
                    │   (port 5173)        │
                    │                      │
                    │ - SSE for live data   │
                    │ - REST for snapshots  │
                    │ - JSONL for replay    │
                    └──────────────────────┘
```

---

## 6. Design Priorities

1. **Sprint Replay** (core differentiator — no other tool does this for autonomous agents)
2. **Sprint Overview** (first thing the developer sees)
3. **Scrum Metrics** (familiar, high value)
4. **Agent Performance** (unique to cop1)
5. **Budget View** (depends on E14, can wait)
6. **Ceremony Reports** (simpler, list-based)

---

## 7. Inspiration & References

- **GitHub Actions** — workflow run timeline visualization
- **Datadog APM** — service trace waterfall diagrams
- **Linear** — clean dark theme, sprint progress tracking
- **Grafana** — dashboard composition, time-series charts
- **Jira Burndown** — classic scrum charts

---

## 8. Constraints

- **CLI-first project:** The dashboard complements the CLI, it doesn't replace it
- **Local-first:** Runs on localhost, single user, no auth needed
- **Overnight usage:** Must clearly show "what happened" after the fact (replay > real-time)
- **Dark theme mandatory:** Matches developer environment (IDE, terminal)
- **No external dependencies for hosting:** Served by the cop1 daemon on port 3000
- **Chart library:** Not yet chosen — Sally may recommend one
