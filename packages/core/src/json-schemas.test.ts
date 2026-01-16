/**
 * Tests for generated JSON schemas
 *
 * Validates that the generated JSON schemas correctly accept/reject data
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, '../schemas');

interface JsonSchema {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  [key: string]: unknown;
}

let ajv: Ajv;
let specSchema: JsonSchema;
let configSchema: JsonSchema;
let lockfileSchema: JsonSchema;

beforeAll(async () => {
  // Initialize Ajv with format support
  ajv = new Ajv({
    allErrors: true,
    strict: false, // Allow draft-07 features
  });
  addFormats(ajv);

  // Load all schemas
  specSchema = JSON.parse(await readFile(join(SCHEMAS_DIR, 'spec-v2.schema.json'), 'utf-8'));
  configSchema = JSON.parse(await readFile(join(SCHEMAS_DIR, 'browserflow.schema.json'), 'utf-8'));
  lockfileSchema = JSON.parse(await readFile(join(SCHEMAS_DIR, 'lockfile.schema.json'), 'utf-8'));
});

describe('spec-v2.schema.json', () => {
  test('validates a valid spec', () => {
    const spec = {
      version: 2,
      name: 'test-spec',
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          url: 'https://example.com',
        },
      ],
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(true);
  });

  test('validates spec with target', () => {
    const spec = {
      version: 2,
      name: 'click-test',
      steps: [
        {
          id: 'click-btn',
          action: 'click',
          target: {
            testid: 'submit-button',
          },
        },
      ],
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(true);
  });

  test('rejects spec without version', () => {
    const spec = {
      name: 'test-spec',
      steps: [{ id: 'step-1', action: 'navigate' }],
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(false);
  });

  test('rejects spec with invalid name format', () => {
    const spec = {
      version: 2,
      name: 'Test Spec', // Should be kebab-case
      steps: [{ id: 'step-1', action: 'navigate' }],
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(false);
  });

  test('rejects spec without steps', () => {
    const spec = {
      version: 2,
      name: 'test-spec',
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(false);
  });

  test('rejects spec with empty steps', () => {
    const spec = {
      version: 2,
      name: 'test-spec',
      steps: [],
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(false);
  });

  test('rejects step without id', () => {
    const spec = {
      version: 2,
      name: 'test-spec',
      steps: [{ action: 'navigate' }],
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(false);
  });

  test('rejects invalid action type', () => {
    const spec = {
      version: 2,
      name: 'test-spec',
      steps: [{ id: 'step-1', action: 'invalid_action' }],
    };
    const validate = ajv.compile(specSchema);
    const valid = validate(spec);
    expect(valid).toBe(false);
  });
});

describe('browserflow.schema.json', () => {
  test('validates a valid config', () => {
    const config = {
      project: {
        name: 'my-project',
        base_url: 'http://localhost:3000',
      },
      runtime: {
        browser: 'chromium',
        headless: true,
      },
    };
    const validate = ajv.compile(configSchema);
    const valid = validate(config);
    expect(valid).toBe(true);
  });

  test('validates minimal config', () => {
    const config = {
      project: { name: 'test' },
    };
    const validate = ajv.compile(configSchema);
    const valid = validate(config);
    expect(valid).toBe(true);
  });

  test('rejects config without project', () => {
    const config = {
      runtime: { browser: 'chromium' },
    };
    const validate = ajv.compile(configSchema);
    const valid = validate(config);
    expect(valid).toBe(false);
  });

  test('rejects invalid browser type', () => {
    const config = {
      project: { name: 'test' },
      runtime: { browser: 'chrome' }, // Invalid
    };
    const validate = ajv.compile(configSchema);
    const valid = validate(config);
    expect(valid).toBe(false);
  });
});

describe('lockfile.schema.json', () => {
  test('validates a valid lockfile', () => {
    const lockfile = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      spec_hash: 'abc123',
      created_at: '2026-01-15T00:00:00Z',
      locators: {},
      masks: {},
      assertions: [],
      generation: {
        format: 'playwright-ts',
        output_path: 'e2e/tests/test-spec.spec.ts',
      },
    };
    const validate = ajv.compile(lockfileSchema);
    const valid = validate(lockfile);
    expect(valid).toBe(true);
  });

  test('validates lockfile with locators', () => {
    const lockfile = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      spec_hash: 'abc123',
      created_at: '2026-01-15T00:00:00Z',
      locators: {
        'step-1': {
          locator_id: 'loc-1',
          preferred: {
            type: 'testid',
            value: 'submit-btn',
          },
          fallbacks: [],
          proof: {},
        },
      },
      masks: {},
      assertions: [],
      generation: {
        format: 'playwright-ts',
        output_path: 'e2e/tests/test-spec.spec.ts',
      },
    };
    const validate = ajv.compile(lockfileSchema);
    const valid = validate(lockfile);
    expect(valid).toBe(true);
  });

  test('rejects lockfile missing required fields', () => {
    const lockfile = {
      run_id: 'run-123',
      // Missing spec_name, spec_hash, etc.
    };
    const validate = ajv.compile(lockfileSchema);
    const valid = validate(lockfile);
    expect(valid).toBe(false);
  });

  test('rejects lockfile with invalid generation format', () => {
    const lockfile = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      spec_hash: 'abc123',
      created_at: '2026-01-15T00:00:00Z',
      locators: {},
      masks: {},
      assertions: [],
      generation: {
        format: 'invalid-format', // Should be playwright-ts
        output_path: 'test.ts',
      },
    };
    const validate = ajv.compile(lockfileSchema);
    const valid = validate(lockfile);
    expect(valid).toBe(false);
  });
});

describe('schema metadata', () => {
  test('spec schema has correct metadata', () => {
    expect(specSchema.$id).toContain('spec-v2.schema.json');
    expect(specSchema.title).toBe('BrowserFlow Spec v2');
    expect(specSchema.description).toContain('test specifications');
  });

  test('config schema has correct metadata', () => {
    expect(configSchema.$id).toContain('browserflow.schema.json');
    expect(configSchema.title).toBe('BrowserFlow Configuration');
    expect(configSchema.description).toContain('configuration files');
  });

  test('lockfile schema has correct metadata', () => {
    expect(lockfileSchema.$id).toContain('lockfile.schema.json');
    expect(lockfileSchema.title).toBe('BrowserFlow Lockfile');
    expect(lockfileSchema.description).toContain('lockfile.json');
  });
});
