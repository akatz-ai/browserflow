/**
 * Tests for bf baseline commands
 * @see bf-lp7
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import {
  BaselineStore,
  getBaselineStatus,
  acceptBaselines,
  type BaselineInfo,
  type BaselineAcceptanceRecord,
} from './baseline.js';

/**
 * Helper to create a simple PNG buffer
 */
function createSimplePNG(width = 10, height = 10, color = [255, 0, 0, 255]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
  return PNG.sync.write(png);
}

describe('BaselineStore', () => {
  let testDir: string;
  let store: BaselineStore;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-baseline-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'baselines', 'test-spec'), { recursive: true });
    await mkdir(join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123', 'artifacts', 'screenshots'), { recursive: true });
    store = new BaselineStore(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('getBaselinesForSpec returns empty array when no baselines', async () => {
    const baselines = await store.getBaselinesForSpec('empty-spec');
    expect(baselines).toEqual([]);
  });

  test('getBaselinesForSpec finds PNG files in baseline directory', async () => {
    const pngBuffer = createSimplePNG();
    await writeFile(
      join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot1.png'),
      pngBuffer
    );
    await writeFile(
      join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot2.png'),
      pngBuffer
    );

    const baselines = await store.getBaselinesForSpec('test-spec');
    expect(baselines).toHaveLength(2);
    expect(baselines.map(b => b.name).sort()).toEqual(['screenshot1', 'screenshot2']);
  });

  test('getActualsFromRun finds screenshots in run artifacts', async () => {
    const runDir = join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123');
    await writeFile(
      join(runDir, 'artifacts', 'screenshots', 'screenshot1.png'),
      createSimplePNG()
    );

    const actuals = await store.getActualsFromRun(runDir);
    expect(actuals).toHaveLength(1);
    expect(actuals[0].name).toBe('screenshot1');
  });

  test('getLatestRun returns most recent run', async () => {
    // Create multiple runs (must use stat-based sorting, not alphabetic)
    await mkdir(join(testDir, '.browserflow', 'runs', 'test-spec', 'run-100'), { recursive: true });
    await new Promise(r => setTimeout(r, 10)); // Ensure different mtime
    await mkdir(join(testDir, '.browserflow', 'runs', 'test-spec', 'run-150'), { recursive: true });
    await new Promise(r => setTimeout(r, 10)); // Ensure different mtime
    await mkdir(join(testDir, '.browserflow', 'runs', 'test-spec', 'run-200'), { recursive: true });

    const latestRun = await store.getLatestRun('test-spec');
    expect(latestRun).toContain('run-200');
  });

  test('copyToBaselines creates baseline from actual', async () => {
    const runDir = join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123');
    const pngBuffer = createSimplePNG();
    await writeFile(
      join(runDir, 'artifacts', 'screenshots', 'new-screenshot.png'),
      pngBuffer
    );

    await store.copyToBaselines('test-spec', 'new-screenshot', join(runDir, 'artifacts', 'screenshots', 'new-screenshot.png'));

    const baselinePath = join(testDir, '.browserflow', 'baselines', 'test-spec', 'new-screenshot.png');
    const content = await readFile(baselinePath);
    expect(content.equals(pngBuffer)).toBe(true);
  });

  test('recordAcceptance writes metadata file', async () => {
    const record: BaselineAcceptanceRecord = {
      accepted_at: '2026-01-15T10:00:00.000Z',
      accepted_by: 'testuser',
      run_id: 'run-123',
      previous_hash: null,
      current_hash: 'abc123',
    };

    await store.recordAcceptance('test-spec', 'screenshot1', record);

    const metaPath = join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot1.meta.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
    expect(meta.accepted_by).toBe('testuser');
    expect(meta.run_id).toBe('run-123');
  });
});

describe('getBaselineStatus', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-baseline-status-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'baselines', 'test-spec'), { recursive: true });
    await mkdir(join(testDir, '.browserflow', 'runs', 'test-spec', 'run-latest', 'artifacts', 'screenshots'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('returns status for each baseline', async () => {
    // Create baseline and matching actual
    const pngBuffer = createSimplePNG();
    await writeFile(
      join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot1.png'),
      pngBuffer
    );

    await writeFile(
      join(testDir, '.browserflow', 'runs', 'test-spec', 'run-latest', 'artifacts', 'screenshots', 'screenshot1.png'),
      pngBuffer
    );

    const status = await getBaselineStatus('test-spec', { cwd: testDir });
    expect(status.baselines).toHaveLength(1);
    expect(status.baselines[0].name).toBe('screenshot1');
    expect(status.baselines[0].status).toBe('match');
  });

  test('detects missing actuals', async () => {
    // Create baseline without actual
    await writeFile(
      join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot1.png'),
      createSimplePNG()
    );

    const status = await getBaselineStatus('test-spec', { cwd: testDir });
    expect(status.baselines).toHaveLength(1);
    expect(status.baselines[0].status).toBe('missing');
  });

  test('detects differences', async () => {
    // Create baseline and different actual (different colors)
    await writeFile(
      join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot1.png'),
      createSimplePNG(10, 10, [255, 0, 0, 255]) // Red
    );
    await writeFile(
      join(testDir, '.browserflow', 'runs', 'test-spec', 'run-latest', 'artifacts', 'screenshots', 'screenshot1.png'),
      createSimplePNG(10, 10, [0, 0, 255, 255]) // Blue
    );

    const status = await getBaselineStatus('test-spec', { cwd: testDir });
    expect(status.baselines).toHaveLength(1);
    expect(status.baselines[0].status).toBe('diff');
  });
});

describe('acceptBaselines', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-baseline-accept-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'baselines', 'test-spec'), { recursive: true });
    await mkdir(join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123', 'artifacts', 'screenshots'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('accepts single screenshot', async () => {
    // Create actual
    const pngBuffer = createSimplePNG();
    await writeFile(
      join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123', 'artifacts', 'screenshots', 'screenshot1.png'),
      pngBuffer
    );

    const result = await acceptBaselines('test-spec', {
      runId: 'run-123',
      screenshot: 'screenshot1',
      cwd: testDir,
    });

    expect(result.accepted).toContain('screenshot1');

    // Check baseline was created
    const baselinePath = join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot1.png');
    const content = await readFile(baselinePath);
    expect(content.equals(pngBuffer)).toBe(true);
  });

  test('records metadata on acceptance', async () => {
    // Create actual
    await writeFile(
      join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123', 'artifacts', 'screenshots', 'screenshot1.png'),
      createSimplePNG()
    );

    await acceptBaselines('test-spec', {
      runId: 'run-123',
      screenshot: 'screenshot1',
      cwd: testDir,
    });

    // Check metadata was recorded
    const metaPath = join(testDir, '.browserflow', 'baselines', 'test-spec', 'screenshot1.meta.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
    expect(meta.run_id).toBe('run-123');
    expect(meta.accepted_at).toBeDefined();
    expect(meta.current_hash).toBeDefined();
  });

  test('accepts all screenshots when --all flag used', async () => {
    // Create multiple actuals
    await writeFile(
      join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123', 'artifacts', 'screenshots', 'screenshot1.png'),
      createSimplePNG(10, 10, [255, 0, 0, 255])
    );
    await writeFile(
      join(testDir, '.browserflow', 'runs', 'test-spec', 'run-123', 'artifacts', 'screenshots', 'screenshot2.png'),
      createSimplePNG(10, 10, [0, 255, 0, 255])
    );

    const result = await acceptBaselines('test-spec', {
      runId: 'run-123',
      all: true,
      cwd: testDir,
    });

    expect(result.accepted).toHaveLength(2);
    expect(result.accepted.sort()).toEqual(['screenshot1', 'screenshot2']);
  });
});
