import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { RunResult, SpecResult, StepResult, FailureInfo } from './types.js';
import type { ExecutorResult } from './executor.js';
import { generateFailureBundle, type TestFailure } from './failure-bundle.js';

export async function collectResults(
  runDir: string,
  executorResult: ExecutorResult
): Promise<RunResult> {
  const specs: SpecResult[] = [];
  const failures: FailureInfo[] = [];

  // Parse results from JSON output
  if (!executorResult.jsonOutput) {
    // Fallback if no JSON output available
    return {
      runDir,
      specs: [],
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failures: [],
    };
  }

  const json = executorResult.jsonOutput as PlaywrightJsonReport;

  // Process each suite (file)
  for (const suite of json.suites ?? []) {
    // Extract spec name from file path
    // e.g., 'e2e/tests/login.spec.ts' -> 'login'
    // e.g., 'e2e/tests/nested/deep/test.spec.ts' -> 'nested/deep/test'
    const specName = extractSpecName(suite.file);

    const steps: StepResult[] = [];
    let suiteDuration = 0;
    let suiteStatus: 'passed' | 'failed' | 'skipped' = 'passed';

    // Process each spec (test) within the suite as a step
    for (const spec of suite.specs ?? []) {
      const test = spec.tests?.[0];
      const result = test?.results?.[0];

      const status = result?.status === 'skipped'
        ? 'skipped'
        : spec.ok
          ? 'passed'
          : 'failed';

      const duration = result?.duration ?? 0;
      const errorMessage = result?.error?.message;

      steps.push({
        name: spec.title,
        duration,
        status,
        error: errorMessage,
      });

      suiteDuration += duration;

      // Suite fails if any test fails
      if (status === 'failed') {
        suiteStatus = 'failed';
      } else if (status === 'skipped' && suiteStatus === 'passed') {
        suiteStatus = 'skipped';
      }

      // Track failures
      if (status === 'failed' && errorMessage) {
        failures.push({
          spec: specName,
          step: spec.title,
          error: errorMessage,
        });
      }
    }

    // Create one SpecResult per suite (file) with all tests as steps
    if (steps.length > 0) {
      specs.push({
        name: specName,
        steps,
        duration: suiteDuration,
        status: suiteStatus,
      });
    }
  }

  // Use stats from JSON report
  const stats = json.stats;
  const passed = stats?.expected ?? 0;
  const failed = stats?.unexpected ?? 0;
  const skipped = stats?.skipped ?? 0;
  const duration = stats?.duration ?? 0;

  return {
    runDir,
    specs,
    passed,
    failed,
    skipped,
    duration,
    failures,
  };
}

function extractSpecName(filePath: string): string {
  // Extract spec name from file path
  // e.g., 'e2e/tests/login.spec.ts' -> 'login'
  // e.g., 'e2e/tests/nested/deep/test.spec.ts' -> 'nested/deep/test'
  const match = filePath.match(/tests\/(.+?)\.spec\.ts/);
  return match ? match[1] : 'unknown';
}

// Type definitions for Playwright JSON reporter output
interface PlaywrightJsonReport {
  config?: unknown;
  suites?: PlaywrightSuite[];
  stats?: {
    expected: number;
    unexpected: number;
    skipped: number;
    duration: number;
  };
}

interface PlaywrightSuite {
  title: string;
  file: string;
  specs?: PlaywrightSpec[];
}

interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests?: PlaywrightTest[];
}

interface PlaywrightTest {
  results?: PlaywrightTestResult[];
}

interface PlaywrightTestResult {
  status: string;
  duration: number;
  startTime?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

export async function generateFailureBundles(
  runDir: string,
  failures: FailureInfo[]
): Promise<string[]> {
  const bundlesDir = path.join(runDir, 'failure-bundles');
  await fs.mkdir(bundlesDir, { recursive: true });

  const bundlePaths: string[] = [];
  const artifactsDir = path.join(runDir, 'artifacts');

  for (const failure of failures) {
    const bundleName = `${failure.spec}-${failure.step}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    const bundleDir = path.join(bundlesDir, bundleName);
    await fs.mkdir(bundleDir, { recursive: true });

    // Convert FailureInfo to TestFailure
    const testFailure: TestFailure = {
      specName: failure.spec,
      stepId: failure.step,
      action: failure.step, // Use step name as action if not available
      message: failure.error,
      context: failure.context ?? {
        url: 'unknown',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
    };

    // Generate comprehensive failure bundle
    const bundlePath = await generateFailureBundle(bundleDir, testFailure, artifactsDir);
    bundlePaths.push(bundlePath);
  }

  return bundlePaths;
}
