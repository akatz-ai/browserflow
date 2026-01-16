import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  type FailureBundle,
  type TestFailure,
  type RepairSuggestion,
  classifyError,
  generateRepairSuggestions,
  generateFailureBundle,
} from './failure-bundle.js';

describe('classifyError', () => {
  it('should classify locator not found errors', () => {
    expect(classifyError('locator resolved to 0 elements')).toBe('locator_not_found');
    expect(classifyError('locator resolved to 2 elements')).toBe('locator_not_found');
    expect(classifyError('Locator resolved to N elements')).toBe('locator_not_found');
  });

  it('should classify timeout errors', () => {
    expect(classifyError('Timeout 30000ms exceeded')).toBe('timeout');
    expect(classifyError('TimeoutError: Waiting for selector')).toBe('timeout');
    expect(classifyError('Test timeout of 60000ms exceeded')).toBe('timeout');
  });

  it('should classify assertion failures', () => {
    expect(classifyError('expect(received).toBe(expected)')).toBe('assertion_failed');
    expect(classifyError('Expected: "foo"\nReceived: "bar"')).toBe('assertion_failed');
    expect(classifyError('AssertionError: expected true to be false')).toBe('assertion_failed');
  });

  it('should classify screenshot diff errors', () => {
    expect(classifyError('Screenshot comparison failed')).toBe('screenshot_diff');
    expect(classifyError('Visual comparison failed')).toBe('screenshot_diff');
    expect(classifyError('toMatchSnapshot call failed')).toBe('screenshot_diff');
  });

  it('should return unknown for unrecognized errors', () => {
    expect(classifyError('Something went wrong')).toBe('unknown');
    expect(classifyError('Network error')).toBe('unknown');
    expect(classifyError('')).toBe('unknown');
  });
});

describe('generateRepairSuggestions', () => {
  it('should suggest locator improvements for locator_not_found', () => {
    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'click',
      message: 'locator resolved to 0 elements',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };
    const suggestions = generateRepairSuggestions(failure);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.type === 'update_locator')).toBe(true);
  });

  it('should suggest wait increase for timeout', () => {
    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'click',
      message: 'Timeout 30000ms exceeded',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };
    const suggestions = generateRepairSuggestions(failure);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.type === 'increase_timeout')).toBe(true);
  });

  it('should suggest baseline update for screenshot_diff', () => {
    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'screenshot',
      message: 'Screenshot comparison failed',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };
    const suggestions = generateRepairSuggestions(failure);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.type === 'update_baseline')).toBe(true);
  });
});

describe('generateFailureBundle', () => {
  let tempDir: string;
  let runDir: string;
  let artifactsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-bundle-test-'));
    runDir = path.join(tempDir, 'run-123');
    artifactsDir = path.join(runDir, 'artifacts');
    await fs.mkdir(artifactsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create a failure.json file with correct structure', async () => {
    const failure: TestFailure = {
      specName: 'checkout-cart',
      stepId: 'step-1',
      action: 'click',
      message: 'locator resolved to 0 elements',
      context: {
        url: 'https://shop.example.com/cart',
        viewport: { width: 1280, height: 720 },
        browser: 'chromium',
      },
    };

    const bundlePath = await generateFailureBundle(runDir, failure, artifactsDir);

    expect(bundlePath).toBe(path.join(runDir, 'failure.json'));

    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    const bundle: FailureBundle = JSON.parse(bundleContent);

    expect(bundle.run_id).toBe('run-123');
    expect(bundle.spec_name).toBe('checkout-cart');
    expect(bundle.failed_at).toBeDefined();
    expect(bundle.failure.step_id).toBe('step-1');
    expect(bundle.failure.action).toBe('click');
    expect(bundle.failure.error_message).toBe('locator resolved to 0 elements');
    expect(bundle.failure.error_type).toBe('locator_not_found');
    expect(bundle.context.url).toBe('https://shop.example.com/cart');
    expect(bundle.suggestions).toBeDefined();
  });

  it('should copy trace file when present', async () => {
    // Create a mock trace file
    const traceDir = path.join(artifactsDir, 'test-results', 'checkout');
    await fs.mkdir(traceDir, { recursive: true });
    await fs.writeFile(path.join(traceDir, 'trace.zip'), 'mock trace data');

    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'click',
      message: 'error',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };

    await generateFailureBundle(runDir, failure, artifactsDir);

    const bundleDir = path.join(runDir, 'artifacts');
    const traceExists = await fs.stat(path.join(bundleDir, 'trace.zip')).then(() => true).catch(() => false);
    expect(traceExists).toBe(true);
  });

  it('should copy failure screenshot when present', async () => {
    // Create a mock screenshot
    const screenshotDir = path.join(artifactsDir, 'test-results', 'checkout');
    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.writeFile(path.join(screenshotDir, 'test-failed-1.png'), 'mock png data');

    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'click',
      message: 'error',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };

    await generateFailureBundle(runDir, failure, artifactsDir);

    const bundleDir = path.join(runDir, 'artifacts');
    const screenshotsDir = path.join(bundleDir, 'screenshots');
    const screenshotExists = await fs.stat(path.join(screenshotsDir, 'failure.png')).then(() => true).catch(() => false);
    expect(screenshotExists).toBe(true);
  });

  it('should copy diff images for screenshot failures', async () => {
    // Create mock diff images
    const diffDir = path.join(artifactsDir, 'test-results', 'checkout');
    await fs.mkdir(diffDir, { recursive: true });
    await fs.writeFile(path.join(diffDir, 'screenshot-expected.png'), 'baseline');
    await fs.writeFile(path.join(diffDir, 'screenshot-actual.png'), 'actual');
    await fs.writeFile(path.join(diffDir, 'screenshot-diff.png'), 'diff');

    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'screenshot',
      message: 'Screenshot comparison failed',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };

    await generateFailureBundle(runDir, failure, artifactsDir);

    const bundleContent = await fs.readFile(path.join(runDir, 'failure.json'), 'utf-8');
    const bundle: FailureBundle = JSON.parse(bundleContent);

    expect(bundle.artifacts.diff).toBeDefined();
    expect(bundle.artifacts.diff?.baseline).toBeDefined();
    expect(bundle.artifacts.diff?.actual).toBeDefined();
    expect(bundle.artifacts.diff?.diff).toBeDefined();
  });

  it('should include ISO8601 timestamp', async () => {
    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'click',
      message: 'error',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };

    await generateFailureBundle(runDir, failure, artifactsDir);

    const bundleContent = await fs.readFile(path.join(runDir, 'failure.json'), 'utf-8');
    const bundle: FailureBundle = JSON.parse(bundleContent);

    // Validate ISO8601 format
    const date = new Date(bundle.failed_at);
    expect(date.toISOString()).toBe(bundle.failed_at);
  });

  it('should write console and network logs to logs directory', async () => {
    // Create a mock trace file with extractable logs
    const traceDir = path.join(artifactsDir, 'test-results', 'checkout');
    await fs.mkdir(traceDir, { recursive: true });
    await fs.writeFile(path.join(traceDir, 'trace.zip'), 'mock trace data');

    const failure: TestFailure = {
      specName: 'checkout',
      stepId: 'step-1',
      action: 'click',
      message: 'error',
      context: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, browser: 'chromium' },
    };

    await generateFailureBundle(runDir, failure, artifactsDir);

    const logsDir = path.join(runDir, 'artifacts', 'logs');
    const consoleLogExists = await fs.stat(path.join(logsDir, 'console.json')).then(() => true).catch(() => false);
    const networkLogExists = await fs.stat(path.join(logsDir, 'network.json')).then(() => true).catch(() => false);

    expect(consoleLogExists).toBe(true);
    expect(networkLogExists).toBe(true);
  });
});
