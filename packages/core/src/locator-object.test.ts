/**
 * Tests for LocatorObject types and resolution
 * @see bf-6ig
 */

import { describe, expect, test, mock } from 'bun:test';
import {
  locatorObjectSchema,
  locatorStrategySchema,
  strategyToLocator,
  resolveLocator,
  type LocatorObject,
  type LocatorStrategy,
} from './locator-object.js';

describe('locatorStrategySchema', () => {
  test('validates testid strategy', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'testid',
      value: 'submit-button',
    });
    expect(result.success).toBe(true);
  });

  test('validates testid with custom attribute', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'testid',
      value: 'submit-button',
      attribute: 'data-qa',
    });
    expect(result.success).toBe(true);
  });

  test('validates role strategy', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'role',
      role: 'button',
      name: 'Submit',
    });
    expect(result.success).toBe(true);
  });

  test('validates role with exact matching', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'role',
      role: 'button',
      name: 'Submit',
      exact: false,
    });
    expect(result.success).toBe(true);
  });

  test('validates label strategy', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'label',
      text: 'Email Address',
    });
    expect(result.success).toBe(true);
  });

  test('validates placeholder strategy', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'placeholder',
      text: 'Enter your email',
    });
    expect(result.success).toBe(true);
  });

  test('validates text strategy', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'text',
      text: 'Click here',
    });
    expect(result.success).toBe(true);
  });

  test('validates css strategy', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'css',
      selector: '.submit-btn',
    });
    expect(result.success).toBe(true);
  });

  test('rejects invalid strategy type', () => {
    const result = locatorStrategySchema.safeParse({
      type: 'invalid',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });
});

describe('locatorObjectSchema', () => {
  test('validates complete locator object', () => {
    const locatorObj: LocatorObject = {
      locator_id: 'loc-123',
      preferred: { type: 'testid', value: 'submit-btn' },
      fallbacks: [
        { type: 'role', role: 'button', name: 'Submit' },
        { type: 'css', selector: '.submit-btn' },
      ],
      proof: {
        a11y_role: 'button',
        a11y_name: 'Submit',
      },
    };
    const result = locatorObjectSchema.safeParse(locatorObj);
    expect(result.success).toBe(true);
  });

  test('validates locator with scoping', () => {
    const locatorObj: LocatorObject = {
      locator_id: 'loc-456',
      preferred: { type: 'role', role: 'button', name: 'Delete' },
      fallbacks: [],
      scoping: {
        within: [{ type: 'testid', value: 'user-list' }],
        nth: 2,
      },
      proof: {},
    };
    const result = locatorObjectSchema.safeParse(locatorObj);
    expect(result.success).toBe(true);
  });

  test('validates locator with DOM fingerprint', () => {
    const locatorObj: LocatorObject = {
      locator_id: 'loc-789',
      preferred: { type: 'css', selector: 'button.primary' },
      fallbacks: [],
      proof: {
        dom_fingerprint: {
          tag: 'button',
          classes: ['primary', 'submit'],
          attributes: { type: 'submit' },
        },
      },
    };
    const result = locatorObjectSchema.safeParse(locatorObj);
    expect(result.success).toBe(true);
  });

  test('validates locator with bounding box', () => {
    const locatorObj: LocatorObject = {
      locator_id: 'loc-abc',
      preferred: { type: 'testid', value: 'btn' },
      fallbacks: [],
      proof: {
        bounding_box: { x: 100, y: 200, width: 50, height: 30 },
      },
    };
    const result = locatorObjectSchema.safeParse(locatorObj);
    expect(result.success).toBe(true);
  });

  test('requires locator_id', () => {
    const result = locatorObjectSchema.safeParse({
      preferred: { type: 'testid', value: 'btn' },
      fallbacks: [],
      proof: {},
    });
    expect(result.success).toBe(false);
  });

  test('requires preferred strategy', () => {
    const result = locatorObjectSchema.safeParse({
      locator_id: 'loc-123',
      fallbacks: [],
      proof: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('strategyToLocator', () => {
  // Mock Playwright Page object
  const mockPage = {
    getByTestId: mock((id: string) => ({ _testid: id })),
    getByRole: mock((role: string, options?: { name?: string; exact?: boolean }) => ({
      _role: role,
      _options: options,
    })),
    getByLabel: mock((text: string) => ({ _label: text })),
    getByPlaceholder: mock((text: string) => ({ _placeholder: text })),
    getByText: mock((text: string) => ({ _text: text })),
    locator: mock((selector: string) => ({ _selector: selector })),
  };

  test('converts testid strategy', () => {
    const strategy: LocatorStrategy = { type: 'testid', value: 'submit-btn' };
    const result = strategyToLocator(strategy, mockPage as any);
    expect(mockPage.getByTestId).toHaveBeenCalledWith('submit-btn');
  });

  test('converts testid with custom attribute', () => {
    const strategy: LocatorStrategy = {
      type: 'testid',
      value: 'submit-btn',
      attribute: 'data-qa',
    };
    const result = strategyToLocator(strategy, mockPage as any);
    expect(mockPage.locator).toHaveBeenCalledWith('[data-qa="submit-btn"]');
  });

  test('converts role strategy', () => {
    const strategy: LocatorStrategy = {
      type: 'role',
      role: 'button',
      name: 'Submit',
    };
    strategyToLocator(strategy, mockPage as any);
    expect(mockPage.getByRole).toHaveBeenCalledWith('button', {
      name: 'Submit',
      exact: true,
    });
  });

  test('converts role with exact=false', () => {
    const strategy: LocatorStrategy = {
      type: 'role',
      role: 'button',
      name: 'Submit',
      exact: false,
    };
    strategyToLocator(strategy, mockPage as any);
    expect(mockPage.getByRole).toHaveBeenCalledWith('button', {
      name: 'Submit',
      exact: false,
    });
  });

  test('converts label strategy', () => {
    const strategy: LocatorStrategy = { type: 'label', text: 'Email' };
    strategyToLocator(strategy, mockPage as any);
    expect(mockPage.getByLabel).toHaveBeenCalledWith('Email');
  });

  test('converts placeholder strategy', () => {
    const strategy: LocatorStrategy = {
      type: 'placeholder',
      text: 'Enter email',
    };
    strategyToLocator(strategy, mockPage as any);
    expect(mockPage.getByPlaceholder).toHaveBeenCalledWith('Enter email');
  });

  test('converts text strategy', () => {
    const strategy: LocatorStrategy = { type: 'text', text: 'Click here' };
    strategyToLocator(strategy, mockPage as any);
    expect(mockPage.getByText).toHaveBeenCalledWith('Click here');
  });

  test('converts css strategy', () => {
    const strategy: LocatorStrategy = { type: 'css', selector: '.submit-btn' };
    strategyToLocator(strategy, mockPage as any);
    expect(mockPage.locator).toHaveBeenCalledWith('.submit-btn');
  });
});

describe('resolveLocator', () => {
  // Mock Playwright Page with chainable locator
  const createMockPage = () => {
    const locatorResult = {
      _selector: '',
      nth: mock((n: number) => ({ ...locatorResult, _nth: n })),
      locator: mock((loc: any) => ({ ...locatorResult, _chained: loc })),
    };

    return {
      getByTestId: mock((id: string) => ({ ...locatorResult, _testid: id })),
      getByRole: mock((role: string, options?: any) => ({
        ...locatorResult,
        _role: role,
        _options: options,
      })),
      getByLabel: mock(() => locatorResult),
      getByPlaceholder: mock(() => locatorResult),
      getByText: mock(() => locatorResult),
      locator: mock((selector: string) => ({ ...locatorResult, _selector: selector })),
    };
  };

  test('resolves locator using preferred strategy', () => {
    const mockPage = createMockPage();
    const locator: LocatorObject = {
      locator_id: 'loc-1',
      preferred: { type: 'testid', value: 'submit-btn' },
      fallbacks: [],
      proof: {},
    };
    resolveLocator(locator, mockPage as any, { useFallbacks: false });
    expect(mockPage.getByTestId).toHaveBeenCalledWith('submit-btn');
  });

  test('applies nth scoping', () => {
    const mockPage = createMockPage();
    const locator: LocatorObject = {
      locator_id: 'loc-2',
      preferred: { type: 'role', role: 'listitem' },
      fallbacks: [],
      scoping: { nth: 2 },
      proof: {},
    };
    const result = resolveLocator(locator, mockPage as any, { useFallbacks: false });
    expect(result._nth).toBe(2);
  });

  test('applies within scoping', () => {
    const mockPage = createMockPage();
    const locator: LocatorObject = {
      locator_id: 'loc-3',
      preferred: { type: 'role', role: 'button', name: 'Delete' },
      fallbacks: [],
      scoping: {
        within: [{ type: 'testid', value: 'user-list' }],
      },
      proof: {},
    };
    resolveLocator(locator, mockPage as any, { useFallbacks: false });
    expect(mockPage.getByTestId).toHaveBeenCalledWith('user-list');
  });
});
