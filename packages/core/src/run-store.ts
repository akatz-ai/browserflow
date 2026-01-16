/**
 * Immutable run directory management
 *
 * Manages .browserflow/ directories for storing exploration runs,
 * screenshots, and generated artifacts.
 *
 * @see bf-92j for implementation task
 */

import { join } from 'path';

/**
 * Run directory structure:
 * .browserflow/
 *   runs/
 *     <exploration-id>/
 *       lockfile.json
 *       screenshots/
 *         step-0-before.png
 *         step-0-after.png
 *       review.json (optional)
 */

export interface RunDirectoryPaths {
  /** Root .browserflow directory */
  root: string;
  /** Runs directory */
  runsDir: string;
  /** This run's directory */
  runDir: string;
  /** Lockfile path */
  lockfile: string;
  /** Screenshots directory */
  screenshotsDir: string;
  /** Review file path */
  reviewFile: string;
}

/**
 * Gets paths for a run directory.
 *
 * @param projectRoot - Root of the project (where .browserflow lives)
 * @param explorationId - Unique exploration identifier
 * @returns Paths object
 */
export function getRunPaths(projectRoot: string, explorationId: string): RunDirectoryPaths {
  const root = join(projectRoot, '.browserflow');
  const runsDir = join(root, 'runs');
  const runDir = join(runsDir, explorationId);

  return {
    root,
    runsDir,
    runDir,
    lockfile: join(runDir, 'lockfile.json'),
    screenshotsDir: join(runDir, 'screenshots'),
    reviewFile: join(runDir, 'review.json'),
  };
}

/**
 * Generates a unique exploration ID.
 *
 * Format: <spec-slug>-<timestamp>-<random>
 * Example: login-flow-20240115-143022-abc123
 *
 * @param specName - Name of the spec
 * @returns Unique exploration ID
 */
export function generateExplorationId(specName: string): string {
  const slug = specName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);

  const random = Math.random().toString(36).slice(2, 8);

  return `${slug}-${timestamp}-${random}`;
}

/**
 * Gets the screenshot path for a step.
 *
 * @param screenshotsDir - Screenshots directory path
 * @param stepIndex - Step index (0-based)
 * @param type - "before" or "after"
 * @returns Screenshot file path
 */
export function getScreenshotPath(
  screenshotsDir: string,
  stepIndex: number,
  type: 'before' | 'after'
): string {
  return join(screenshotsDir, `step-${stepIndex}-${type}.png`);
}
