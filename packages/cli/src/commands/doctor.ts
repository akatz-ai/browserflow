import { Command } from 'commander';

export function doctorCommand(): Command {
  const cmd = new Command('doctor');

  cmd
    .description('Check environment and dependencies')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (options) => {
      // TODO: Implementation in bf-2un
      console.log('bf doctor - Not yet implemented');
    });

  return cmd;
}
