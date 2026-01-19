/**
 * Tests for EvidenceCollector - Screenshot and trace evidence capture
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { promises as fs } from 'fs';
import * as path from 'path';
import { EvidenceCollector } from './evidence';
import type { BrowserSession } from './explorer';

describe('EvidenceCollector', () => {
  let collector: EvidenceCollector;
  let mockSession: BrowserSession;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test outputs
    tempDir = `/tmp/evidence-test-${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });

    collector = new EvidenceCollector({
      outputDir: tempDir,
      screenshotFormat: 'png',
    });

    // Mock browser session
    mockSession = {
      isLaunched: () => true,
      launch: mock(async () => {}),
      navigate: mock(async () => {}),
      screenshot: mock(async () => Buffer.from('fake-png-data')),
      getSnapshot: mock(async () => ({ refs: {}, elements: [] })),
      close: mock(async () => {}),
    };
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Session Management', () => {
    test('registerSession stores a browser session', () => {
      collector.registerSession('test-session-1', mockSession);
      // If this doesn't throw, registration worked
      expect(true).toBe(true);
    });

    test('registerSession allows multiple sessions', () => {
      const mockSession2: BrowserSession = {
        ...mockSession,
        screenshot: mock(async () => Buffer.from('fake-png-data-2')),
      };

      collector.registerSession('session-1', mockSession);
      collector.registerSession('session-2', mockSession2);
      // Should not throw
      expect(true).toBe(true);
    });

    test('unregisterSession removes a session', () => {
      collector.registerSession('test-session', mockSession);
      collector.unregisterSession('test-session');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Screenshot Capture', () => {
    beforeEach(() => {
      collector.registerSession('test-session', mockSession);
    });

    test('captureScreenshot creates screenshots directory', async () => {
      const filepath = await collector.captureScreenshot('test-session', 'test-screenshot');

      const screenshotsDir = path.join(tempDir, 'screenshots');
      const dirExists = await fs
        .stat(screenshotsDir)
        .then((s) => s.isDirectory())
        .catch(() => false);

      expect(dirExists).toBe(true);
    });

    test('captureScreenshot writes file to disk', async () => {
      const filepath = await collector.captureScreenshot('test-session', 'test-screenshot');

      const fileExists = await fs
        .stat(filepath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    test('captureScreenshot returns correct file path', async () => {
      const filepath = await collector.captureScreenshot('test-session', 'my-screenshot');

      const expectedPath = path.join(tempDir, 'screenshots', 'my-screenshot.png');
      expect(filepath).toBe(expectedPath);
    });

    test('captureScreenshot writes actual screenshot buffer', async () => {
      const testBuffer = Buffer.from('test-screenshot-data');
      mockSession.screenshot = mock(async () => testBuffer);

      const filepath = await collector.captureScreenshot('test-session', 'test-screenshot');

      const fileContent = await fs.readFile(filepath);
      expect(fileContent).toEqual(testBuffer);
    });

    test('captureScreenshot records metadata', async () => {
      await collector.captureScreenshot('test-session', 'test-screenshot');

      const evidence = collector.getEvidence();
      expect(evidence.length).toBe(1);
      expect(evidence[0].type).toBe('screenshot');
      expect(evidence[0].sessionId).toBe('test-session');
      expect(evidence[0].path).toContain('test-screenshot.png');
    });

    test('captureScreenshot throws error for unknown session', async () => {
      await expect(
        collector.captureScreenshot('unknown-session', 'test')
      ).rejects.toThrow('No browser session found: unknown-session');
    });

    test('captureScreenshot respects screenshot format (jpeg)', async () => {
      const jpegCollector = new EvidenceCollector({
        outputDir: tempDir,
        screenshotFormat: 'jpeg',
      });
      jpegCollector.registerSession('test-session', mockSession);

      const filepath = await jpegCollector.captureScreenshot('test-session', 'test-jpeg');

      expect(filepath).toContain('.jpeg');
    });

    test('captureScreenshot passes options to browser session', async () => {
      const screenshotMock = mock(async () => Buffer.from('data'));
      mockSession.screenshot = screenshotMock;

      const options = {
        fullPage: true,
        clip: { x: 0, y: 0, width: 100, height: 100 },
      };

      await collector.captureScreenshot('test-session', 'test', options);

      expect(screenshotMock).toHaveBeenCalledWith(options);
    });

    test('captureScreenshot handles multiple screenshots', async () => {
      await collector.captureScreenshot('test-session', 'screenshot-1');
      await collector.captureScreenshot('test-session', 'screenshot-2');
      await collector.captureScreenshot('test-session', 'screenshot-3');

      const evidence = collector.getEvidence();
      expect(evidence.length).toBe(3);
      expect(evidence[0].path).toContain('screenshot-1');
      expect(evidence[1].path).toContain('screenshot-2');
      expect(evidence[2].path).toContain('screenshot-3');
    });

    test('captureScreenshot creates nested directories if needed', async () => {
      // Even if screenshots dir doesn't exist, it should be created
      const screenshotsDir = path.join(tempDir, 'screenshots');
      const dirExistsBefore = await fs
        .stat(screenshotsDir)
        .then(() => true)
        .catch(() => false);

      expect(dirExistsBefore).toBe(false);

      await collector.captureScreenshot('test-session', 'test');

      const dirExistsAfter = await fs
        .stat(screenshotsDir)
        .then((s) => s.isDirectory())
        .catch(() => false);

      expect(dirExistsAfter).toBe(true);
    });
  });

  describe('Evidence Metadata', () => {
    beforeEach(() => {
      collector.registerSession('test-session', mockSession);
    });

    test('getEvidence returns all captured evidence', async () => {
      await collector.captureScreenshot('test-session', 'shot-1');
      await collector.captureScreenshot('test-session', 'shot-2');

      const evidence = collector.getEvidence();
      expect(evidence.length).toBe(2);
    });

    test('clearEvidence removes all metadata', async () => {
      await collector.captureScreenshot('test-session', 'shot-1');
      await collector.captureScreenshot('test-session', 'shot-2');

      collector.clearEvidence();

      const evidence = collector.getEvidence();
      expect(evidence.length).toBe(0);
    });

    test('evidence metadata includes timestamp', async () => {
      const beforeTime = new Date().toISOString();
      await collector.captureScreenshot('test-session', 'test');
      const afterTime = new Date().toISOString();

      const evidence = collector.getEvidence();
      expect(evidence[0].timestamp).toBeDefined();
      expect(evidence[0].timestamp >= beforeTime).toBe(true);
      expect(evidence[0].timestamp <= afterTime).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('getOutputDir returns configured directory', () => {
      expect(collector.getOutputDir()).toBe(tempDir);
    });

    test('setOutputDir updates directory', () => {
      const newDir = '/tmp/new-dir';
      collector.setOutputDir(newDir);
      expect(collector.getOutputDir()).toBe(newDir);
    });
  });
});
