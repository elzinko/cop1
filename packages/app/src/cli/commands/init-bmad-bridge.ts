import { BmadBridgeService } from '../../features/bmad-bridge/application/BmadBridgeService.js';

export function initBmadBridgeCommand(): void {
  const projectPath = process.cwd();
  const service = new BmadBridgeService(projectPath);
  const result = service.initBridge();

  if (result.created.length > 0) {
    console.log(`Created: ${result.created.join(', ')}`);
  }
  if (result.modified.length > 0) {
    console.log(`Updated: ${result.modified.join(', ')}`);
  }
  if (result.skipped.length > 0) {
    console.log(`Already configured: ${result.skipped.join(', ')}`);
  }

  const total = result.created.length + result.modified.length;
  if (total > 0) {
    console.log(`\nBMAD bridge configured for ${total} agent(s).`);
  } else {
    console.log('\nAll agents already configured. Nothing to do.');
  }
}
