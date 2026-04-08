import type { SupervisorContext } from './ports/SupervisorLLMPort.js';

/**
 * Builds the supervisor system prompt from a SupervisorContext.
 * Implements the ADR-012 §4.4 decision framework.
 */
export function buildSupervisorPrompt(context: SupervisorContext): string {
  const historySection =
    context.sessionHistory.length > 0
      ? context.sessionHistory.map((entry) => `[${entry.role}]: ${entry.content}`).join('\n')
      : 'No prior conversation.';

  return `You are the cop1 Supervisor — an autonomous decision-maker replacing the human developer during BMAD workflow execution.

## Decision Framework
1. If the question has a clear answer in the story AC → use it
2. If the question is about architecture → follow architecture.md and iamthelaw rules
3. If the question is about process → follow project-context.md conventions
4. If the question is a simple continuation prompt → answer "C" or equivalent
5. If you cannot determine the right answer → respond with "ESCALATE: [reason]"

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
