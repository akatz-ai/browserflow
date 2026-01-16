#!/usr/bin/env bun
/**
 * Generates JSON Schemas from Zod schemas for IDE validation
 *
 * Output files:
 * - schemas/spec-v2.schema.json      - Spec YAML validation
 * - schemas/browserflow.schema.json  - Config file validation
 * - schemas/lockfile.schema.json     - Lockfile validation
 *
 * @see bf-cv6 for implementation task
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import Zod schemas
import { specSchema } from '../src/spec-schema.js';
import { lockfileSchema } from '../src/lockfile.js';
import { browserflowConfigSchema } from '../src/config-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Output to package-local schemas directory for npm publishing
const PACKAGE_SCHEMAS_DIR = join(__dirname, '../schemas');
// Also copy to root schemas directory for monorepo documentation
const ROOT_SCHEMAS_DIR = join(__dirname, '../../../schemas');

interface SchemaDefinition {
  name: string;
  filename: string;
  schema: unknown;
  title: string;
  description: string;
}

const schemas: SchemaDefinition[] = [
  {
    name: 'spec-v2',
    filename: 'spec-v2.schema.json',
    schema: specSchema,
    title: 'BrowserFlow Spec v2',
    description: 'Schema for BrowserFlow YAML test specifications (version 2)',
  },
  {
    name: 'browserflow',
    filename: 'browserflow.schema.json',
    schema: browserflowConfigSchema,
    title: 'BrowserFlow Configuration',
    description: 'Schema for browserflow.yaml configuration files',
  },
  {
    name: 'lockfile',
    filename: 'lockfile.schema.json',
    schema: lockfileSchema,
    title: 'BrowserFlow Lockfile',
    description: 'Schema for lockfile.json exploration result files',
  },
];

async function generateSchemas(): Promise<void> {
  console.log('Generating JSON schemas from Zod schemas...\n');

  // Ensure output directories exist
  await mkdir(PACKAGE_SCHEMAS_DIR, { recursive: true });
  await mkdir(ROOT_SCHEMAS_DIR, { recursive: true });

  for (const { name, filename, schema, title, description } of schemas) {
    const jsonSchema = zodToJsonSchema(schema as any, {
      name,
      $refStrategy: 'none', // Inline all definitions for better IDE support
      errorMessages: true,
    });

    // Add metadata (spread jsonSchema first so our metadata takes precedence)
    const enrichedSchema = {
      ...jsonSchema,
      $id: `https://browserflow.dev/schemas/${filename}`,
      title,
      description,
    };

    const content = JSON.stringify(enrichedSchema, null, 2) + '\n';

    // Write to both locations
    await writeFile(join(PACKAGE_SCHEMAS_DIR, filename), content);
    await writeFile(join(ROOT_SCHEMAS_DIR, filename), content);

    console.log(`  ✓ ${filename}`);
  }

  console.log(`\nGenerated ${schemas.length} schemas in:`);
  console.log(`  - ${PACKAGE_SCHEMAS_DIR} (for npm package)`);
  console.log(`  - ${ROOT_SCHEMAS_DIR} (for monorepo)`);
}

// Run if executed directly
generateSchemas().catch((error) => {
  console.error('Failed to generate schemas:', error);
  process.exit(1);
});
