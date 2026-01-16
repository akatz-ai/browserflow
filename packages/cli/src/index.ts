import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { lintCommand } from './commands/lint.js';
import { runCommand } from './commands/run.js';

const VERSION = '0.0.1';

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
