/**
 * Tests for spec v2 Zod schema
 * @see bf-dgs
 */

import { describe, expect, test } from 'bun:test';
import {
  specSchema,
  targetSchema,
  durationSchema,
  stepSchema,
  preconditionsSchema,
} from './spec-schema.js';

describe('durationSchema', () => {
  test('validates valid duration strings', () => {
    expect(durationSchema.safeParse('3s').success).toBe(true);
    expect(durationSchema.safeParse('2m').success).toBe(true);
    expect(durationSchema.safeParse('500ms').success).toBe(true);
    expect(durationSchema.safeParse('1m30s').success).toBe(true);
    expect(durationSchema.safeParse('1h').success).toBe(true);
  });

  test('rejects invalid duration strings', () => {
    expect(durationSchema.safeParse('3 seconds').success).toBe(false);
    expect(durationSchema.safeParse('abc').success).toBe(false);
    expect(durationSchema.safeParse('').success).toBe(false);
  });

  test('provides actionable error message', () => {
    const result = durationSchema.safeParse('invalid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('duration');
    }
  });
});

describe('targetSchema', () => {
  test('validates targets with testid', () => {
    expect(targetSchema.safeParse({ testid: 'submit-button' }).success).toBe(true);
  });

  test('validates targets with role', () => {
    expect(targetSchema.safeParse({ role: 'button', name: 'Submit' }).success).toBe(true);
  });

  test('validates targets with label', () => {
    expect(targetSchema.safeParse({ label: 'Email' }).success).toBe(true);
  });

  test('validates targets with placeholder', () => {
    expect(targetSchema.safeParse({ placeholder: 'Enter email' }).success).toBe(true);
  });

  test('validates targets with text', () => {
    expect(targetSchema.safeParse({ text: 'Click here' }).success).toBe(true);
  });

  test('validates targets with css', () => {
    expect(targetSchema.safeParse({ css: '.submit-btn' }).success).toBe(true);
  });

  test('validates targets with query (natural language)', () => {
    expect(targetSchema.safeParse({ query: 'the blue submit button' }).success).toBe(true);
  });

  test('validates nested within targeting', () => {
    const result = targetSchema.safeParse({
      role: 'button',
      name: 'Delete',
      within: { testid: 'user-list' },
    });
    expect(result.success).toBe(true);
  });

  test('validates nth targeting', () => {
    expect(targetSchema.safeParse({ role: 'listitem', nth: 2 }).success).toBe(true);
  });

  test('rejects targets with no locator strategy', () => {
    const result = targetSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects targets with only nth (no strategy)', () => {
    const result = targetSchema.safeParse({ nth: 1 });
    expect(result.success).toBe(false);
  });
});

describe('stepSchema', () => {
  test('validates step with required id', () => {
    const result = stepSchema.safeParse({
      id: 'step-1',
      action: 'click',
      target: { testid: 'submit-btn' },
    });
    expect(result.success).toBe(true);
  });

  test('rejects step without id', () => {
    const result = stepSchema.safeParse({
      action: 'click',
      target: { testid: 'submit-btn' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // The error should be about the missing 'id' field (path: ['id'])
      const idError = result.error.issues.find((i) => i.path.includes('id'));
      expect(idError).toBeDefined();
    }
  });

  test('rejects step with empty id', () => {
    const result = stepSchema.safeParse({
      id: '',
      action: 'click',
    });
    expect(result.success).toBe(false);
  });

  test('validates navigate action', () => {
    const result = stepSchema.safeParse({
      id: 'nav-1',
      action: 'navigate',
      url: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  test('validates fill action', () => {
    const result = stepSchema.safeParse({
      id: 'fill-1',
      action: 'fill',
      target: { label: 'Email' },
      value: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });

  test('validates wait action', () => {
    const result = stepSchema.safeParse({
      id: 'wait-1',
      action: 'wait',
      duration: '2s',
    });
    expect(result.success).toBe(true);
  });

  test('validates expect action', () => {
    const result = stepSchema.safeParse({
      id: 'expect-1',
      action: 'expect',
      target: { text: 'Success' },
      state: 'visible',
    });
    expect(result.success).toBe(true);
  });

  test('validates screenshot action', () => {
    const result = stepSchema.safeParse({
      id: 'screenshot-1',
      action: 'screenshot',
      name: 'checkout-complete',
    });
    expect(result.success).toBe(true);
  });
});

describe('preconditionsSchema', () => {
  test('validates page precondition', () => {
    const result = preconditionsSchema.safeParse({
      page: { url: 'https://example.com/login' },
    });
    expect(result.success).toBe(true);
  });

  test('validates auth precondition', () => {
    const result = preconditionsSchema.safeParse({
      auth: { user: 'admin', state: 'logged_in' },
    });
    expect(result.success).toBe(true);
  });

  test('validates viewport precondition', () => {
    const result = preconditionsSchema.safeParse({
      viewport: { width: 1280, height: 720 },
    });
    expect(result.success).toBe(true);
  });

  test('validates mocks precondition', () => {
    const result = preconditionsSchema.safeParse({
      mocks: [{ url: '/api/users', response: { users: [] } }],
    });
    expect(result.success).toBe(true);
  });
});

describe('specSchema', () => {
  test('validates complete spec', () => {
    const spec = {
      version: 2,
      name: 'checkout-cart',
      description: 'Test the checkout flow',
      steps: [
        { id: 'step-1', action: 'navigate', url: 'https://example.com' },
        { id: 'step-2', action: 'click', target: { testid: 'add-to-cart' } },
      ],
      timeout: '30s',
      priority: 'high',
      tags: ['e2e', 'checkout'],
    };
    const result = specSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  test('requires version 2', () => {
    const spec = {
      version: 1,
      name: 'test-spec',
      steps: [{ id: 'step-1', action: 'click' }],
    };
    const result = specSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  test('requires kebab-case name', () => {
    const specWithInvalidName = {
      version: 2,
      name: 'Invalid Name With Spaces',
      steps: [{ id: 'step-1', action: 'navigate', url: 'https://example.com' }],
    };
    const result = specSchema.safeParse(specWithInvalidName);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('kebab-case');
    }
  });

  test('requires at least one step', () => {
    const spec = {
      version: 2,
      name: 'empty-spec',
      steps: [],
    };
    const result = specSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('step');
    }
  });

  test('requires unique step IDs', () => {
    const spec = {
      version: 2,
      name: 'duplicate-ids',
      steps: [
        { id: 'step-1', action: 'click', target: { testid: 'btn1' } },
        { id: 'step-1', action: 'click', target: { testid: 'btn2' } }, // Duplicate!
      ],
    };
    const result = specSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('unique');
    }
  });

  test('validates priority values', () => {
    const validPriorities = ['critical', 'high', 'normal', 'low'];
    for (const priority of validPriorities) {
      const spec = {
        version: 2,
        name: 'priority-test',
        steps: [{ id: 'step-1', action: 'navigate', url: 'https://example.com' }],
        priority,
      };
      expect(specSchema.safeParse(spec).success).toBe(true);
    }

    const invalidSpec = {
      version: 2,
      name: 'priority-test',
      steps: [{ id: 'step-1', action: 'navigate', url: 'https://example.com' }],
      priority: 'urgent',
    };
    expect(specSchema.safeParse(invalidSpec).success).toBe(false);
  });

  test('validates timeout as duration string', () => {
    const validSpec = {
      version: 2,
      name: 'timeout-test',
      steps: [{ id: 'step-1', action: 'navigate', url: 'https://example.com' }],
      timeout: '30s',
    };
    expect(specSchema.safeParse(validSpec).success).toBe(true);

    const invalidSpec = {
      version: 2,
      name: 'timeout-test',
      steps: [{ id: 'step-1', action: 'navigate', url: 'https://example.com' }],
      timeout: 'invalid',
    };
    expect(specSchema.safeParse(invalidSpec).success).toBe(false);
  });

  test('validates expected outcomes', () => {
    const spec = {
      version: 2,
      name: 'outcomes-test',
      steps: [{ id: 'step-1', action: 'navigate', url: 'https://example.com' }],
      expected_outcomes: [
        { description: 'Cart should be empty', check: 'cart_count', expected: 0 },
        { description: 'User is logged in', check: 'logged_in', expected: true },
      ],
    };
    expect(specSchema.safeParse(spec).success).toBe(true);
  });

  test('validates preconditions', () => {
    const spec = {
      version: 2,
      name: 'preconditions-test',
      steps: [{ id: 'step-1', action: 'click', target: { testid: 'btn' } }],
      preconditions: {
        page: { url: 'https://example.com/dashboard' },
        viewport: { width: 1920, height: 1080 },
      },
    };
    expect(specSchema.safeParse(spec).success).toBe(true);
  });
});

describe('action types', () => {
  const actionTestCases = [
    { action: 'click', target: { testid: 'btn' } },
    { action: 'navigate', url: 'https://example.com' },
    { action: 'back' },
    { action: 'forward' },
    { action: 'refresh' },
    { action: 'fill', target: { label: 'Email' }, value: 'test@test.com' },
    { action: 'type', target: { css: 'input' }, text: 'hello' },
    { action: 'select', target: { label: 'Country' }, option: 'USA' },
    { action: 'check', target: { label: 'I agree' }, checked: true },
    { action: 'wait', duration: '2s' },
    { action: 'expect', target: { text: 'Success' }, state: 'visible' },
    { action: 'screenshot', name: 'final-state' },
  ];

  for (const testCase of actionTestCases) {
    test(`validates ${testCase.action} action`, () => {
      const step = { id: `test-${testCase.action}`, ...testCase };
      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  }
});
