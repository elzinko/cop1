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
    useBMAD: boolean;
  };
  blocage_rules: Record<string, string>;
  schedule: {
    auto_start: string[];
  };
}
