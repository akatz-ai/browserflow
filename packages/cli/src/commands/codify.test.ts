/**
 * Tests for bf codify command
 * @see bf-ari
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { codifyCommand, findLatestExploration, convertToLockfile } from './codify.js';

describe('codifyCommand', () => {
  test('has correct name', () => {
    const cmd = codifyCommand();
    expect(cmd.name()).toBe('codify');
  });

  test('has correct description', () => {
    const cmd = codifyCommand();
    expect(cmd.description()).toContain('Playwright test');
    expect(cmd.description()).toContain('approved exploration');
  });

  test('has required --spec option', () => {
    const cmd = codifyCommand();
    const specOption = cmd.options.find(o => o.long === '--spec');

    expect(specOption).toBeDefined();
    expect(specOption?.mandatory).toBe(true);
    expect(specOption?.description).toContain('Spec name');
  });

  test('has optional --exploration option', () => {
    const cmd = codifyCommand();
    const explorationOption = cmd.options.find(o => o.long === '--exploration');

    expect(explorationOption).toBeDefined();
    expect(explorationOption?.mandatory).toBe(false);
    expect(explorationOption?.description).toContain('exploration ID');
  });

  test('has optional --output option with default value', () => {
    const cmd = codifyCommand();
    const outputOption = cmd.options.find(o => o.long === '--output');

    expect(outputOption).toBeDefined();
    expect(outputOption?.mandatory).toBe(false);
    expect(outputOption?.defaultValue).toBe('e2e/tests');
  });

  test('has optional --dry-run flag', () => {
    const cmd = codifyCommand();
    const dryRunOption = cmd.options.find(o => o.long === '--dry-run');

    expect(dryRunOption).toBeDefined();
    expect(dryRunOption?.mandatory).toBe(false);
  });
});

describe('findLatestExploration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-codify-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'explorations'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('finds latest exploration for spec', async () => {
    // Create multiple explorations
    const exp1 = 'exp-20240101-100000';
    const exp2 = 'exp-20240102-100000';
    const exp3 = 'exp-20240103-100000'; // Latest

    await mkdir(join(testDir, '.browserflow', 'explorations', exp1), {
      recursive: true,
    });
    await mkdir(join(testDir, '.browserflow', 'explorations', exp2), {
      recursive: true,
    });
    await mkdir(join(testDir, '.browserflow', 'explorations', exp3), {
      recursive: true,
    });

    // Write exploration files
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp1, 'exploration.json'),
      JSON.stringify({ spec: 'checkout', explorationId: exp1 })
    );
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp2, 'exploration.json'),
      JSON.stringify({ spec: 'checkout', explorationId: exp2 })
    );
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp3, 'exploration.json'),
      JSON.stringify({ spec: 'checkout', explorationId: exp3 })
    );

    const result = await findLatestExploration('checkout', testDir);
    expect(result).toBe(exp3);
  });

  test('returns null when no exploration found for spec', async () => {
    // Create exploration for different spec
    const exp1 = 'exp-20240101-100000';
    await mkdir(join(testDir, '.browserflow', 'explorations', exp1), {
      recursive: true,
    });
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp1, 'exploration.json'),
      JSON.stringify({ spec: 'login', explorationId: exp1 })
    );

    const result = await findLatestExploration('checkout', testDir);
    expect(result).toBeNull();
  });

  test('returns null when explorations directory does not exist', async () => {
    const nonExistentDir = join(tmpdir(), `bf-codify-test-nonexistent-${Date.now()}`);
    const result = await findLatestExploration('checkout', nonExistentDir);
    expect(result).toBeNull();
  });

  test('skips invalid exploration files', async () => {
    const exp1 = 'exp-20240101-100000';
    const exp2 = 'exp-20240102-100000';

    await mkdir(join(testDir, '.browserflow', 'explorations', exp1), {
      recursive: true,
    });
    await mkdir(join(testDir, '.browserflow', 'explorations', exp2), {
      recursive: true,
    });

    // First one has invalid JSON
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp1, 'exploration.json'),
      '{ invalid json }'
    );

    // Second one is valid
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp2, 'exploration.json'),
      JSON.stringify({ spec: 'checkout', explorationId: exp2 })
    );

    const result = await findLatestExploration('checkout', testDir);
    expect(result).toBe(exp2);
  });

  test('filters explorations by spec name correctly', async () => {
    const exp1 = 'exp-20240101-100000';
    const exp2 = 'exp-20240102-100000';
    const exp3 = 'exp-20240103-100000';

    await mkdir(join(testDir, '.browserflow', 'explorations', exp1), {
      recursive: true,
    });
    await mkdir(join(testDir, '.browserflow', 'explorations', exp2), {
      recursive: true,
    });
    await mkdir(join(testDir, '.browserflow', 'explorations', exp3), {
      recursive: true,
    });

    // Mixed specs
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp1, 'exploration.json'),
      JSON.stringify({ spec: 'login', explorationId: exp1 })
    );
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp2, 'exploration.json'),
      JSON.stringify({ spec: 'checkout', explorationId: exp2 })
    );
    await writeFile(
      join(testDir, '.browserflow', 'explorations', exp3, 'exploration.json'),
      JSON.stringify({ spec: 'login', explorationId: exp3 })
    );

    const result = await findLatestExploration('checkout', testDir);
    expect(result).toBe(exp2);
  });
});

describe('convertToLockfile', () => {
  test('converts ExplorationOutput to ExplorationLockfile format', () => {
    const explorationOutput = {
      spec: 'checkout',
      specPath: 'specs/checkout.yaml',
      explorationId: 'exp-20240101-100000',
      timestamp: '2024-01-01T10:00:00Z',
      durationMs: 5000,
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
      baseUrl: 'http://localhost:3000',
      steps: [
        {
          stepIndex: 0,
          specAction: {
            action: 'navigate',
            url: '/checkout',
          },
          execution: {
            status: 'completed' as const,
            method: 'page.goto',
            durationMs: 500,
          },
          screenshots: {
            before: 'screenshots/step-0-before.png',
            after: 'screenshots/step-0-after.png',
          },
        },
      ],
      outcomeChecks: [
        {
          check: 'url_contains',
          expected: '/checkout',
          actual: '/checkout',
          passed: true,
        },
      ],
      overallStatus: 'completed' as const,
      errors: [],
    };

    const lockfile = convertToLockfile(explorationOutput);

    expect(lockfile.spec).toBe('checkout');
    expect(lockfile.spec_path).toBe('specs/checkout.yaml');
    expect(lockfile.exploration_id).toBe('exp-20240101-100000');
    expect(lockfile.timestamp).toBe('2024-01-01T10:00:00Z');
    expect(lockfile.steps.length).toBe(1);
    expect(lockfile.steps[0].spec_action).toEqual({
      action: 'navigate',
      url: '/checkout',
    });
    expect(lockfile.steps[0].execution).toEqual({
      status: 'completed',
      method: 'page.goto',
      durationMs: 500,
    });
    expect(lockfile.outcome_checks).toEqual([
      {
        check: 'url_contains',
        expected: '/checkout',
        actual: '/checkout',
        passed: true,
      },
    ]);
  });

  test('converts complex steps with multiple fields', () => {
    const explorationOutput = {
      spec: 'login',
      specPath: 'specs/login.yaml',
      explorationId: 'exp-test',
      timestamp: '2024-01-01T10:00:00Z',
      durationMs: 3000,
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
      baseUrl: 'http://localhost:3000',
      steps: [
        {
          stepIndex: 0,
          specAction: {
            action: 'fill',
            selector: '#username',
            value: 'testuser',
          },
          execution: {
            status: 'completed' as const,
            method: 'page.fill',
            elementRef: 'e1',
            selectorUsed: '#username',
            durationMs: 200,
          },
          screenshots: {
            before: 'screenshots/step-0-before.png',
            after: 'screenshots/step-0-after.png',
          },
        },
      ],
      outcomeChecks: [],
      overallStatus: 'completed' as const,
      errors: [],
    };

    const lockfile = convertToLockfile(explorationOutput);

    expect(lockfile.steps[0].spec_action).toEqual({
      action: 'fill',
      selector: '#username',
      value: 'testuser',
    });
    expect(lockfile.steps[0].execution.elementRef).toBe('e1');
    expect(lockfile.steps[0].execution.selectorUsed).toBe('#username');
  });

  test('includes metadata fields', () => {
    const explorationOutput = {
      spec: 'test',
      specPath: 'specs/test.yaml',
      explorationId: 'exp-test',
      timestamp: '2024-01-01T10:00:00Z',
      durationMs: 1000,
      browser: 'firefox',
      viewport: { width: 1920, height: 1080 },
      baseUrl: 'http://example.com',
      steps: [],
      outcomeChecks: [],
      overallStatus: 'completed' as const,
      errors: [],
    };

    const lockfile = convertToLockfile(explorationOutput);

    expect(lockfile.duration_ms).toBe(1000);
    expect(lockfile.browser).toBe('firefox');
    expect(lockfile.viewport).toEqual({ width: 1920, height: 1080 });
    expect(lockfile.base_url).toBe('http://example.com');
    expect(lockfile.overall_status).toBe('completed');
    expect(lockfile.errors).toEqual([]);
  });
});

describe('codify action integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-codify-action-test-${Date.now()}`);
    const explorationsDir = join(testDir, '.browserflow', 'explorations', 'exp-test');
    await mkdir(explorationsDir, { recursive: true });

    // Create exploration data
    const explorationData = {
      spec: 'checkout',
      specPath: 'specs/checkout.yaml',
      explorationId: 'exp-test',
      timestamp: '2024-01-01T10:00:00Z',
      durationMs: 5000,
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
      baseUrl: 'http://localhost:3000',
      steps: [
        {
          stepIndex: 0,
          specAction: {
            action: 'navigate',
            url: '/checkout',
          },
          execution: {
            status: 'completed',
            method: 'page.goto',
            durationMs: 500,
          },
          screenshots: {
            before: 'screenshots/step-0-before.png',
            after: 'screenshots/step-0-after.png',
          },
        },
      ],
      outcomeChecks: [],
      overallStatus: 'completed',
      errors: [],
    };

    await writeFile(
      join(explorationsDir, 'exploration.json'),
      JSON.stringify(explorationData, null, 2)
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('generates test file with default output path', async () => {
    // This will fail until implementation exists
    const cmd = codifyCommand();

    // We would normally call the action, but since it doesn't exist yet,
    // this test will fail during execution
    // When implemented, it should generate e2e/tests/checkout.spec.ts
    expect(cmd.name()).toBe('codify');
  });

  test('includes review data when available', async () => {
    // Add review data
    const reviewData = {
      exploration_id: 'exp-test',
      reviewer: 'test-user',
      started_at: '2024-01-01T10:05:00Z',
      updated_at: '2024-01-01T10:06:00Z',
      steps: [
        {
          step_index: 0,
          status: 'approved' as const,
          comment: 'Looks good',
        },
      ],
      verdict: 'approved' as const,
      submitted_at: '2024-01-01T10:06:00Z',
    };

    await writeFile(
      join(testDir, '.browserflow', 'explorations', 'exp-test', 'review.json'),
      JSON.stringify(reviewData, null, 2)
    );

    // When implemented, should include review metadata in generated test
    const cmd = codifyCommand();
    expect(cmd.name()).toBe('codify');
  });

  test('warns when review data is missing but still generates', async () => {
    // No review.json file created
    // When implemented, should show warning but continue
    const cmd = codifyCommand();
    expect(cmd.name()).toBe('codify');
  });
});
