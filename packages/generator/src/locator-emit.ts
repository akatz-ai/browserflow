/**
 * locator-emit.ts
 * Converts LocatorObject instances to Playwright locator code strings.
 */

import type { LegacyLocatorObject, LocatorMethod } from '@browserflow/core';

// Use the legacy interface for backwards compatibility
type LocatorObject = LegacyLocatorObject;

/**
 * Options for code generation.
 */
export interface LocatorEmitOptions {
  /** Variable name for the page object (default: "page") */
  pageVar?: string;
  /** Whether to chain .first() for potentially multiple matches */
  chainFirst?: boolean;
  /**
   * Index-based selection for multiple matches:
   * - 0: .first()
   * - -1: .last()
   * - other: .nth(n)
   * Takes precedence over chainFirst when specified.
   */
  nth?: number;
  /**
   * Parent locator for scoping. The generated code will be
   * chained from this parent locator.
   * Example: within: { method: 'getByTestId', args: { testId: 'form' } }
   * Results in: page.getByTestId('form').getByRole('button')
   */
  within?: LocatorObject;
}

/**
 * Escapes a string for use in generated TypeScript code.
 */
export function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Formats a value as a TypeScript literal.
 */
function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${escapeString(value)}'`;
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return 'undefined';
  }
  return JSON.stringify(value);
}

/**
 * Generates Playwright locator code from a LocatorObject.
 *
 * @example
 * // getByRole example
 * generateLocatorCode({ method: 'getByRole', args: { role: 'button', name: 'Submit' } })
 * // Returns: "page.getByRole('button', { name: 'Submit' })"
 *
 * @example
 * // CSS selector example
 * generateLocatorCode({ selector: 'button.primary' })
 * // Returns: "page.locator('button.primary')"
 */
export function generateLocatorCode(
  locator: LocatorObject,
  options: LocatorEmitOptions = {}
): string {
  const { pageVar = 'page', chainFirst = false, nth, within } = options;

  // Start with the base variable or parent locator chain
  let baseVar = pageVar;
  if (within) {
    // Generate code for the parent locator (without page var suffix methods)
    baseVar = generateLocatorCode(within, { pageVar });
  }

  let code: string;

  if (locator.method && locator.args) {
    code = generateMethodLocator(locator.method, locator.args, baseVar);
  } else if (locator.selector) {
    code = `${baseVar}.locator('${escapeString(locator.selector)}')`;
  } else if (locator.ref) {
    // Element refs need to be resolved - use a placeholder selector
    // In practice, the exploration should have resolved this to a selector
    code = `${baseVar}.locator('[data-ref="${escapeString(locator.ref)}"]')`;
  } else {
    throw new Error('LocatorObject must have either method+args, selector, or ref');
  }

  // Apply nth handling - takes precedence over chainFirst
  if (nth !== undefined) {
    if (nth === 0) {
      code += '.first()';
    } else if (nth === -1) {
      code += '.last()';
    } else {
      code += `.nth(${nth})`;
    }
  } else if (chainFirst) {
    code += '.first()';
  }

  return code;
}

/**
 * Generates code for Playwright locator methods (getByRole, getByText, etc.)
 */
function generateMethodLocator(
  method: LocatorMethod,
  args: Record<string, unknown>,
  pageVar: string
): string {
  switch (method) {
    case 'getByRole': {
      const { role, ...options } = args;
      if (!role) {
        throw new Error('getByRole requires a role argument');
      }
      const escapedRole = escapeString(String(role));
      const optionsStr = formatOptions(options);
      if (optionsStr) {
        return `${pageVar}.getByRole('${escapedRole}', ${optionsStr})`;
      }
      return `${pageVar}.getByRole('${escapedRole}')`;
    }

    case 'getByText': {
      const { text, exact } = args;
      if (text === undefined) {
        throw new Error('getByText requires a text argument');
      }
      const textValue = formatValue(text);
      if (exact !== undefined) {
        return `${pageVar}.getByText(${textValue}, { exact: ${exact} })`;
      }
      return `${pageVar}.getByText(${textValue})`;
    }

    case 'getByLabel': {
      const { text, exact } = args;
      if (text === undefined) {
        throw new Error('getByLabel requires a text argument');
      }
      const textValue = formatValue(text);
      if (exact !== undefined) {
        return `${pageVar}.getByLabel(${textValue}, { exact: ${exact} })`;
      }
      return `${pageVar}.getByLabel(${textValue})`;
    }

    case 'getByPlaceholder': {
      const { text, exact } = args;
      if (text === undefined) {
        throw new Error('getByPlaceholder requires a text argument');
      }
      const textValue = formatValue(text);
      if (exact !== undefined) {
        return `${pageVar}.getByPlaceholder(${textValue}, { exact: ${exact} })`;
      }
      return `${pageVar}.getByPlaceholder(${textValue})`;
    }

    case 'getByTestId': {
      const { testId } = args;
      if (testId === undefined) {
        throw new Error('getByTestId requires a testId argument');
      }
      return `${pageVar}.getByTestId('${escapeString(String(testId))}')`;
    }

    case 'getByAltText': {
      const { text, exact } = args;
      if (text === undefined) {
        throw new Error('getByAltText requires a text argument');
      }
      const textValue = formatValue(text);
      if (exact !== undefined) {
        return `${pageVar}.getByAltText(${textValue}, { exact: ${exact} })`;
      }
      return `${pageVar}.getByAltText(${textValue})`;
    }

    case 'getByTitle': {
      const { text, exact } = args;
      if (text === undefined) {
        throw new Error('getByTitle requires a text argument');
      }
      const textValue = formatValue(text);
      if (exact !== undefined) {
        return `${pageVar}.getByTitle(${textValue}, { exact: ${exact} })`;
      }
      return `${pageVar}.getByTitle(${textValue})`;
    }

    case 'locator': {
      const { selector } = args;
      if (selector === undefined) {
        throw new Error('locator requires a selector argument');
      }
      return `${pageVar}.locator('${escapeString(String(selector))}')`;
    }

    default:
      throw new Error(`Unknown locator method: ${method}`);
  }
}

/**
 * Formats an options object for code generation.
 */
function formatOptions(options: Record<string, unknown>): string {
  const entries = Object.entries(options).filter(
    ([_, v]) => v !== undefined && v !== null
  );

  if (entries.length === 0) {
    return '';
  }

  const parts = entries.map(([key, value]) => {
    return `${key}: ${formatValue(value)}`;
  });

  return `{ ${parts.join(', ')} }`;
}

/**
 * Creates a LocatorObject from a CSS selector string.
 */
export function selectorToLocator(selector: string): LocatorObject {
  return { selector };
}

/**
 * Creates a LocatorObject for getByRole.
 */
export function roleLocator(
  role: string,
  options?: { name?: string; exact?: boolean }
): LocatorObject {
  return {
    method: 'getByRole',
    args: { role, ...options },
  };
}

/**
 * Creates a LocatorObject for getByText.
 */
export function textLocator(
  text: string,
  options?: { exact?: boolean }
): LocatorObject {
  return {
    method: 'getByText',
    args: { text, ...options },
  };
}

/**
 * Creates a LocatorObject for getByTestId.
 */
export function testIdLocator(testId: string): LocatorObject {
  return {
    method: 'getByTestId',
    args: { testId },
  };
}

/**
 * Resolves the best locator code from an exploration step.
 * Prefers method-based locators over CSS selectors.
 */
export function resolveLocatorCode(
  locator: LocatorObject | undefined,
  fallbackSelector: string | undefined,
  options: LocatorEmitOptions = {}
): string {
  if (locator?.method && locator.args) {
    return generateLocatorCode(locator, options);
  }

  if (locator?.selector) {
    return generateLocatorCode(locator, options);
  }

  if (fallbackSelector) {
    return generateLocatorCode({ selector: fallbackSelector }, options);
  }

  throw new Error('No locator or selector available');
}
