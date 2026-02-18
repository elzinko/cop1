import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { type SprintSessionData, isExpired } from '../domain/SprintSession.js';

const SESSION_FILE = '.cop1/session.yaml';

export class SprintSessionService {
  private readonly filePath: string;

  constructor(projectPath: string) {
    this.filePath = join(projectPath, SESSION_FILE);
  }

  start(durationMinutes: number): SprintSessionData {
    const now = new Date();
    const deadline = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const session: SprintSessionData = {
      startedAt: now.toISOString(),
      durationMinutes,
      deadline: deadline.toISOString(),
      status: 'active',
    };

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, stringify(session), 'utf-8');

    return session;
  }

  check(): SprintSessionData | null {
    if (!existsSync(this.filePath)) {
      return null;
    }
    const content = readFileSync(this.filePath, 'utf-8');
    const session = parse(content) as SprintSessionData;

    if (session.status === 'active' && isExpired(session)) {
      session.status = 'expired';
      writeFileSync(this.filePath, stringify(session), 'utf-8');
    }

    return session;
  }

  stop(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    const content = readFileSync(this.filePath, 'utf-8');
    const session = parse(content) as SprintSessionData;
    session.status = 'completed';
    writeFileSync(this.filePath, stringify(session), 'utf-8');
  }

  isActive(): boolean {
    const session = this.check();
    return session?.status === 'active';
  }
}
