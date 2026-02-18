#!/usr/bin/env node
import { Command } from 'commander';
import { COP1_VERSION } from '../features/daemon/domain/DaemonState.js';
import { healthCommand } from './commands/health.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { stopCommand } from './commands/stop.js';

const program = new Command();

program.name('cop1').description('Autonomous AI agents team').version(COP1_VERSION);

program
  .command('start')
  .description('Start the cop1 daemon')
  .option('-p, --port <port>', 'Daemon port')
  .action(startCommand);

program.command('stop').description('Stop the cop1 daemon').action(stopCommand);

program.command('status').description('Check if the daemon is running').action(statusCommand);

program
  .command('health')
  .description('Get daemon health info (JSON)')
  .option('-p, --port <port>', 'Daemon port')
  .action(healthCommand);

program.parse();
