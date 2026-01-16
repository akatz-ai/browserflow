import { Command } from 'commander';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { logSuccess, logWarning, logHeader, logNewline, logInfo } from '../ui/prompts.js';
import { colors } from '../ui/colors.js';

export const DEFAULT_CONFIG = `project:
  name: my-project
  base_url: http://localhost:3000

runtime:
  browser: chromium
  headless: true
  viewport:
    width: 1280
    height: 720
  timeout: 30s

locators:
  prefer_testid: true
  testid_attributes:
    - data-testid
    - data-test

exploration:
  adapter: claude
  max_retries: 3

review:
  port: 8190
  auto_open: true

output:
  tests_dir: e2e/tests
  baselines_dir: baselines
`;

export const EXAMPLE_SPEC = `version: 2
name: example
description: Example spec - customize for your app

steps:
  - id: visit_home
    action: navigate
    url: /

  - id: homepage_screenshot
    action: screenshot
    name: homepage

tags:
  - example
  - smoke
`;

const GITIGNORE_ENTRIES = ['.browserflow/', 'node_modules/'];

export interface InitOptions {
  force?: boolean;
  example?: boolean;
}

export interface InitResult {
  created: string[];
  updated: string[];
  skipped: string[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function appendToGitignore(entries: string[]): Promise<{ updated: boolean; added: string[] }> {
  const gitignorePath = join(process.cwd(), '.gitignore');
  let existingContent = '';
  const added: string[] = [];

  try {
    existingContent = await readFile(gitignorePath, 'utf-8');
  } catch {
    // File doesn't exist yet
  }

  const existingLines = new Set(existingContent.split('\n').map(l => l.trim()));
  const toAdd: string[] = [];

  for (const entry of entries) {
    if (!existingLines.has(entry)) {
      toAdd.push(entry);
      added.push(entry);
    }
  }

  if (toAdd.length > 0) {
    const newContent = existingContent
      ? existingContent.trimEnd() + '\n' + toAdd.join('\n') + '\n'
      : toAdd.join('\n') + '\n';
    await writeFile(gitignorePath, newContent);
    return { updated: true, added };
  }

  return { updated: false, added: [] };
}

export async function runInit(options: InitOptions): Promise<InitResult> {
  const result: InitResult = {
    created: [],
    updated: [],
    skipped: [],
  };

  // 1. Create browserflow.yaml
  const configPath = join(process.cwd(), 'browserflow.yaml');
  const configExists = await fileExists(configPath);

  if (!configExists || options.force) {
    await writeFile(configPath, DEFAULT_CONFIG);
    result.created.push('browserflow.yaml');
  } else {
    result.skipped.push('browserflow.yaml');
  }

  // 2. Create specs/ directory
  const specsDir = join(process.cwd(), 'specs');
  const specsDirExists = await fileExists(specsDir);

  if (!specsDirExists) {
    await mkdir(specsDir, { recursive: true });
    result.created.push('specs/');
  }

  // 3. Update .gitignore
  const gitignoreResult = await appendToGitignore(GITIGNORE_ENTRIES);
  if (gitignoreResult.updated) {
    result.updated.push('.gitignore');
  }

  // 4. Create example spec (if --example)
  if (options.example) {
    const examplePath = join(specsDir, 'example.yaml');
    await writeFile(examplePath, EXAMPLE_SPEC);
    result.created.push('specs/example.yaml');
  }

  return result;
}

export function initCommand(): Command {
  const cmd = new Command('init');

  cmd
    .description('Initialize BrowserFlow in the current project')
    .option('-f, --force', 'Overwrite existing configuration')
    .option('--example', 'Create an example spec file')
    .action(async (options: InitOptions) => {
      logHeader('BrowserFlow Initialized!');
      logNewline();

      const result = await runInit(options);

      if (result.created.length > 0 || result.updated.length > 0) {
        console.log(colors.bold('Created:'));
        for (const file of result.created) {
          logSuccess(file);
        }
        for (const file of result.updated) {
          logSuccess(`${file} (updated)`);
        }
        logNewline();
      }

      if (result.skipped.length > 0) {
        console.log(colors.bold('Skipped (already exists):'));
        for (const file of result.skipped) {
          logWarning(`${file} - use --force to overwrite`);
        }
        logNewline();
      }

      console.log(colors.bold('Next steps:'));
      logInfo('Edit browserflow.yaml with your project settings');
      logInfo('Write specs in specs/ directory');
      logInfo(`Run: ${colors.code('bf explore --spec <name>')}`);
    });

  return cmd;
}
