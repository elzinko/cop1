import { createInterface } from 'node:readline';
import { InitService } from '../../features/init/application/InitService.js';

async function confirmOverwrite(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('.cop1/ already exists. Overwrite? (y/N) ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

export async function initCommand(
  projectPath: string,
  options: { projectKey?: string; projectName?: string },
): Promise<void> {
  const service = new InitService();

  if (service.checkExists(projectPath)) {
    console.warn('Warning: .cop1/ directory already exists in this project.');
    const confirmed = await confirmOverwrite();
    if (!confirmed) {
      console.log('Aborted.');
      return;
    }
  }

  const detectedVars = service.detectVars(projectPath);
  const vars = {
    projectKey: options.projectKey ?? detectedVars.projectKey,
    projectName: options.projectName ?? detectedVars.projectName,
    projectVersion: detectedVars.projectVersion,
  };

  service.createStructure(projectPath);
  const created = service.copyTemplates(projectPath, vars);

  console.log(`Initialized cop1 for "${vars.projectName}" (key: ${vars.projectKey})`);
  console.log('Created files:');
  for (const file of created) {
    console.log(`  ${file}`);
  }
}
