/**
 * Tests for bf review command
 * @see bf-kqu
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { reviewCommand } from './review.js';

describe('reviewCommand', () => {
  test('has correct name', () => {
    const cmd = reviewCommand();
    expect(cmd.name()).toBe('review');
  });

  test('has correct description', () => {
    const cmd = reviewCommand();
    expect(cmd.description()).toContain('review server');
  });

  test('has optional --exploration option', () => {
    const cmd = reviewCommand();
    const explorationOption = cmd.options.find(o => o.long === '--exploration');

    expect(explorationOption).toBeDefined();
    expect(explorationOption?.mandatory).toBe(false);
    expect(explorationOption?.description).toContain('exploration ID');
  });

  test('has optional --port option with default', () => {
    const cmd = reviewCommand();
    const portOption = cmd.options.find(o => o.long === '--port');

    expect(portOption).toBeDefined();
    expect(portOption?.mandatory).toBe(false);
    expect(portOption?.defaultValue).toBe('8190');
  });

  test('has optional --no-open flag', () => {
    const cmd = reviewCommand();
    const openOption = cmd.options.find(o => o.long === '--no-open');

    expect(openOption).toBeDefined();
  });
});

describe('loadExploration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-review-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'explorations', 'exp-123'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('loads valid exploration file', async () => {
    const explorationData = {
      explorationId: 'exp-123',
      specName: 'test-spec',
      steps: [],
      status: 'passed',
      timestamp: new Date().toISOString(),
    };

    const explorationPath = join(
      testDir,
      '.browserflow',
      'explorations',
      'exp-123',
      'exploration.json'
    );
    await writeFile(explorationPath, JSON.stringify(explorationData, null, 2));

    const { loadExploration } = await import('./review.js');
    const data = await loadExploration('exp-123', testDir);

    expect(data.explorationId).toBe('exp-123');
    expect(data.specName).toBe('test-spec');
    expect(data.status).toBe('passed');
  });

  test('throws error when exploration does not exist', async () => {
    const { loadExploration } = await import('./review.js');

    expect(async () => {
      await loadExploration('exp-nonexistent', testDir);
    }).toThrow(/not found|ENOENT/i);
  });

  test('throws error when exploration has invalid JSON', async () => {
    const explorationPath = join(
      testDir,
      '.browserflow',
      'explorations',
      'exp-123',
      'exploration.json'
    );
    await writeFile(explorationPath, '{ invalid json }');

    const { loadExploration } = await import('./review.js');

    expect(async () => {
      await loadExploration('exp-123', testDir);
    }).toThrow(/JSON|parse/i);
  });
});

describe('saveReview', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-review-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'explorations', 'exp-123'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('saves review data to correct path', async () => {
    const reviewData = {
      exploration_id: 'exp-123',
      spec_name: 'test-spec',
      reviewed_at: new Date().toISOString(),
      steps: [
        {
          step_index: 0,
          status: 'approved',
          comment: 'Looks good',
        },
      ],
    };

    const { saveReview } = await import('./review.js');
    const reviewPath = await saveReview('exp-123', reviewData, testDir);

    expect(reviewPath).toContain('.browserflow/explorations/exp-123/review.json');

    // Verify file was written
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(reviewPath, 'utf-8');
    const saved = JSON.parse(content);

    expect(saved.exploration_id).toBe('exp-123');
    expect(saved.steps.length).toBe(1);
    expect(saved.steps[0].status).toBe('approved');
  });

  test('overwrites existing review file', async () => {
    const reviewData1 = {
      exploration_id: 'exp-123',
      reviewed_at: '2024-01-01T00:00:00Z',
      steps: [],
    };

    const reviewData2 = {
      exploration_id: 'exp-123',
      reviewed_at: '2024-01-02T00:00:00Z',
      steps: [{ step_index: 0, status: 'approved' }],
    };

    const { saveReview } = await import('./review.js');

    await saveReview('exp-123', reviewData1, testDir);
    const reviewPath = await saveReview('exp-123', reviewData2, testDir);

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(reviewPath, 'utf-8');
    const saved = JSON.parse(content);

    expect(saved.reviewed_at).toBe('2024-01-02T00:00:00Z');
    expect(saved.steps.length).toBe(1);
  });
});

describe('listExplorations', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-review-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'explorations'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('returns list of exploration IDs', async () => {
    // Create multiple exploration directories
    await mkdir(join(testDir, '.browserflow', 'explorations', 'exp-123'), {
      recursive: true,
    });
    await mkdir(join(testDir, '.browserflow', 'explorations', 'exp-456'), {
      recursive: true,
    });
    await mkdir(join(testDir, '.browserflow', 'explorations', 'exp-789'), {
      recursive: true,
    });

    // Create a non-exploration directory (should be filtered out)
    await mkdir(join(testDir, '.browserflow', 'explorations', 'other-dir'), {
      recursive: true,
    });

    const { listExplorations } = await import('./review.js');
    const explorations = await listExplorations(testDir);

    expect(explorations.length).toBe(3);
    expect(explorations).toContain('exp-123');
    expect(explorations).toContain('exp-456');
    expect(explorations).toContain('exp-789');
    expect(explorations).not.toContain('other-dir');
  });

  test('returns empty array when no explorations exist', async () => {
    const { listExplorations } = await import('./review.js');
    const explorations = await listExplorations(testDir);

    expect(explorations).toEqual([]);
  });

  test('returns empty array when explorations directory does not exist', async () => {
    const nonExistentDir = join(tmpdir(), `bf-review-test-nonexistent-${Date.now()}`);

    const { listExplorations } = await import('./review.js');
    const explorations = await listExplorations(nonExistentDir);

    expect(explorations).toEqual([]);
  });
});

describe('review server API endpoints', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-review-test-${Date.now()}`);
    await mkdir(join(testDir, '.browserflow', 'explorations', 'exp-123'), {
      recursive: true,
    });

    // Create test exploration data
    const explorationData = {
      explorationId: 'exp-123',
      specName: 'test-spec',
      steps: [
        {
          step_index: 0,
          spec_action: { id: 'step-1', action: 'navigate' },
          execution: { status: 'completed', duration_ms: 100 },
        },
      ],
      status: 'passed',
      timestamp: new Date().toISOString(),
    };

    await writeFile(
      join(testDir, '.browserflow', 'explorations', 'exp-123', 'exploration.json'),
      JSON.stringify(explorationData, null, 2)
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('GET /api/exploration?id=exp-123 returns exploration data', async () => {
    // This test will fail until we implement the server
    // We'll test the server fetch handler directly when implemented
    expect(true).toBe(false); // Placeholder - will be replaced with actual server test
  });

  test('GET /api/exploration without id returns list of explorations', async () => {
    // This test will fail until we implement the server
    expect(true).toBe(false); // Placeholder - will be replaced with actual server test
  });

  test('POST /api/reviews/exp-123 saves review data', async () => {
    // This test will fail until we implement the server
    expect(true).toBe(false); // Placeholder - will be replaced with actual server test
  });

  test('POST /api/reviews/exp-123 returns X-Review-Path header', async () => {
    // This test will fail until we implement the server
    expect(true).toBe(false); // Placeholder - will be replaced with actual server test
  });
});
