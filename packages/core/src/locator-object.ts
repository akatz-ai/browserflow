/**
 * LocatorObject types and resolution utilities
 *
 * @see bf-6ig for implementation task
 */

import { z } from 'zod';
import type { Page, Locator } from 'playwright-core';

/**
 * Supported locator strategy types
 */
export type LocatorStrategyType = 'testid' | 'role' | 'label' | 'placeholder' | 'text' | 'css';

/**
 * Locator strategy definition
 */
export interface LocatorStrategy {
  type: LocatorStrategyType;
  // For testid
  value?: string;
  attribute?: string; // Default: data-testid
  // For role
  role?: string;
  name?: string;
  exact?: boolean; // Default: true
  // For label/placeholder/text
  text?: string;
  // For css
  selector?: string;
}

/**
 * DOM fingerprint for element verification
 */
export interface DOMFingerprint {
  tag: string;
  classes: string[];
  attributes?: Record<string, string>;
}

/**
 * Bounding box for element position
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Proof data for element verification
 */
export interface LocatorProof {
  a11y_role?: string;
  a11y_name?: string;
  dom_fingerprint?: DOMFingerprint;
  bounding_box?: BoundingBox;
}

/**
 * Scoping constraints for locator
 */
export interface LocatorScoping {
  within?: LocatorStrategy[];
  nth?: number;
}

/**
 * Complete LocatorObject - core primitive for deterministic element selection
 */
export interface LocatorObject {
  locator_id: string;
  preferred: LocatorStrategy;
  fallbacks: LocatorStrategy[];
  scoping?: LocatorScoping;
  proof: LocatorProof;
}

/**
 * Options for resolving locators
 */
export interface ResolveOptions {
  useFallbacks: boolean; // false in CI, true in dev
  timeout?: number;
}

// Zod schemas
export const locatorStrategyTypeSchema = z.enum(['testid', 'role', 'label', 'placeholder', 'text', 'css']);

export const locatorStrategySchema = z.object({
  type: locatorStrategyTypeSchema,
  // For testid
  value: z.string().optional(),
  attribute: z.string().optional(),
  // For role
  role: z.string().optional(),
  name: z.string().optional(),
  exact: z.boolean().optional(),
  // For label/placeholder/text
  text: z.string().optional(),
  // For css
  selector: z.string().optional(),
});

export const domFingerprintSchema = z.object({
  tag: z.string(),
  classes: z.array(z.string()),
  attributes: z.record(z.string()).optional(),
});

export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const locatorProofSchema = z.object({
  a11y_role: z.string().optional(),
  a11y_name: z.string().optional(),
  dom_fingerprint: domFingerprintSchema.optional(),
  bounding_box: boundingBoxSchema.optional(),
});

export const locatorScopingSchema = z.object({
  within: z.array(locatorStrategySchema).optional(),
  nth: z.number().int().optional(),
});

export const locatorObjectSchema = z.object({
  locator_id: z.string().min(1),
  preferred: locatorStrategySchema,
  fallbacks: z.array(locatorStrategySchema),
  scoping: locatorScopingSchema.optional(),
  proof: locatorProofSchema,
});

/**
 * Converts a LocatorStrategy to a Playwright Locator
 */
export function strategyToLocator(strategy: LocatorStrategy, page: Page): Locator {
  switch (strategy.type) {
    case 'testid':
      if (strategy.attribute && strategy.attribute !== 'data-testid') {
        // Custom testid attribute
        return page.locator(`[${strategy.attribute}="${strategy.value}"]`);
      }
      return page.getByTestId(strategy.value!);

    case 'role':
      const roleOptions: { name?: string; exact?: boolean } = {};
      if (strategy.name) {
        roleOptions.name = strategy.name;
        roleOptions.exact = strategy.exact ?? true;
      }
      return page.getByRole(strategy.role as any, roleOptions);

    case 'label':
      return page.getByLabel(strategy.text!);

    case 'placeholder':
      return page.getByPlaceholder(strategy.text!);

    case 'text':
      return page.getByText(strategy.text!);

    case 'css':
      return page.locator(strategy.selector!);

    default:
      throw new Error(`Unknown locator strategy type: ${(strategy as any).type}`);
  }
}

/**
 * Resolves a LocatorObject to a Playwright Locator
 */
export function resolveLocator(
  locatorObj: LocatorObject,
  page: Page,
  options: ResolveOptions
): Locator {
  // Start with preferred strategy
  let locator = strategyToLocator(locatorObj.preferred, page);

  // Apply scoping constraints
  if (locatorObj.scoping?.within) {
    for (const scope of locatorObj.scoping.within) {
      const scopeLocator = strategyToLocator(scope, page);
      locator = scopeLocator.locator(locator);
    }
  }

  if (locatorObj.scoping?.nth !== undefined) {
    locator = locator.nth(locatorObj.scoping.nth);
  }

  // TODO: If useFallbacks is true and locator doesn't find element,
  // iterate through fallbacks. This requires async operation.

  return locator;
}

// Legacy exports for backwards compatibility
export type LocatorMethod =
  | 'getByRole'
  | 'getByText'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByTestId'
  | 'getByAltText'
  | 'getByTitle'
  | 'locator';

export interface LocatorArgs {
  role?: string;
  name?: string | RegExp;
  text?: string | RegExp;
  exact?: boolean;
  selector?: string;
  [key: string]: unknown;
}

/**
 * Legacy LocatorObject interface (for backwards compatibility)
 */
export interface LegacyLocatorObject {
  ref?: string;
  selector?: string;
  method?: LocatorMethod;
  args?: LocatorArgs;
  description?: string;
}

/**
 * Legacy function - resolves a LegacyLocatorObject to a string representation
 */
export function resolveLegacyLocator(locator: LegacyLocatorObject): string {
  if (locator.selector) {
    return `locator(${JSON.stringify(locator.selector)})`;
  }
  if (locator.method && locator.args) {
    const argsStr = JSON.stringify(locator.args);
    return `${locator.method}(${argsStr})`;
  }
  return 'locator("body")';
}
