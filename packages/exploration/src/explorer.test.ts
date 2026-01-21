// @browserflow-ai/exploration - Explorer tests
import { describe, it, expect, beforeEach, spyOn, afterEach } from 'bun:test';
import { Explorer } from './explorer';
import type { BrowserSession } from './explorer';
import type { AIAdapter, Spec } from './adapters/types';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock browser session
function createMockBrowserSession(options: Partial<BrowserSession> = {}): BrowserSession {
  return {
    isLaunched: () => true,
    launch: async () => {},
    navigate: async () => {},
    screenshot: async () => Buffer.from('fake-image'),
    close: async () => {},
    getSnapshot: async () => ({
      tree: '<button ref="e1">Submit</button>',
      refs: { e1: { tag: 'button', text: 'Submit' } },
    }),
    ...options,
  };
}

// Mock AI adapter
function createMockAdapter(options: Partial<AIAdapter> = {}): AIAdapter {
  return {
    name: 'mock',
    explore: async () => ({
      spec: 'test',
      specPath: 'test.yaml',
      explorationId: 'exp-test',
      timestamp: new Date().toISOString(),
      durationMs: 100,
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
      baseUrl: 'http://localhost:3000',
      steps: [],
      outcomeChecks: [],
      overallStatus: 'completed',
      errors: [],
    }),
    findElement: async () => ({
      ref: 'e1',
      reasoning: 'Found submit button',
      confidence: 0.95,
    }),
    ...options,
  };
}

// Sample spec for testing
const sampleSpec: Spec = {
  name: 'login-flow',
  description: 'Test user login',
  steps: [
    { action: 'navigate', to: '/login' },
    { action: 'fill', query: 'email input field', value: 'test@example.com' },
    { action: 'fill', query: 'password input field', value: 'password123' },
    { action: 'click', query: 'submit button' },
    { action: 'wait', for: 'url', contains: '/dashboard' },
  ],
};

describe('Explorer', () => {
  let explorer: Explorer;
  let mockBrowser: BrowserSession;
  let mockAdapter: AIAdapter;

  beforeEach(() => {
    mockBrowser = createMockBrowserSession();
    mockAdapter = createMockAdapter();
    explorer = new Explorer({
      adapter: mockAdapter,
      browser: mockBrowser,
      outputDir: './test-output',
    });
  });

  describe('constructor', () => {
    it('should initialize with required config', () => {
      expect(explorer.getAdapter()).toBe(mockAdapter);
    });

    it('should use default outputDir when not provided', () => {
      const exp = new Explorer({ adapter: mockAdapter });
      expect(exp).toBeDefined();
    });
  });

  describe('runExploration', () => {
    it('should launch browser at start', async () => {
      const launchSpy = spyOn(mockBrowser, 'launch');

      await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(launchSpy).toHaveBeenCalled();
    });

    it('should navigate to starting page', async () => {
      const navigateSpy = spyOn(mockBrowser, 'navigate');

      await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(navigateSpy).toHaveBeenCalled();
    });

    it('should execute all steps in spec', async () => {
      const result = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(result.steps.length).toBe(sampleSpec.steps.length);
    });

    it('should return completed status when all steps succeed', async () => {
      const result = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(result.overallStatus).toBe('completed');
    });

    it('should return failed status when any step fails', async () => {
      // Make findElement fail for one step
      mockAdapter.findElement = async (query: string) => {
        if (query.includes('submit')) {
          throw new Error('Element not found');
        }
        return { ref: 'e1', reasoning: 'Found', confidence: 0.9 };
      };

      const result = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(result.overallStatus).toBe('failed');
    });

    it('should continue exploration after step failure', async () => {
      let stepCount = 0;
      mockAdapter.findElement = async () => {
        stepCount++;
        if (stepCount === 2) {
          throw new Error('Element not found');
        }
        return { ref: 'e1', reasoning: 'Found', confidence: 0.9 };
      };

      const result = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      // Should have attempted all steps
      expect(result.steps.length).toBe(sampleSpec.steps.length);
    });

    it('should capture timing information', async () => {
      const result = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      // Duration should be >= 0 (might be 0 for very fast tests)
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
      for (const step of result.steps) {
        expect(step.execution.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should close browser on completion', async () => {
      const closeSpy = spyOn(mockBrowser, 'close');

      await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should close browser even on error', async () => {
      const closeSpy = spyOn(mockBrowser, 'close');
      mockBrowser.navigate = async () => {
        throw new Error('Navigation failed');
      };

      try {
        await explorer.runExploration(sampleSpec, 'http://localhost:3000');
      } catch {
        // Expected to throw
      }

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should generate unique exploration ID', async () => {
      const result1 = await explorer.runExploration(sampleSpec, 'http://localhost:3000');
      const result2 = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(result1.explorationId).not.toBe(result2.explorationId);
    });

    it('should include spec metadata in output', async () => {
      const result = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      expect(result.spec).toBe(sampleSpec.name);
      expect(result.baseUrl).toBe('http://localhost:3000');
    });

    it('should use preconditions viewport when specified', async () => {
      const specWithViewport: Spec = {
        ...sampleSpec,
        preconditions: {
          viewport: { width: 800, height: 600 },
        },
      };

      const launchSpy = spyOn(mockBrowser, 'launch');
      await explorer.runExploration(specWithViewport, 'http://localhost:3000');

      expect(launchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 800, height: 600 },
        })
      );
    });
  });

  describe('step execution', () => {
    it('should capture screenshot before each action', async () => {
      const screenshotSpy = spyOn(mockBrowser, 'screenshot');

      await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      // At least 2 screenshots per step (before + after)
      expect(screenshotSpy.mock.calls.length).toBeGreaterThanOrEqual(sampleSpec.steps.length * 2);
    });

    it('should use AI adapter to find elements for query-based steps', async () => {
      const findSpy = spyOn(mockAdapter, 'findElement');

      await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      // Should be called for steps with query field
      expect(findSpy).toHaveBeenCalled();
    });

    it('should include locator info in step result', async () => {
      const result = await explorer.runExploration(sampleSpec, 'http://localhost:3000');

      const clickStep = result.steps.find((s) => s.specAction.action === 'click');
      expect(clickStep?.execution.elementRef).toBeDefined();
    });
  });

  describe('screenshot file persistence', () => {
    let testDir: string;

    beforeEach(async () => {
      // Create temporary test directory
      testDir = join(tmpdir(), `bf-test-${Date.now()}`);
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up test directory
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should write screenshot files to disk for each step', async () => {
      const explorerWithTempDir = new Explorer({
        adapter: mockAdapter,
        browser: mockBrowser,
        outputDir: testDir,
      });

      const result = await explorerWithTempDir.runExploration(sampleSpec, 'http://localhost:3000');

      // Check that screenshot directory was created (inside exploration-specific directory)
      const explorationDir = join(testDir, result.explorationId);
      const screenshotDir = join(explorationDir, 'screenshots');
      const dirExists = await fs.stat(screenshotDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Check that screenshot files exist for each step
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];

        // Verify screenshot paths are recorded
        expect(step.screenshots.before).toBeDefined();
        expect(step.screenshots.after).toBeDefined();

        // Verify actual files exist (paths are relative to exploration directory)
        const beforePath = join(explorationDir, step.screenshots.before);
        const afterPath = join(explorationDir, step.screenshots.after);

        const beforeExists = await fs.stat(beforePath).then(() => true).catch(() => false);
        const afterExists = await fs.stat(afterPath).then(() => true).catch(() => false);

        expect(beforeExists).toBe(true);
        expect(afterExists).toBe(true);

        // Verify files are not empty
        const beforeSize = (await fs.stat(beforePath)).size;
        const afterSize = (await fs.stat(afterPath)).size;

        expect(beforeSize).toBeGreaterThan(0);
        expect(afterSize).toBeGreaterThan(0);
      }
    });

    it('should store relative paths in exploration output', async () => {
      const explorerWithTempDir = new Explorer({
        adapter: mockAdapter,
        browser: mockBrowser,
        outputDir: testDir,
      });

      const result = await explorerWithTempDir.runExploration(sampleSpec, 'http://localhost:3000');

      // Paths should be relative (start with "screenshots/")
      for (const step of result.steps) {
        expect(step.screenshots.before).toMatch(/^screenshots\//);
        expect(step.screenshots.after).toMatch(/^screenshots\//);
      }
    });
  });
});
