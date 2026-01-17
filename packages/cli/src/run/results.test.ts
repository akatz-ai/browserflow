import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { collectResults } from './results.js';
import type { ExecutorResult } from './executor.js';

describe('collectResults with JSON reporter', () => {
  let tempDir: string;
  let runDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-test-'));
    runDir = path.join(tempDir, 'run-001');
    await fs.mkdir(runDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should parse successful test results from JSON', async () => {
    // Create mock Playwright JSON output
    const mockResults = {
      config: {},
      suites: [
        {
          title: '',
          file: 'e2e/tests/login.spec.ts',
          specs: [
            {
              title: 'should login successfully',
              ok: true,
              tests: [
                {
                  results: [
                    {
                      status: 'passed',
                      duration: 1234,
                      startTime: '2026-01-17T12:00:00Z',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        expected: 1,
        unexpected: 0,
        skipped: 0,
        duration: 1234,
      },
    };

    const executorResult: ExecutorResult = {
      exitCode: 0,
      stdout: JSON.stringify(mockResults),
      stderr: '',
      jsonOutput: mockResults,
    };

    const result = await collectResults(runDir, executorResult);

    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.duration).toBe(1234);
    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].name).toBe('login');
    expect(result.specs[0].status).toBe('passed');
    expect(result.failures).toHaveLength(0);
  });

  it('should parse failed test results with error messages', async () => {
    const mockResults = {
      config: {},
      suites: [
        {
          title: '',
          file: 'e2e/tests/checkout.spec.ts',
          specs: [
            {
              title: 'should complete checkout',
              ok: false,
              tests: [
                {
                  results: [
                    {
                      status: 'failed',
                      duration: 2500,
                      startTime: '2026-01-17T12:00:00Z',
                      error: {
                        message: 'Timeout: element not found',
                        stack: 'Error: Timeout at Page.click',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        expected: 0,
        unexpected: 1,
        skipped: 0,
        duration: 2500,
      },
    };

    const executorResult: ExecutorResult = {
      exitCode: 5,
      stdout: JSON.stringify(mockResults),
      stderr: '',
      jsonOutput: mockResults,
    };

    const result = await collectResults(runDir, executorResult);

    expect(result.passed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].name).toBe('checkout');
    expect(result.specs[0].status).toBe('failed');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].spec).toBe('checkout');
    expect(result.failures[0].error).toBe('Timeout: element not found');
  });

  it('should parse mixed results (pass and fail)', async () => {
    const mockResults = {
      config: {},
      suites: [
        {
          title: '',
          file: 'e2e/tests/auth.spec.ts',
          specs: [
            {
              title: 'should login',
              ok: true,
              tests: [
                {
                  results: [
                    {
                      status: 'passed',
                      duration: 1000,
                      startTime: '2026-01-17T12:00:00Z',
                    },
                  ],
                },
              ],
            },
            {
              title: 'should logout',
              ok: false,
              tests: [
                {
                  results: [
                    {
                      status: 'failed',
                      duration: 1500,
                      startTime: '2026-01-17T12:00:01Z',
                      error: {
                        message: 'Button not visible',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        expected: 1,
        unexpected: 1,
        skipped: 0,
        duration: 2500,
      },
    };

    const executorResult: ExecutorResult = {
      exitCode: 5,
      stdout: JSON.stringify(mockResults),
      stderr: '',
      jsonOutput: mockResults,
    };

    const result = await collectResults(runDir, executorResult);

    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.specs).toHaveLength(1); // One spec (file) with 2 steps (tests)
    expect(result.specs[0].steps).toHaveLength(2);
    expect(result.specs[0].steps[0].status).toBe('passed');
    expect(result.specs[0].steps[1].status).toBe('failed');
    expect(result.specs[0].status).toBe('failed'); // Suite status is failed if any test fails
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBe('Button not visible');
  });

  it('should handle skipped tests', async () => {
    const mockResults = {
      config: {},
      suites: [
        {
          title: '',
          file: 'e2e/tests/feature.spec.ts',
          specs: [
            {
              title: 'should work',
              ok: true,
              tests: [
                {
                  results: [
                    {
                      status: 'skipped',
                      duration: 0,
                      startTime: '2026-01-17T12:00:00Z',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        expected: 0,
        unexpected: 0,
        skipped: 1,
        duration: 0,
      },
    };

    const executorResult: ExecutorResult = {
      exitCode: 0,
      stdout: JSON.stringify(mockResults),
      stderr: '',
      jsonOutput: mockResults,
    };

    const result = await collectResults(runDir, executorResult);

    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.specs[0].status).toBe('skipped');
  });

  it('should handle multiple test files', async () => {
    const mockResults = {
      config: {},
      suites: [
        {
          title: '',
          file: 'e2e/tests/login.spec.ts',
          specs: [
            {
              title: 'should login',
              ok: true,
              tests: [
                {
                  results: [
                    {
                      status: 'passed',
                      duration: 1000,
                      startTime: '2026-01-17T12:00:00Z',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          title: '',
          file: 'e2e/tests/checkout.spec.ts',
          specs: [
            {
              title: 'should checkout',
              ok: true,
              tests: [
                {
                  results: [
                    {
                      status: 'passed',
                      duration: 2000,
                      startTime: '2026-01-17T12:00:01Z',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        expected: 2,
        unexpected: 0,
        skipped: 0,
        duration: 3000,
      },
    };

    const executorResult: ExecutorResult = {
      exitCode: 0,
      stdout: JSON.stringify(mockResults),
      stderr: '',
      jsonOutput: mockResults,
    };

    const result = await collectResults(runDir, executorResult);

    expect(result.passed).toBe(2);
    expect(result.specs).toHaveLength(2);
    expect(result.specs[0].name).toBe('login');
    expect(result.specs[1].name).toBe('checkout');
    expect(result.duration).toBe(3000);
  });

  it('should extract spec name from file path correctly', async () => {
    const mockResults = {
      config: {},
      suites: [
        {
          title: '',
          file: 'e2e/tests/nested/deep/test.spec.ts',
          specs: [
            {
              title: 'should work',
              ok: true,
              tests: [
                {
                  results: [
                    {
                      status: 'passed',
                      duration: 1000,
                      startTime: '2026-01-17T12:00:00Z',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        expected: 1,
        unexpected: 0,
        skipped: 0,
        duration: 1000,
      },
    };

    const executorResult: ExecutorResult = {
      exitCode: 0,
      stdout: JSON.stringify(mockResults),
      stderr: '',
      jsonOutput: mockResults,
    };

    const result = await collectResults(runDir, executorResult);

    // Should extract 'nested/deep/test' from 'e2e/tests/nested/deep/test.spec.ts'
    expect(result.specs[0].name).toBe('nested/deep/test');
  });
});
