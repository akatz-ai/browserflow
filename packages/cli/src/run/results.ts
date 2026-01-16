import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { RunResult, SpecResult, FailureInfo } from './types.js';
import type { ExecutorResult } from './executor.js';

export async function collectResults(
  runDir: string,
  executorResult: ExecutorResult
): Promise<RunResult> {
  const specs: SpecResult[] = [];
  const failures: FailureInfo[] = [];

  // Parse the stdout to extract step-by-step results
  // Playwright's list reporter outputs lines like:
  // [chromium] › tests/example.spec.ts:3:5 › step name
  const lines = executorResult.stdout.split('\n');
  let currentSpec: SpecResult | null = null;

  for (const line of lines) {
    // Match passed steps: ✓ or ✔
    const passMatch = line.match(/[✓✔]\s+.*?›\s+(.+?)\s+\(([0-9.]+)([sm]s?)\)/);
    if (passMatch) {
      const [, stepName, duration, unit] = passMatch;
      const durationMs = unit.startsWith('s')
        ? parseFloat(duration) * 1000
        : parseFloat(duration);

      // Extract spec name from earlier in the line
      const specMatch = line.match(/tests\/(.+?)\.spec\.ts/);
      const specName = specMatch ? specMatch[1] : 'unknown';

      if (!currentSpec || currentSpec.name !== specName) {
        if (currentSpec) {
          specs.push(currentSpec);
        }
        currentSpec = {
          name: specName,
          steps: [],
          duration: 0,
          status: 'passed',
        };
      }

      currentSpec.steps.push({
        name: stepName,
        duration: durationMs,
        status: 'passed',
      });
      currentSpec.duration += durationMs;
    }

    // Match failed steps
    const failMatch = line.match(/[✗✘×]\s+.*?›\s+(.+?)(?:\s+\(([0-9.]+)([sm]s?)\))?/);
    if (failMatch) {
      const [, stepName, duration, unit] = failMatch;
      const durationMs = duration
        ? (unit?.startsWith('s') ? parseFloat(duration) * 1000 : parseFloat(duration))
        : 0;

      const specMatch = line.match(/tests\/(.+?)\.spec\.ts/);
      const specName = specMatch ? specMatch[1] : 'unknown';

      if (!currentSpec || currentSpec.name !== specName) {
        if (currentSpec) {
          specs.push(currentSpec);
        }
        currentSpec = {
          name: specName,
          steps: [],
          duration: 0,
          status: 'failed',
        };
      }

      currentSpec.steps.push({
        name: stepName,
        duration: durationMs,
        status: 'failed',
      });
      currentSpec.duration += durationMs;
      currentSpec.status = 'failed';

      failures.push({
        spec: specName,
        step: stepName,
        error: 'Test failed',
      });
    }
  }

  if (currentSpec) {
    specs.push(currentSpec);
  }

  // Calculate total duration from individual spec durations
  const totalDuration = specs.reduce((sum, spec) => sum + spec.duration, 0);
  const passed = specs.filter(s => s.status === 'passed').length;
  const failed = specs.filter(s => s.status === 'failed').length;
  const skipped = specs.filter(s => s.status === 'skipped').length;

  return {
    runDir,
    specs,
    passed,
    failed,
    skipped,
    duration: totalDuration,
    failures,
  };
}

export async function generateFailureBundles(
  runDir: string,
  failures: FailureInfo[]
): Promise<void> {
  const bundlesDir = path.join(runDir, 'failure-bundles');
  await fs.mkdir(bundlesDir, { recursive: true });

  for (const failure of failures) {
    const bundleName = `${failure.spec}-${failure.step}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    const bundleDir = path.join(bundlesDir, bundleName);
    await fs.mkdir(bundleDir, { recursive: true });

    // Write failure info
    await fs.writeFile(
      path.join(bundleDir, 'failure.json'),
      JSON.stringify(failure, null, 2)
    );
  }
}
