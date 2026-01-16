/**
 * Tests for run store (immutable directories)
 * @see bf-92j
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdtemp, rm, readlink, stat, readdir, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import {
  createRunStore,
  createRunId,
  type RunStore,
} from './run-store.js';

describe('createRunId', () => {
  test('generates run ID with correct format', () => {
    const id = createRunId();
    expect(id).toMatch(/^run-\d{14}-[a-f0-9]{6}$/);
  });

  test('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createRunId());
    }
    expect(ids.size).toBe(100);
  });

  test('includes timestamp in ID', () => {
    const id = createRunId();
    const timestamp = id.slice(4, 18);
    const now = new Date();
    const year = timestamp.slice(0, 4);
    expect(parseInt(year)).toBe(now.getFullYear());
  });
});

describe('RunStore', () => {
  let tempDir: string;
  let store: RunStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'browserflow-test-'));
    store = createRunStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createRun', () => {
    test('creates run directory with correct structure', async () => {
      const runPath = await store.createRun('checkout-cart');

      // Check directory exists
      const stats = await stat(runPath);
      expect(stats.isDirectory()).toBe(true);

      // Check subdirectories created
      const artifactsDir = join(runPath, 'artifacts');
      const screenshotsDir = join(artifactsDir, 'screenshots');
      const logsDir = join(artifactsDir, 'logs');

      expect((await stat(artifactsDir)).isDirectory()).toBe(true);
      expect((await stat(screenshotsDir)).isDirectory()).toBe(true);
      expect((await stat(logsDir)).isDirectory()).toBe(true);
    });

    test('creates unique run directories', async () => {
      const run1 = await store.createRun('spec-a');
      const run2 = await store.createRun('spec-a');

      expect(run1).not.toBe(run2);
      expect((await stat(run1)).isDirectory()).toBe(true);
      expect((await stat(run2)).isDirectory()).toBe(true);
    });

    test('creates run under spec-specific directory', async () => {
      const runPath = await store.createRun('checkout-cart');

      expect(runPath).toContain('checkout-cart');
      expect(runPath).toContain('runs');
    });

    test('updates latest symlink', async () => {
      const runPath = await store.createRun('checkout-cart');

      const latestPath = join(tempDir, '.browserflow', 'runs', 'checkout-cart', 'latest');
      const linkTarget = await readlink(latestPath);

      expect(runPath).toContain(linkTarget);
    });

    test('creates multiple runs for same spec', async () => {
      const run1 = await store.createRun('checkout-cart');
      const run2 = await store.createRun('checkout-cart');
      const run3 = await store.createRun('checkout-cart');

      const runs = await store.listRuns('checkout-cart');
      expect(runs.length).toBe(3);
    });
  });

  describe('getLatestRun', () => {
    test('returns null for spec with no runs', () => {
      const latest = store.getLatestRun('nonexistent-spec');
      expect(latest).toBeNull();
    });

    test('returns latest run path', async () => {
      await store.createRun('checkout-cart');
      await new Promise((r) => setTimeout(r, 10)); // Small delay
      const run2 = await store.createRun('checkout-cart');

      const latest = store.getLatestRun('checkout-cart');
      expect(latest).toBe(run2);
    });
  });

  describe('listRuns', () => {
    test('returns empty array for spec with no runs', () => {
      const runs = store.listRuns('nonexistent-spec');
      expect(runs).toEqual([]);
    });

    test('lists all runs newest first', async () => {
      const run1 = await store.createRun('checkout-cart');
      await new Promise((r) => setTimeout(r, 10));
      const run2 = await store.createRun('checkout-cart');
      await new Promise((r) => setTimeout(r, 10));
      const run3 = await store.createRun('checkout-cart');

      const runs = store.listRuns('checkout-cart');

      expect(runs.length).toBe(3);
      expect(runs[0]).toBe(run3);
      expect(runs[1]).toBe(run2);
      expect(runs[2]).toBe(run1);
    });

    test('only lists run directories, not latest symlink', async () => {
      await store.createRun('checkout-cart');
      await store.createRun('checkout-cart');

      const runs = store.listRuns('checkout-cart');

      expect(runs.every((r) => r.includes('run-'))).toBe(true);
      expect(runs.some((r) => r.includes('latest'))).toBe(false);
    });
  });

  describe('getRunDir', () => {
    test('returns full path for run', async () => {
      const runPath = await store.createRun('checkout-cart');
      const runId = runPath.split('/').pop()!;

      const dir = store.getRunDir('checkout-cart', runId);
      expect(dir).toBe(runPath);
    });
  });

  describe('runExists', () => {
    test('returns false for nonexistent run', () => {
      expect(store.runExists('checkout-cart', 'run-nonexistent')).toBe(false);
    });

    test('returns true for existing run', async () => {
      const runPath = await store.createRun('checkout-cart');
      const runId = runPath.split('/').pop()!;

      expect(store.runExists('checkout-cart', runId)).toBe(true);
    });
  });

  describe('immutability', () => {
    test('never overwrites existing runs', async () => {
      const run1 = await store.createRun('checkout-cart');

      // Write a file to the run
      await writeFile(join(run1, 'test.txt'), 'original');

      // Create another run
      const run2 = await store.createRun('checkout-cart');

      // Original run should be unchanged
      const content = await Bun.file(join(run1, 'test.txt')).text();
      expect(content).toBe('original');

      // New run should be different
      expect(run1).not.toBe(run2);
    });
  });
});

describe('directory structure', () => {
  let tempDir: string;
  let store: RunStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'browserflow-test-'));
    store = createRunStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('creates .browserflow root directory', async () => {
    await store.createRun('test-spec');

    const browserflowDir = join(tempDir, '.browserflow');
    const stats = await stat(browserflowDir);
    expect(stats.isDirectory()).toBe(true);
  });

  test('creates runs directory', async () => {
    await store.createRun('test-spec');

    const runsDir = join(tempDir, '.browserflow', 'runs');
    const stats = await stat(runsDir);
    expect(stats.isDirectory()).toBe(true);
  });

  test('creates spec-specific directory', async () => {
    await store.createRun('checkout-cart');

    const specDir = join(tempDir, '.browserflow', 'runs', 'checkout-cart');
    const stats = await stat(specDir);
    expect(stats.isDirectory()).toBe(true);
  });
});
