/**
 * bf codify command - generate Playwright tests from explorations
 * @see bf-0lr
 */

import { Command } from 'commander';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { generateTest } from '@browserflow-ai/generator';
import type { ExplorationLockfile, ReviewData, GeneratedTest, LegacySpecStep, ExplorationStep, StepExecution, LegacyLocatorObject } from '@browserflow-ai/core';
import { colors } from '../ui/colors.js';
import { loadExploration, listExplorations } from './review.js';

/**
 * Resolve an element ref to a locator object using snapshot refs data.
 * The exploration stores elementRef (e.g., "e17") and the actual locator data
 * is in snapshotBefore.refs or snapshotAfter.refs.
 */
function resolveElementRefToLocator(
  elementRef: string | undefined,
  snapshotBefore: Record<string, unknown> | undefined,
  snapshotAfter: Record<string, unknown> | undefined
): LegacyLocatorObject | undefined {
  if (!elementRef) return undefined;

  // Try to get refs from snapshot (prefer snapshotBefore as it's what was used for the action)
  const refs = (snapshotBefore?.refs ?? snapshotAfter?.refs) as Record<string, Record<string, unknown>> | undefined;
  if (!refs) return undefined;

  const refData = refs[elementRef];
  if (!refData) return undefined;

  // The refs contain a 'selector' field which is actually Playwright code like:
  // "getByRole('button', { name: \"ComfyGit\", exact: true })"
  // We need to parse this into a LocatorObject format
  const selectorStr = refData.selector as string | undefined;
  if (!selectorStr) return undefined;

  // Try to parse method-style selectors (getByRole, getByText, etc.)
  const methodMatch = selectorStr.match(/^(getBy\w+)\((.+)\)$/);
  if (methodMatch) {
    const method = methodMatch[1] as 'getByRole' | 'getByText' | 'getByLabel' | 'getByPlaceholder' | 'getByTestId' | 'getByAltText' | 'getByTitle';
    const argsStr = methodMatch[2];

    // For getByRole, parse: 'button', { name: "...", exact: true }
    // For getByText/etc, parse: '...', { exact: true }
    if (method === 'getByRole') {
      const roleMatch = argsStr.match(/^'(\w+)'(?:,\s*\{(.+)\})?$/);
      if (roleMatch) {
        const role = roleMatch[1];
        const args: Record<string, unknown> = { role };

        // Parse options if present
        if (roleMatch[2]) {
          const nameMatch = roleMatch[2].match(/name:\s*"([^"]+)"/);
          if (nameMatch) args.name = nameMatch[1];
          const exactMatch = roleMatch[2].match(/exact:\s*(true|false)/);
          if (exactMatch) args.exact = exactMatch[1] === 'true';
        }

        return { method, args };
      }
    } else if (method === 'getByTestId') {
      const testIdMatch = argsStr.match(/^'([^']+)'$/);
      if (testIdMatch) {
        return { method, args: { testId: testIdMatch[1] } };
      }
    } else {
      // getByText, getByLabel, etc.
      const textMatch = argsStr.match(/^'([^']+)'(?:,\s*\{(.+)\})?$/);
      if (textMatch) {
        const args: Record<string, unknown> = { text: textMatch[1] };
        if (textMatch[2]) {
          const exactMatch = textMatch[2].match(/exact:\s*(true|false)/);
          if (exactMatch) args.exact = exactMatch[1] === 'true';
        }
        return { method, args };
      }
    }
  }

  // Fallback: treat as CSS selector
  return { selector: selectorStr };
}

/**
 * Transform camelCase exploration output to snake_case lockfile format.
 * The exploration engine outputs camelCase, but the generator expects snake_case.
 */
function transformToLockfile(exploration: Record<string, unknown>): ExplorationLockfile {
  // Transform step execution, resolving element refs to locators
  const transformExecution = (
    exec: Record<string, unknown>,
    snapshotBefore: Record<string, unknown> | undefined,
    snapshotAfter: Record<string, unknown> | undefined
  ): StepExecution => {
    const elementRef = exec.elementRef as string | undefined;
    const resolvedLocator = resolveElementRefToLocator(elementRef, snapshotBefore, snapshotAfter);

    return {
      status: exec.status as 'completed' | 'failed' | 'skipped',
      method: exec.method as string | undefined,
      element_ref: elementRef,
      selector_used: exec.selectorUsed as string | undefined,
      locator: exec.locator as LegacyLocatorObject | undefined ?? resolvedLocator,
      duration_ms: exec.durationMs as number,
      error: exec.error as string | undefined,
      value_used: exec.valueUsed as string | undefined,
      url_used: exec.urlUsed as string | undefined,
    };
  };

  // Transform steps
  const transformStep = (step: Record<string, unknown>): ExplorationStep => {
    const snapshotBefore = step.snapshotBefore as Record<string, unknown> | undefined;
    const snapshotAfter = step.snapshotAfter as Record<string, unknown> | undefined;

    return {
      step_index: step.stepIndex as number,
      spec_action: step.specAction as LegacySpecStep,
      execution: transformExecution(step.execution as Record<string, unknown>, snapshotBefore, snapshotAfter),
      screenshots: step.screenshots as { before?: string; after?: string },
      snapshot_before: snapshotBefore,
      snapshot_after: snapshotAfter,
    };
  };

  // Transform outcome checks (already snake_case in the interface)
  const transformOutcomeCheck = (check: Record<string, unknown>) => ({
    check: check.check as string,
    expected: check.expected,
    actual: check.actual,
    passed: check.passed as boolean,
  });

  // Transform errors
  const transformErrors = (errors: unknown[]): Array<{ step_index?: number; message: string; stack?: string }> => {
    return errors.map((err) => {
      if (typeof err === 'string') {
        return { message: err };
      }
      const errObj = err as Record<string, unknown>;
      return {
        step_index: errObj.stepIndex as number | undefined,
        message: errObj.message as string,
        stack: errObj.stack as string | undefined,
      };
    });
  };

  return {
    spec: exploration.spec as string,
    spec_path: exploration.specPath as string,
    spec_description: exploration.specDescription as string | undefined,
    exploration_id: exploration.explorationId as string,
    timestamp: exploration.timestamp as string,
    duration_ms: exploration.durationMs as number,
    browser: exploration.browser as 'chromium' | 'firefox' | 'webkit',
    viewport: exploration.viewport as { width: number; height: number },
    base_url: exploration.baseUrl as string,
    steps: (exploration.steps as unknown[]).map((s) => transformStep(s as Record<string, unknown>)),
    outcome_checks: (exploration.outcomeChecks as unknown[]).map((c) => transformOutcomeCheck(c as Record<string, unknown>)),
    overall_status: exploration.overallStatus as 'completed' | 'failed' | 'timeout',
    errors: transformErrors(exploration.errors as unknown[]),
  };
}

/**
 * Load review data if it exists
 */
async function loadReview(explorationId: string, cwd: string = process.cwd()): Promise<ReviewData | undefined> {
  const reviewPath = join(cwd, '.browserflow', 'explorations', explorationId, 'review.json');

  try {
    const content = await readFile(reviewPath, 'utf-8');
    return JSON.parse(content) as ReviewData;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return undefined; // No review exists
    }
    throw error;
  }
}

/**
 * Find the most recent exploration for a spec name
 */
async function findExplorationForSpec(specName: string, cwd: string = process.cwd()): Promise<string | null> {
  const explorations = await listExplorations(cwd);

  // Sort by timestamp (newest first) - exp-{timestamp} format
  const sorted = explorations.sort().reverse();

  for (const id of sorted) {
    try {
      const exploration = await loadExploration(id, cwd) as Record<string, unknown>;
      if (exploration.spec === specName) {
        return id;
      }
    } catch {
      // Skip invalid explorations
    }
  }

  return null;
}

export function codifyCommand(): Command {
  return new Command('codify')
    .description('Generate Playwright test from an exploration')
    .option('--exploration <id>', 'Exploration ID to codify')
    .option('--spec <name>', 'Find latest exploration for this spec')
    .option('--output <path>', 'Output path for generated test')
    .option('--no-visual', 'Skip visual assertions')
    .option('--no-comments', 'Skip step comments')
    .option('--require-review', 'Only codify if exploration has been reviewed')
    .option('--dry-run', 'Print generated test without writing to disk')
    .action(async (options) => {
      const cwd = process.cwd();

      try {
        // 1. Determine exploration ID
        let explorationId: string;

        if (options.exploration) {
          explorationId = options.exploration;
        } else if (options.spec) {
          const found = await findExplorationForSpec(options.spec, cwd);
          if (!found) {
            throw new Error(`No exploration found for spec: ${options.spec}`);
          }
          explorationId = found;
          console.log(colors.dim(`Found exploration: ${explorationId}`));
        } else {
          // List available explorations
          const explorations = await listExplorations(cwd);
          if (explorations.length === 0) {
            throw new Error('No explorations found. Run `bf explore` first.');
          }

          // Use the most recent one
          explorationId = explorations.sort().reverse()[0];
          console.log(colors.dim(`Using most recent exploration: ${explorationId}`));
        }

        // 2. Load exploration data
        const rawExploration = await loadExploration(explorationId, cwd) as Record<string, unknown>;

        // 3. Check exploration status
        if (rawExploration.overallStatus !== 'completed') {
          console.warn(colors.warning(`Exploration status: ${rawExploration.overallStatus}`));
          const errors = rawExploration.errors as unknown[];
          if (errors?.length > 0) {
            console.warn(colors.warning(`Errors: ${errors.length}`));
          }
        }

        // 4. Load review if exists
        const review = await loadReview(explorationId, cwd);

        if (options.requireReview && !review) {
          throw new Error('Exploration has not been reviewed. Run `bf review` first or remove --require-review.');
        }

        if (options.requireReview && review?.verdict !== 'approved') {
          throw new Error(`Exploration not approved. Current verdict: ${review?.verdict}`);
        }

        // 5. Transform to lockfile format
        const lockfile = transformToLockfile(rawExploration);

        // 6. Generate test
        const generated: GeneratedTest = generateTest(
          lockfile,
          {
            includeVisualChecks: options.visual !== false,
            includeComments: options.comments !== false,
          },
          review
        );

        // 7. Determine output path
        const outputPath = options.output ?? generated.path;

        // 8. Handle output
        if (options.dryRun) {
          console.log(colors.info(`Would write to: ${outputPath}`));
          console.log('');
          console.log(generated.content);
        } else {
          // Ensure directory exists
          const outputDir = dirname(outputPath);
          await mkdir(outputDir, { recursive: true });

          // Write test file
          await writeFile(outputPath, generated.content, 'utf-8');
          console.log(colors.success(`Generated: ${outputPath}`));

          // Print summary
          console.log(colors.dim(`  Spec: ${generated.specName}`));
          console.log(colors.dim(`  Exploration: ${generated.explorationId}`));
          if (review) {
            console.log(colors.dim(`  Reviewed: ${review.verdict} by ${review.reviewer ?? 'unknown'}`));
          }
        }
      } catch (error) {
        const err = error as Error;
        console.error(colors.fail(err.message));
        process.exitCode = 1;
      }
    });
}
