/**
 * Tests for browserflow.yaml config schema validation
 */

import { describe, test, expect } from 'bun:test';
import {
  browserflowConfigSchema,
  validateBrowserflowConfig,
  parseBrowserflowConfig,
} from './config-schema.js';

describe('browserflowConfigSchema', () => {
  describe('valid configs', () => {
    test('accepts minimal config with required project.name', () => {
      const config = {
        project: {
          name: 'my-project',
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(true);
    });

    test('accepts full config', () => {
      const config = {
        project: {
          name: 'my-project',
          base_url: 'http://localhost:3000',
        },
        runtime: {
          browser: 'chromium',
          headless: true,
          viewport: { width: 1280, height: 720 },
          timeout: '30s',
        },
        locators: {
          prefer_testid: true,
          testid_attributes: ['data-testid', 'data-test'],
        },
        exploration: {
          adapter: 'claude',
          max_retries: 3,
        },
        review: {
          port: 8190,
          auto_open: true,
        },
        output: {
          tests_dir: 'e2e/tests',
          baselines_dir: 'baselines',
        },
        ci: {
          fail_on_baseline_diff: false,
          parallel: 2,
        },
      };
      const result = browserflowConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    test('accepts browser alias for runtime', () => {
      const config = {
        project: { name: 'test' },
        browser: {
          engine: 'firefox',
          headless: false,
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(true);
    });

    test('accepts numeric timeout', () => {
      const config = {
        project: { name: 'test' },
        runtime: {
          timeout: 30000,
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(true);
    });

    test('accepts duration string timeout', () => {
      const config = {
        project: { name: 'test' },
        runtime: {
          timeout: '1m30s',
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(true);
    });
  });

  describe('invalid configs', () => {
    test('rejects missing project', () => {
      const config = {
        runtime: { browser: 'chromium' },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(false);
    });

    test('rejects missing project.name', () => {
      const config = {
        project: {},
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(false);
    });

    test('rejects empty project.name', () => {
      const config = {
        project: { name: '' },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(false);
    });

    test('rejects invalid browser type', () => {
      const config = {
        project: { name: 'test' },
        runtime: {
          browser: 'chrome', // Invalid - should be chromium
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(false);
    });

    test('rejects invalid port number', () => {
      const config = {
        project: { name: 'test' },
        review: {
          port: 70000, // Invalid - max is 65535
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(false);
    });

    test('rejects negative viewport dimensions', () => {
      const config = {
        project: { name: 'test' },
        runtime: {
          viewport: { width: -100, height: 720 },
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(false);
    });

    test('rejects negative max_retries', () => {
      const config = {
        project: { name: 'test' },
        exploration: {
          max_retries: -1,
        },
      };
      expect(browserflowConfigSchema.safeParse(config).success).toBe(false);
    });
  });
});

describe('validateBrowserflowConfig', () => {
  test('returns true for valid config', () => {
    const config = {
      project: { name: 'test' },
    };
    expect(validateBrowserflowConfig(config)).toBe(true);
  });

  test('returns false for invalid config', () => {
    const config = {
      project: {},
    };
    expect(validateBrowserflowConfig(config)).toBe(false);
  });
});

describe('parseBrowserflowConfig', () => {
  test('returns data for valid config', () => {
    const config = {
      project: { name: 'test' },
    };
    const result = parseBrowserflowConfig(config);
    expect(result.success).toBe(true);
    expect(result.data?.project.name).toBe('test');
  });

  test('returns error message for invalid config', () => {
    const config = {
      project: { name: '' },
    };
    const result = parseBrowserflowConfig(config);
    expect(result.success).toBe(false);
    expect(result.error).toContain('project.name');
  });
});
