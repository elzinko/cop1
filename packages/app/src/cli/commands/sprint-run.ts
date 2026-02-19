import { BMADReader, StoryStatusTracker, YamlStatusStore } from '@cop1/sprint-core';
import { SprintRunner } from '../../composition/SprintRunner.js';
import { SprintFormatter } from '../formatters/SprintFormatter.js';

export async function sprintRunCommand(options: {
  dryRun?: boolean;
  filter?: string;
  simulate?: boolean;
}): Promise<void> {
  if (options.dryRun && options.simulate) {
    console.error('Error: --dry-run and --simulate are mutually exclusive');
    process.exitCode = 1;
    return;
  }

  const projectPath = process.cwd();
  const runner = new SprintRunner(projectPath);
  const formatter = new SprintFormatter();
  formatter.attach(runner.eventBus);

  if (options.dryRun) {
    // Show what would be processed
    const bmadReader = new BMADReader();
    const stories = bmadReader.listStories(projectPath);
    const statusStore = new YamlStatusStore(projectPath);
    const tracker = new StoryStatusTracker(statusStore);

    const eligible = stories.filter((s) => {
      const entry = tracker.getStatus(s.id);
      if (!entry) return true;
      return entry.status === 'backlog' || entry.status === 'ready';
    });

    const filtered = options.filter
      ? eligible.filter((s) => {
          const pattern = options.filter?.replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`, 'i').test(s.id);
        })
      : eligible;

    console.log(`\nDry run: ${filtered.length} stories would be processed:\n`);
    for (const s of filtered) {
      const entry = tracker.getStatus(s.id);
      console.log(`  ${s.id} [${entry?.status ?? 'new'}] ${s.title}`);
    }
    console.log('');
    return;
  }

  if (options.simulate) {
    console.log('\nWorktree execution mode — running in isolated worktree\n');
  }

  const result = await runner.run({
    filter: options.filter,
    dryRun: false,
    simulate: options.simulate,
  });

  if (result.simulate && result.worktreePath) {
    console.log('\nWorktree preserved for inspection:');
    console.log(`  ${result.worktreePath}`);
    console.log(`\nTo inspect:  cd ${result.worktreePath}`);
    console.log('To merge:    git merge <branch>  (from main)');
    console.log(`To discard:  git worktree remove ${result.worktreePath}`);
  }

  if (result.storiesFailed > 0) {
    process.exitCode = 1;
  }
}
