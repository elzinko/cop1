/**
 * Model tiering policy (clean-arch domain): maps a BMAD command to the Claude
 * model tier that should execute it. Heavy-reasoning commands (story creation,
 * code review) run on the strong tier; mechanical implementation (dev-story,
 * qa-automate) runs on the cheaper, faster tier.
 *
 * `model` is a Claude Agent SDK concept, so the *policy* lives in the domain
 * (pure, IO-free, BMAD-aware) while the *application* of it (setting
 * `options.model`) lives in `AgentSdkSessionAdapter`. The orchestrator stays
 * model-agnostic via `BMADSessionPort`. See ADR-015.
 */

/** Claude Agent SDK model aliases accepted by `options.model`. */
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

/** Resolves the model tier for a given BMAD command string. */
export interface ModelTierRouter {
  resolve(command: string): ModelTier;
}

/** One routing rule: if the command contains `match`, use `tier`. */
export interface ModelTierRule {
  readonly match: string;
  readonly tier: ModelTier;
}

/** Configuration for {@link DefaultModelTierRouter}. */
export interface ModelTierRouterConfig {
  /** Ordered rules; the first whose `match` is a substring of the command wins. */
  readonly rules: readonly ModelTierRule[];
  /** Tier used when no rule matches. */
  readonly fallback: ModelTier;
}

/**
 * Cost-aware default mapping for the BMAD orchestrator cycle:
 * - `create-story` (specification) → opus
 * - `code-review` (judgement)      → opus
 * - everything else incl. `dev-story`, `qa-automate` → sonnet (fallback)
 *
 * Unknown commands fall back to the cheaper tier deliberately, so an
 * unexpected command never silently spends on the most expensive model.
 */
export const DEFAULT_MODEL_TIER_CONFIG: ModelTierRouterConfig = {
  rules: [
    { match: 'create-story', tier: 'opus' },
    { match: 'code-review', tier: 'opus' },
  ],
  fallback: 'sonnet',
};

/** Data-driven {@link ModelTierRouter}: open for new rules without code change. */
export class DefaultModelTierRouter implements ModelTierRouter {
  private readonly rules: readonly ModelTierRule[];
  private readonly fallback: ModelTier;

  constructor(config: ModelTierRouterConfig = DEFAULT_MODEL_TIER_CONFIG) {
    this.rules = config.rules;
    this.fallback = config.fallback;
  }

  resolve(command: string): ModelTier {
    for (const rule of this.rules) {
      if (command.includes(rule.match)) {
        return rule.tier;
      }
    }
    return this.fallback;
  }
}
