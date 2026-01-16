import { colors, symbols } from './colors.js';

export function logSuccess(message: string): void {
  console.log(colors.success('✓'), message);
}

export function logError(message: string): void {
  console.error(colors.error('✗'), message);
}

export function logWarning(message: string): void {
  console.warn(colors.warning('⚠'), message);
}

export function logInfo(message: string): void {
  console.log(colors.info('ℹ'), message);
}

export function logStep(step: number, total: number, message: string): void {
  console.log(colors.dim(`[${step}/${total}]`), message);
}

export function logHeader(title: string): void {
  console.log();
  console.log(colors.bold(colors.primary(title)));
  console.log(colors.dim('─'.repeat(title.length)));
}

export function logNewline(): void {
  console.log();
}

/**
 * Print "Next steps" guidance for the user
 */
export function printNextSteps(steps: string[]): void {
  if (steps.length === 0) return;

  console.log();
  console.log(colors.bold('Next steps:'));
  for (const step of steps) {
    console.log(`  ${symbols.arrow} ${step}`);
  }
}
