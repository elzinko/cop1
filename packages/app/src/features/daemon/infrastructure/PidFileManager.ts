import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { COP1_DIR, PID_FILENAME } from '../domain/DaemonState.js';

export class PidFileManager {
  private readonly pidPath: string;

  constructor(projectPath: string) {
    this.pidPath = join(projectPath, COP1_DIR, PID_FILENAME);
  }

  write(pid: number): void {
    const dir = dirname(this.pidPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.pidPath, String(pid), 'utf-8');
  }

  read(): number | null {
    if (!existsSync(this.pidPath)) {
      return null;
    }
    const content = readFileSync(this.pidPath, 'utf-8').trim();
    const pid = Number.parseInt(content, 10);
    return Number.isNaN(pid) ? null : pid;
  }

  delete(): void {
    if (existsSync(this.pidPath)) {
      unlinkSync(this.pidPath);
    }
  }

  exists(): boolean {
    return existsSync(this.pidPath);
  }

  isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
