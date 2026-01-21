/**
 * bf lint command - validates spec files against v2 schema
 * @see bf-eq4
 */

import { Command } from 'commander';
import { readFile, readdir, access } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parse as parseYaml, LineCounter, parseDocument } from 'yaml';
import { specSchema } from '@akatz-ai/core';
import { colors, symbols } from '../ui/colors.js';
import { logHeader, logNewline } from '../ui/prompts.js';

export interface LintError {
  path: string;
  message: string;
  line: number;
  value?: unknown;
}

export interface LintResult {
  file: string;
  errors: LintError[];
}

export interface LintOptions {
  fix?: boolean;
  cwd?: string;
}

/**
 * Get line number for a path in YAML content
 */
export function getLineNumber(content: string, path: (string | number)[]): number {
  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(content, { lineCounter });

    if (!doc.contents) {
      return 1;
    }

    // Cast to any to use getIn method - the yaml library types are complex
    const contents = doc.contents as { getIn: (path: (string | number)[], keepScalar?: boolean) => unknown };
    if (!('getIn' in contents)) {
      return 1;
    }

    // Use getIn with keepScalar=true to get the actual node
    const node = contents.getIn(path, true);

    if (node && typeof node === 'object' && 'range' in node) {
      const range = (node as { range: [number, number, number] | null }).range;
      if (range && range[0] !== undefined) {
        const pos = lineCounter.linePos(range[0]);
        return pos.line;
      }
    }

    // If we can't find the exact node, try to find the parent
    // This helps when the property doesn't exist (e.g., missing 'id')
    if (path.length > 0) {
      const parentPath = path.slice(0, -1);
      const parentNode = contents.getIn(parentPath, true);
      if (parentNode && typeof parentNode === 'object' && 'range' in parentNode) {
        const range = (parentNode as { range: [number, number, number] | null }).range;
        if (range && range[0] !== undefined) {
          const pos = lineCounter.linePos(range[0]);
          return pos.line;
        }
      }
    }

    return 1;
  } catch {
    return 1;
  }
}

/**
 * Format lint error with actionable message
 */
export function formatLintError(error: LintError): LintError {
  const { path, message, value } = error;
  let actionableMessage = message;

  // Make messages actionable based on error type
  if (path.includes('id') && (message.toLowerCase().includes('required') || message.toLowerCase().includes('invalid'))) {
    actionableMessage = "Step id is required - add 'id: unique_step_id' to this step";
  } else if (path.includes('timeout') || path.includes('duration')) {
    if (value !== undefined) {
      actionableMessage = `Invalid duration "${value}" - use format like "3s", "2m", or "500ms"`;
    } else if (message.toLowerCase().includes('duration')) {
      actionableMessage = message;
    }
  } else if (message.toLowerCase().includes('unique')) {
    actionableMessage = 'Step IDs must be unique within spec - rename duplicate step IDs';
  } else if (message.toLowerCase().includes('kebab-case')) {
    if (value !== undefined) {
      actionableMessage = `Name "${value}" must be kebab-case (lowercase letters, numbers, and hyphens only)`;
    } else {
      actionableMessage = 'Name must be kebab-case (lowercase letters, numbers, and hyphens only)';
    }
  }

  return {
    ...error,
    message: actionableMessage,
  };
}

/**
 * Lint a single spec file content
 */
export function lintSpec(content: string, filename: string): LintResult {
  const errors: LintError[] = [];

  // Try to parse YAML
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (e) {
    const error = e as Error;
    errors.push({
      path: '',
      message: `YAML syntax error: ${error.message}`,
      line: 1,
    });
    return { file: filename, errors };
  }

  // Validate against schema
  const validation = specSchema.safeParse(parsed);

  if (!validation.success) {
    for (const issue of validation.error.issues) {
      const path = issue.path.join('.');
      const line = getLineNumber(content, issue.path);

      // Get the value at this path for context
      let value: unknown;
      try {
        let current = parsed as Record<string, unknown>;
        for (const segment of issue.path) {
          if (current && typeof current === 'object') {
            current = (current as Record<string | number, unknown>)[segment] as Record<string, unknown>;
          }
        }
        value = current;
      } catch {
        // Ignore errors getting value
      }

      const error: LintError = {
        path,
        message: issue.message,
        line,
        value: typeof value === 'string' || typeof value === 'number' ? value : undefined,
      };

      errors.push(formatLintError(error));
    }
  }

  return { file: filename, errors };
}

/**
 * Lint multiple spec files
 */
export async function lintFiles(
  files: string[],
  options: LintOptions = {}
): Promise<LintResult[]> {
  const cwd = options.cwd || process.cwd();
  const results: LintResult[] = [];

  // If no files specified, find all yaml files in specs/
  let targetFiles = files;
  if (targetFiles.length === 0) {
    try {
      const specsDir = join(cwd, 'specs');
      await access(specsDir);
      const entries = await readdir(specsDir);
      targetFiles = entries
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map((f) => join(specsDir, f));
    } catch {
      // specs/ doesn't exist
      return [];
    }
  }

  // Lint each file
  for (const file of targetFiles) {
    const filePath = resolve(cwd, file);
    const displayPath = relative(cwd, filePath);

    try {
      const content = await readFile(filePath, 'utf-8');
      const result = lintSpec(content, displayPath);
      results.push(result);
    } catch (e) {
      const error = e as NodeJS.ErrnoException;
      results.push({
        file: displayPath,
        errors: [
          {
            path: '',
            message: error.code === 'ENOENT' ? 'File not found' : error.message,
            line: 1,
          },
        ],
      });
    }
  }

  return results;
}

/**
 * Print lint results to console
 */
function printResults(results: LintResult[]): void {
  let totalPassed = 0;
  let totalFailed = 0;
  let totalErrors = 0;

  for (const result of results) {
    if (result.errors.length === 0) {
      console.log(`${symbols.pass} ${result.file}`);
      totalPassed++;
    } else {
      console.log(`${symbols.fail} ${result.file}`);
      totalFailed++;
      totalErrors += result.errors.length;

      for (const error of result.errors) {
        console.log(`  ${colors.dim(`Line ${error.line}:`)} ${error.message}`);
        if (error.path) {
          console.log(`    ${colors.dim('at')} ${colors.code(error.path)}`);
        }
      }
    }
  }

  logNewline();
  const parts: string[] = [];
  if (totalPassed > 0) parts.push(colors.pass(`${totalPassed} passed`));
  if (totalFailed > 0) parts.push(colors.fail(`${totalFailed} failed`));
  if (totalErrors > 0) parts.push(`(${totalErrors} error${totalErrors > 1 ? 's' : ''})`);

  console.log(parts.join(', '));
}

export function lintCommand(): Command {
  const cmd = new Command('lint');

  cmd
    .description('Validate BrowserFlow spec files')
    .argument('[specs...]', 'Spec files or directories to lint')
    .option('--fix', 'Attempt to fix issues automatically')
    .action(async (specs: string[], options: LintOptions) => {
      logHeader('Linting specs');
      logNewline();

      const targetDir = specs.length > 0 ? undefined : 'specs/*.yaml';
      if (specs.length === 0) {
        console.log(colors.dim(`Linting ${targetDir}`));
        logNewline();
      }

      const results = await lintFiles(specs, options);

      if (results.length === 0) {
        console.log(colors.dim('No spec files found.'));
        return;
      }

      printResults(results);

      // Exit code 3 for validation failure (per spec)
      const hasErrors = results.some((r) => r.errors.length > 0);
      if (hasErrors) {
        process.exitCode = 3;
      }
    });

  return cmd;
}
