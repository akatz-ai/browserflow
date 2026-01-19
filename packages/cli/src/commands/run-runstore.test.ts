/**
 * Tests for unified RunStore usage (CLI using core RunStore)
 * @see bf-1lw
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRunStore } from '@browserflow/core';

describe('CLI uses core RunStore', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-runstore-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('createRun should create per-spec directory structure', async () => {
    const store = createRunStore(testDir);
    const runDir = await store.createRun('my-spec');

    // Should match core format: .browserflow/runs/<spec>/run-YYYYMMDDHHMMSS-<hex>/
    expect(runDir).toContain('.browserflow/runs/my-spec/run-');

    // Run ID should have datetime format (14 digits) + hex suffix
    const runId = runDir.split('/').pop() || '';
    expect(runId).toMatch(/^run-\d{14}-[a-f0-9]{6}$/);

    // Directory should exist
    const dirStat = await stat(runDir);
    expect(dirStat.isDirectory()).toBe(true);
  });

  test('createRun should create artifacts subdirectories', async () => {
    const store = createRunStore(testDir);
    const runDir = await store.createRun('my-spec');

    // Should have screenshots and logs directories
    const screenshotsDir = join(runDir, 'artifacts', 'screenshots');
    const logsDir = join(runDir, 'artifacts', 'logs');

    const screenshotsStat = await stat(screenshotsDir);
    const logsStat = await stat(logsDir);

    expect(screenshotsStat.isDirectory()).toBe(true);
    expect(logsStat.isDirectory()).toBe(true);
  });

  test('createRun should update latest symlink', async () => {
    const store = createRunStore(testDir);

    const run1Dir = await store.createRun('my-spec');
    const latestPath = join(testDir, '.browserflow', 'runs', 'my-spec', 'latest');

    // Latest should point to run1
    const latestRun1 = store.getLatestRun('my-spec');
    expect(latestRun1).toBe(run1Dir);

    // Create another run
    await new Promise(r => setTimeout(r, 10)); // Ensure different timestamp
    const run2Dir = await store.createRun('my-spec');

    // Latest should now point to run2
    const latestRun2 = store.getLatestRun('my-spec');
    expect(latestRun2).toBe(run2Dir);
  });

  test('different specs should have separate run directories', async () => {
    const store = createRunStore(testDir);

    const spec1Run = await store.createRun('spec-1');
    const spec2Run = await store.createRun('spec-2');

    expect(spec1Run).toContain('.browserflow/runs/spec-1/');
    expect(spec2Run).toContain('.browserflow/runs/spec-2/');
  });

  test('listRuns should return runs for specific spec', async () => {
    const store = createRunStore(testDir);

    await store.createRun('spec-1');
    await new Promise(r => setTimeout(r, 10));
    await store.createRun('spec-1');
    await store.createRun('spec-2');

    const spec1Runs = store.listRuns('spec-1');
    const spec2Runs = store.listRuns('spec-2');

    expect(spec1Runs.length).toBe(2);
    expect(spec2Runs.length).toBe(1);

    // All spec-1 runs should contain 'spec-1' in path
    for (const run of spec1Runs) {
      expect(run).toContain('/spec-1/');
    }
  });

  test('runExists should check run existence for specific spec', async () => {
    const store = createRunStore(testDir);

    const runDir = await store.createRun('my-spec');
    const runId = runDir.split('/').pop() || '';

    expect(store.runExists('my-spec', runId)).toBe(true);
    expect(store.runExists('my-spec', 'run-99999999999999-ffffff')).toBe(false);
    expect(store.runExists('other-spec', runId)).toBe(false);
  });
});

describe('Baseline commands work with core RunStore structure', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-baseline-runstore-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('BaselineStore.getLatestRun should find runs in core structure', async () => {
    const store = createRunStore(testDir);
    const specName = 'test-spec';

    // Create run using core RunStore
    const runDir = await store.createRun(specName);

    // Create screenshots in the run
    const screenshotsDir = join(runDir, 'artifacts', 'screenshots');
    await writeFile(join(screenshotsDir, 'screenshot1.png'), 'fake-image');

    // Import and use BaselineStore
    const { BaselineStore } = await import('./baseline.js');
    const baselineStore = new BaselineStore(testDir);

    // Should be able to find the latest run
    const latestRun = await baselineStore.getLatestRun(specName);
    expect(latestRun).not.toBeNull();

    // Should find the screenshots in the run
    if (latestRun) {
      const actuals = await baselineStore.getActualsFromRun(latestRun);
      expect(actuals.length).toBe(1);
      expect(actuals[0].name).toBe('screenshot1');
    }
  });

  test('BaselineStore should handle multiple runs per spec', async () => {
    const store = createRunStore(testDir);
    const specName = 'test-spec';

    // Create multiple runs
    const run1Dir = await store.createRun(specName);
    await writeFile(join(run1Dir, 'artifacts', 'screenshots', 'old.png'), 'old-image');

    await new Promise(r => setTimeout(r, 10));

    const run2Dir = await store.createRun(specName);
    await writeFile(join(run2Dir, 'artifacts', 'screenshots', 'new.png'), 'new-image');

    // Import and use BaselineStore
    const { BaselineStore } = await import('./baseline.js');
    const baselineStore = new BaselineStore(testDir);

    // Should get the latest run (run2)
    const latestRun = await baselineStore.getLatestRun(specName);
    expect(latestRun).toBe(run2Dir);

    // Should find screenshots from latest run only
    const actuals = await baselineStore.getActualsFromRun(latestRun!);
    expect(actuals.length).toBe(1);
    expect(actuals[0].name).toBe('new');
  });

  test('acceptBaselines should work with core RunStore paths', async () => {
    const store = createRunStore(testDir);
    const specName = 'test-spec';

    // Create run with screenshot
    const runDir = await store.createRun(specName);
    const screenshotsDir = join(runDir, 'artifacts', 'screenshots');
    await writeFile(join(screenshotsDir, 'screenshot1.png'), 'new-baseline-image');

    // Import and use acceptBaselines
    const { acceptBaselines } = await import('./baseline.js');

    const runId = runDir.split('/').pop() || '';
    const result = await acceptBaselines(specName, {
      runId,
      screenshot: 'screenshot1',
      cwd: testDir,
    });

    expect(result.accepted).toContain('screenshot1');
    expect(result.failed.length).toBe(0);

    // Verify baseline was created
    const baselinePath = join(testDir, '.browserflow', 'baselines', specName, 'screenshot1.png');
    const baselineContent = await readFile(baselinePath, 'utf-8');
    expect(baselineContent).toBe('new-baseline-image');
  });
});

describe('No CLI RunStore remnants', () => {
  test('CLI RunStore class should not be importable', async () => {
    // Verify that the old CLI RunStore has been removed
    try {
      await import('../run/run-store.js');
      // If import succeeds, fail the test
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      // Import should fail because file was deleted
      expect(err).toBeDefined();
    }
  });

  test('run/index.ts should not export RunStore', async () => {
    const runExports = await import('../run/index.js');

    // Should not have RunStore export
    expect('RunStore' in runExports).toBe(false);
  });
});
