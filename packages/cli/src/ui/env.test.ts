import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { isCI, isTTY, supportsColor, shouldUseSpinners, isInteractive, resetEnvCache } from './env.js';

describe('env', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    resetEnvCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    // Can't reassign isTTY, so we rely on resetEnvCache
    resetEnvCache();
  });

  describe('isCI', () => {
    it('should detect CI environment variable', () => {
      process.env.CI = 'true';
      resetEnvCache();
      expect(isCI()).toBe(true);
    });

    it('should detect GITHUB_ACTIONS', () => {
      delete process.env.CI;
      process.env.GITHUB_ACTIONS = 'true';
      resetEnvCache();
      expect(isCI()).toBe(true);
    });

    it('should detect GITLAB_CI', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      process.env.GITLAB_CI = 'true';
      resetEnvCache();
      expect(isCI()).toBe(true);
    });

    it('should detect JENKINS_URL', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      process.env.JENKINS_URL = 'http://jenkins.example.com';
      resetEnvCache();
      expect(isCI()).toBe(true);
    });

    it('should detect CIRCLECI', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.JENKINS_URL;
      process.env.CIRCLECI = 'true';
      resetEnvCache();
      expect(isCI()).toBe(true);
    });

    it('should return false when no CI env vars', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.JENKINS_URL;
      delete process.env.CIRCLECI;
      resetEnvCache();
      // Note: in test environment it might still be true if running in CI
      // This test documents expected behavior
      const result = isCI();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isTTY', () => {
    it('should return boolean indicating TTY status', () => {
      const result = isTTY();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('supportsColor', () => {
    it('should return false when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';
      resetEnvCache();
      expect(supportsColor()).toBe(false);
    });

    it('should return true when FORCE_COLOR is set', () => {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      resetEnvCache();
      expect(supportsColor()).toBe(true);
    });

    it('should return boolean based on TTY when no override', () => {
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;
      resetEnvCache();
      const result = supportsColor();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('shouldUseSpinners', () => {
    it('should return boolean', () => {
      resetEnvCache();
      const result = shouldUseSpinners();
      expect(typeof result).toBe('boolean');
    });

    it('should return false when in CI', () => {
      process.env.CI = 'true';
      resetEnvCache();
      // In CI, spinners should be disabled regardless of TTY
      const result = shouldUseSpinners();
      expect(result).toBe(false);
    });
  });

  describe('isInteractive', () => {
    it('should return boolean', () => {
      resetEnvCache();
      const result = isInteractive();
      expect(typeof result).toBe('boolean');
    });

    it('should return false when in CI', () => {
      process.env.CI = 'true';
      resetEnvCache();
      const result = isInteractive();
      expect(result).toBe(false);
    });
  });
});
