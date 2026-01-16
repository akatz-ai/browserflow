/**
 * Tests for bf repair command
 * @see bf-mtk
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadFailureBundle,
  analyzeFailure,
  generateRepairPlan,
  type RepairSuggestion,
  type FailureBundle,
} from './repair.js';

describe('loadFailureBundle', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-repair-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'runs', '_execution', 'run-123'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('loads failure bundle from run directory', async () => {
    const bundle: FailureBundle = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      failed_at: '2026-01-15T10:00:00.000Z',
      failure: {
        step_id: 'step-1',
        action: 'click',
        error_message: 'Timeout 30000ms exceeded',
        error_type: 'timeout',
      },
      context: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
      artifacts: {},
    };

    await writeFile(
      join(testDir, '.browserflow', 'runs', '_execution', 'run-123', 'failure.json'),
      JSON.stringify(bundle)
    );

    const loaded = await loadFailureBundle(join(testDir, '.browserflow', 'runs', '_execution', 'run-123'));
    expect(loaded.run_id).toBe('run-123');
    expect(loaded.spec_name).toBe('test-spec');
    expect(loaded.failure.error_type).toBe('timeout');
  });

  test('loads failure bundle from failure.json path', async () => {
    const bundle: FailureBundle = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      failed_at: '2026-01-15T10:00:00.000Z',
      failure: {
        step_id: 'step-1',
        action: 'click',
        error_message: 'Element not found',
        error_type: 'locator_not_found',
      },
      context: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
      artifacts: {},
    };

    await writeFile(
      join(testDir, '.browserflow', 'runs', '_execution', 'run-123', 'failure.json'),
      JSON.stringify(bundle)
    );

    const loaded = await loadFailureBundle(
      join(testDir, '.browserflow', 'runs', '_execution', 'run-123', 'failure.json')
    );
    expect(loaded.failure.error_type).toBe('locator_not_found');
  });

  test('throws error for missing failure bundle', async () => {
    await expect(
      loadFailureBundle(join(testDir, '.browserflow', 'runs', '_execution', 'nonexistent'))
    ).rejects.toThrow();
  });
});

describe('analyzeFailure', () => {
  test('suggests timeout increase for timeout errors', () => {
    const bundle: FailureBundle = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      failed_at: '2026-01-15T10:00:00.000Z',
      failure: {
        step_id: 'step-1',
        action: 'click',
        error_message: 'Timeout 30000ms exceeded',
        error_type: 'timeout',
      },
      context: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
      artifacts: {},
    };

    const suggestions = analyzeFailure(bundle);
    expect(suggestions.some(s => s.type === 'increase_timeout')).toBe(true);
  });

  test('suggests locator update for locator not found errors', () => {
    const bundle: FailureBundle = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      failed_at: '2026-01-15T10:00:00.000Z',
      failure: {
        step_id: 'step-1',
        action: 'click',
        error_message: 'locator resolved to 0 elements',
        error_type: 'locator_not_found',
      },
      context: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
      artifacts: {},
    };

    const suggestions = analyzeFailure(bundle);
    expect(suggestions.some(s => s.type === 'use_fallback')).toBe(true);
  });

  test('suggests baseline update for screenshot diff errors', () => {
    const bundle: FailureBundle = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      failed_at: '2026-01-15T10:00:00.000Z',
      failure: {
        step_id: 'step-1',
        action: 'screenshot',
        error_message: 'Screenshot comparison failed',
        error_type: 'screenshot_diff',
      },
      context: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
      artifacts: {},
    };

    const suggestions = analyzeFailure(bundle);
    expect(suggestions.some(s => s.type === 'update_baseline')).toBe(true);
    expect(suggestions.some(s => s.type === 'add_mask')).toBe(true);
  });

  test('suggestions have confidence scores', () => {
    const bundle: FailureBundle = {
      run_id: 'run-123',
      spec_name: 'test-spec',
      failed_at: '2026-01-15T10:00:00.000Z',
      failure: {
        step_id: 'step-1',
        action: 'click',
        error_message: 'Timeout exceeded',
        error_type: 'timeout',
      },
      context: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
      artifacts: {},
    };

    const suggestions = analyzeFailure(bundle);
    for (const suggestion of suggestions) {
      expect(suggestion.confidence).toBeGreaterThan(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('generateRepairPlan', () => {
  test('creates plan from suggestions', () => {
    const suggestions: RepairSuggestion[] = [
      {
        type: 'increase_timeout',
        description: 'Double the timeout',
        confidence: 0.8,
        patch: { timeout: '60s' },
      },
      {
        type: 'use_fallback',
        description: 'Try alternate locator',
        confidence: 0.6,
        patch: { locator: { css: '.button' } },
      },
    ];

    const plan = generateRepairPlan(suggestions);
    expect(plan.suggestions).toHaveLength(2);
    expect(plan.primarySuggestion.type).toBe('increase_timeout');
    expect(plan.requiresConfirmation).toBe(true);
  });

  test('sorts suggestions by confidence', () => {
    const suggestions: RepairSuggestion[] = [
      { type: 'use_fallback', description: 'Low confidence', confidence: 0.3 },
      { type: 'increase_timeout', description: 'High confidence', confidence: 0.9 },
      { type: 'add_mask', description: 'Medium confidence', confidence: 0.6 },
    ];

    const plan = generateRepairPlan(suggestions);
    expect(plan.suggestions[0].confidence).toBe(0.9);
    expect(plan.suggestions[1].confidence).toBe(0.6);
    expect(plan.suggestions[2].confidence).toBe(0.3);
  });

  test('marks high confidence suggestions as auto-applicable', () => {
    const suggestions: RepairSuggestion[] = [
      { type: 'increase_timeout', description: 'Very high confidence', confidence: 0.95 },
    ];

    const plan = generateRepairPlan(suggestions);
    expect(plan.autoApplicable).toBe(true);
  });

  test('requires confirmation for lower confidence suggestions', () => {
    const suggestions: RepairSuggestion[] = [
      { type: 'use_fallback', description: 'Medium confidence', confidence: 0.5 },
    ];

    const plan = generateRepairPlan(suggestions);
    expect(plan.autoApplicable).toBe(false);
    expect(plan.requiresConfirmation).toBe(true);
  });
});
