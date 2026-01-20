// @browserflow/exploration - Claude CLI Adapter tests (with mocks)

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ClaudeCliAdapter } from './claude-cli';
import type { EnhancedSnapshot } from './types';

// Mock child_process spawn
const mockSpawn = mock(() => {});

describe('ClaudeCliAdapter', () => {
  let adapter: ClaudeCliAdapter;

  beforeEach(() => {
    adapter = new ClaudeCliAdapter({ model: 'haiku' });
  });

  test('has correct name', () => {
    expect(adapter.name).toBe('claude-cli');
  });

  test('accepts custom configuration', () => {
    const customAdapter = new ClaudeCliAdapter({
      model: 'sonnet',
      timeout: 60000,
      cliPath: '/usr/local/bin/claude',
    });
    expect(customAdapter.name).toBe('claude-cli');
  });

  describe('explore', () => {
    test('returns valid exploration output structure', async () => {
      const result = await adapter.explore({
        spec: { name: 'test-spec', steps: [] },
        specPath: 'specs/test.yaml',
        baseUrl: 'http://localhost:3001',
        outputDir: '/tmp/test',
      });

      expect(result.spec).toBe('test-spec');
      expect(result.specPath).toBe('specs/test.yaml');
      expect(result.explorationId).toMatch(/^exp-\d+-[a-z0-9]+$/);
      expect(result.overallStatus).toBe('completed');
      expect(result.browser).toBe('chromium');
      expect(result.viewport).toEqual({ width: 1280, height: 720 });
    });

    test('uses provided browser and viewport', async () => {
      const result = await adapter.explore({
        spec: { name: 'test-spec', steps: [] },
        specPath: 'specs/test.yaml',
        baseUrl: 'http://localhost:3001',
        outputDir: '/tmp/test',
        browser: 'firefox',
        viewport: { width: 800, height: 600 },
      });

      expect(result.browser).toBe('firefox');
      expect(result.viewport).toEqual({ width: 800, height: 600 });
    });
  });

  describe('retryWithFeedback', () => {
    test('delegates to explore', async () => {
      const previousExploration = {
        spec: 'old-spec',
        specPath: 'specs/old.yaml',
        explorationId: 'exp-123',
        timestamp: new Date().toISOString(),
        durationMs: 1000,
        browser: 'chromium' as const,
        viewport: { width: 1280, height: 720 },
        baseUrl: 'http://localhost:3001',
        steps: [],
        outcomeChecks: [],
        overallStatus: 'completed' as const,
        errors: [],
      };

      const result = await adapter.retryWithFeedback({
        spec: { name: 'retry-spec', steps: [] },
        specPath: 'specs/retry.yaml',
        baseUrl: 'http://localhost:3001',
        outputDir: '/tmp/test',
        previousExploration,
        reviewFeedback: {
          explorationId: 'exp-123',
          reviewer: 'test',
          steps: [],
          verdict: 'rejected',
        },
      });

      expect(result.spec).toBe('retry-spec');
    });
  });

  describe('parseJsonResponse (via findElement error handling)', () => {
    // We test JSON parsing indirectly through the error handling path
    // since parseJsonResponse is private

    test('handles CLI errors gracefully', async () => {
      // Create adapter with non-existent CLI path to trigger error
      const badAdapter = new ClaudeCliAdapter({
        cliPath: '/nonexistent/claude',
        timeout: 1000,
      });

      const snapshot: EnhancedSnapshot = {
        tree: '- button "Add" [ref=e1]',
        refs: { e1: { role: 'button', name: 'Add' } },
      };

      const result = await badAdapter.findElement('the Add button', snapshot);

      expect(result.ref).toBe('NOT_FOUND');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('CLI error');
    });
  });
});

describe('ClaudeCliAdapter interface compliance', () => {
  test('implements AIAdapter interface', () => {
    const adapter = new ClaudeCliAdapter();

    // Check required properties
    expect(typeof adapter.name).toBe('string');

    // Check required methods
    expect(typeof adapter.findElement).toBe('function');
    expect(typeof adapter.explore).toBe('function');
    expect(typeof adapter.retryWithFeedback).toBe('function');
  });
});
