/**
 * LocatorObject types and resolution utilities
 *
 * @see bf-6ig for implementation task
 */

/**
 * Supported Playwright locator methods
 */
export type LocatorMethod =
  | 'getByRole'
  | 'getByText'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByTestId'
  | 'getByAltText'
  | 'getByTitle'
  | 'locator';

/**
 * Arguments for locator methods
 */
export interface LocatorArgs {
  role?: string;
  name?: string | RegExp;
  text?: string | RegExp;
  exact?: boolean;
  selector?: string;
  [key: string]: unknown;
}

/**
 * A locator object representing how to find an element in the page.
 * Generated during exploration and used for deterministic test generation.
 */
export interface LocatorObject {
  /** Element reference from snapshot (e.g., "@e23") */
  ref?: string;
  /** CSS selector for the element */
  selector?: string;
  /** Playwright locator method (e.g., "getByRole", "getByText") */
  method?: LocatorMethod;
  /** Arguments for the locator method */
  args?: LocatorArgs;
  /** Human-readable description of what this locates */
  description?: string;
}

/**
 * Resolves a LocatorObject to a Playwright locator string.
 * Placeholder - will be implemented in bf-6ig.
 */
export function resolveLocator(locator: LocatorObject): string {
  if (locator.selector) {
    return `locator(${JSON.stringify(locator.selector)})`;
  }
  if (locator.method && locator.args) {
    const argsStr = JSON.stringify(locator.args);
    return `${locator.method}(${argsStr})`;
  }
  return 'locator("body")';
}
