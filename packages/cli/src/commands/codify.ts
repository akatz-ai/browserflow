/**
 * bf codify command - Generate Playwright test from approved exploration
 * @see bf-ari
 */

import { Command } from 'commander';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { generateTest } from '@browserflow/generator';
import type { ExplorationLockfile, ReviewData } from '@browserflow/core';
import type { ExplorationOutput } from '@browserflow/exploration';
import { colors } from '../ui/colors.js';

/**
 * Create the codify command
 */
export function codifyCommand(): Command {
  return new Command('codify')
    .description('Generate Playwright test from approved exploration')
    .requiredOption('--spec <name>', 'Spec name to codify')
    .option('--exploration <id>', 'Specific exploration ID (default: latest for spec)')
    .option('--output <dir>', 'Output directory', 'e2e/tests')
    .option('--dry-run', 'Print generated test without writing')
    .action(async (options) => {
      try {
        // 1. Find exploration directory
        const explorationId = options.exploration || await findLatestExploration(options.spec);
        if (!explorationId) {
          console.error(colors.error(`No exploration found for spec: ${options.spec}`));
          process.exit(1);
        }

        const explorationDir = `.browserflow/explorations/${explorationId}`;

        // 2. Load exploration data (convert to lockfile format)
        const explorationPath = join(explorationDir, 'exploration.json');
        const explorationData = JSON.parse(await readFile(explorationPath, 'utf-8')) as ExplorationOutput;
        const lockfile = convertToLockfile(explorationData);

        // 3. Load review data (optional - may not be approved yet)
        let review: ReviewData | undefined;
        try {
          const reviewPath = join(explorationDir, 'review.json');
          review = JSON.parse(await readFile(reviewPath, 'utf-8')) as ReviewData;
          console.log(colors.info(`Using review from ${review.updated_at}`));
        } catch {
          console.log(colors.warning('No review found - generating without approval metadata'));
        }

        // 4. Generate test
        const result = generateTest(lockfile, { includeVisualChecks: true }, review);

        // 5. Write or print
        if (options.dryRun) {
          console.log(result.content);
        } else {
          const outputPath = join(options.output, `${options.spec}.spec.ts`);
          await mkdir(dirname(outputPath), { recursive: true });
          await writeFile(outputPath, result.content);
          console.log(colors.success(`Generated: ${outputPath}`));
          console.log(`Run \`bf run --spec ${options.spec}\` to execute`);
        }
      } catch (error) {
        const err = error as Error;
        console.error(colors.error(`Failed to generate test: ${err.message}`));
        process.exit(1);
      }
    });
}

/**
 * Find the latest exploration for a given spec name
 */
export async function findLatestExploration(
  specName: string,
  baseDir: string = process.cwd()
): Promise<string | null> {
  const explorationsDir = join(baseDir, '.browserflow', 'explorations');

  try {
    const entries = await readdir(explorationsDir);

    // Find explorations for this spec, sorted by timestamp (newest first)
    const matching = entries
      .filter(e => e.startsWith('exp-'))
      .sort()
      .reverse();

    for (const id of matching) {
      const explorationPath = join(explorationsDir, id, 'exploration.json');
      try {
        const data = JSON.parse(await readFile(explorationPath, 'utf-8')) as ExplorationOutput;
        if (data.spec === specName) {
          return id;
        }
      } catch {
        // Skip invalid exploration files
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert ExplorationOutput to ExplorationLockfile format
 */
export function convertToLockfile(exploration: ExplorationOutput): ExplorationLockfile {
  return {
    spec: exploration.spec,
    spec_path: exploration.specPath,
    exploration_id: exploration.explorationId,
    timestamp: exploration.timestamp,
    duration_ms: exploration.durationMs,
    browser: exploration.browser as 'chromium' | 'firefox' | 'webkit',
    viewport: exploration.viewport,
    base_url: exploration.baseUrl,
    steps: exploration.steps.map(step => ({
      step_index: step.stepIndex,
      spec_action: step.specAction as any, // LegacySpecStep format
      execution: {
        status: step.execution.status,
        method: step.execution.method,
        element_ref: step.execution.elementRef,
        selector_used: step.execution.selectorUsed,
        duration_ms: step.execution.durationMs,
      },
      screenshots: {
        before: step.screenshots.before,
        after: step.screenshots.after,
      },
      snapshot_before: step.snapshotBefore,
      snapshot_after: step.snapshotAfter,
    })),
    outcome_checks: exploration.outcomeChecks.map(check => ({
      check: check.check,
      expected: check.expected,
      actual: check.actual,
      passed: check.passed,
    })),
    overall_status: exploration.overallStatus,
    errors: exploration.errors.map(err => ({
      message: err,
    })),
  };
}
