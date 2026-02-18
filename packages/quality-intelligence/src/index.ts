// @cop1/quality-intelligence — Barrel public

export type {
  QualityGatePort,
  QualityGateResult,
} from './features/quality-gate/domain/ports/QualityGatePort.js';
export { QualityGateService } from './features/quality-gate/application/QualityGateService.js';
export type { GatePort, GateResult } from './features/quality-gate/domain/ports/GatePort.js';

// Coverage Gate
export { CoverageGate } from './features/coverage-gate/application/CoverageGate.js';
export type { CoverageResult } from './features/coverage-gate/domain/CoverageResult.js';

// Static Analysis Gate
export { StaticAnalysisGate } from './features/static-analysis-gate/application/StaticAnalysisGate.js';
export type {
  AnalysisResult,
  Violation,
} from './features/static-analysis-gate/domain/AnalysisResult.js';

// Config Templates
export { QualityConfigTemplateService } from './features/config-templates/application/QualityConfigTemplateService.js';

// Arch Drift Detector
export { ArchDriftDetector } from './features/arch-drift/application/ArchDriftDetector.js';

// SonarQube
export { SonarQubeAdapter } from './features/sonarqube/application/SonarQubeAdapter.js';
