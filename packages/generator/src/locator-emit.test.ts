/**
 * locator-emit.test.ts
 * Tests for the locator-to-code conversion module.
 */

import { describe, it, expect } from 'bun:test';
import type { LegacyLocatorObject } from '@browserflow/core';

// Use the legacy interface for backwards compatibility
type LocatorObject = LegacyLocatorObject;
import {
  generateLocatorCode,
  resolveLocatorCode,
  escapeString,
  selectorToLocator,
  roleLocator,
  textLocator,
  testIdLocator,
} from './locator-emit.js';

describe('escapeString', () => {
  it('escapes single quotes', () => {
    expect(escapeString("it's")).toBe("it\\'s");
  });

  it('escapes backslashes', () => {
    expect(escapeString('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('escapes newlines', () => {
    expect(escapeString('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes carriage returns', () => {
    expect(escapeString('line1\rline2')).toBe('line1\\rline2');
  });

  it('escapes tabs', () => {
    expect(escapeString('col1\tcol2')).toBe('col1\\tcol2');
  });

  it('handles complex strings with multiple special characters', () => {
    expect(escapeString("it's a\ntest\\path")).toBe("it\\'s a\\ntest\\\\path");
  });

  it('returns empty string unchanged', () => {
    expect(escapeString('')).toBe('');
  });

  it('returns normal string unchanged', () => {
    expect(escapeString('normal text')).toBe('normal text');
  });
});

describe('generateLocatorCode', () => {
  describe('CSS selector locators', () => {
    it('generates code from CSS selector', () => {
      const locator: LocatorObject = { selector: 'button.primary' };
      expect(generateLocatorCode(locator)).toBe("page.locator('button.primary')");
    });

    it('escapes special characters in CSS selectors', () => {
      const locator: LocatorObject = { selector: "[data-test='value']" };
      expect(generateLocatorCode(locator)).toBe("page.locator('[data-test=\\'value\\']')");
    });

    it('uses custom page variable', () => {
      const locator: LocatorObject = { selector: 'button' };
      expect(generateLocatorCode(locator, { pageVar: 'frame' })).toBe("frame.locator('button')");
    });
  });

  describe('getByRole locators', () => {
    it('generates getByRole with just role', () => {
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'button' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByRole('button')");
    });

    it('generates getByRole with name', () => {
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'button', name: 'Submit' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByRole('button', { name: 'Submit' })");
    });

    it('generates getByRole with exact match', () => {
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'heading', name: 'Welcome', exact: true },
      };
      expect(generateLocatorCode(locator)).toBe(
        "page.getByRole('heading', { name: 'Welcome', exact: true })"
      );
    });

    it('escapes special characters in name', () => {
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'button', name: "Don't click" },
      };
      expect(generateLocatorCode(locator)).toBe(
        "page.getByRole('button', { name: 'Don\\'t click' })"
      );
    });

    it('throws error if role is missing', () => {
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { name: 'Submit' },
      };
      expect(() => generateLocatorCode(locator)).toThrow('getByRole requires a role argument');
    });
  });

  describe('getByText locators', () => {
    it('generates getByText with text', () => {
      const locator: LocatorObject = {
        method: 'getByText',
        args: { text: 'Hello World' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByText('Hello World')");
    });

    it('generates getByText with exact option', () => {
      const locator: LocatorObject = {
        method: 'getByText',
        args: { text: 'Hello', exact: true },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByText('Hello', { exact: true })");
    });

    it('throws error if text is missing', () => {
      const locator: LocatorObject = {
        method: 'getByText',
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow('getByText requires a text argument');
    });
  });

  describe('getByLabel locators', () => {
    it('generates getByLabel with text', () => {
      const locator: LocatorObject = {
        method: 'getByLabel',
        args: { text: 'Email' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByLabel('Email')");
    });

    it('generates getByLabel with exact option', () => {
      const locator: LocatorObject = {
        method: 'getByLabel',
        args: { text: 'Username', exact: false },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByLabel('Username', { exact: false })");
    });

    it('throws error if text is missing', () => {
      const locator: LocatorObject = {
        method: 'getByLabel',
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow('getByLabel requires a text argument');
    });
  });

  describe('getByPlaceholder locators', () => {
    it('generates getByPlaceholder with text', () => {
      const locator: LocatorObject = {
        method: 'getByPlaceholder',
        args: { text: 'Enter email...' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByPlaceholder('Enter email...')");
    });

    it('generates getByPlaceholder with exact option', () => {
      const locator: LocatorObject = {
        method: 'getByPlaceholder',
        args: { text: 'Search', exact: true },
      };
      expect(generateLocatorCode(locator)).toBe(
        "page.getByPlaceholder('Search', { exact: true })"
      );
    });

    it('throws error if text is missing', () => {
      const locator: LocatorObject = {
        method: 'getByPlaceholder',
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow(
        'getByPlaceholder requires a text argument'
      );
    });
  });

  describe('getByTestId locators', () => {
    it('generates getByTestId with testId', () => {
      const locator: LocatorObject = {
        method: 'getByTestId',
        args: { testId: 'submit-button' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByTestId('submit-button')");
    });

    it('escapes special characters in testId', () => {
      const locator: LocatorObject = {
        method: 'getByTestId',
        args: { testId: "user's-form" },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByTestId('user\\'s-form')");
    });

    it('throws error if testId is missing', () => {
      const locator: LocatorObject = {
        method: 'getByTestId',
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow('getByTestId requires a testId argument');
    });
  });

  describe('getByAltText locators', () => {
    it('generates getByAltText with text', () => {
      const locator: LocatorObject = {
        method: 'getByAltText',
        args: { text: 'Company Logo' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByAltText('Company Logo')");
    });

    it('generates getByAltText with exact option', () => {
      const locator: LocatorObject = {
        method: 'getByAltText',
        args: { text: 'Logo', exact: true },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByAltText('Logo', { exact: true })");
    });

    it('throws error if text is missing', () => {
      const locator: LocatorObject = {
        method: 'getByAltText',
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow('getByAltText requires a text argument');
    });
  });

  describe('getByTitle locators', () => {
    it('generates getByTitle with text', () => {
      const locator: LocatorObject = {
        method: 'getByTitle',
        args: { text: 'Settings' },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByTitle('Settings')");
    });

    it('generates getByTitle with exact option', () => {
      const locator: LocatorObject = {
        method: 'getByTitle',
        args: { text: 'Close', exact: false },
      };
      expect(generateLocatorCode(locator)).toBe("page.getByTitle('Close', { exact: false })");
    });

    it('throws error if text is missing', () => {
      const locator: LocatorObject = {
        method: 'getByTitle',
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow('getByTitle requires a text argument');
    });
  });

  describe('locator method', () => {
    it('generates locator with selector', () => {
      const locator: LocatorObject = {
        method: 'locator',
        args: { selector: 'div.container' },
      };
      expect(generateLocatorCode(locator)).toBe("page.locator('div.container')");
    });

    it('throws error if selector is missing', () => {
      const locator: LocatorObject = {
        method: 'locator',
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow('locator requires a selector argument');
    });
  });

  describe('ref-based locators', () => {
    it('generates locator from element ref', () => {
      const locator: LocatorObject = { ref: '@e23' };
      expect(generateLocatorCode(locator)).toBe("page.locator('[data-ref=\"@e23\"]')");
    });

    it('escapes special characters in ref', () => {
      const locator: LocatorObject = { ref: "@e'23" };
      expect(generateLocatorCode(locator)).toBe("page.locator('[data-ref=\"@e\\'23\"]')");
    });
  });

  describe('chainFirst option', () => {
    it('adds .first() when chainFirst is true', () => {
      const locator: LocatorObject = { selector: 'button' };
      expect(generateLocatorCode(locator, { chainFirst: true })).toBe(
        "page.locator('button').first()"
      );
    });

    it('works with method-based locators', () => {
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'button' },
      };
      expect(generateLocatorCode(locator, { chainFirst: true })).toBe(
        "page.getByRole('button').first()"
      );
    });

    it('does not add .first() when chainFirst is false', () => {
      const locator: LocatorObject = { selector: 'button' };
      expect(generateLocatorCode(locator, { chainFirst: false })).toBe("page.locator('button')");
    });
  });

  describe('nth handling', () => {
    it('adds .first() when nth is 0', () => {
      const locator: LocatorObject = { selector: 'button' };
      expect(generateLocatorCode(locator, { nth: 0 })).toBe("page.locator('button').first()");
    });

    it('adds .last() when nth is -1', () => {
      const locator: LocatorObject = { selector: 'button' };
      expect(generateLocatorCode(locator, { nth: -1 })).toBe("page.locator('button').last()");
    });

    it('adds .nth(n) for positive indices', () => {
      const locator: LocatorObject = { selector: 'button' };
      expect(generateLocatorCode(locator, { nth: 2 })).toBe("page.locator('button').nth(2)");
    });

    it('adds .nth(n) for negative indices other than -1', () => {
      const locator: LocatorObject = { selector: 'button' };
      expect(generateLocatorCode(locator, { nth: -2 })).toBe("page.locator('button').nth(-2)");
    });

    it('works with method-based locators', () => {
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'listitem' },
      };
      expect(generateLocatorCode(locator, { nth: 3 })).toBe(
        "page.getByRole('listitem').nth(3)"
      );
    });

    it('nth takes precedence over chainFirst', () => {
      const locator: LocatorObject = { selector: 'button' };
      // When nth is specified, it should use nth handling, not chainFirst
      expect(generateLocatorCode(locator, { nth: 2, chainFirst: true })).toBe(
        "page.locator('button').nth(2)"
      );
    });
  });

  describe('scoping (within)', () => {
    it('chains parent locator before main locator', () => {
      const parent: LocatorObject = {
        method: 'getByTestId',
        args: { testId: 'form' },
      };
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'button' },
      };
      expect(generateLocatorCode(locator, { within: parent })).toBe(
        "page.getByTestId('form').getByRole('button')"
      );
    });

    it('handles nested scoping with CSS selector parent', () => {
      const parent: LocatorObject = { selector: '.dialog' };
      const locator: LocatorObject = {
        method: 'getByText',
        args: { text: 'Close' },
      };
      expect(generateLocatorCode(locator, { within: parent })).toBe(
        "page.locator('.dialog').getByText('Close')"
      );
    });

    it('combines scoping with nth', () => {
      const parent: LocatorObject = {
        method: 'getByTestId',
        args: { testId: 'list' },
      };
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'listitem' },
      };
      expect(generateLocatorCode(locator, { within: parent, nth: 0 })).toBe(
        "page.getByTestId('list').getByRole('listitem').first()"
      );
    });

    it('respects custom pageVar with within', () => {
      const parent: LocatorObject = {
        method: 'getByTestId',
        args: { testId: 'modal' },
      };
      const locator: LocatorObject = {
        method: 'getByRole',
        args: { role: 'button', name: 'Close' },
      };
      expect(generateLocatorCode(locator, { within: parent, pageVar: 'frame' })).toBe(
        "frame.getByTestId('modal').getByRole('button', { name: 'Close' })"
      );
    });
  });

  describe('error handling', () => {
    it('throws error for locator without method, selector, or ref', () => {
      const locator: LocatorObject = {};
      expect(() => generateLocatorCode(locator)).toThrow(
        'LocatorObject must have either method+args, selector, or ref'
      );
    });

    it('throws error for unknown locator method', () => {
      const locator: LocatorObject = {
        method: 'unknownMethod' as any,
        args: {},
      };
      expect(() => generateLocatorCode(locator)).toThrow('Unknown locator method: unknownMethod');
    });
  });
});

describe('resolveLocatorCode', () => {
  it('uses method-based locator when available', () => {
    const locator: LocatorObject = {
      method: 'getByRole',
      args: { role: 'button' },
    };
    expect(resolveLocatorCode(locator, 'button.fallback')).toBe("page.getByRole('button')");
  });

  it('uses selector from locator when method not available', () => {
    const locator: LocatorObject = { selector: 'button.primary' };
    expect(resolveLocatorCode(locator, 'button.fallback')).toBe("page.locator('button.primary')");
  });

  it('uses fallback selector when locator has no method or selector', () => {
    expect(resolveLocatorCode(undefined, 'button.fallback')).toBe(
      "page.locator('button.fallback')"
    );
  });

  it('throws error when no locator or fallback available', () => {
    expect(() => resolveLocatorCode(undefined, undefined)).toThrow(
      'No locator or selector available'
    );
  });

  it('passes options through', () => {
    const locator: LocatorObject = { selector: 'button' };
    expect(resolveLocatorCode(locator, undefined, { pageVar: 'frame', chainFirst: true })).toBe(
      "frame.locator('button').first()"
    );
  });
});

describe('helper functions', () => {
  describe('selectorToLocator', () => {
    it('creates locator from selector string', () => {
      const locator = selectorToLocator('button.primary');
      expect(locator).toEqual({ selector: 'button.primary' });
    });
  });

  describe('roleLocator', () => {
    it('creates locator for getByRole with just role', () => {
      const locator = roleLocator('button');
      expect(locator).toEqual({
        method: 'getByRole',
        args: { role: 'button' },
      });
    });

    it('creates locator for getByRole with options', () => {
      const locator = roleLocator('button', { name: 'Submit', exact: true });
      expect(locator).toEqual({
        method: 'getByRole',
        args: { role: 'button', name: 'Submit', exact: true },
      });
    });
  });

  describe('textLocator', () => {
    it('creates locator for getByText with just text', () => {
      const locator = textLocator('Hello');
      expect(locator).toEqual({
        method: 'getByText',
        args: { text: 'Hello' },
      });
    });

    it('creates locator for getByText with options', () => {
      const locator = textLocator('Hello', { exact: true });
      expect(locator).toEqual({
        method: 'getByText',
        args: { text: 'Hello', exact: true },
      });
    });
  });

  describe('testIdLocator', () => {
    it('creates locator for getByTestId', () => {
      const locator = testIdLocator('submit-btn');
      expect(locator).toEqual({
        method: 'getByTestId',
        args: { testId: 'submit-btn' },
      });
    });
  });
});
