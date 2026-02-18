// @cop1/sprint-core — Barrel public

// Workflow
export { WorkflowEngine } from './features/workflow/application/WorkflowEngine.js';
export type { WorkflowStep } from './features/workflow/domain/WorkflowStep.js';
export type { WorkflowContext } from './features/workflow/domain/WorkflowContext.js';
export type { StepResult } from './features/workflow/domain/StepResult.js';
export { WorkflowEvent } from './features/workflow/domain/WorkflowEvent.js';
export type { WorkflowEventValue } from './features/workflow/domain/WorkflowEvent.js';

// Agent stubs
export { DevAgentStep } from './features/workflow/infrastructure/steps/DevAgentStep.js';
export { ReviewerAgentStep } from './features/workflow/infrastructure/steps/ReviewerAgentStep.js';
export { QAAgentStep } from './features/workflow/infrastructure/steps/QAAgentStep.js';
export { PMAgentStep } from './features/workflow/infrastructure/steps/PMAgentStep.js';

// BMAD Reader
export { BMADReader } from './features/bmad-reader/application/BMADReader.js';
export type { StoryMetadata } from './features/bmad-reader/domain/StoryMetadata.js';
export { IntegrityError } from './features/bmad-reader/domain/errors/IntegrityError.js';

// Story Status Tracker
export { StoryStatusTracker } from './features/story-tracker/application/StoryStatusTracker.js';
export { StoryStatus } from './features/story-tracker/domain/StoryStatus.js';
export type { StoryStatusValue } from './features/story-tracker/domain/StoryStatus.js';
export { InvalidTransitionError } from './features/story-tracker/domain/errors/InvalidTransitionError.js';

// Snapshot
export { SnapshotService } from './features/story-snapshot/application/SnapshotService.js';

// Enrichment
export { EnrichmentService } from './features/story-enrichment/application/EnrichmentService.js';

// Checkpoint
export { CheckpointService } from './features/checkpoint/application/CheckpointService.js';
export type { CheckpointState } from './features/checkpoint/domain/CheckpointState.js';
export { CheckpointPhase } from './features/checkpoint/domain/CheckpointState.js';

// Sprint Session
export { SprintSessionService } from './features/sprint-session/application/SprintSessionService.js';
export { parseDuration } from './features/sprint-session/domain/SprintSession.js';
export type { SprintSessionData } from './features/sprint-session/domain/SprintSession.js';

// DevAgent
export { DevAgent } from './features/dev-agent/application/DevAgent.js';
export type { CodeGeneratorPort } from './features/dev-agent/domain/ports/CodeGeneratorPort.js';
export { WorktreeManager } from './features/dev-agent/infrastructure/WorktreeManager.js';
export { buildDevPrompt, parseLLMResponse } from './features/dev-agent/domain/DevPromptTemplate.js';
export type { FileOperation } from './features/dev-agent/domain/DevPromptTemplate.js';
