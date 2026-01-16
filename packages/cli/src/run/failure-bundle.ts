import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type ErrorType = 'locator_not_found' | 'timeout' | 'assertion_failed' | 'screenshot_diff' | 'unknown';

export interface RepairSuggestion {
  type: 'update_locator' | 'increase_timeout' | 'update_baseline' | 'fix_assertion' | 'investigate';
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface TestFailure {
  specName: string;
  stepId: string;
  action: string;
  message: string;
  context: {
    url: string;
    viewport: { width: number; height: number };
    browser: string;
  };
}

export interface FailureBundle {
  run_id: string;
  spec_name: string;
  failed_at: string;  // ISO8601

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

/**
 * Classify an error message into a specific error type.
 */
export function classifyError(errorMessage: string): ErrorType {
  const msg = errorMessage.toLowerCase();

  // Locator not found
  if (/locator resolved to (\d+|N) elements/i.test(errorMessage)) {
    return 'locator_not_found';
  }

  // Timeout errors
  if (msg.includes('timeout') || msg.includes('timeouterror')) {
    return 'timeout';
  }

  // Assertion failures
  if (
    msg.includes('expect') ||
    msg.includes('expected:') ||
    msg.includes('received:') ||
    msg.includes('assertionerror')
  ) {
    return 'assertion_failed';
  }

  // Screenshot/visual diff
  if (
    msg.includes('screenshot comparison') ||
    msg.includes('visual comparison') ||
    msg.includes('tomatchsnapshot')
  ) {
    return 'screenshot_diff';
  }

  return 'unknown';
}

/**
 * Generate repair suggestions based on the failure type.
 */
export function generateRepairSuggestions(failure: TestFailure): RepairSuggestion[] {
  const errorType = classifyError(failure.message);
  const suggestions: RepairSuggestion[] = [];

  switch (errorType) {
    case 'locator_not_found':
      suggestions.push({
        type: 'update_locator',
        description: `The locator for "${failure.action}" action could not find the element. Consider updating the locator with a more specific selector or waiting for the element to appear.`,
        confidence: 'high',
      });
      suggestions.push({
        type: 'investigate',
        description: 'Check if the page structure has changed or if the element loads dynamically.',
        confidence: 'medium',
      });
      break;

    case 'timeout':
      suggestions.push({
        type: 'increase_timeout',
        description: 'The operation timed out. Consider increasing the timeout or checking if the element/action is slow to respond.',
        confidence: 'high',
      });
      suggestions.push({
        type: 'investigate',
        description: 'Check for network issues or slow page loads that might be causing the timeout.',
        confidence: 'medium',
      });
      break;

    case 'assertion_failed':
      suggestions.push({
        type: 'fix_assertion',
        description: 'The assertion failed. Review the expected vs actual values and update the test or fix the application behavior.',
        confidence: 'medium',
      });
      break;

    case 'screenshot_diff':
      suggestions.push({
        type: 'update_baseline',
        description: 'Visual differences detected. Review the diff images and update the baseline if the changes are intentional.',
        confidence: 'high',
      });
      suggestions.push({
        type: 'investigate',
        description: 'Check if the visual differences indicate a regression or an expected UI change.',
        confidence: 'medium',
      });
      break;

    default:
      suggestions.push({
        type: 'investigate',
        description: 'Unknown error type. Review the error message and stack trace for more details.',
        confidence: 'low',
      });
  }

  return suggestions;
}

/**
 * Find trace file in the artifacts directory.
 */
async function findTrace(artifactsDir: string): Promise<string | null> {
  try {
    const testResultsDir = path.join(artifactsDir, 'test-results');
    const entries = await fs.readdir(testResultsDir, { withFileTypes: true, recursive: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name === 'trace.zip') {
        return path.join(entry.parentPath || testResultsDir, entry.name);
      }
    }
  } catch {
    // Directory doesn't exist or other error
  }
  return null;
}

/**
 * Find failure screenshot in the artifacts directory.
 */
async function findFailureScreenshot(artifactsDir: string): Promise<string | null> {
  try {
    const testResultsDir = path.join(artifactsDir, 'test-results');
    const entries = await fs.readdir(testResultsDir, { withFileTypes: true, recursive: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.match(/test-failed.*\.png$/)) {
        return path.join(entry.parentPath || testResultsDir, entry.name);
      }
    }
  } catch {
    // Directory doesn't exist or other error
  }
  return null;
}

/**
 * Find and copy diff images for screenshot failures.
 */
async function copyDiffImages(
  artifactsDir: string,
  bundleDir: string
): Promise<{ baseline?: string; actual?: string; diff?: string } | null> {
  try {
    const testResultsDir = path.join(artifactsDir, 'test-results');
    const entries = await fs.readdir(testResultsDir, { withFileTypes: true, recursive: true });

    const diffDir = path.join(bundleDir, 'diff');
    await fs.mkdir(diffDir, { recursive: true });

    const result: { baseline?: string; actual?: string; diff?: string } = {};

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(entry.parentPath || testResultsDir, entry.name);

      if (entry.name.includes('-expected.png') || entry.name.includes('-baseline.png')) {
        const destPath = path.join(diffDir, 'baseline.png');
        await fs.copyFile(fullPath, destPath);
        result.baseline = destPath;
      } else if (entry.name.includes('-actual.png')) {
        const destPath = path.join(diffDir, 'actual.png');
        await fs.copyFile(fullPath, destPath);
        result.actual = destPath;
      } else if (entry.name.includes('-diff.png')) {
        const destPath = path.join(diffDir, 'diff.png');
        await fs.copyFile(fullPath, destPath);
        result.diff = destPath;
      }
    }

    if (result.baseline || result.actual || result.diff) {
      return result;
    }
  } catch {
    // Error reading or copying files
  }
  return null;
}

/**
 * Extract console and network logs from trace.
 * Note: This is a placeholder - actual trace extraction would require parsing the trace.zip file.
 */
async function extractLogsFromTrace(
  _tracePath: string
): Promise<{ console: unknown[]; network: unknown[] }> {
  // Placeholder implementation - in a real implementation, we would:
  // 1. Unzip the trace file
  // 2. Parse the trace JSON
  // 3. Extract console and network events
  return {
    console: [],
    network: [],
  };
}

/**
 * Write JSON to a file, ensuring the directory exists.
 */
async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Generate a failure bundle with all artifacts and metadata.
 */
export async function generateFailureBundle(
  runDir: string,
  failure: TestFailure,
  playwrightArtifacts: string
): Promise<string> {
  const bundleDir = path.join(runDir, 'artifacts');
  await fs.mkdir(bundleDir, { recursive: true });

  const artifacts: FailureBundle['artifacts'] = {};

  // 1. Copy trace file
  const tracePath = await findTrace(playwrightArtifacts);
  if (tracePath) {
    const destPath = path.join(bundleDir, 'trace.zip');
    await fs.copyFile(tracePath, destPath);
    artifacts.trace = destPath;

    // 4. Extract console/network logs from trace
    const logs = await extractLogsFromTrace(destPath);
    const logsDir = path.join(bundleDir, 'logs');
    await writeJson(path.join(logsDir, 'console.json'), logs.console);
    await writeJson(path.join(logsDir, 'network.json'), logs.network);
    artifacts.console_log = path.join(logsDir, 'console.json');
    artifacts.network_log = path.join(logsDir, 'network.json');
  } else {
    // Still create empty log files even without trace
    const logsDir = path.join(bundleDir, 'logs');
    await writeJson(path.join(logsDir, 'console.json'), []);
    await writeJson(path.join(logsDir, 'network.json'), []);
    artifacts.console_log = path.join(logsDir, 'console.json');
    artifacts.network_log = path.join(logsDir, 'network.json');
  }

  // 2. Copy failure screenshot
  const screenshotPath = await findFailureScreenshot(playwrightArtifacts);
  if (screenshotPath) {
    const screenshotsDir = path.join(bundleDir, 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });
    const destPath = path.join(screenshotsDir, 'failure.png');
    await fs.copyFile(screenshotPath, destPath);
    artifacts.screenshot = destPath;
  }

  // 3. Copy diff images if screenshot failure
  const errorType = classifyError(failure.message);
  if (errorType === 'screenshot_diff') {
    const diffImages = await copyDiffImages(playwrightArtifacts, bundleDir);
    if (diffImages) {
      artifacts.diff = diffImages as { baseline: string; actual: string; diff: string };
    }
  }

  // 5. Generate repair suggestions
  const suggestions = generateRepairSuggestions(failure);

  // 6. Write failure.json
  const bundle: FailureBundle = {
    run_id: path.basename(runDir),
    spec_name: failure.specName,
    failed_at: new Date().toISOString(),
    failure: {
      step_id: failure.stepId,
      action: failure.action,
      error_message: failure.message,
      error_type: errorType,
    },
    context: failure.context,
    artifacts,
    suggestions,
  };

  const bundlePath = path.join(runDir, 'failure.json');
  await writeJson(bundlePath, bundle);

  return bundlePath;
}
