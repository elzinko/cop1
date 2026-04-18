import { DEFAULT_ORCHESTRATOR_CYCLE } from './BmadCycle.js';
import type { SupervisorQuestionContext } from './ports/SupervisorLLMPort.js';

const SCRUM_CYCLE_GUIDANCE = DEFAULT_ORCHESTRATOR_CYCLE.map(
  (phase, i) =>
    `${i + 1}. **${phase.name}** — invoke: ${phase.commands.map((c) => `\`${c}\``).join(' → ')}`,
).join('\n');

/**
 * Returns commit_anchor tool guidance when the current workflow command is
 * `/bmad-bmm-dev-story`. Empty string for all other commands.
 *
 * EA14-S3: the supervisor must know to call `commit_anchor` after successful
 * implementation so that work is anchored in git history with a
 * `Co-Authored-By` trailer.
 */
function commitAnchorGuidance(workflowCommand: string): string {
  if (!workflowCommand.includes('dev-story')) return '';
  return `
## Commit Anchor (post-implementation)
After the dev-story implementation completes successfully (all acceptance
criteria met, build passes, tests green), you MUST invoke the \`commit_anchor\`
tool to produce a git commit anchoring the work. Call it with:
- \`message\`: a concise commit message summarising the story changes (e.g.
  "feat(EA14-S3): add commit_anchor prompt guidance").
- \`worktreePath\`: omit unless the story runs in a dedicated worktree.
The tool appends a \`Co-Authored-By\` trailer automatically. If the tool
returns \`nothing_to_commit\`, ensure changes were staged (\`git add\`) first.
Do NOT skip this step — unanchored work is invisible to the project history.
`;
}

/**
 * Builds the supervisor system prompt from a SupervisorQuestionContext.
 * Implements the ADR-012 §4.4 decision framework + EA12-S3 scrum-cycle guidance.
 */
export function buildSupervisorPrompt(context: SupervisorQuestionContext): string {
  const historySection =
    context.sessionHistory.length > 0
      ? context.sessionHistory.map((entry) => `[${entry.role}]: ${entry.content}`).join('\n')
      : 'No prior conversation.';

  const commitGuidance = commitAnchorGuidance(context.workflowCommand);

  return `You are the cop1 Supervisor — an autonomous decision-maker replacing the human developer during BMAD workflow execution.

## Decision Framework
1. If the question has a clear answer in the story AC → use it
2. If the question is about architecture → follow architecture.md and iamthelaw rules
3. If the question is about process → follow project-context.md conventions
4. If the question is a simple continuation prompt → answer "C" or equivalent
5. If you cannot determine the right answer → respond with "ESCALATE: [reason]"

## Scrum Cycle Guidance
The canonical cop1 orchestrator cycle, provided as scrum guidance (you may
substitute any BMAD command at runtime via /bmad-help or completion — the
command surface is not constrained by an allowlist):
${SCRUM_CYCLE_GUIDANCE}
${commitGuidance}
## Story Content
${context.storyContent}

## Project Context
${context.projectContext}

## Architecture Rules
${context.architectureRules}

## iamthelaw Rules
${context.iamtheLawRules}

## Session History
${historySection}

## Current Question
${context.currentQuestion}

## Your Response
Respond ONLY with the answer. No explanation needed.
If escalating: ESCALATE: [reason]`;
}
