export interface BudgetConfig {
  sprint_max_tokens: number;
  alert_thresholds: number[];
  auto_pause: boolean;
}

export interface Cop1Config {
  project: {
    name: string;
    path: string;
  };
  daemon: {
    port: number;
  };
  sprint: {
    default_duration_hours: number;
  };
  resources: {
    ram_budget_night_gb: number;
    ram_budget_day_gb: number;
    suspension_threshold_percent: number;
    polling_interval_ms: number;
  };
  llm_routing: Record<string, string>;
  llm_fallback: Record<string, string>;
  git: {
    auto_merge: boolean;
  };
  workflow: {
    /**
     * @deprecated Since 2026-04-14 (EA11-S2). Setting `useBMAD=false` selects the legacy
     * stub pipeline (`DevAgentStep` / `ReviewerAgentStep` / `QAAgentStep` / `PMAgentStep`)
     * kept as a safety-net fallback. The BMAD path (`useBMAD=true`, default) is the
     * supported route. This flag is scheduled for removal once EA10 Supervisor
     * Orchestrator (EA10-S9 integration test) is proven in production.
     */
    useBMAD: boolean;
  };
  blocage_rules: Record<string, string>;
  schedule: {
    auto_start: string[];
  };
  budget: BudgetConfig;
}
