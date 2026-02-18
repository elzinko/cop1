import { describe, expect, it } from 'vitest';
import { RoundTableEngine } from '../../round-table/application/RoundTableEngine.js';
import type { RoundTableParticipant } from '../../round-table/domain/RoundTableTypes.js';
import { GroomingCeremony } from '../application/GroomingCeremony.js';
import type { GroomingParticipantPort } from '../domain/GroomingTypes.js';

function makeParticipant(name: string, position: string): RoundTableParticipant {
  return {
    name,
    contribute: async () => position,
  };
}

function makePort(participants: RoundTableParticipant[]): GroomingParticipantPort {
  return { getParticipants: () => participants };
}

describe('GroomingCeremony', () => {
  it('should refine stories and return estimated points', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('PM', 'story looks good ready to go'),
      makeParticipant('Architect', 'story looks good ready to go'),
    ]);

    const ceremony = new GroomingCeremony(engine, port);
    const result = await ceremony.run({
      stories: [{ id: 'S1', title: 'Login', acceptanceCriteria: ['AC1', 'AC2', 'AC3'] }],
    });

    expect(result.refinedStories).toHaveLength(1);
    expect(result.refinedStories[0]?.id).toBe('S1');
    expect(result.refinedStories[0]?.estimatedPoints).toBe(6);
  });

  it('should mark story ready when AC >= 2 and consensus reached', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('PM', 'agree this story is well defined'),
      makeParticipant('Architect', 'agree this story is well defined'),
    ]);

    const ceremony = new GroomingCeremony(engine, port);
    const result = await ceremony.run({
      stories: [{ id: 'S1', title: 'Feature', acceptanceCriteria: ['AC1', 'AC2'] }],
    });

    expect(result.refinedStories[0]?.ready).toBe(true);
  });

  it('should mark story not ready without consensus', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('PM', 'this story needs more work completely different view'),
      makeParticipant('Architect', 'ready to implement no issues at all perfect'),
    ]);

    const ceremony = new GroomingCeremony(engine, port);
    const result = await ceremony.run({
      stories: [{ id: 'S1', title: 'Feature', acceptanceCriteria: ['AC1', 'AC2'] }],
    });

    expect(result.refinedStories[0]?.ready).toBe(false);
  });

  it('should handle empty story list', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([makeParticipant('PM', 'ok')]);

    const ceremony = new GroomingCeremony(engine, port);
    const result = await ceremony.run({ stories: [] });

    expect(result.refinedStories).toHaveLength(0);
  });
});
