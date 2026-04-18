/**
 * Supervisor LLM port — generates intelligent responses to BMAD workflow questions.
 * The SupervisorService (EA9-S3) invokes this port to answer questions that cannot
 * be resolved deterministically.
 */

export interface SupervisorQuestion {
  currentQuestion: string;
  workflowCommand: string;
  storyId: string;
}

export interface SupervisorQuestionContext {
  workflowCommand: string;
  storyId: string;
  storyContent: string;
  projectContext: string;
  architectureRules: string;
  iamtheLawRules: string;
  sessionHistory: Array<{ role: 'workflow' | 'supervisor'; content: string }>;
  currentQuestion: string;
}

export interface SupervisorResponse {
  answer: string;
  escalated: boolean;
  escalationReason?: string;
  durationMs: number;
  tokensUsed?: number;
}

export interface SupervisorLLMPort {
  generateResponse(
    question: SupervisorQuestion,
    context: SupervisorQuestionContext,
  ): Promise<SupervisorResponse>;
}
