/**
 * bf explore command - runs AI exploration for a spec
 * @see bf-x9t
 */

import { Command } from 'commander';

export function exploreCommand(): Command {
  const cmd = new Command('explore');

  cmd
    .description('Run AI exploration for a spec')
    .requiredOption('--spec <name>', 'Spec name to explore')
    .option('--url <url>', 'Base URL (overrides config)')
    .option('--headed', 'Run browser in headed mode')
    .option('--adapter <name>', 'AI adapter (default: claude)', 'claude')
    .action(async (options) => {
      // TODO: Implementation
      throw new Error('Not implemented yet');
    });

  return cmd;
}
