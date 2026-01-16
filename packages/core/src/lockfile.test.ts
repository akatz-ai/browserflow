/**
 * Tests for lockfile types
 * @see bf-aak
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import {
  lockfileSchema,
  maskSchema,
  assertionSchema,
  readLockfile,
  writeLockfile,
  validateLockfile,
  computeSpecHash,
  type Lockfile,
  type Mask,
  type Assertion,
  type AssertionType,
} from './lockfile.js';

describe('maskSchema', () => {
  test('validates mask with coordinates', () => {
    const mask: Mask = {
      x: 100,
      y: 200,
      width: 50,
      height: 30,
      reason: 'Dynamic content',
    };
    expect(maskSchema.safeParse(mask).success).toBe(true);
  });

  test('validates mask with locator', () => {
    const mask: Mask = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      reason: 'User avatar',
      locator: '[data-testid="avatar"]',
    };
    expect(maskSchema.safeParse(mask).success).toBe(true);
  });

  test('requires all coordinate fields', () => {
    const incompleteMask = {
      x: 100,
      y: 200,
      reason: 'Missing dimensions',
    };
    expect(maskSchema.safeParse(incompleteMask).success).toBe(false);
  });
});

describe('assertionSchema', () => {
  const assertionTypes: AssertionType[] = [
    'visible',
    'hidden',
    'text_contains',
    'text_equals',
    'url_contains',
    'url_matches',
    'count',
    'attribute',
    'checked',
    'screenshot',
  ];

  for (const type of assertionTypes) {
    test(`validates ${type} assertion type`, () => {
      const assertion: Assertion = {
        id: `assertion-${type}`,
        type,
      };
      expect(assertionSchema.safeParse(assertion).success).toBe(true);
    });
  }

  test('validates assertion with target', () => {
    const assertion: Assertion = {
      id: 'assert-1',
      type: 'visible',
      target: {
        locator_id: 'loc-1',
        preferred: { type: 'testid', value: 'submit-btn' },
        fallbacks: [],
        proof: {},
      },
    };
    expect(assertionSchema.safeParse(assertion).success).toBe(true);
  });

  test('validates assertion with expected value', () => {
    const assertion: Assertion = {
      id: 'assert-2',
      type: 'text_equals',
      expected: 'Welcome back!',
    };
    expect(assertionSchema.safeParse(assertion).success).toBe(true);
  });

  test('validates assertion attached to step', () => {
    const assertion: Assertion = {
      id: 'assert-3',
      type: 'screenshot',
      step_id: 'step-5',
    };
    expect(assertionSchema.safeParse(assertion).success).toBe(true);
  });
});

describe('lockfileSchema', () => {
  test('validates complete lockfile', () => {
    const lockfile: Lockfile = {
      run_id: 'run-20260115031000-abc123',
      spec_name: 'checkout-cart',
      spec_hash: 'abc123def456',
      created_at: '2026-01-15T03:10:00Z',
      locators: {
        'submit-btn': {
          locator_id: 'submit-btn',
          preferred: { type: 'testid', value: 'submit-btn' },
          fallbacks: [],
          proof: { a11y_role: 'button' },
        },
      },
      masks: {
        'checkout-complete': [
          { x: 10, y: 20, width: 100, height: 50, reason: 'Dynamic timestamp' },
        ],
      },
      assertions: [
        { id: 'assert-1', type: 'visible' },
      ],
      generation: {
        format: 'playwright-ts',
        output_path: 'tests/checkout-cart.spec.ts',
      },
    };
    expect(lockfileSchema.safeParse(lockfile).success).toBe(true);
  });

  test('validates lockfile with generated_at', () => {
    const lockfile: Lockfile = {
      run_id: 'run-20260115031000-abc123',
      spec_name: 'checkout-cart',
      spec_hash: 'abc123def456',
      created_at: '2026-01-15T03:10:00Z',
      locators: {},
      masks: {},
      assertions: [],
      generation: {
        format: 'playwright-ts',
        output_path: 'tests/checkout-cart.spec.ts',
        generated_at: '2026-01-15T03:15:00Z',
      },
    };
    expect(lockfileSchema.safeParse(lockfile).success).toBe(true);
  });

  test('requires run_id', () => {
    const lockfile = {
      spec_name: 'checkout-cart',
      spec_hash: 'abc123',
      created_at: '2026-01-15T03:10:00Z',
      locators: {},
      masks: {},
      assertions: [],
      generation: {
        format: 'playwright-ts',
        output_path: 'tests/test.spec.ts',
      },
    };
    expect(lockfileSchema.safeParse(lockfile).success).toBe(false);
  });

  test('requires spec_name', () => {
    const lockfile = {
      run_id: 'run-123',
      spec_hash: 'abc123',
      created_at: '2026-01-15T03:10:00Z',
      locators: {},
      masks: {},
      assertions: [],
      generation: {
        format: 'playwright-ts',
        output_path: 'tests/test.spec.ts',
      },
    };
    expect(lockfileSchema.safeParse(lockfile).success).toBe(false);
  });
});

describe('validateLockfile', () => {
  test('returns true for valid lockfile', () => {
    const lockfile: Lockfile = {
      run_id: 'run-123',
      spec_name: 'test',
      spec_hash: 'abc',
      created_at: '2026-01-15T03:10:00Z',
      locators: {},
      masks: {},
      assertions: [],
      generation: {
        format: 'playwright-ts',
        output_path: 'tests/test.spec.ts',
      },
    };
    expect(validateLockfile(lockfile)).toBe(true);
  });

  test('returns false for invalid lockfile', () => {
    const invalid = {
      run_id: 'run-123',
      // Missing required fields
    };
    expect(validateLockfile(invalid)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(validateLockfile('string')).toBe(false);
    expect(validateLockfile(123)).toBe(false);
    expect(validateLockfile(null)).toBe(false);
  });
});

describe('computeSpecHash', () => {
  test('computes consistent hash for same content', () => {
    const content = 'version: 2\nname: test';
    const hash1 = computeSpecHash(content);
    const hash2 = computeSpecHash(content);
    expect(hash1).toBe(hash2);
  });

  test('computes different hash for different content', () => {
    const hash1 = computeSpecHash('content1');
    const hash2 = computeSpecHash('content2');
    expect(hash1).not.toBe(hash2);
  });

  test('returns SHA256 hex string', () => {
    const hash = computeSpecHash('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('file operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lockfile-test-'));
    await mkdir(join(tempDir, 'runs', 'test-spec', 'run-123'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('writeLockfile', () => {
    test('writes lockfile to correct path', async () => {
      const runDir = join(tempDir, 'runs', 'test-spec', 'run-123');
      const lockfile: Lockfile = {
        run_id: 'run-123',
        spec_name: 'test-spec',
        spec_hash: 'abc123',
        created_at: '2026-01-15T03:10:00Z',
        locators: {},
        masks: {},
        assertions: [],
        generation: {
          format: 'playwright-ts',
          output_path: 'tests/test.spec.ts',
        },
      };

      await writeLockfile(runDir, lockfile);

      const file = Bun.file(join(runDir, 'lockfile.json'));
      const content = await file.json();
      expect(content.run_id).toBe('run-123');
      expect(content.spec_name).toBe('test-spec');
    });

    test('writes formatted JSON', async () => {
      const runDir = join(tempDir, 'runs', 'test-spec', 'run-123');
      const lockfile: Lockfile = {
        run_id: 'run-123',
        spec_name: 'test-spec',
        spec_hash: 'abc123',
        created_at: '2026-01-15T03:10:00Z',
        locators: {},
        masks: {},
        assertions: [],
        generation: {
          format: 'playwright-ts',
          output_path: 'tests/test.spec.ts',
        },
      };

      await writeLockfile(runDir, lockfile);

      const text = await Bun.file(join(runDir, 'lockfile.json')).text();
      expect(text).toContain('\n'); // Should be pretty-printed
    });
  });

  describe('readLockfile', () => {
    test('reads lockfile from correct path', async () => {
      const runDir = join(tempDir, 'runs', 'test-spec', 'run-123');
      const lockfile: Lockfile = {
        run_id: 'run-123',
        spec_name: 'test-spec',
        spec_hash: 'abc123',
        created_at: '2026-01-15T03:10:00Z',
        locators: {},
        masks: {},
        assertions: [],
        generation: {
          format: 'playwright-ts',
          output_path: 'tests/test.spec.ts',
        },
      };

      await writeFile(join(runDir, 'lockfile.json'), JSON.stringify(lockfile));

      const result = await readLockfile(runDir);
      expect(result.run_id).toBe('run-123');
      expect(result.spec_name).toBe('test-spec');
    });

    test('throws for missing lockfile', async () => {
      const runDir = join(tempDir, 'runs', 'nonexistent');
      await expect(readLockfile(runDir)).rejects.toThrow();
    });

    test('throws for invalid JSON', async () => {
      const runDir = join(tempDir, 'runs', 'test-spec', 'run-123');
      await writeFile(join(runDir, 'lockfile.json'), 'not json');
      await expect(readLockfile(runDir)).rejects.toThrow();
    });
  });
});
