import { spawn } from 'node:child_process';
import * as path from 'node:path';
import type { RunOptions } from './types.js';

export interface ExecutorResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  jsonOutput?: unknown;
}

export async function executePlaywright(
  specs: string[],
  options: RunOptions,
  runDir: string
): Promise<ExecutorResult> {
  const args = buildPlaywrightArgs(specs, options, runDir);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const child = spawn('bunx', ['playwright', 'test', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      let jsonOutput: unknown;
      try {
        // Parse JSON output from JSON reporter
        // The entire stdout should be valid JSON when using --reporter json
        if (stdout.trim()) {
          jsonOutput = JSON.parse(stdout.trim());
        }
      } catch (error) {
        // If JSON parsing fails, try to extract JSON object from mixed output
        try {
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonOutput = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Ignore parse errors - jsonOutput will remain undefined
        }
      }

      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        jsonOutput,
      });
    });

    child.on('error', (err) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + '\n' + err.message,
      });
    });
  });
}

function buildPlaywrightArgs(
  specs: string[],
  options: RunOptions,
  runDir: string
): string[] {
  const args: string[] = [];

  // Config file (if exists)
  args.push('--config', 'e2e/playwright.config.ts');

  // Reporter - use JSON for structured output
  args.push('--reporter', 'json');

  // Output directory for artifacts
  args.push('--output', path.join(runDir, 'artifacts'));

  // Parallel workers
  if (options.parallel !== undefined) {
    args.push('--workers', String(options.parallel));
  }

  // Headed mode
  if (options.headed) {
    args.push('--headed');
  }

  // Trace mode
  if (options.trace) {
    args.push('--trace', options.trace);
  }

  // Tag filter (using Playwright's grep)
  if (options.tag) {
    args.push('--grep', `@${options.tag}`);
  }

  // Spec files
  for (const spec of specs) {
    args.push(`e2e/tests/${spec}.spec.ts`);
  }

  return args;
}

export async function resolveSpecs(options: RunOptions): Promise<string[]> {
  // If specific spec provided, use it
  if (options.spec) {
    return [options.spec];
  }

  // Otherwise, run all specs by not filtering
  // Playwright will run all files matching the config pattern
  return [];
}
