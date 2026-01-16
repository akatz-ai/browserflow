import { colors } from '../ui/colors.js';
import type { RunResult, SpecResult, StepResult } from './types.js';

export function printRunHeader(specs: string[]): void {
  console.log();
  if (specs.length > 0) {
    console.log(colors.bold(`Running: ${specs.join(', ')}`));
  } else {
    console.log(colors.bold('Running: all specs'));
  }
  console.log();
}

export function printRunSummary(result: RunResult): void {
  console.log();

  // Print spec-by-spec results
  for (const spec of result.specs) {
    printSpecResult(spec);
  }

  // Print summary line
  console.log();
  const parts: string[] = [];

  if (result.passed > 0) {
    parts.push(colors.pass(`${result.passed} passed`));
  }
  if (result.failed > 0) {
    parts.push(colors.fail(`${result.failed} failed`));
  }
  if (result.skipped > 0) {
    parts.push(colors.skip(`${result.skipped} skipped`));
  }

  const duration = formatDuration(result.duration);
  console.log(`  ${parts.join(', ')} (${duration})`);

  // Print run location
  console.log();
  console.log(`Run complete. Results at: ${colors.path(result.runDir)}`);
}

function printSpecResult(spec: SpecResult): void {
  console.log(`  ${colors.bold(spec.name)}`);

  for (const step of spec.steps) {
    printStepResult(step);
  }

  console.log();
}

function printStepResult(step: StepResult): void {
  const duration = formatDuration(step.duration);
  const icon = step.status === 'passed'
    ? colors.pass('✓')
    : step.status === 'failed'
      ? colors.fail('✗')
      : colors.skip('○');

  console.log(`    ${icon} ${step.name} ${colors.dim(`(${duration})`)}`);
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function printError(message: string): void {
  console.error();
  console.error(colors.error(`Error: ${message}`));
}
