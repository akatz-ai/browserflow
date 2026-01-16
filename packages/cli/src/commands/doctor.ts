import { Command } from 'commander';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { parse as parseYaml } from 'yaml';
import { logSuccess, logError, logWarning, logHeader, logNewline } from '../ui/prompts.js';
import { colors } from '../ui/colors.js';

const exec = promisify(execCallback);

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fixHint?: string;
}

export interface Check {
  name: string;
  check: () => Promise<CheckResult>;
  fix?: () => Promise<void>;
}

export interface CheckOutput {
  name: string;
  result: CheckResult;
}

export interface DoctorResult {
  checks: CheckOutput[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
  exitCode: number;
}

export interface DoctorOptions {
  fix?: boolean;
  verbose?: boolean;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

export async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1));

  if (major >= 18) {
    return { status: 'pass', message: `Node.js ${version}` };
  }

  return {
    status: 'fail',
    message: `Node.js ${version} (need >=18)`,
    fixHint: 'Install Node.js 18+ from https://nodejs.org',
  };
}

export async function checkAgentBrowser(): Promise<CheckResult> {
  try {
    const { stdout } = await exec('agent-browser --version');
    const version = stdout.trim();
    // Handle version with or without 'v' prefix
    const displayVersion = version.startsWith('v') ? version : `v${version}`;
    return { status: 'pass', message: displayVersion };
  } catch {
    return {
      status: 'fail',
      message: 'Not installed',
      fixHint: 'Run: bun add -g agent-browser',
    };
  }
}

export async function checkPlaywrightBrowsers(): Promise<CheckResult> {
  try {
    // Get playwright version
    const { stdout: versionOutput } = await exec('bunx playwright --version');
    const version = versionOutput.trim();

    // Check if chromium is installed using --list
    try {
      const { stdout: listOutput } = await exec('bunx playwright install --list');
      // Check if chromium is listed in the browsers section
      if (listOutput.includes('chromium-')) {
        return { status: 'pass', message: `Installed (Playwright ${version})` };
      }
      return {
        status: 'warn',
        message: `Playwright ${version} (chromium not installed)`,
        fixHint: 'Run: bunx playwright install chromium',
      };
    } catch {
      return {
        status: 'warn',
        message: `Playwright ${version} (browsers may need install)`,
        fixHint: 'Run: bunx playwright install chromium',
      };
    }
  } catch {
    return {
      status: 'fail',
      message: 'Not installed',
      fixHint: 'Run: bunx playwright install chromium',
    };
  }
}

async function loadConfig(): Promise<{ config: Record<string, unknown> | null; error?: string }> {
  const configPath = join(process.cwd(), 'browserflow.yaml');

  if (!(await fileExists(configPath))) {
    return { config: null, error: 'No browserflow.yaml' };
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const config = parseYaml(content) as Record<string, unknown>;
    return { config };
  } catch (err) {
    return { config: null, error: `Invalid YAML: ${(err as Error).message}` };
  }
}

export async function checkConfiguration(): Promise<CheckResult> {
  const { config, error } = await loadConfig();

  if (!config) {
    return {
      status: 'fail',
      message: error ?? 'No browserflow.yaml',
      fixHint: 'Run: bf init',
    };
  }

  return { status: 'pass', message: 'Valid' };
}

export async function checkReviewPort(): Promise<CheckResult> {
  const { config } = await loadConfig();

  const port = (config?.review as Record<string, unknown>)?.port as number ?? 8190;

  if (await isPortAvailable(port)) {
    return { status: 'pass', message: `Port ${port} available` };
  }

  return {
    status: 'warn',
    message: `Port ${port} in use`,
    fixHint: 'Change review.port in browserflow.yaml',
  };
}

function createDefaultChecks(): Check[] {
  return [
    { name: 'Node.js version', check: checkNodeVersion },
    { name: 'agent-browser', check: checkAgentBrowser },
    { name: 'Playwright browsers', check: checkPlaywrightBrowsers },
    { name: 'Configuration', check: checkConfiguration },
    { name: 'Review port', check: checkReviewPort },
  ];
}

export function createMockChecks(options: { allPass?: boolean } = {}): Check[] {
  if (options.allPass) {
    return [
      { name: 'Node.js version', check: async () => ({ status: 'pass', message: 'v20.0.0' }) },
      { name: 'agent-browser', check: async () => ({ status: 'pass', message: 'v0.5.0' }) },
      { name: 'Playwright browsers', check: async () => ({ status: 'pass', message: 'Installed' }) },
      { name: 'Configuration', check: async () => ({ status: 'pass', message: 'Valid' }) },
      { name: 'Review port', check: async () => ({ status: 'pass', message: 'Port 8190 available' }) },
    ];
  }
  return createDefaultChecks();
}

export async function runDoctor(
  options: DoctorOptions,
  checks: Check[] = createDefaultChecks()
): Promise<DoctorResult> {
  const checkOutputs: CheckOutput[] = [];

  for (const check of checks) {
    const result = await check.check();
    checkOutputs.push({ name: check.name, result });

    // Attempt fix if requested and available
    if (options.fix && result.status === 'fail' && check.fix) {
      try {
        await check.fix();
        // Re-run check after fix
        const newResult = await check.check();
        checkOutputs[checkOutputs.length - 1].result = newResult;
      } catch {
        // Fix failed, keep original result
      }
    }
  }

  const summary = {
    passed: checkOutputs.filter(c => c.result.status === 'pass').length,
    warnings: checkOutputs.filter(c => c.result.status === 'warn').length,
    failed: checkOutputs.filter(c => c.result.status === 'fail').length,
  };

  // Exit code: 0 for all pass, 0 for warnings only, 1 for any failures
  const exitCode = summary.failed > 0 ? 1 : 0;

  return { checks: checkOutputs, summary, exitCode };
}

function formatCheckOutput(check: CheckOutput): void {
  const { name, result } = check;
  const paddedName = name.padEnd(20);

  switch (result.status) {
    case 'pass':
      logSuccess(`${paddedName} ${result.message}`);
      break;
    case 'warn':
      logWarning(`${paddedName} ${result.message}`);
      if (result.fixHint) {
        console.log(`    ${colors.dim('→')} ${result.fixHint}`);
      }
      break;
    case 'fail':
      logError(`${paddedName} ${result.message}`);
      if (result.fixHint) {
        console.log(`    ${colors.dim('→')} ${result.fixHint}`);
      }
      break;
  }
}

export function doctorCommand(): Command {
  const cmd = new Command('doctor');

  cmd
    .description('Check environment and dependencies')
    .option('-v, --verbose', 'Show detailed output')
    .option('--fix', 'Attempt to fix issues automatically')
    .action(async (options: DoctorOptions) => {
      logHeader('BrowserFlow Doctor');
      logNewline();

      const result = await runDoctor(options);

      for (const check of result.checks) {
        formatCheckOutput(check);
      }

      logNewline();
      const { passed, warnings, failed } = result.summary;
      const parts: string[] = [];

      if (passed > 0) parts.push(colors.pass(`${passed} passed`));
      if (warnings > 0) parts.push(colors.warning(`${warnings} warning${warnings > 1 ? 's' : ''}`));
      if (failed > 0) parts.push(colors.fail(`${failed} failed`));

      console.log(parts.join(', '));

      if (failed > 0 && !options.fix) {
        logNewline();
        console.log(colors.dim('Run bf doctor --fix to attempt automatic fixes.'));
      }

      process.exitCode = result.exitCode;
    });

  return cmd;
}
