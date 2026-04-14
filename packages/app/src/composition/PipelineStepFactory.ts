import {
  LLMCodeGenerator,
  LLMGateway,
  LLMReviewer,
  LLMRouter,
  OllamaAdapter,
  TokensPerSecMonitor,
} from '@cop1/llm-intelligence';
import type { Cop1Config } from '@cop1/shared-kernel';
import type { EventBus } from '@cop1/shared-kernel';
import {
  type BMADSessionPort,
  BMADSessionStep,
  DevAgent,
  PMAgentWorkflowStep,
  QAAgent,
  ReviewerAgent,
  type SupervisorService,
  type WorkflowStep,
} from '@cop1/sprint-core';
import type { ConfigLoader } from '../features/config/application/ConfigLoader.js';

export interface PipelineStepFactoryOptions {
  sessionPort?: BMADSessionPort;
  supervisorService?: SupervisorService;
  /**
   * Optional warn sink. Defaults to `console.warn`. Injectable for testing.
   * @internal
   */
  warn?: (message: string) => void;
}

const LEGACY_USE_BMAD_WARNING =
  '[DEPRECATED EA11-S2 / 2026-04-14] config.workflow.useBMAD=false uses the legacy stub pipeline (DevAgent/Reviewer/QA/PM*Step). This path is deprecated and scheduled for removal after EA10 orchestrator is proven. Switch to workflow.useBMAD=true (default) and, when available, the EA10 orchestrator.';

export class PipelineStepFactory {
  private tpsListenerRegistered = false;
  private legacyWarnEmitted = false;
  private readonly sessionPort?: BMADSessionPort;
  private readonly supervisorService?: SupervisorService;
  private readonly warn: (message: string) => void;

  constructor(
    private readonly eventBus: EventBus,
    options: PipelineStepFactoryOptions = {},
  ) {
    this.sessionPort = options.sessionPort;
    this.supervisorService = options.supervisorService;
    this.warn = options.warn ?? ((message) => console.warn(message));
  }

  build(config: Cop1Config, configLoader?: ConfigLoader): WorkflowStep[] {
    if (config.workflow.useBMAD) {
      return this.buildBMADSteps();
    }
    if (!this.legacyWarnEmitted) {
      this.warn(LEGACY_USE_BMAD_WARNING);
      this.legacyWarnEmitted = true;
    }
    return this.buildLegacySteps(configLoader);
  }

  private buildBMADSteps(): WorkflowStep[] {
    if (!this.sessionPort || !this.supervisorService) {
      throw new Error(
        'BMADSessionPort and SupervisorService are required when workflow.useBMAD is true',
      );
    }
    const sessionPort = this.sessionPort;
    const supervisorService = this.supervisorService;
    const eventBus = this.eventBus;
    // BMAD pipeline: 3 BMADSessionStep instances sharing the same sessionPort +
    // supervisorService (ADR-012). PM validation is handled internally by BMAD.
    return [
      new BMADSessionStep(sessionPort, supervisorService, {
        name: 'bmad-dev',
        command: '/bmad-bmm-dev-story',
        errorPrefix: 'BMAD dev-story failed',
        eventBus,
      }),
      new BMADSessionStep(sessionPort, supervisorService, {
        name: 'bmad-review',
        command: '/bmad-bmm-code-review',
        errorPrefix: 'BMAD code-review failed',
        eventBus,
      }),
      new BMADSessionStep(sessionPort, supervisorService, {
        name: 'bmad-qa',
        command: '/bmad-bmm-qa-automate',
        errorPrefix: 'BMAD QA validation failed',
        eventBus,
      }),
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
