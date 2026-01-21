import { Command } from 'commander';
import { basename } from 'node:path';
import { createRunStore } from '@browserflow-ai/core';
import { resolveSpecs, executePlaywright } from '../run/executor.js';
import { collectResults, generateFailureBundles } from '../run/results.js';
import { printRunHeader, printRunSummary, printError } from '../run/output.js';
import type { RunOptions } from '../run/types.js';

export function runCommand(): Command {
  const cmd = new Command('run');

  cmd
    .description('Run BrowserFlow tests via Playwright')
    .argument('[specs...]', 'Spec files to run')
    .option('-s, --spec <name>', 'Run specific spec by name')
    .option('-t, --tag <tag>', 'Filter tests by tag')
    .option('-p, --parallel <workers>', 'Number of parallel workers', parseInt)
    .option('--headed', 'Run tests in headed browser mode')
    .option('--trace <mode>', 'Trace mode: on, off, on-first-retry', 'off')
    .action(async (specs: string[], cmdOptions) => {
      const options: RunOptions = {
        spec: cmdOptions.spec ?? specs[0],
        tag: cmdOptions.tag,
        parallel: cmdOptions.parallel,
        headed: cmdOptions.headed,
        trace: cmdOptions.trace as RunOptions['trace'],
      };

      try {
        await run(options);
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cmd;
}

export async function run(options: RunOptions): Promise<void> {
  const runStore = createRunStore(process.cwd());

  // 1. Determine which specs to run
  const specs = await resolveSpecs(options);

  // 2. Print header
  printRunHeader(specs);

  // 3. Create run directory for this execution
  // Extract spec name from first spec file path
  // e.g., 'specs/login.spec.yaml' -> 'login.spec' or 'login'
  let specName = '_execution'; // fallback
  if (specs.length > 0) {
    const specFile = basename(specs[0]);
    // Remove .yaml/.yml extension if present
    specName = specFile.replace(/\.(yaml|yml)$/, '');
  }
  const runDir = await runStore.createRun(specName);

  // 4. Execute Playwright tests
  const executorResult = await executePlaywright(specs, options, runDir);

  // 5. Collect results and generate summary
  const summary = await collectResults(runDir, executorResult);

  // 6. Print human-friendly output
  printRunSummary(summary);

  // 7. If failures, generate failure bundles
  if (summary.failed > 0) {
    await generateFailureBundles(runDir, summary.failures);
  }

  // 8. Exit with appropriate code
  if (summary.failed > 0) {
    process.exit(5); // Exit code 5 for test failures as per spec
  }
}
