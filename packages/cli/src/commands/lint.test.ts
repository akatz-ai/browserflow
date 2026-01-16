/**
 * Tests for bf lint command
 * @see bf-eq4
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  lintSpec,
  lintFiles,
  getLineNumber,
  formatLintError,
  type LintError,
} from './lint.js';

describe('getLineNumber', () => {
  const yamlContent = `version: 2
name: test-spec
steps:
  - id: step-1
    action: click
    target:
      testid: btn
  - id: step-2
    action: navigate
    url: https://example.com`;

  test('finds line number for top-level field', () => {
    expect(getLineNumber(yamlContent, ['name'])).toBe(2);
  });

  test('finds line number for nested field in array', () => {
    expect(getLineNumber(yamlContent, ['steps', 0, 'id'])).toBe(4);
    expect(getLineNumber(yamlContent, ['steps', 1, 'action'])).toBe(9);
  });

  test('finds line number for deeply nested field', () => {
    expect(getLineNumber(yamlContent, ['steps', 0, 'target', 'testid'])).toBe(7);
  });

  test('returns 1 for unfound paths', () => {
    expect(getLineNumber(yamlContent, ['nonexistent'])).toBe(1);
  });
});

describe('formatLintError', () => {
  test('provides actionable message for missing step id', () => {
    const error: LintError = {
      path: 'steps.0.id',
      message: 'Required',
      line: 4,
    };
    const formatted = formatLintError(error);
    expect(formatted.message).toContain("Step id is required - add 'id: unique_step_id'");
  });

  test('provides actionable message for invalid duration', () => {
    const error: LintError = {
      path: 'steps.0.timeout',
      message: 'Invalid duration',
      line: 5,
      value: '3000',
    };
    const formatted = formatLintError(error);
    expect(formatted.message).toContain('Invalid duration "3000"');
    expect(formatted.message).toContain('use format like "3s", "2m", or "500ms"');
  });

  test('provides actionable message for duplicate step IDs', () => {
    const error: LintError = {
      path: '',
      message: 'Step IDs must be unique within spec',
      line: 1,
    };
    const formatted = formatLintError(error);
    expect(formatted.message).toContain('unique');
  });

  test('provides actionable message for invalid name format', () => {
    const error: LintError = {
      path: 'name',
      message: 'Name must be kebab-case',
      line: 2,
      value: 'Invalid Name',
    };
    const formatted = formatLintError(error);
    expect(formatted.message).toContain('kebab-case');
  });
});

describe('lintSpec', () => {
  test('passes valid spec', () => {
    const content = `version: 2
name: valid-spec
steps:
  - id: step-1
    action: navigate
    url: https://example.com`;

    const result = lintSpec(content, 'valid-spec.yaml');
    expect(result.errors).toHaveLength(0);
    expect(result.file).toBe('valid-spec.yaml');
  });

  test('catches missing step ID', () => {
    const content = `version: 2
name: test-spec
steps:
  - action: click
    target:
      testid: btn`;

    const result = lintSpec(content, 'test.yaml');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.path.includes('id'))).toBe(true);
  });

  test('catches invalid duration string', () => {
    const content = `version: 2
name: test-spec
steps:
  - id: step-1
    action: wait
    duration: 3000`;

    const result = lintSpec(content, 'test.yaml');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.includes('duration'))).toBe(true);
  });

  test('catches duplicate step IDs', () => {
    const content = `version: 2
name: test-spec
steps:
  - id: step-1
    action: click
    target:
      testid: btn1
  - id: step-1
    action: click
    target:
      testid: btn2`;

    const result = lintSpec(content, 'test.yaml');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.toLowerCase().includes('unique'))).toBe(true);
  });

  test('catches non-kebab-case name', () => {
    const content = `version: 2
name: InvalidName
steps:
  - id: step-1
    action: navigate
    url: https://example.com`;

    const result = lintSpec(content, 'test.yaml');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.toLowerCase().includes('kebab-case'))).toBe(true);
  });

  test('catches wrong version', () => {
    const content = `version: 1
name: test-spec
steps:
  - id: step-1
    action: navigate
    url: https://example.com`;

    const result = lintSpec(content, 'test.yaml');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('catches missing required fields', () => {
    const content = `name: test-spec
steps:
  - id: step-1
    action: navigate`;

    const result = lintSpec(content, 'test.yaml');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('reports line numbers for errors', () => {
    const content = `version: 2
name: test-spec
steps:
  - id: step-1
    action: click
    target:
      testid: btn
  - action: navigate
    url: https://example.com`;

    const result = lintSpec(content, 'test.yaml');
    // The step without id is at line 8
    const idError = result.errors.find(e => e.path.includes('id'));
    expect(idError).toBeDefined();
    expect(idError!.line).toBeGreaterThan(1);
  });

  test('handles YAML syntax errors gracefully', () => {
    const content = `version: 2
name: test-spec
steps:
  - id: step-1
    action: click
      bad: indentation`;

    const result = lintSpec(content, 'test.yaml');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message.toLowerCase()).toMatch(/yaml|parse|syntax/i);
  });
});

describe('lintFiles', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-lint-test-${Date.now()}`);
    await mkdir(join(testDir, 'specs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('lints all yaml files in specs directory', async () => {
    // Create valid spec
    await writeFile(
      join(testDir, 'specs', 'valid.yaml'),
      `version: 2
name: valid-spec
steps:
  - id: step-1
    action: navigate
    url: https://example.com`
    );

    // Create invalid spec
    await writeFile(
      join(testDir, 'specs', 'invalid.yaml'),
      `version: 2
name: invalid-spec
steps:
  - action: click`
    );

    const results = await lintFiles([], { cwd: testDir });
    expect(results.length).toBe(2);
    expect(results.filter(r => r.errors.length === 0).length).toBe(1);
    expect(results.filter(r => r.errors.length > 0).length).toBe(1);
  });

  test('lints specific files when provided', async () => {
    await writeFile(
      join(testDir, 'specs', 'spec1.yaml'),
      `version: 2
name: spec-one
steps:
  - id: step-1
    action: navigate
    url: https://example.com`
    );

    await writeFile(
      join(testDir, 'specs', 'spec2.yaml'),
      `version: 2
name: spec-two
steps:
  - id: step-1
    action: navigate
    url: https://example.com`
    );

    const results = await lintFiles([join(testDir, 'specs', 'spec1.yaml')], { cwd: testDir });
    expect(results.length).toBe(1);
    expect(results[0].file).toContain('spec1.yaml');
  });

  test('returns empty array when no specs found', async () => {
    await rm(join(testDir, 'specs'), { recursive: true });
    const results = await lintFiles([], { cwd: testDir });
    expect(results.length).toBe(0);
  });

  test('handles non-existent file gracefully', async () => {
    const results = await lintFiles([join(testDir, 'nonexistent.yaml')], { cwd: testDir });
    expect(results.length).toBe(1);
    expect(results[0].errors.length).toBeGreaterThan(0);
    expect(results[0].errors[0].message.toLowerCase()).toMatch(/not found|no such|enoent/i);
  });
});
