import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { RunStore } from './run-store.js';

describe('RunStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createRun', () => {
    it('should create a run directory with timestamp', async () => {
      const store = new RunStore(tempDir);
      const runDir = await store.createRun();

      expect(runDir).toContain('.browserflow/runs/_execution/run-');

      const stat = await fs.stat(runDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create artifacts subdirectory', async () => {
      const store = new RunStore(tempDir);
      const runDir = await store.createRun();

      const artifactsDir = path.join(runDir, 'artifacts');
      const stat = await fs.stat(artifactsDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should support custom categories', async () => {
      const store = new RunStore(tempDir);
      const runDir = await store.createRun('_generation');

      expect(runDir).toContain('.browserflow/runs/_generation/run-');
    });
  });

  describe('listRuns', () => {
    it('should list runs in reverse chronological order', async () => {
      const store = new RunStore(tempDir);
      await store.createRun();
      await new Promise(r => setTimeout(r, 10));
      await store.createRun();

      const runs = await store.listRuns();
      expect(runs.length).toBe(2);
      // More recent run should be first
      expect(parseInt(runs[0].replace('run-', ''))).toBeGreaterThan(
        parseInt(runs[1].replace('run-', ''))
      );
    });

    it('should return empty array when no runs exist', async () => {
      const store = new RunStore(tempDir);
      const runs = await store.listRuns();
      expect(runs).toEqual([]);
    });
  });

  describe('getLatestRun', () => {
    it('should return the most recent run', async () => {
      const store = new RunStore(tempDir);
      await store.createRun();
      await new Promise(r => setTimeout(r, 10));
      const latestDir = await store.createRun();

      const latest = await store.getLatestRun();
      expect(latest).toBe(latestDir);
    });

    it('should return null when no runs exist', async () => {
      const store = new RunStore(tempDir);
      const latest = await store.getLatestRun();
      expect(latest).toBeNull();
    });
  });
});
