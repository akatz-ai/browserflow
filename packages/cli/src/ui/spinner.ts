import ora, { type Ora } from 'ora';
import { colors } from './colors.js';

export interface SpinnerOptions {
  text: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'magenta';
}

export function createSpinner(options: SpinnerOptions | string): Ora {
  const opts = typeof options === 'string' ? { text: options } : options;
  return ora({
    text: opts.text,
    color: opts.color ?? 'cyan',
  });
}

export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>
): Promise<T> {
  const spinner = createSpinner(text);
  spinner.start();

  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export function stepSpinner(step: string, total?: number): Ora {
  const prefix = total ? colors.dim(`[${step}/${total}]`) : colors.dim(`[${step}]`);
  return createSpinner(`${prefix} `);
}
