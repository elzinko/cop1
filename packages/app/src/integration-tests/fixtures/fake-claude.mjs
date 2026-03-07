#!/usr/bin/env node
/**
 * Fake Claude CLI stub for integration tests.
 * Reads args and returns structured JSON mimicking Claude CLI output.
 *
 * Supported flags (embedded in prompt content):
 *   --simulate-success         → exit 0 with success JSON (default)
 *   --simulate-timeout         → sleep forever, ignore SIGTERM
 *   --simulate-429             → exit 1 with "429" in stderr (transient)
 *   --simulate-crash           → exit 137 (SIGKILL-like crash)
 *   --simulate-review-failure  → exit 1 for /bmad-bmm-code-review only; succeed for others
 */

const args = process.argv.slice(2);

// Extract the prompt from -p flag
let prompt = '';
const pIndex = args.indexOf('-p');
if (pIndex !== -1 && pIndex + 1 < args.length) {
  prompt = args[pIndex + 1];
}

// Determine the BMAD command (first line of prompt)
const command = prompt.split('\n')[0]?.trim() ?? '';

function respond(json) {
  process.stdout.write(JSON.stringify(json));
  process.exit(0);
}

function respondError(message, code = 1) {
  process.stderr.write(message);
  process.exit(code);
}

function success() {
  respond({
    result: 'Implementation completed successfully. All acceptance criteria met.',
    type: 'result',
    usage: { input_tokens: 1000, output_tokens: 500 },
    is_error: false,
  });
}

// Check for simulation flags in prompt
if (prompt.includes('--simulate-timeout')) {
  // Sleep forever, ignore SIGTERM (test verifies timeout + SIGKILL handling)
  process.on('SIGTERM', () => {
    // Intentionally ignore SIGTERM to test SIGKILL escalation
  });
  setTimeout(() => {}, 600_000);
} else if (prompt.includes('--simulate-429')) {
  respondError('Error: 429 Too Many Requests - Rate limit exceeded', 1);
} else if (prompt.includes('--simulate-crash')) {
  process.exit(137);
} else if (prompt.includes('--simulate-review-failure')) {
  // Only fail for the review command; succeed for dev and qa
  if (command === '/bmad-bmm-code-review') {
    respondError('Review found critical issues that must be addressed before merging.', 1);
  } else {
    success();
  }
} else {
  // Default: simulate success (also for --simulate-success)
  success();
}
