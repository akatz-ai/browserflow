import { Command } from 'commander';
import { createRequire } from 'node:module';
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { lintCommand } from './commands/lint.js';
import { runCommand } from './commands/run.js';
import { baselineCommand } from './commands/baseline.js';
import { repairCommand } from './commands/repair.js';
import { exploreCommand } from './commands/explore.js';
import { reviewCommand } from './commands/review.js';
import { codifyCommand } from './commands/codify.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

export function createProgram(): Command {
  const program = new Command();

  program
    .name('bf')
    .description('BrowserFlow - Human-in-the-Loop E2E Test Generation')
    .version(VERSION);

  program.addCommand(initCommand());
  program.addCommand(doctorCommand());
  program.addCommand(lintCommand());
  program.addCommand(runCommand());
  program.addCommand(baselineCommand());
  program.addCommand(repairCommand());
  program.addCommand(exploreCommand());
  program.addCommand(reviewCommand());
  program.addCommand(codifyCommand());

  return program;
}

export function run(argv?: string[]): void {
  const program = createProgram();
  program.parse(argv);
}

// Run if this is the entry point
if (import.meta.main) {
  run();
}
