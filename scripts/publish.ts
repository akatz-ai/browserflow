#!/usr/bin/env bun
/**
 * Publish all packages to npm
 *
 * This script:
 * 1. Reads the version from the tag or root package.json
 * 2. Updates all package versions
 * 3. Replaces workspace:* references with actual versions
 * 4. Publishes packages in dependency order
 *
 * Usage:
 *   bun run scripts/publish.ts              # Publish with current version
 *   bun run scripts/publish.ts --dry-run    # Preview without publishing
 *
 * @see bf-tdf
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { $ } from 'bun';

// Package publish order (dependency order)
const PACKAGES = [
  'core',       // No internal deps
  'generator',  // Depends on core
  'exploration', // Depends on core
  'review-ui',  // Depends on core
  'cli',        // Depends on all
];

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

async function readPackageJson(pkgDir: string): Promise<PackageJson> {
  const content = await readFile(join(pkgDir, 'package.json'), 'utf-8');
  return JSON.parse(content);
}

async function writePackageJson(pkgDir: string, pkg: PackageJson): Promise<void> {
  await writeFile(join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Replace workspace:* references with actual version
 */
function replaceWorkspaceRefs(
  deps: Record<string, string> | undefined,
  version: string
): Record<string, string> | undefined {
  if (!deps) return deps;

  const updated: Record<string, string> = {};
  for (const [name, ver] of Object.entries(deps)) {
    if (ver === 'workspace:*') {
      updated[name] = version;
    } else {
      updated[name] = ver;
    }
  }
  return updated;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const rootDir = process.cwd();

  // Get version from environment (set by CI from tag) or root package.json
  let version = process.env.RELEASE_VERSION;
  if (!version) {
    const rootPkg = await readPackageJson(rootDir);
    version = rootPkg.version || '0.0.1';
  }
  // Remove 'v' prefix if present
  version = version.replace(/^v/, '');

  console.log(`📦 Publishing BrowserFlow packages v${version}`);
  if (dryRun) {
    console.log('🔍 DRY RUN - No packages will be published\n');
  }
  console.log('');

  // Store original package.json contents for restoration
  const originalContents: Map<string, string> = new Map();

  try {
    // Update all package.json files
    for (const pkg of PACKAGES) {
      const pkgDir = join(rootDir, 'packages', pkg);
      const pkgJsonPath = join(pkgDir, 'package.json');

      // Store original
      originalContents.set(pkgJsonPath, await readFile(pkgJsonPath, 'utf-8'));

      // Update version and workspace refs
      const pkgJson = await readPackageJson(pkgDir);
      pkgJson.version = version;
      pkgJson.dependencies = replaceWorkspaceRefs(pkgJson.dependencies, version);
      pkgJson.devDependencies = replaceWorkspaceRefs(pkgJson.devDependencies, version);

      await writePackageJson(pkgDir, pkgJson);
      console.log(`  ✓ Updated ${pkgJson.name} to v${version}`);
    }

    console.log('');

    // Publish packages
    for (const pkg of PACKAGES) {
      const pkgDir = join(rootDir, 'packages', pkg);
      const pkgJson = await readPackageJson(pkgDir);

      console.log(`📤 Publishing ${pkgJson.name}...`);

      if (dryRun) {
        console.log(`  Would run: npm publish --access public`);
        console.log(`  ✓ (dry run) ${pkgJson.name}@${version}\n`);
      } else {
        try {
          await $`npm publish --access public`.cwd(pkgDir);
          console.log(`  ✓ Published ${pkgJson.name}@${version}\n`);
        } catch (error) {
          // Check if it's just a version conflict (already published)
          const err = error as Error;
          if (err.message?.includes('403') || err.message?.includes('already exists')) {
            console.log(`  ⚠ ${pkgJson.name}@${version} already exists, skipping\n`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('✨ All packages published successfully!');
    console.log('');
    console.log('Install with:');
    console.log('  bun add -g @browserflow/cli');
    console.log('  # or');
    console.log('  npm install -g @browserflow/cli');

  } finally {
    // Restore original package.json files
    console.log('\n🔄 Restoring package.json files...');
    for (const [path, content] of originalContents) {
      await writeFile(path, content);
    }
    console.log('  ✓ Restored');
  }
}

main().catch((error) => {
  console.error('❌ Publish failed:', error);
  process.exit(1);
});
