import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StructuredLogger } from '../application/StructuredLogger.js';

describe('StructuredLogger', () => {
  let testDir: string;
  let logger: StructuredLogger;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    logger = new StructuredLogger(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create a JSONL file with a valid log entry', () => {
    logger.event('story.workflow.started', { storyId: 'TEST-001' });

    const cop1Dir = join(testDir, '.cop1');
    expect(existsSync(cop1Dir)).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    const logFile = join(cop1Dir, `sprint-log-${today}.jsonl`);
    expect(existsSync(logFile)).toBe(true);

    const content = readFileSync(logFile, 'utf-8').trim();
    const entry = JSON.parse(content) as { eventType: string; storyId: string; timestamp: string };
    expect(entry.eventType).toBe('story.workflow.started');
    expect(entry.storyId).toBe('TEST-001');
    expect(entry.timestamp).toBeDefined();
  });

  it('should append multiple events as separate lines', () => {
    logger.event('story.step.started', { step: 'dev' });
    logger.event('story.step.completed', { step: 'dev' });
    logger.event('story.step.started', { step: 'reviewer' });

    const today = new Date().toISOString().slice(0, 10);
    const logFile = join(testDir, '.cop1', `sprint-log-${today}.jsonl`);
    const lines = readFileSync(logFile, 'utf-8').trim().split('\n');

    expect(lines.length).toBe(3);
  });

  it('should never throw on write errors', () => {
    // Use a path that will fail (read-only or invalid)
    const badLogger = new StructuredLogger('/nonexistent/path/that/does/not/exist');

    expect(() => {
      badLogger.event('test.event', { data: 'test' });
    }).not.toThrow();
  });
});
