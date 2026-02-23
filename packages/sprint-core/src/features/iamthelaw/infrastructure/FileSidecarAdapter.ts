import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SidecarSyncPort } from '../domain/ports/SidecarSyncPort.js';

/** Filesystem adapter that writes sidecar content to `_bmad/_memory/iamthelaw-sidecar/rules.md`. */
export class FileSidecarAdapter implements SidecarSyncPort {
  private readonly filePath: string;

  constructor(projectPath: string) {
    this.filePath = join(projectPath, '_bmad', '_memory', 'iamthelaw-sidecar', 'rules.md');
  }

  /** Write content atomically (write .tmp then rename), creating directory if needed. */
  write(content: string): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, this.filePath);
  }
}
