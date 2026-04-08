import { OllamaManagementAdapter } from '@cop1/llm-intelligence';
import { BmadStatusReader, SprintSessionService } from '@cop1/sprint-core';

export async function sprintStatusCommand(): Promise<void> {
  const projectPath = process.cwd();
  const reader = new BmadStatusReader(projectPath);
  const sessionService = new SprintSessionService(projectPath);

  // Session info
  const session = sessionService.check();
  if (session) {
    console.log(`\nSprint session: ${session.status}`);
    console.log(`  Started:  ${session.startedAt}`);
    console.log(`  Deadline: ${session.deadline}`);
    console.log(`  Duration: ${session.durationMinutes}min`);
  } else {
    console.log('\nNo active sprint session.');
  }

  // Story statuses
  const statuses = reader.getAllStatuses();
  if (statuses.size === 0) {
    console.log('\nNo story statuses tracked yet.');
  } else {
    const byStatus: Record<string, string[]> = {};
    for (const [storyId, status] of statuses) {
      if (!byStatus[status]) {
        byStatus[status] = [];
      }
      byStatus[status]?.push(storyId);
    }

    console.log(`\nStories: ${statuses.size} total`);
    for (const [status, ids] of Object.entries(byStatus).sort()) {
      console.log(`  ${status}: ${ids.length}`);
    }
  }

  // Ollama models
  console.log('');
  try {
    const ollama = new OllamaManagementAdapter();
    const models = await ollama.listModels();
    if (models.length > 0) {
      console.log('Ollama Models:');
      for (const m of models) {
        const sizeGB = (m.size / 1e9).toFixed(1);
        console.log(`  ${m.name}  (${sizeGB} GB)`);
      }
    } else {
      console.log('Ollama: no models installed');
    }
  } catch {
    console.log('Ollama: unavailable');
  }
  console.log('');
}
