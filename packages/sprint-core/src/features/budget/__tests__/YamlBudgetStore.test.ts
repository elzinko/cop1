import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BudgetData } from '../domain/ports/BudgetStorePort.js';
import { YamlBudgetStore } from '../infrastructure/YamlBudgetStore.js';

const TEST_DIR = join(import.meta.dirname, '__fixtures__', 'yaml-budget-store-test');
const COP1_DIR = join(TEST_DIR, '.cop1');

describe('YamlBudgetStore', () => {
  let store: YamlBudgetStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    store = new YamlBudgetStore(TEST_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('should return undefined when no budget file exists', () => {
    const result = store.load('2026-02-23');
    expect(result).toBeUndefined();
  });

  it('should save and reload budget data', () => {
    const data: BudgetData = {
      date: '2026-02-23',
      totalConsumed: 15000,
      breakdownByCommand: { 'claude-cli': 10000, ollama: 5000 },
      breakdownByAgent: { 'bmad-dev': 12000, 'bmad-reviewer': 3000 },
      events: [
        {
          commandType: 'claude-cli',
          agentType: 'bmad-dev',
          tokens: 10000,
          timestamp: '2026-02-23T10:00:00Z',
        },
        {
          commandType: 'ollama',
          agentType: 'bmad-dev',
          tokens: 2000,
          timestamp: '2026-02-23T11:00:00Z',
        },
        {
          commandType: 'ollama',
          agentType: 'bmad-reviewer',
          tokens: 3000,
          timestamp: '2026-02-23T12:00:00Z',
        },
      ],
    };

    store.save(data);

    const loaded = store.load('2026-02-23');
    expect(loaded).toBeDefined();
    expect(loaded!.date).toBe('2026-02-23');
    expect(loaded!.totalConsumed).toBe(15000);
    expect(loaded!.breakdownByCommand).toEqual({ 'claude-cli': 10000, ollama: 5000 });
    expect(loaded!.breakdownByAgent).toEqual({ 'bmad-dev': 12000, 'bmad-reviewer': 3000 });
    expect(loaded!.events).toHaveLength(3);
  });

  it('should create .cop1 directory if it does not exist', () => {
    expect(existsSync(COP1_DIR)).toBe(false);

    store.save({
      date: '2026-02-23',
      totalConsumed: 0,
      breakdownByCommand: {},
      breakdownByAgent: {},
      events: [],
    });

    expect(existsSync(COP1_DIR)).toBe(true);
  });

  it('should write to budget-{date}.yaml file', () => {
    store.save({
      date: '2026-02-23',
      totalConsumed: 1000,
      breakdownByCommand: {},
      breakdownByAgent: {},
      events: [],
    });

    const filePath = join(COP1_DIR, 'budget-2026-02-23.yaml');
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('total_consumed: 1000');
    expect(content).toContain('date: 2026-02-23');
  });

  it('should handle different dates independently', () => {
    store.save({
      date: '2026-02-23',
      totalConsumed: 5000,
      breakdownByCommand: {},
      breakdownByAgent: {},
      events: [],
    });
    store.save({
      date: '2026-02-24',
      totalConsumed: 8000,
      breakdownByCommand: {},
      breakdownByAgent: {},
      events: [],
    });

    const day1 = store.load('2026-02-23');
    const day2 = store.load('2026-02-24');
    expect(day1!.totalConsumed).toBe(5000);
    expect(day2!.totalConsumed).toBe(8000);
  });
});
