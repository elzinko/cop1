#!/usr/bin/env bash
# EA13-S3 — manual real-run procedure.
#
# Replays the 2026-04-16 empirical shakedown procedure against the real
# BMAD runner (EA13-S2) to verify observables that the automated
# integration test (orchestrator-real-run.test.ts) cannot cover without
# an SDK key.
#
# Usage:
#   ./scripts/ea13-real-run.sh                 # default sandbox at /tmp/cop1-ea13-realrun-<date>
#   SANDBOX=/path/to/sandbox ./scripts/ea13-real-run.sh
#
# Expected observables (verify manually after the run):
#   - exit code 0
#   - `Orchestrator finished: 1 stories, escalated=false, aborted=false`
#   - `sprint-status.yaml` → `EX1-S1: done`
#   - `.cop1/sprint-log-<today>.jsonl` contains real decision entries
#   - `.cop1/history/EX1-S1/track{1,2,3}/...` present with turn files
#   - At least one `git log` entry in the sandbox with `Co-Authored-By:` trailer
#
# Pre-requisites:
#   - ANTHROPIC_API_KEY set in the environment (the default runner lazy-loads the SDK)
#   - cop1 built: `pnpm build` green
#   - node >= 20

set -euo pipefail

DATE=$(date -u +%Y-%m-%d)
SANDBOX=${SANDBOX:-/tmp/cop1-ea13-realrun-$DATE}
COP1_BIN=${COP1_BIN:-$(pwd)/packages/app/dist/cli/index.js}

if [[ ! -f "$COP1_BIN" ]]; then
  echo "ERROR: CLI not built at $COP1_BIN. Run 'pnpm build' first." >&2
  exit 1
fi

echo "=== EA13-S3 real-run ==="
echo "Sandbox: $SANDBOX"
echo "CLI:     $COP1_BIN"
echo ""

# Clean prior sandbox
if [[ -d "$SANDBOX" ]]; then
  echo "Removing prior sandbox at $SANDBOX"
  rm -rf "$SANDBOX"
fi

mkdir -p "$SANDBOX/_bmad-output/implementation-artifacts"

# git init so commit_anchor has a target
(cd "$SANDBOX" && git init -q && git config user.email "ea13@local" && git config user.name "EA13" && \
  : > .gitkeep && git add .gitkeep && git commit -q -m "init")

# Playbook — post-EA12-S3 format (scrum directives, no commands map)
cat > "$SANDBOX/supervisor-playbook.md" <<'EOF'
BMAD version: 6.0.0-Beta.8
help: /bmad-help
Epic/story restrictions: Process every story of the target epic.
Decision policy: 3-tier supervisor cascade.

## Mission
Smoke test.

## Story Creation
Author the story with minimal AC.

## Development Loop
Canonical scrum cycle.

## Escalation Policy
Escalate on reentrance cap or budget exhaustion.
EOF

# Sprint status — single ready-for-dev story
cat > "$SANDBOX/_bmad-output/implementation-artifacts/sprint-status.yaml" <<'EOF'
generated: 2026-04-16
project: smoke
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts
development_status:
  epic-ex1: in-progress
  EX1-S1: ready-for-dev
  epic-ex1-retrospective: optional
EOF

echo ""
echo "=== Running orchestrator (real BMAD runner) ==="
echo ""

node "$COP1_BIN" orchestrator run --epic EX1 --project-root "$SANDBOX"

echo ""
echo "=== Post-run observables ==="
echo ""
echo "[1] sprint-status.yaml content:"
cat "$SANDBOX/_bmad-output/implementation-artifacts/sprint-status.yaml" | grep -E "EX1-S1:" || echo "  (nothing)"
echo ""
echo "[2] JSONL sprint log (last 5 entries):"
LOG_FILE="$SANDBOX/.cop1/sprint-log-$DATE.jsonl"
if [[ -f "$LOG_FILE" ]]; then
  tail -n 5 "$LOG_FILE"
else
  echo "  (no log file at $LOG_FILE)"
fi
echo ""
echo "[3] History tracks:"
if [[ -d "$SANDBOX/.cop1/history" ]]; then
  find "$SANDBOX/.cop1/history" -maxdepth 3 -type f | head -10
else
  echo "  (no .cop1/history/ directory)"
fi
echo ""
echo "[4] Git log in sandbox:"
(cd "$SANDBOX" && git log --oneline --decorate | head -5)
echo ""
echo "[5] Git commits with Co-Authored-By trailers:"
(cd "$SANDBOX" && git log --grep "Co-Authored-By:" --oneline | head -5) || echo "  (none — commit_anchor did not fire)"
echo ""
echo "=== Checklist ==="
echo "[ ] exit code was 0"
echo "[ ] 'Orchestrator finished: 1 stories, escalated=false, aborted=false' printed"
echo "[ ] EX1-S1 status flipped to done"
echo "[ ] JSONL log contains real decision entries (not 'stub')"
echo "[ ] history/ tracks populated"
echo "[ ] ≥1 real git commit with Co-Authored-By trailer"
echo ""
echo "Done."
