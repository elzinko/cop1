import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EventBus } from '@cop1/shared-kernel';
import { parse, stringify } from 'yaml';
import { type BlocageData, BlocageEvent, type BlocageTypeValue } from '../domain/Blocage.js';

const BLOCAGES_DIR = '.cop1/blocages';

export class BlockageService {
  private readonly blocagesDir: string;

  constructor(
    private readonly projectPath: string,
    private readonly eventBus: EventBus,
  ) {
    this.blocagesDir = join(projectPath, BLOCAGES_DIR);
  }

  declare(storyId: string, type: BlocageTypeValue, reason: string): BlocageData {
    if (!existsSync(this.blocagesDir)) {
      mkdirSync(this.blocagesDir, { recursive: true });
    }

    const id = `BLK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const blocage: BlocageData = {
      id,
      storyId,
      type,
      reason,
      declaredAt: new Date().toISOString(),
      status: 'open',
    };

    const filePath = join(this.blocagesDir, `${id}.yaml`);
    writeFileSync(filePath, stringify(blocage), 'utf-8');

    this.eventBus.emit(BlocageEvent.STORY_BLOCKED, { storyId, blocageId: id, type, reason });

    return blocage;
  }

  resolve(blocageId: string, response: string): BlocageData {
    const filePath = join(this.blocagesDir, `${blocageId}.yaml`);
    if (!existsSync(filePath)) {
      throw new Error(`Blocage not found: ${blocageId}`);
    }

    const blocage = parse(readFileSync(filePath, 'utf-8')) as BlocageData;
    blocage.status = 'resolved';
    blocage.resolvedAt = new Date().toISOString();
    blocage.response = response;

    writeFileSync(filePath, stringify(blocage), 'utf-8');

    this.eventBus.emit(BlocageEvent.STORY_UNBLOCKED, {
      storyId: blocage.storyId,
      blocageId,
      response,
    });

    return blocage;
  }

  getOpen(): BlocageData[] {
    return this.list().filter((b) => b.status === 'open');
  }

  list(): BlocageData[] {
    if (!existsSync(this.blocagesDir)) return [];

    return readdirSync(this.blocagesDir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => {
        const content = readFileSync(join(this.blocagesDir, f), 'utf-8');
        return parse(content) as BlocageData;
      });
  }
}
