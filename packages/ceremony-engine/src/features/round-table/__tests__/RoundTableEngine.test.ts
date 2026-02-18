import { describe, expect, it } from 'vitest';
import { RoundTableEngine } from '../application/RoundTableEngine.js';
import type { Contribution, RoundTableParticipant } from '../domain/RoundTableTypes.js';

function createParticipant(name: string, position: string): RoundTableParticipant {
  return {
    name,
    contribute: async () => position,
  };
}

describe('RoundTableEngine', () => {
  it('should reach consensus when participants agree', async () => {
    const engine = new RoundTableEngine(0.7);
    const participants = [
      createParticipant('dev', 'We should use TypeScript with strict mode enabled'),
      createParticipant('reviewer', 'TypeScript with strict mode is the right approach'),
      createParticipant('architect', 'Using TypeScript strict mode is recommended'),
    ];

    const result = await engine.run('language choice', participants);

    expect(result.consensus).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.contributions).toHaveLength(3);
  });

  it('should not reach consensus when participants disagree', async () => {
    const engine = new RoundTableEngine(0.7, 2);
    const participants = [
      createParticipant('dev', 'We must use Python for this project'),
      createParticipant('reviewer', 'Java is the best option here'),
      createParticipant('architect', 'Rust would be most performant'),
    ];

    const result = await engine.run('language choice', participants);

    expect(result.consensus).toBe(false);
    expect(result.rounds).toBe(2);
    // 2 rounds × 3 participants = 6 contributions
    expect(result.contributions).toHaveLength(6);
  });

  it('should produce a synthesis', async () => {
    const engine = new RoundTableEngine();
    const participants = [
      createParticipant('dev', 'Implement feature X'),
      createParticipant('reviewer', 'Implement feature X with tests'),
    ];

    const result = await engine.run('feature X', participants);

    expect(result.synthesis).toContain('dev:');
    expect(result.synthesis).toContain('reviewer:');
  });

  it('should pass previous contributions to participants', async () => {
    const engine = new RoundTableEngine(0.0, 1); // never consensus → 1 round
    let receivedContributions: Contribution[] = [];

    const participants: RoundTableParticipant[] = [
      createParticipant('first', 'position A'),
      {
        name: 'second',
        contribute: async (_topic, previous) => {
          receivedContributions = [...previous];
          return 'position B';
        },
      },
    ];

    await engine.run('test', participants);

    expect(receivedContributions).toHaveLength(1);
    expect(receivedContributions[0]?.agent).toBe('first');
  });

  it('should handle single participant', async () => {
    const engine = new RoundTableEngine();
    const participants = [createParticipant('solo', 'my position')];

    const result = await engine.run('topic', participants);

    expect(result.consensus).toBe(true);
    expect(result.contributions).toHaveLength(1);
  });
});
