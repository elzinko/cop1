import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BMADReader } from '../application/BMADReader.js';
import { IntegrityError } from '../domain/errors/IntegrityError.js';

describe('BMADReader', () => {
  let testDir: string;
  let reader: BMADReader;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-bmad-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const storiesDir = join(testDir, '_bmad-output/implementation-artifacts');
    mkdirSync(storiesDir, { recursive: true });

    writeFileSync(
      join(storiesDir, 'E1-S1-setup.md'),
      '# Story E1.S1: Setup\n\nStatus: ready-for-dev\n\n## Story\nSetup story.\n',
    );
    writeFileSync(
      join(storiesDir, 'E1-S2-daemon.md'),
      '# Story E1.S2: Daemon\n\nStatus: in-progress\n\n## Story\nDaemon story.\n',
    );
    writeFileSync(
      join(storiesDir, 'E1-S3-config.md'),
      '# Story E1.S3: Config\n\nStatus: done\n\n## Story\nConfig story.\n',
    );
    // Phase A story IDs (EA-prefix) must be parsed correctly. Regression
    // guard for the bug where the regex /^E\d+-S\d+/ matched 'EA9-S6' as
    // 'E9-S6' (or not at all) and silently dropped Phase A stories.
    writeFileSync(
      join(storiesDir, 'EA9-S6.md'),
      '# Story EA9-S6: Resume Adapter\n\nStatus: ready-for-dev\n\n## Story\nFallback adapter.\n',
    );
    // Non-story markdown at the same level must be ignored (project-context,
    // SCPs, retros, etc.).
    writeFileSync(
      join(storiesDir, 'project-context.md'),
      '# Project Context\n\nNot a story.\n',
    );

    reader = new BMADReader();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should list all stories with metadata', () => {
    const stories = reader.listStories(testDir);

    expect(stories.length).toBe(4);
    expect(stories.map((s) => s.id).sort()).toEqual(['E1-S1', 'E1-S2', 'E1-S3', 'EA9-S6']);
  });

  it('should parse Phase A story IDs (EA-prefix) without truncation', () => {
    const stories = reader.listStories(testDir);
    const ea9 = stories.find((s) => s.id === 'EA9-S6');
    expect(ea9).toBeDefined();
    expect(ea9?.status).toBe('ready-for-dev');
  });

  it('should ignore non-story markdown files at the same level', () => {
    const stories = reader.listStories(testDir);
    expect(stories.find((s) => s.id.includes('project-context'))).toBeUndefined();
  });

  it('should parse status from story files', () => {
    const stories = reader.listStories(testDir);
    const s1 = stories.find((s) => s.id === 'E1-S1');
    const s2 = stories.find((s) => s.id === 'E1-S2');

    expect(s1?.status).toBe('ready-for-dev');
    expect(s2?.status).toBe('in-progress');
  });

  it('should compute checksums for integrity verification', () => {
    const stories = reader.listStories(testDir);

    for (const story of stories) {
      expect(story.checksum).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('should pass integrity check when files unchanged', () => {
    reader.listStories(testDir);
    expect(() => reader.verifyIntegrity()).not.toThrow();
  });

  it('should throw IntegrityError when a file is modified', () => {
    reader.listStories(testDir);

    // Modify a story file
    const storiesDir = join(testDir, '_bmad-output/implementation-artifacts');
    writeFileSync(join(storiesDir, 'E1-S1-setup.md'), '# Modified content\n\nStatus: done\n');

    expect(() => reader.verifyIntegrity()).toThrow(IntegrityError);
  });

  it('should not modify source files after reading', () => {
    const storiesDir = join(testDir, '_bmad-output/implementation-artifacts');
    const originalContent = readFileSync(join(storiesDir, 'E1-S1-setup.md'), 'utf-8');

    reader.listStories(testDir);

    const afterContent = readFileSync(join(storiesDir, 'E1-S1-setup.md'), 'utf-8');
    expect(afterContent).toBe(originalContent);
  });

  it('should return empty array when stories directory does not exist', () => {
    const emptyDir = join(tmpdir(), `cop1-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    const stories = reader.listStories(emptyDir);
    expect(stories).toEqual([]);

    rmSync(emptyDir, { recursive: true, force: true });
  });
});
