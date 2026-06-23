/**
 * Classifies the free-text output of a `/bmad-bmm-code-review` session into a
 * verdict the orchestrator can act on.
 *
 * Why conservative: the review output is LLM prose, so heuristics risk both
 * false blocks (stalling a good story) and false passes. The evidence gate
 * (real source changed) and the verification gate (tests/lint/build) already
 * catch non-implementation, so this classifier only needs to honor an
 * **explicit** rejection. Therefore:
 *   - an explicit blocking marker  → `changes-requested` (runner blocks)
 *   - else an explicit approval    → `approved`
 *   - otherwise                    → `unknown` (runner advances)
 *
 * `unknown` deliberately advances — blocking on ambiguity would stall almost
 * every run, since most reviews lack a machine-precise verdict line.
 */
export type ReviewVerdict = 'approved' | 'changes-requested' | 'unknown';

/** Explicit "the review rejects this / requests changes" markers (EN + FR). */
const BLOCKING_PATTERNS: readonly RegExp[] = [
  /verdict\s*[:=-]?\s*(?:fail(?:ed)?|block(?:ing|ed)?|rejected?|changes[\s-]?requested|no-?go)/i,
  /\bchanges[\s-]?requested\b/i,
  /\brequest(?:ing|ed)?\s+changes\b/i,
  /\bnot\s+implemented\b/i,
  /verdict\s*[:=-]?\s*(?:échec|bloquant|rejet(?:é|ée)?)/i,
  /modifications?\s+demand[ée]/i,
  /\bnon\s+impl[ée]ment/i,
  /❌/,
];

/** Explicit approval markers (EN + FR). */
const APPROVAL_PATTERNS: readonly RegExp[] = [
  /verdict\s*[:=-]?\s*(?:pass(?:ed)?|approved?|go|lgtm|ok)\b/i,
  /\bapproved\b/i,
  /\bLGTM\b/,
  /\bapprouv(?:é|ée|er)?\b/i,
  /verdict\s*[:=-]?\s*(?:validé|conforme)/i,
  /✅/,
];

/**
 * Negated blocking phrases (EN + FR) — an approving review often says "no
 * changes requested" / "aucune modification demandée". These are stripped
 * before blocking detection so a negation is never read as a rejection.
 */
const NEGATED_BLOCKING_PATTERNS: readonly RegExp[] = [
  /\bno\s+(?:further\s+)?changes?\s+(?:requested|required|needed)\b/gi,
  /\bno\s+requested\s+changes\b/gi,
  /\baucune\s+modification\s+(?:demand[ée]e?|requise)\b/gi,
];

export function classifyReviewVerdict(output: string): ReviewVerdict {
  if (!output) return 'unknown';
  const withoutNegations = NEGATED_BLOCKING_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, ' '),
    output,
  );
  if (BLOCKING_PATTERNS.some((p) => p.test(withoutNegations))) return 'changes-requested';
  if (APPROVAL_PATTERNS.some((p) => p.test(output))) return 'approved';
  return 'unknown';
}

/** True for the command whose verdict gates whether a story may advance to done. */
export function isReviewCommand(command: string): boolean {
  return command.includes('code-review');
}
