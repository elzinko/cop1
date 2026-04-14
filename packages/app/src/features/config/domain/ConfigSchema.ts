import { z } from 'zod';

export const ConfigSchema = z
  .object({
    project: z
      .object({
        name: z.string().min(1),
        path: z.string().min(1),
      })
      .default({ name: 'cop1-project', path: '.' }),
    daemon: z
      .object({
        port: z.number().int().min(1024).max(65535).default(4242),
      })
      .default({ port: 4242 }),
    sprint: z
      .object({
        default_duration_hours: z.number().positive().default(8),
      })
      .default({ default_duration_hours: 8 }),
    resources: z
      .object({
        ram_budget_night_gb: z.number().min(4).default(48),
        ram_budget_day_gb: z.number().min(4).default(20),
        suspension_threshold_percent: z.number().min(50).max(95).default(75),
        polling_interval_ms: z.number().min(500).default(1000),
      })
      .default({
        ram_budget_night_gb: 48,
        ram_budget_day_gb: 20,
        suspension_threshold_percent: 75,
        polling_interval_ms: 1000,
      }),
    llm_routing: z.record(z.string(), z.string()).default({}),
    llm_fallback: z.record(z.string(), z.string()).default({}),
    git: z
      .object({
        auto_merge: z.boolean().default(false),
      })
      .default({ auto_merge: false }),
    workflow: z
      .object({
        /**
         * @deprecated Since 2026-04-14 (EA11-S2). `useBMAD=false` selects the legacy
         * stub pipeline kept as a safety net. Scheduled for removal after EA10-S9
         * integration test proves the orchestrator in production. A runtime warning
         * is emitted at startup when `useBMAD=false`.
         */
        useBMAD: z
          .boolean()
          .default(true)
          .describe(
            'DEPRECATED (EA11-S2, 2026-04-14): false selects the legacy stub pipeline. Prefer true (default) and use the EA10 orchestrator when available.',
          ),
      })
      .default({ useBMAD: true }),
    blocage_rules: z.record(z.string(), z.string()).default({}),
    schedule: z
      .object({
        auto_start: z.array(z.string()).default([]),
      })
      .default({ auto_start: [] }),
    budget: z
      .object({
        sprint_max_tokens: z.number().int().positive(),
        alert_thresholds: z
          .array(z.number().min(0).max(100))
          .refine((arr) => arr.every((v, i) => i === 0 || v > (arr[i - 1] ?? -1)), {
            message: 'alert_thresholds must be sorted in ascending order with no duplicates',
          }),
        auto_pause: z.boolean(),
      })
      .default({
        sprint_max_tokens: 1_000_000,
        alert_thresholds: [50, 80, 95],
        auto_pause: true,
      }),
  })
  .refine(
    (data) => {
      const keys = Object.keys(data.llm_routing);
      if (keys.length > 0 && !data.llm_routing.default) {
        return false;
      }
      return true;
    },
    {
      message: 'llm_routing.default is required when llm_routing is configured',
      path: ['llm_routing', 'default'],
    },
  );
