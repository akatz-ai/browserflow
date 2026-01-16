/**
 * bf repair command - fix broken tests using failure bundles
 * @see bf-mtk
 */

import { Command } from 'commander';
import { readFile, access, readdir } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { colors, symbols } from '../ui/colors.js';
import { logHeader, logNewline, logSuccess, logWarning, logError } from '../ui/prompts.js';

const BROWSERFLOW_DIR = '.browserflow';
const RUNS_DIR = 'runs';

export type ErrorType = 'locator_not_found' | 'timeout' | 'assertion_failed' | 'screenshot_diff' | 'unknown';

export interface FailureBundle {
  run_id: string;
  spec_name: string;
  failed_at: string;

  failure: {
    step_id: string;
    action: string;
    error_message: string;
    error_type: ErrorType;
  };

  context: {
    url: string;
    viewport: { width: number; height: number };
    browser: string;
  };

  artifacts: {
    trace?: string;
    video?: string;
    screenshot?: string;
    diff?: {
      baseline: string;
      actual: string;
      diff: string;
    };
    console_log?: string;
    network_log?: string;
  };

  suggestions?: RepairSuggestion[];
}

export interface RepairSuggestion {
  type: 'use_fallback' | 'increase_timeout' | 'update_baseline' | 'add_mask' | 'fix_assertion' | 'investigate';
  description: string;
  confidence: number;
  patch?: Record<string, unknown>;
}

export interface RepairPlan {
  suggestions: RepairSuggestion[];
  primarySuggestion: RepairSuggestion;
  autoApplicable: boolean;
  requiresConfirmation: boolean;
}

export interface RepairOptions {
  spec?: string;
  fromRun?: string;
  ai?: boolean;
  apply?: boolean;
  headed?: boolean;
  cwd?: string;
}

/**
 * Load failure bundle from a run directory or failure.json path
 */
export async function loadFailureBundle(pathOrRunDir: string): Promise<FailureBundle> {
  let failurePath: string;

  // Check if path is a failure.json file or a directory
  if (pathOrRunDir.endsWith('failure.json')) {
    failurePath = pathOrRunDir;
  } else {
    failurePath = join(pathOrRunDir, 'failure.json');
  }

  try {
    await access(failurePath);
    const content = await readFile(failurePath, 'utf-8');
    return JSON.parse(content) as FailureBundle;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`Failure bundle not found: ${failurePath}`);
    }
    throw e;
  }
}

/**
 * Find the latest failure for a spec
 */
async function findLatestFailure(specName: string, cwd: string = process.cwd()): Promise<string | null> {
  const runsDir = join(cwd, BROWSERFLOW_DIR, RUNS_DIR, '_execution');

  try {
    await access(runsDir);
    const entries = await readdir(runsDir);
    const runDirs = entries
      .filter((e) => e.startsWith('run-'))
      .sort()
      .reverse();

    // Check each run for a failure.json
    for (const runDir of runDirs) {
      const failurePath = join(runsDir, runDir, 'failure.json');
      try {
        await access(failurePath);
        const content = await readFile(failurePath, 'utf-8');
        const bundle = JSON.parse(content) as FailureBundle;
        if (!specName || bundle.spec_name === specName) {
          return join(runsDir, runDir);
        }
      } catch {
        // No failure.json in this run
        continue;
      }
    }
  } catch {
    // Runs directory doesn't exist
  }

  return null;
}

/**
 * Analyze a failure and generate deterministic repair suggestions
 */
export function analyzeFailure(bundle: FailureBundle): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];
  const { failure } = bundle;

  switch (failure.error_type) {
    case 'locator_not_found':
      suggestions.push({
        type: 'use_fallback',
        description: 'Try fallback locator strategy',
        confidence: 0.7,
        patch: { use_fallback: true },
      });
      suggestions.push({
        type: 'investigate',
        description: 'Check if page structure has changed',
        confidence: 0.5,
      });
      break;

    case 'timeout':
      suggestions.push({
        type: 'increase_timeout',
        description: 'Double the timeout duration',
        confidence: 0.8,
        patch: { timeout_multiplier: 2 },
      });
      suggestions.push({
        type: 'investigate',
        description: 'Check for slow network or page load issues',
        confidence: 0.4,
      });
      break;

    case 'assertion_failed':
      suggestions.push({
        type: 'fix_assertion',
        description: 'Review and update the expected value',
        confidence: 0.5,
      });
      suggestions.push({
        type: 'investigate',
        description: 'Verify the application behavior is correct',
        confidence: 0.6,
      });
      break;

    case 'screenshot_diff':
      suggestions.push({
        type: 'update_baseline',
        description: 'Accept the new screenshot as baseline',
        confidence: 0.6,
      });
      suggestions.push({
        type: 'add_mask',
        description: 'Add mask for dynamic content area',
        confidence: 0.7,
      });
      suggestions.push({
        type: 'investigate',
        description: 'Verify visual change is intentional',
        confidence: 0.5,
      });
      break;

    default:
      suggestions.push({
        type: 'investigate',
        description: 'Review error details and stack trace',
        confidence: 0.3,
      });
  }

  return suggestions;
}

/**
 * Generate a repair plan from suggestions
 */
export function generateRepairPlan(suggestions: RepairSuggestion[]): RepairPlan {
  // Sort by confidence descending
  const sorted = [...suggestions].sort((a, b) => b.confidence - a.confidence);

  const primarySuggestion = sorted[0];
  const autoApplicable = primarySuggestion.confidence >= 0.9;
  const requiresConfirmation = !autoApplicable;

  return {
    suggestions: sorted,
    primarySuggestion,
    autoApplicable,
    requiresConfirmation,
  };
}

/**
 * Print failure information
 */
function printFailureInfo(bundle: FailureBundle): void {
  console.log(`${colors.bold('Spec:')} ${bundle.spec_name}`);
  console.log(`${colors.bold('Failed step:')} ${bundle.failure.step_id} (${bundle.failure.action})`);
  console.log(`${colors.bold('Error type:')} ${bundle.failure.error_type}`);
  console.log(`${colors.bold('Message:')} ${bundle.failure.error_message}`);
  logNewline();
  console.log(`${colors.bold('Context:')}`);
  console.log(`  URL: ${bundle.context.url}`);
  console.log(`  Viewport: ${bundle.context.viewport.width}x${bundle.context.viewport.height}`);
  console.log(`  Browser: ${bundle.context.browser}`);
}

/**
 * Print repair suggestions
 */
function printSuggestions(plan: RepairPlan): void {
  console.log(colors.bold('Repair suggestions:'));
  logNewline();

  for (let i = 0; i < plan.suggestions.length; i++) {
    const suggestion = plan.suggestions[i];
    const confidencePercent = Math.round(suggestion.confidence * 100);
    const confidenceColor =
      suggestion.confidence >= 0.7 ? colors.pass : suggestion.confidence >= 0.5 ? colors.warning : colors.dim;

    const isPrimary = i === 0;
    const prefix = isPrimary ? symbols.arrow : symbols.bullet;

    console.log(
      `${prefix} ${suggestion.description} ${confidenceColor(`(${confidencePercent}% confidence)`)}`
    );
    console.log(`  ${colors.dim(`Type: ${suggestion.type}`)}`);
  }

  if (plan.autoApplicable) {
    logNewline();
    console.log(colors.pass('Primary suggestion can be auto-applied with --apply flag.'));
  }
}

export function repairCommand(): Command {
  const cmd = new Command('repair');

  cmd
    .description('Fix broken tests using failure bundles')
    .option('-s, --spec <name>', 'Repair specific spec')
    .option('--from-run <path>', 'Path to failure.json or run directory')
    .option('--ai', 'Enable AI-assisted repair suggestions')
    .option('--apply', 'Auto-apply the highest confidence suggestion')
    .option('--headed', 'Show browser during repair verification')
    .action(async (options: RepairOptions) => {
      logHeader('Repair Test');
      logNewline();

      const cwd = options.cwd || process.cwd();

      // 1. Find or load failure bundle
      let failurePath: string | null = null;

      if (options.fromRun) {
        failurePath = options.fromRun;
      } else {
        failurePath = await findLatestFailure(options.spec || '', cwd);
      }

      if (!failurePath) {
        logError('No failure bundle found.');
        console.log(colors.dim('Run "bf run" first to generate test results.'));
        process.exitCode = 1;
        return;
      }

      // 2. Load failure bundle
      let bundle: FailureBundle;
      try {
        bundle = await loadFailureBundle(failurePath);
      } catch (e) {
        logError((e as Error).message);
        process.exitCode = 1;
        return;
      }

      // 3. Display failure info
      printFailureInfo(bundle);
      logNewline();

      // 4. Analyze and generate suggestions
      const suggestions = analyzeFailure(bundle);

      // 5. (Optional) AI suggestions
      if (options.ai) {
        logWarning('AI-assisted repair not yet implemented. Using deterministic suggestions only.');
        // In a real implementation, we would call an AI service here
      }

      // 6. Generate repair plan
      if (suggestions.length === 0) {
        console.log(colors.dim('No automatic repair suggestions available.'));
        console.log('Manual intervention may be required.');
        return;
      }

      const plan = generateRepairPlan(suggestions);

      // 7. Print suggestions
      printSuggestions(plan);

      // 8. Apply if requested
      if (options.apply) {
        logNewline();
        if (plan.autoApplicable) {
          logSuccess(`Applying: ${plan.primarySuggestion.description}`);
          console.log(colors.dim('(Repair application not yet implemented)'));
          // In a real implementation:
          // - Apply the patch to the lockfile/spec
          // - Regenerate the test
          // - Run verification
        } else {
          logWarning('Primary suggestion has low confidence. Please review and apply manually.');
          console.log(
            colors.dim(
              `Confidence: ${Math.round(plan.primarySuggestion.confidence * 100)}% (requires 90%+ for auto-apply)`
            )
          );
        }
      } else {
        logNewline();
        console.log(colors.dim('Run with --apply to auto-apply the primary suggestion.'));
      }
    });

  return cmd;
}
