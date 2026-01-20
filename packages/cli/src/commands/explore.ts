/**
 * bf explore command - runs AI exploration for a spec
 * @see bf-x9t
 */

import { Command } from 'commander';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { specSchema } from '@browserflow/core';
import type { BrowserFlowSpec } from '@browserflow/core';
import { Explorer, ClaudeAdapter, ClaudeCliAdapter, createBrowserSession } from '@browserflow/exploration';
import type { ExplorationOutput, AIAdapter } from '@browserflow/exploration';
import { colors } from '../ui/colors.js';

/**
 * Load and validate a spec file
 */
export async function loadAndValidateSpec(specName: string, cwd: string = process.cwd()): Promise<BrowserFlowSpec> {
  const specPath = join(cwd, 'specs', `${specName}.yaml`);

  // Read file
  let content: string;
  try {
    content = await readFile(specPath, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`Spec file not found: ${specPath}`);
    }
    throw error;
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (error) {
    const err = error as Error;
    throw new Error(`YAML syntax error: ${err.message}`);
  }

  // Validate against schema
  const validation = specSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues.map((issue: { path: (string | number)[]; message: string }) => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    }).join('\n');
    throw new Error(`Spec validation failed:\n${issues}`);
  }

  return validation.data;
}

/**
 * Write exploration output to disk
 */
async function writeExplorationOutput(result: ExplorationOutput): Promise<void> {
  const outputDir = join('.browserflow', 'explorations', result.explorationId);
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'exploration.json'),
    JSON.stringify(result, null, 2)
  );
}

/**
 * Create an AI adapter based on the adapter name
 */
function createAdapter(adapterName: string): AIAdapter {
  switch (adapterName) {
    case 'claude':
      return new ClaudeAdapter();
    case 'claude-cli':
      return new ClaudeCliAdapter();
    default:
      throw new Error(`Unknown adapter: ${adapterName}. Available: claude, claude-cli`);
  }
}

export function exploreCommand(): Command {
  const cmd = new Command('explore');

  cmd
    .description('Run AI exploration for a spec')
    .requiredOption('--spec <name>', 'Spec name to explore')
    .option('--url <url>', 'Base URL (overrides config)')
    .option('--headed', 'Run browser in headed mode')
    .option('--adapter <name>', 'AI adapter: claude (SDK), claude-cli (CLI)', 'claude')
    .action(async (options) => {
      try {
        // 1. Load and validate spec
        const spec = await loadAndValidateSpec(options.spec);

        // 2. Determine base URL
        const baseUrl = options.url || 'http://localhost:3000';

        // 3. Create browser session and AI adapter
        const browser = createBrowserSession();
        const adapter = createAdapter(options.adapter);

        // 4. Create explorer
        const explorer = new Explorer({
          adapter,
          browser,
          headless: !options.headed,
          outputDir: '.browserflow/explorations',
        });

        // 5. Run exploration
        console.log(colors.dim(`Running exploration for ${spec.name}...`));
        const result = await explorer.runExploration(spec, baseUrl, {
          specPath: `specs/${options.spec}.yaml`,
          headless: !options.headed,
        });

        // 6. Write exploration output
        await writeExplorationOutput(result);

        // 7. Print summary
        console.log(colors.success(`Exploration complete: ${result.explorationId}`));
        console.log(`Run \`bf review --exploration ${result.explorationId}\` to review`);
      } catch (error) {
        const err = error as Error;
        console.error(colors.fail(err.message));
        process.exitCode = 1;
      }
    });

  return cmd;
}
