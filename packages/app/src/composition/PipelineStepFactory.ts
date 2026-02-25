import type { Cop1Config } from '@cop1/shared-kernel';
import type { EventBus } from '@cop1/shared-kernel';
import {
  BMADDevStoryStep,
  BMADQAStep,
  BMADReviewStep,
  DevAgent,
  PMAgentWorkflowStep,
  QAAgent,
  ReviewerAgent,
  type BMADCommandPort,
  type WorkflowStep,
} from '@cop1/sprint-core';
import {
  LLMCodeGenerator,
  LLMGateway,
  LLMReviewer,
  LLMRouter,
  OllamaAdapter,
  TokensPerSecMonitor,
} from '@cop1/llm-intelligence';
import type { ConfigLoader } from '../features/config/application/ConfigLoader.js';

export class PipelineStepFactory {
  private tpsListenerRegistered = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly commandPort?: BMADCommandPort,
  ) {}

  build(config: Cop1Config, configLoader?: ConfigLoader): WorkflowStep[] {
    if (config.workflow.useBMAD) {
      return this.buildBMADSteps();
    }
    return this.buildLegacySteps(configLoader);
  }

  private buildBMADSteps(): WorkflowStep[] {
    if (!this.commandPort) {
      throw new Error('BMADCommandPort is required when workflow.useBMAD is true');
    }
    // BMAD pipeline: 3 steps (dev, review, qa).
    // PM validation is handled internally by BMAD workflows,
    // unlike the legacy pipeline which has an explicit PMAgentWorkflowStep.
    return [
      new BMADDevStoryStep(this.commandPort),
      new BMADReviewStep(this.commandPort),
      new BMADQAStep(this.commandPort),
    ];
  }

  private buildLegacySteps(configLoader?: ConfigLoader): WorkflowStep[] {
    if (!configLoader) {
      throw new Error('ConfigLoader is required for legacy pipeline (workflow.useBMAD: false)');
    }

    const ollama = new OllamaAdapter();
    const router = new LLMRouter(configLoader);
    const gateway = new LLMGateway(ollama, this.eventBus).withRouter(router);
    const codeGenerator = new LLMCodeGenerator(gateway);
    const reviewer = new LLMReviewer(gateway);

    if (!this.tpsListenerRegistered) {
      const tpsMonitor = new TokensPerSecMonitor();
      this.eventBus.on('llm.call.completed', (payload: unknown) => {
        const p = payload as { agentType: string; tokenCount: number; durationMs: number };
        tpsMonitor.record(p.agentType, p.tokenCount, p.durationMs);
      });
      this.tpsListenerRegistered = true;
    }

    return [
      new DevAgent(codeGenerator),
      new ReviewerAgent(reviewer),
      new QAAgent(),
      new PMAgentWorkflowStep(),
    ];
  }
}
