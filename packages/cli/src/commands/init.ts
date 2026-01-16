import { Command } from 'commander';

export function initCommand(): Command {
  const cmd = new Command('init');

  cmd
    .description('Initialize BrowserFlow in the current project')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      // TODO: Implementation in bf-jlm
      console.log('bf init - Not yet implemented');
    });

  return cmd;
}
