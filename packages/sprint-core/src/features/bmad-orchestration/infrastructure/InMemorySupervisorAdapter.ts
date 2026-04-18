import type {
  SupervisorLLMPort,
  SupervisorQuestion,
  SupervisorQuestionContext,
  SupervisorResponse,
} from '../domain/ports/SupervisorLLMPort.js';

/**
 * In-memory supervisor adapter for testing.
 * Returns pre-configured responses based on pattern matching on `currentQuestion`.
 */
export class InMemorySupervisorAdapter implements SupervisorLLMPort {
  private readonly defaultResponse: SupervisorResponse;

  constructor(
    private readonly responses: Map<string, SupervisorResponse>,
    defaultResponse?: SupervisorResponse,
  ) {
    this.defaultResponse = defaultResponse ?? {
      answer: 'C',
      escalated: false,
      durationMs: 0,
    };
  }

  async generateResponse(
    question: SupervisorQuestion,
    _context: SupervisorQuestionContext,
  ): Promise<SupervisorResponse> {
    const questionLower = question.currentQuestion.toLowerCase();

    for (const [pattern, response] of this.responses) {
      if (questionLower.includes(pattern.toLowerCase())) {
        return response;
      }
    }

    return this.defaultResponse;
  }
}
