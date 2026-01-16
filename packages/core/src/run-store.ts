/**
 * Immutable run directory management
 *
 * Manages .browserflow/ directories for storing exploration runs,
 * screenshots, and generated artifacts.
 *
 * @see bf-92j for implementation task
 */

import { join, basename } from 'path';
import { randomBytes } from 'crypto';
import { mkdir, symlink, unlink, readlink, readdir, stat } from 'fs/promises';
import { existsSync, statSync, readdirSync, lstatSync } from 'fs';

/**
 * Run directory structure:
 * .browserflow/
 *   runs/
 *     <spec-name>/
 *       run-20260115-031000-abc123/
 *         exploration.json
 *         review.json
 *         lockfile.json
 *         artifacts/
 *           screenshots/
 *           trace.zip
 *           logs/
 *       run-20260115-041500-def456/
 *         ...
 *       latest -> run-20260115-041500-def456
 *   cache/
 *   tmp/
 */

export interface RunDirectoryPaths {
  root: string;
  runsDir: string;
  runDir: string;
  lockfile: string;
  screenshotsDir: string;
  reviewFile: string;
}

export interface RunStore {
  createRun(specName: string): Promise<string>;
  getLatestRun(specName: string): string | null;
  listRuns(specName: string): string[];
  getRunDir(specName: string, runId: string): string;
  runExists(specName: string, runId: string): boolean;
}

/**
 * Generates a unique run ID.
 *
 * Format: run-<YYYYMMDDHHMMSS>-<random>
 * Example: run-20260115031000-a3f2dd
 */
export function createRunId(): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14); // YYYYMMDDHHMMSS
  const rand = randomBytes(3).toString('hex');
  return `run-${ts}-${rand}`;
}

/**
 * Creates a RunStore instance for a project root.
 */
export function createRunStore(projectRoot: string): RunStore {
  const browserflowDir = join(projectRoot, '.browserflow');
  const runsDir = join(browserflowDir, 'runs');

  return {
    async createRun(specName: string): Promise<string> {
      const specDir = join(runsDir, specName);
      const runId = createRunId();
      const runDir = join(specDir, runId);

      // Create directory structure
      await mkdir(runDir, { recursive: true });
      await mkdir(join(runDir, 'artifacts', 'screenshots'), { recursive: true });
      await mkdir(join(runDir, 'artifacts', 'logs'), { recursive: true });

      // Update "latest" symlink atomically
      const latestPath = join(specDir, 'latest');
      const tempLatestPath = join(specDir, `.latest-${Date.now()}`);

      try {
        // Create symlink to new location
        await symlink(runId, tempLatestPath);

        // Atomic rename (replaces old symlink)
        try {
          await unlink(latestPath);
        } catch {
          // Ignore if doesn't exist
        }
        await symlink(runId, latestPath);
        await unlink(tempLatestPath);
      } catch (error) {
        // Cleanup temp symlink on error
        try {
          await unlink(tempLatestPath);
        } catch {
          // Ignore
        }
        throw error;
      }

      return runDir;
    },

    getLatestRun(specName: string): string | null {
      const specDir = join(runsDir, specName);
      const latestPath = join(specDir, 'latest');

      try {
        // Check if latest symlink exists
        if (!existsSync(latestPath)) {
          return null;
        }

        // Read symlink target synchronously
        const target = readdirSync(specDir)
          .filter((name) => name.startsWith('run-'))
          .map((name) => ({
            name,
            path: join(specDir, name),
            mtime: statSync(join(specDir, name)).mtime.getTime(),
          }))
          .sort((a, b) => b.mtime - a.mtime)[0];

        return target ? target.path : null;
      } catch {
        return null;
      }
    },

    listRuns(specName: string): string[] {
      const specDir = join(runsDir, specName);

      try {
        if (!existsSync(specDir)) {
          return [];
        }

        return readdirSync(specDir)
          .filter((name) => name.startsWith('run-'))
          .map((name) => ({
            name,
            path: join(specDir, name),
            mtime: statSync(join(specDir, name)).mtime.getTime(),
          }))
          .sort((a, b) => b.mtime - a.mtime)
          .map((item) => item.path);
      } catch {
        return [];
      }
    },

    getRunDir(specName: string, runId: string): string {
      return join(runsDir, specName, runId);
    },

    runExists(specName: string, runId: string): boolean {
      const runDir = join(runsDir, specName, runId);
      try {
        return existsSync(runDir) && statSync(runDir).isDirectory();
      } catch {
        return false;
      }
    },
  };
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
