/**
 * bf baseline commands - manage visual regression baselines
 * @see bf-lp7
 */

import { Command } from 'commander';
import { readFile, readdir, access, copyFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { colors, symbols } from '../ui/colors.js';
import { logHeader, logNewline, logSuccess, logError, logWarning } from '../ui/prompts.js';

const BROWSERFLOW_DIR = '.browserflow';
const BASELINES_DIR = 'baselines';
const RUNS_DIR = 'runs';

export interface BaselineInfo {
  name: string;
  path: string;
  status: 'match' | 'diff' | 'missing' | 'new';
  diffPercent?: number;
}

export interface BaselineAcceptanceRecord {
  accepted_at: string;
  accepted_by: string;
  run_id: string;
  previous_hash: string | null;
  current_hash: string;
}

export interface BaselineStatus {
  specName: string;
  baselines: BaselineInfo[];
  newScreenshots: string[];
}

export interface AcceptResult {
  accepted: string[];
  failed: string[];
}

export class BaselineStore {
  private baseDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.baseDir = join(projectRoot, BROWSERFLOW_DIR);
  }

  async getBaselinesForSpec(specName: string): Promise<BaselineInfo[]> {
    const baselineDir = join(this.baseDir, BASELINES_DIR, specName);
    try {
      await access(baselineDir);
      const entries = await readdir(baselineDir);
      return entries
        .filter((f) => f.endsWith('.png'))
        .map((f) => ({
          name: basename(f, '.png'),
          path: join(baselineDir, f),
          status: 'match' as const,
        }));
    } catch {
      return [];
    }
  }

  async getActualsFromRun(runDir: string): Promise<{ name: string; path: string }[]> {
    const screenshotsDir = join(runDir, 'artifacts', 'screenshots');
    try {
      await access(screenshotsDir);
      const entries = await readdir(screenshotsDir);
      return entries
        .filter((f) => f.endsWith('.png'))
        .map((f) => ({
          name: basename(f, '.png'),
          path: join(screenshotsDir, f),
        }));
    } catch {
      return [];
    }
  }

  async getLatestRun(specName: string): Promise<string | null> {
    const specDir = join(this.baseDir, RUNS_DIR, specName);
    try {
      await access(specDir);
      const entries = await readdir(specDir);
      const runDirs = await Promise.all(
        entries
          .filter((e) => e.startsWith('run-'))
          .map(async (name) => {
            const fullPath = join(specDir, name);
            const stats = await stat(fullPath);
            return { name, path: fullPath, mtime: stats.mtime.getTime() };
          })
      );

      if (runDirs.length === 0) return null;

      // Sort by modification time, most recent first
      runDirs.sort((a, b) => b.mtime - a.mtime);
      return runDirs[0].path;
    } catch {
      return null;
    }
  }

  async getRunDir(specName: string, runId: string): Promise<string> {
    return join(this.baseDir, RUNS_DIR, specName, runId);
  }

  async copyToBaselines(specName: string, screenshotName: string, sourcePath: string): Promise<string> {
    const baselineDir = join(this.baseDir, BASELINES_DIR, specName);
    await mkdir(baselineDir, { recursive: true });
    const destPath = join(baselineDir, `${screenshotName}.png`);
    await copyFile(sourcePath, destPath);
    return destPath;
  }

  async recordAcceptance(specName: string, screenshotName: string, record: BaselineAcceptanceRecord): Promise<void> {
    const baselineDir = join(this.baseDir, BASELINES_DIR, specName);
    await mkdir(baselineDir, { recursive: true });
    const metaPath = join(baselineDir, `${screenshotName}.meta.json`);
    await writeFile(metaPath, JSON.stringify(record, null, 2));
  }

  async hashFile(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  async getExistingBaselineHash(specName: string, screenshotName: string): Promise<string | null> {
    try {
      const baselinePath = join(this.baseDir, BASELINES_DIR, specName, `${screenshotName}.png`);
      return await this.hashFile(baselinePath);
    } catch {
      return null;
    }
  }
}

/**
 * Compare two image files to check if they match
 */
export async function compareImages(
  path1: string,
  path2: string,
  options: { threshold?: number; generateDiff?: boolean; diffPath?: string } = {}
): Promise<{ match: boolean; diffPercent: number; diffPath?: string }> {
  const { threshold = 0.1, generateDiff = true, diffPath } = options;

  try {
    const [img1Buffer, img2Buffer] = await Promise.all([
      readFile(path1),
      readFile(path2),
    ]);

    const img1 = PNG.sync.read(img1Buffer);
    const img2 = PNG.sync.read(img2Buffer);

    // Handle size mismatch
    if (img1.width !== img2.width || img1.height !== img2.height) {
      return { match: false, diffPercent: 100 };
    }

    const { width, height } = img1;
    const diff = generateDiff ? new PNG({ width, height }) : null;

    const mismatchedPixels = pixelmatch(
      img1.data,
      img2.data,
      diff?.data ?? null,
      width,
      height,
      { threshold }
    );

    const totalPixels = width * height;
    const diffPercent = (mismatchedPixels / totalPixels) * 100;
    const match = mismatchedPixels === 0;

    // Write diff image if requested and images differ
    if (!match && diff && diffPath) {
      await writeFile(diffPath, PNG.sync.write(diff));
      return { match, diffPercent, diffPath };
    }

    return { match, diffPercent };
  } catch {
    return { match: false, diffPercent: 0 };
  }
}

/**
 * Get baseline status for a spec
 */
export async function getBaselineStatus(
  specName: string,
  options: { cwd?: string } = {}
): Promise<BaselineStatus> {
  const cwd = options.cwd || process.cwd();
  const store = new BaselineStore(cwd);

  const baselines = await store.getBaselinesForSpec(specName);
  const latestRun = await store.getLatestRun(specName);

  if (!latestRun) {
    return {
      specName,
      baselines: baselines.map((b) => ({ ...b, status: 'match' as const })),
      newScreenshots: [],
    };
  }

  const actuals = await store.getActualsFromRun(latestRun);
  const actualMap = new Map(actuals.map((a) => [a.name, a]));

  // Check status of each baseline
  const baselineResults: BaselineInfo[] = [];
  for (const baseline of baselines) {
    const actual = actualMap.get(baseline.name);
    if (!actual) {
      baselineResults.push({ ...baseline, status: 'missing' });
    } else {
      const comparison = await compareImages(baseline.path, actual.path);
      if (comparison.match) {
        baselineResults.push({ ...baseline, status: 'match' });
      } else {
        baselineResults.push({
          ...baseline,
          status: 'diff',
          diffPercent: comparison.diffPercent,
        });
      }
    }
  }

  // Find new screenshots (in actuals but not in baselines)
  const baselineNames = new Set(baselines.map((b) => b.name));
  const newScreenshots = actuals.filter((a) => !baselineNames.has(a.name)).map((a) => a.name);

  return {
    specName,
    baselines: baselineResults,
    newScreenshots,
  };
}

/**
 * Accept baselines from a run
 */
export async function acceptBaselines(
  specName: string,
  options: {
    runId?: string;
    screenshot?: string;
    all?: boolean;
    cwd?: string;
  } = {}
): Promise<AcceptResult> {
  const cwd = options.cwd || process.cwd();
  const store = new BaselineStore(cwd);

  // Find run directory
  let runDir: string;
  if (options.runId) {
    runDir = await store.getRunDir(specName, options.runId);
  } else {
    const latest = await store.getLatestRun(specName);
    if (!latest) {
      return { accepted: [], failed: ['No runs found'] };
    }
    runDir = latest;
  }

  // Get actuals from run
  const actuals = await store.getActualsFromRun(runDir);

  // Filter if specific screenshot requested
  const toAccept = options.screenshot
    ? actuals.filter((a) => a.name === options.screenshot)
    : actuals;

  if (toAccept.length === 0) {
    return { accepted: [], failed: ['No screenshots found to accept'] };
  }

  const accepted: string[] = [];
  const failed: string[] = [];

  for (const actual of toAccept) {
    try {
      // Get existing hash for recording
      const previousHash = await store.getExistingBaselineHash(specName, actual.name);

      // Copy to baselines
      await store.copyToBaselines(specName, actual.name, actual.path);

      // Calculate new hash
      const currentHash = await store.hashFile(actual.path);

      // Record acceptance metadata
      const record: BaselineAcceptanceRecord = {
        accepted_at: new Date().toISOString(),
        accepted_by: process.env.USER || 'unknown',
        run_id: basename(runDir),
        previous_hash: previousHash,
        current_hash: currentHash,
      };
      await store.recordAcceptance(specName, actual.name, record);

      accepted.push(actual.name);
    } catch (e) {
      const err = e as Error;
      failed.push(`${actual.name}: ${err.message}`);
    }
  }

  return { accepted, failed };
}

/**
 * Print baseline status
 */
function printBaselineStatus(status: BaselineStatus): void {
  console.log(`Baseline status for: ${colors.bold(status.specName)}\n`);

  if (status.baselines.length === 0 && status.newScreenshots.length === 0) {
    console.log(colors.dim('  No baselines or screenshots found.'));
    return;
  }

  for (const baseline of status.baselines) {
    let icon: string;
    let statusText: string;

    switch (baseline.status) {
      case 'match':
        icon = symbols.pass;
        statusText = '';
        break;
      case 'diff':
        icon = symbols.fail;
        statusText = baseline.diffPercent
          ? colors.warning(` (differs by ${baseline.diffPercent.toFixed(1)}%)`)
          : colors.warning(' (differs)');
        break;
      case 'missing':
        icon = colors.warning('?');
        statusText = colors.dim(' (no actual in latest run)');
        break;
      default:
        icon = symbols.pending;
        statusText = '';
    }

    console.log(`  ${icon} ${baseline.name}${statusText}`);
  }

  if (status.newScreenshots.length > 0) {
    logNewline();
    console.log(colors.dim('New screenshots (not in baselines):'));
    for (const name of status.newScreenshots) {
      console.log(`  ${colors.info('+')} ${name}`);
    }
  }
}

export function baselineCommand(): Command {
  const cmd = new Command('baseline');
  cmd.description('Manage visual regression baselines');

  // bf baseline status --spec <name>
  cmd
    .command('status')
    .description('Show baseline status for a spec')
    .requiredOption('-s, --spec <name>', 'Spec name')
    .action(async (options) => {
      logHeader('Baseline Status');
      logNewline();

      const status = await getBaselineStatus(options.spec);
      printBaselineStatus(status);
    });

  // bf baseline accept --spec <name> [--run-id <id>] [--all]
  cmd
    .command('accept')
    .description('Accept screenshots as new baselines')
    .requiredOption('-s, --spec <name>', 'Spec name')
    .option('-r, --run-id <id>', 'Specific run ID to accept from')
    .option('--screenshot <name>', 'Accept only this screenshot')
    .option('--all', 'Accept all screenshots without confirmation')
    .action(async (options) => {
      logHeader('Accept Baselines');
      logNewline();

      // Without --all, we should confirm (but for now, always proceed)
      if (!options.all && !options.screenshot) {
        console.log(colors.warning('Warning: Accepting all screenshots without --all flag.'));
        console.log(colors.dim('Use --screenshot <name> to accept a specific screenshot.'));
        logNewline();
      }

      const result = await acceptBaselines(options.spec, {
        runId: options.runId,
        screenshot: options.screenshot,
        all: true, // Always proceed for now (confirmation would require interactive prompt)
      });

      if (result.accepted.length > 0) {
        for (const name of result.accepted) {
          logSuccess(`Accepted: ${name}`);
        }
      }

      if (result.failed.length > 0) {
        for (const name of result.failed) {
          logError(`Failed: ${name}`);
        }
      }

      logNewline();
      console.log(
        `${colors.pass(`${result.accepted.length} accepted`)}, ${colors.fail(`${result.failed.length} failed`)}`
      );
    });

  // bf baseline update --spec <name> (alias for accept from latest)
  cmd
    .command('update')
    .description('Update baselines from the latest run (alias for accept --all)')
    .requiredOption('-s, --spec <name>', 'Spec name')
    .action(async (options) => {
      logHeader('Update Baselines');
      logNewline();

      const result = await acceptBaselines(options.spec, { all: true });

      if (result.accepted.length > 0) {
        for (const name of result.accepted) {
          logSuccess(`Updated: ${name}`);
        }
      }

      if (result.failed.length > 0) {
        for (const name of result.failed) {
          logError(`Failed: ${name}`);
        }
      }

      logNewline();
      console.log(
        `${colors.pass(`${result.accepted.length} updated`)}, ${colors.fail(`${result.failed.length} failed`)}`
      );
    });

  // bf baseline diff --spec <name> - would open Review UI
  cmd
    .command('diff')
    .description('Open Review UI to view diff gallery')
    .requiredOption('-s, --spec <name>', 'Spec name')
    .action(async (options) => {
      logHeader('Baseline Diff');
      logNewline();

      const status = await getBaselineStatus(options.spec);
      const diffs = status.baselines.filter((b) => b.status === 'diff');

      if (diffs.length === 0) {
        console.log(colors.pass('No differences found. All baselines match.'));
        return;
      }

      console.log(`Found ${diffs.length} difference(s):`);
      for (const diff of diffs) {
        console.log(`  ${symbols.fail} ${diff.name}`);
      }

      logNewline();
      console.log(colors.dim('To open the Review UI, run: bf review --spec ' + options.spec));
      // In a full implementation, this would launch a server and open the browser
    });

  return cmd;
}
