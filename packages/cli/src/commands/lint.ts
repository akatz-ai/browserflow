import { Command } from 'commander';

export function lintCommand(): Command {
  const cmd = new Command('lint');

  cmd
    .description('Validate BrowserFlow spec files')
    .argument('[specs...]', 'Spec files or directories to lint')
    .option('--fix', 'Attempt to fix issues automatically')
    .action(async (specs, options) => {
      // TODO: Implementation in bf-eq4
      console.log('bf lint - Not yet implemented');
    });

  return cmd;
}
