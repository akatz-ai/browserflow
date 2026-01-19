/**
 * Tests for bf explore command
 * @see bf-x9t
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exploreCommand, loadAndValidateSpec } from './explore.js';

describe('exploreCommand', () => {
  test('has correct name', () => {
    const cmd = exploreCommand();
    expect(cmd.name()).toBe('explore');
  });

  test('has correct description', () => {
    const cmd = exploreCommand();
    expect(cmd.description()).toContain('AI exploration');
  });

  test('has required --spec option', () => {
    const cmd = exploreCommand();
    const specOption = cmd.options.find(o => o.long === '--spec');

    expect(specOption).toBeDefined();
    expect(specOption?.mandatory).toBe(true);
    expect(specOption?.description).toContain('Spec name');
  });

  test('has optional --url option', () => {
    const cmd = exploreCommand();
    const urlOption = cmd.options.find(o => o.long === '--url');

    expect(urlOption).toBeDefined();
    expect(urlOption?.mandatory).toBe(false);
    expect(urlOption?.description).toContain('URL');
  });

  test('has optional --headed flag', () => {
    const cmd = exploreCommand();
    const headedOption = cmd.options.find(o => o.long === '--headed');

    expect(headedOption).toBeDefined();
    expect(headedOption?.mandatory).toBe(false);
  });

  test('has optional --adapter option with default value', () => {
    const cmd = exploreCommand();
    const adapterOption = cmd.options.find(o => o.long === '--adapter');

    expect(adapterOption).toBeDefined();
    expect(adapterOption?.mandatory).toBe(false);
    expect(adapterOption?.defaultValue).toBe('claude');
  });
});

describe('loadAndValidateSpec', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-explore-test-${Date.now()}`);
    await mkdir(join(testDir, 'specs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('loads valid spec file', async () => {
    const specPath = join(testDir, 'specs', 'valid.yaml');
    await writeFile(
      specPath,
      `version: 2
name: valid-spec
steps:
  - id: step-1
    action: navigate
    url: /home`
    );

    const spec = await loadAndValidateSpec('valid', testDir);
    expect(spec.name).toBe('valid-spec');
    expect(spec.steps.length).toBe(1);
    expect(spec.steps[0].id).toBe('step-1');
  });

  test('throws error when spec file does not exist', async () => {
    expect(async () => {
      await loadAndValidateSpec('nonexistent', testDir);
    }).toThrow(/not found|ENOENT/i);
  });

  test('throws error when spec file has invalid YAML', async () => {
    const specPath = join(testDir, 'specs', 'invalid.yaml');
    await writeFile(
      specPath,
      `version: 2
name: test
steps:
  - id: step-1
    action: click
      bad: indentation`
    );

    expect(async () => {
      await loadAndValidateSpec('invalid', testDir);
    }).toThrow(/YAML|parse|syntax/i);
  });

  test('throws error when spec fails schema validation', async () => {
    const specPath = join(testDir, 'specs', 'invalid-schema.yaml');
    await writeFile(
      specPath,
      `version: 2
name: test-spec
steps:
  - action: click`  // missing id
    );

    expect(async () => {
      await loadAndValidateSpec('invalid-schema', testDir);
    }).toThrow(/validation|invalid|required/i);
  });

  test('throws error when spec has wrong version', async () => {
    const specPath = join(testDir, 'specs', 'wrong-version.yaml');
    await writeFile(
      specPath,
      `version: 1
name: test-spec
steps:
  - id: step-1
    action: navigate
    url: /home`
    );

    expect(async () => {
      await loadAndValidateSpec('wrong-version', testDir);
    }).toThrow();
  });
});
