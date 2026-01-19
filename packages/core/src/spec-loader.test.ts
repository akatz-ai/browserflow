/**
 * Tests for spec loading and normalization
 * @see bf-7ne - preconditions.page string coercion
 */

import { describe, expect, test } from 'bun:test';
import { normalizePreconditions, loadSpec } from './spec-loader.js';
import { specSchema } from './spec-schema.js';

describe('normalizePreconditions', () => {
  test('coerces string page to object format', () => {
    const input = {
      page: '/',
      viewport: { width: 1920, height: 1080 },
    };

    const result = normalizePreconditions(input);

    expect(result.page).toEqual({ url: '/' });
    expect(result.viewport).toEqual({ width: 1920, height: 1080 });
  });

  test('coerces string page with full URL', () => {
    const input = {
      page: 'https://example.com/login',
    };

    const result = normalizePreconditions(input);

    expect(result.page).toEqual({ url: 'https://example.com/login' });
  });

  test('passes through object page format unchanged', () => {
    const input = {
      page: { url: '/dashboard' },
      viewport: { width: 1280, height: 720 },
    };

    const result = normalizePreconditions(input);

    expect(result.page).toEqual({ url: '/dashboard' });
    expect(result.viewport).toEqual({ width: 1280, height: 720 });
  });

  test('handles missing page field', () => {
    const input = {
      viewport: { width: 1920, height: 1080 },
    };

    const result = normalizePreconditions(input);

    expect(result.page).toBeUndefined();
    expect(result.viewport).toEqual({ width: 1920, height: 1080 });
  });

  test('handles empty preconditions', () => {
    const result = normalizePreconditions({});

    expect(result).toEqual({});
  });

  test('handles null/undefined preconditions', () => {
    expect(normalizePreconditions(null)).toEqual({});
    expect(normalizePreconditions(undefined)).toEqual({});
  });

  test('preserves auth field', () => {
    const input = {
      page: '/',
      auth: { user: 'testuser', state: 'logged-in' },
    };

    const result = normalizePreconditions(input);

    expect(result.page).toEqual({ url: '/' });
    expect(result.auth).toEqual({ user: 'testuser', state: 'logged-in' });
  });

  test('preserves mocks field', () => {
    const input = {
      page: '/',
      mocks: [{ url: '/api/user', response: { id: 123 } }],
    };

    const result = normalizePreconditions(input);

    expect(result.page).toEqual({ url: '/' });
    expect(result.mocks).toEqual([{ url: '/api/user', response: { id: 123 } }]);
  });
});

describe('loadSpec', () => {
  test('loads and validates spec with string preconditions.page', () => {
    const rawSpec = {
      version: 2,
      name: 'login-test',
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          url: '/login',
        },
      ],
      preconditions: {
        page: '/',
      },
    };

    const result = loadSpec(rawSpec);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preconditions?.page).toEqual({ url: '/' });
    }
  });

  test('loads and validates spec with object preconditions.page', () => {
    const rawSpec = {
      version: 2,
      name: 'login-test',
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          url: '/login',
        },
      ],
      preconditions: {
        page: { url: '/dashboard' },
      },
    };

    const result = loadSpec(rawSpec);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preconditions?.page).toEqual({ url: '/dashboard' });
    }
  });

  test('validates spec after normalization', () => {
    const rawSpec = {
      version: 2,
      name: 'invalid-name!',  // Invalid: not kebab-case
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          url: '/login',
        },
      ],
      preconditions: {
        page: '/',
      },
    };

    const result = loadSpec(rawSpec);

    expect(result.success).toBe(false);
  });

  test('handles spec with no preconditions', () => {
    const rawSpec = {
      version: 2,
      name: 'simple-test',
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          url: '/login',
        },
      ],
    };

    const result = loadSpec(rawSpec);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preconditions).toBeUndefined();
    }
  });
});
