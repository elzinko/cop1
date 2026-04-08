import { randomUUID } from 'node:crypto';
import type {
  BMADSessionContext,
  BMADSessionPort,
  SessionHandle,
  SessionTurnResult,
} from '../domain/ports/BMADSessionPort.js';

/**
 * In-memory implementation of BMADSessionPort for testing.
 * Accepts pre-configured turn sequences and returns them in order.
 */
export class InMemorySessionAdapter implements BMADSessionPort {
  private readonly scriptedTurns: SessionTurnResult[];
  private turnIndex = 0;

  constructor(scriptedTurns: SessionTurnResult[]) {
    this.scriptedTurns = scriptedTurns;
  }

  async startSession(_command: string, _context: BMADSessionContext): Promise<SessionHandle> {
    const sessionId = randomUUID();
    const firstTurn = this.nextTurn();
    return { sessionId, firstTurn };
  }

  async continueSession(_sessionId: string, _message: string): Promise<SessionTurnResult> {
    return this.nextTurn();
  }

  private nextTurn(): SessionTurnResult {
    const turn = this.scriptedTurns[this.turnIndex];
    if (!turn) {
      return {
        completed: true,
        output: 'No more scripted turns available',
        error: true,
        errorMessage: 'No more scripted turns available',
        durationMs: 0,
      };
    }
    this.turnIndex++;
    return turn;
  }
}
