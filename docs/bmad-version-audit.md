---
title: BMAD Version Audit — 6.0.0-Beta.8 vs upstream 6.3.0
generated: 2026-04-15
status: working — input for the next /bmad-bmm-create-architecture session
authoritative_sources:
  - _bmad/_config/manifest.yaml (installed versions)
  - supervisor-playbook.md (declared pin)
  - packages/app/src/composition/PipelineStepFactory.ts (commands invoked)
  - https://github.com/bmad-code-org/BMAD-METHOD/releases (upstream)
---

# BMAD Version Audit

> **Purpose.** Before the `/bmad-bmm-create-architecture` session, quantify the gap between the BMAD install cop1 currently drives (`6.0.0-Beta.8`) and the upstream line, so the architecture session can take an explicit position on compatibility / upgrade strategy.

---

## 1. Installed state (`_bmad/_config/manifest.yaml`)

| Module | Installed | Source | Install date |
|---|---|---|---|
| `core` | **6.0.0-Beta.8** | built-in | 2026-02-09 |
| `bmm` | **6.0.0-Beta.8** | built-in | 2026-02-09 |
| `bmb` | **0.1.6** | external (`bmad-builder`) | 2026-02-09 |
| `tea` | **1.0.0** | external (`bmad-method-test-architecture-enterprise`) | 2026-02-09 |

IDE bindings: `claude-code`, `cursor`, `codex`, `gemini`.

`supervisor-playbook.md:1` also pins the display string `BMAD version: 6.0.0-Beta.8`.

## 2. Upstream state (at audit time)

| Thing | Version / date | Source |
|---|---|---|
| Latest stable release | **6.3.0** — 2026-04-10 | https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.3.0 |
| Last `main` push | 2026-04-14 | GitHub `bmad-code-org/BMAD-METHOD` |
| `bmad-builder` (BMB) stable v1 | **In Progress** — no ETA | Roadmap `docs/roadmap.mdx` |

**Gap on `core` + `bmm`**: 3 minor releases (6.0 → 6.1 → 6.2 → 6.3), 2 months behind.

## 3. Slash commands cop1 actually invokes

Recovered by grepping the live codebase (not docs):

| Slash command | Source paths |
|---|---|
| `/bmad-bmm-create-story` | `supervisor-playbook.md:10`, `packages/app/src/integration-tests/orchestrator-e2e.test.ts:45,134`, `docs/GETTING_STARTED.md:47` |
| `/bmad-bmm-dev-story` | `packages/app/src/composition/PipelineStepFactory.ts:77`, `supervisor-playbook.md:14`, `bmad-smoke-e2e.test.ts:22`, `bmad-pipeline-e2e.test.ts:166-169` |
| `/bmad-bmm-code-review` | `PipelineStepFactory.ts:83`, `supervisor-playbook.md:15`, `fake-claude.mjs:58`, `bmad-pipeline-e2e.test.ts:167-170` |
| `/bmad-bmm-qa-automate` | `PipelineStepFactory.ts:89`, `bmad-pipeline-e2e.test.ts:168-171` |
| `/bmad-help` | `SupervisorPlaybookLoader.ts:100` (default `helpRef`), `supervisor-playbook.md:2` |

No `/bmad-bmb-*` nor `/bmad-tea-*` commands are invoked by cop1 code today. Only `bmm` skills matter for the runtime path.

## 4. Breaking / material changes upstream 6.0 → 6.3

Source: BMAD-METHOD CHANGELOG / release notes / issue tracker.

### 4.1 v6.1.0 (2026-03-13) — "everything is a skill"

- Legacy workflow engine removed. Workflows / agents / tasks unified behind a single `SKILL.md` package format.
- Module Whiteport Design Studio (WDS) activated.
- `.claude/hooks/bmad-speak.sh` shipped (TTS, cosmetic — not a generic hook system).
- NPM package size −91% (6.2 MB → 555 KB).
- `@next` channel added.

**cop1 impact:** the XML/YAML workflow artefacts referenced by `_bmad/bmm/` in 6.0-Beta.8 no longer exist as-is in 6.1+. BMAD slash commands resolve through different file paths. **Moderate risk** on anything that reads `_bmad/bmm/workflows/*.yaml` directly (cop1 doesn't seem to — it invokes by slash command through the Agent SDK).

### 4.2 v6.2.0 (2026-03-15) — all workflows → native skill packages

- `create-story`, `quick-dev`, `dev-story`, `create-architecture`, `create-product-brief`, `create-ux-design`, `code-review` all converted to native skill packages.
- `bmad-builder` module-definition path moved: `src/module.yaml` → `skills/module.yaml` (v6.2.2).

**cop1 impact:** the slash commands cop1 invokes (`/bmad-bmm-dev-story`, `/bmad-bmm-code-review`, `/bmad-bmm-create-story`) should still resolve by name, since the Claude Code IDE hooks listed in manifest still pick them up. **Low-to-moderate risk** — behaviour inside the skill may have changed (different prompts, different question flows). Needs smoke test.

### 4.3 v6.3.0 (2026-04-10) — agent consolidation

- **Three personas deleted**: Barry (quick-flow-solo-dev), **Quinn (QA agent)**, **Bob Scrum Master**. All consolidated into the single Developer agent Amelia.
- `spec-wip.md` singleton removed; `quick-dev` writes to `spec-{slug}.md` with a `status` field — enables parallel sessions.
- Remote marketplace registry for modules + universal source support (GitHub/GitLab/Bitbucket/self-hosted) via 5-strategy PluginResolver.
- New skill `bmad-prfaq` (Amazon Working Backwards).

**cop1 impact — HIGH** on `/bmad-bmm-qa-automate`:
- If `qa-automate` was a Quinn-agent entry point, a 6.3 upgrade will either rename or remove the command. **Must be verified before upgrade.**
- `/bmad-bmm-dev-story` and `/bmad-bmm-code-review` — likely still exist, but now routed through Amelia. Behaviour may differ.
- `/bmad-bmm-create-story` — unchanged intent, but internals rewritten.

### 4.4 BMB (bmad-builder) — not a safe rely-on path

- Installed version: 0.1.6 (Feb 2026).
- Upstream: `BMad Builder v1` listed **In Progress** in the public roadmap, no ETA.
- Community issues requesting a native orchestrator pattern (#2036, #1809, #1584) are **open, no official answer beyond "use /bmad-help as router"**.

**Implication**: do NOT plan cop1's Supervisor architecture around BMB `create-module` / `create-agent` / `create-workflow`. These may be renamed or removed before BMB v1 stabilizes. The Supervisor is a cop1 runtime feature (per ADR-014), not a BMAD skill.

## 5. Decision points for the architecture session

### D1 — Pin strategy

**Options:**
1. **Freeze** on 6.0.0-Beta.8 until V1.1 ships. Zero compat work. Accept that BMAD upstream fixes/improvements will not land.
2. **Upgrade** to 6.3.0 before V1.1. Requires smoke-testing all 5 slash commands used by cop1 (esp. `/bmad-bmm-qa-automate` given Quinn removal) and re-running `cop1 init-bmad-bridge` to refresh `customize.yaml`.
3. **Split**: freeze `core` + `bmm` at 6.0-Beta.8, upgrade `bmb` / `tea` independently. Low value — BMB is not used by cop1 runtime and TEA version is 1.0 stable.

**Recommendation to raise in session:** default to (1) for the V1-light → V1.1 window (stability over features), schedule (2) as a dedicated V1.1-end story with migration notes.

### D2 — `qa-automate` resilience

Regardless of D1 outcome, cop1 hardcodes `/bmad-bmm-qa-automate` in three places:
- `packages/app/src/composition/PipelineStepFactory.ts:89`
- `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts:168-171`
- Implicitly in the default playbook pipeline contract

Decision: extract the command list to config (`cop1.config.yaml` or playbook frontmatter) so an upgrade to 6.3 can remap QA to whatever Amelia exposes without code change. This fits ADR-014's playbook-first philosophy.

### D3 — ADR-009 vs OrchestratorService write contention

Orthogonal to BMAD version, but must be tranched in the same session — see brownfield §10.5. Once a real `BMADCommandRunner` delegates to a real BMAD slash command, the slash command mutates `sprint-status.yaml` itself (ADR-008); `OrchestratorService.persistStatus()` would then double-write. Either:
- Keep orchestrator as single writer (requires pinning `BMADCommandRunner` to a version of BMAD that does NOT mutate status)
- Revert to ADR-009 invariant, remove `persistStatus()` once BMAD runs end-to-end.

Second option is cleaner and matches every other ADR on the topic. Flag for architect.

### D4 — Playbook schema vs BMAD skill parameters

ADR-014 §7 defines a markdown + YAML frontmatter playbook. If the v6.3 skill packages add required parameters to `/bmad-bmm-dev-story`, the playbook schema must evolve. Verify once on the 6.3 install, not now.

## 6. What we do NOT know yet

- Whether `/bmad-bmm-qa-automate` survives in v6.3 (and, if not, what replaces it).
- Whether the existing `_bmad/_config/agents/*.customize.yaml` bridge still loads after v6.1 "everything is a skill" refactor.
- Whether `settingSources: ["project"]` in `AgentSdkSessionAdapter` still resolves BMAD skills identically on v6.3.
- Concrete BMB v1 public API (not yet released).

These unknowns are resolved empirically during the upgrade, not on paper.

## 7. Commands the user should run (not Claude)

Anything under `_bmad/` must be driven by BMAD itself, not by cop1 or an assistant editing files. When the upgrade is decided:

```bash
# In the cop1 repo, from a clean working tree:
# 1. Check what BMAD upgrade does in dry-run (commands vary by BMAD version — check `bmad --help` on your current install).
npx bmad-method update --dry-run
# 2. Review the proposed diff in _bmad/.
# 3. Apply:
npx bmad-method update
# 4. Refresh the bridge so `customize.yaml` reloads iamthelaw sidecar:
node packages/app/dist/cli/daemon-entry.js init-bmad-bridge
# 5. Smoke-test the 5 commands used by cop1:
#    /bmad-bmm-create-story  ·  /bmad-bmm-dev-story  ·  /bmad-bmm-code-review
#    /bmad-bmm-qa-automate   ·  /bmad-help
# 6. If /bmad-bmm-qa-automate is gone, discover the replacement:
/bmad-help
```

The final "what the architecture doc should decide" checklist (D1–D4 above) is the output to take into `/bmad-bmm-create-architecture`.
