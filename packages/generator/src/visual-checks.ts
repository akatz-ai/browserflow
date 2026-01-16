/**
 * visual-checks.ts
 * Generates Playwright screenshot assertion code.
 */

import type { MaskRegion } from '@browserflow/core';
import { escapeString } from './locator-emit.js';

/**
 * Options for screenshot assertion generation.
 */
export interface ScreenshotOptions {
  /** Name for the screenshot (used in baseline path) */
  name: string;
  /** Regions to mask during comparison */
  mask?: MaskRegion[];
  /** Maximum allowed pixel difference (0-1) */
  maxDiffPixelRatio?: number;
  /** Threshold for pixel color difference (0-1) */
  threshold?: number;
  /** Animation handling: "disabled" waits for animations to finish */
  animations?: 'disabled' | 'allow';
  /** Whether to capture full page */
  fullPage?: boolean;
  /** Timeout for screenshot capture */
  timeout?: number;
}

/**
 * Options for visual check code generation.
 */
export interface VisualCheckEmitOptions {
  /** Variable name for the page object (default: "page") */
  pageVar?: string;
  /** Base path for baseline screenshots */
  baselinesPath?: string;
  /** Include comments explaining the assertion */
  includeComments?: boolean;
}

/**
 * Generates code for a Playwright toHaveScreenshot assertion.
 *
 * @example
 * generateScreenshotAssertion({ name: 'homepage' })
 * // Returns: "await expect(page).toHaveScreenshot('homepage.png');"
 */
export function generateScreenshotAssertion(
  options: ScreenshotOptions,
  emitOptions: VisualCheckEmitOptions = {}
): string {
  const { pageVar = 'page', includeComments = false } = emitOptions;
  const lines: string[] = [];

  if (includeComments && options.name) {
    lines.push(`// Visual check: ${options.name}`);
  }

  const screenshotName = options.name.endsWith('.png')
    ? options.name
    : `${options.name}.png`;

  const assertionOptions = buildAssertionOptions(options, pageVar);

  if (assertionOptions) {
    lines.push(
      `await expect(${pageVar}).toHaveScreenshot('${escapeString(screenshotName)}', ${assertionOptions});`
    );
  } else {
    lines.push(
      `await expect(${pageVar}).toHaveScreenshot('${escapeString(screenshotName)}');`
    );
  }

  return lines.join('\n');
}

/**
 * Generates code for an element-specific screenshot assertion.
 *
 * @example
 * generateElementScreenshotAssertion("page.locator('.card')", { name: 'card' })
 * // Returns: "await expect(page.locator('.card')).toHaveScreenshot('card.png');"
 */
export function generateElementScreenshotAssertion(
  locatorCode: string,
  options: ScreenshotOptions,
  emitOptions: VisualCheckEmitOptions = {}
): string {
  const { pageVar = 'page', includeComments = false } = emitOptions;
  const lines: string[] = [];

  if (includeComments && options.name) {
    lines.push(`// Visual check (element): ${options.name}`);
  }

  const screenshotName = options.name.endsWith('.png')
    ? options.name
    : `${options.name}.png`;

  const assertionOptions = buildAssertionOptions(options, pageVar);

  if (assertionOptions) {
    lines.push(
      `await expect(${locatorCode}).toHaveScreenshot('${escapeString(screenshotName)}', ${assertionOptions});`
    );
  } else {
    lines.push(
      `await expect(${locatorCode}).toHaveScreenshot('${escapeString(screenshotName)}');`
    );
  }

  return lines.join('\n');
}

/**
 * Builds the options object string for toHaveScreenshot.
 */
function buildAssertionOptions(options: ScreenshotOptions, pageVar = 'page'): string {
  const parts: string[] = [];

  if (options.maxDiffPixelRatio !== undefined) {
    parts.push(`maxDiffPixelRatio: ${options.maxDiffPixelRatio}`);
  }

  if (options.threshold !== undefined) {
    parts.push(`threshold: ${options.threshold}`);
  }

  if (options.animations) {
    parts.push(`animations: '${options.animations}'`);
  }

  if (options.fullPage !== undefined) {
    parts.push(`fullPage: ${options.fullPage}`);
  }

  if (options.timeout !== undefined) {
    parts.push(`timeout: ${options.timeout}`);
  }

  if (options.mask && options.mask.length > 0) {
    const maskCode = generateMaskArray(options.mask, pageVar);
    parts.push(`mask: ${maskCode}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `{ ${parts.join(', ')} }`;
}

/**
 * Generates code for a mask array.
 */
function generateMaskArray(masks: MaskRegion[], pageVar = 'page'): string {
  const maskItems = masks
    .map((mask) => {
      if (mask.selector) {
        return `${pageVar}.locator('${escapeString(mask.selector)}')`;
      }
      // Region-based masks need custom handling
      // Playwright doesn't directly support region masks, so we'd need a locator
      return null;
    })
    .filter((item): item is string => item !== null);

  if (maskItems.length === 0) {
    return '[]';
  }

  return `[${maskItems.join(', ')}]`;
}

/**
 * Generates a screenshot capture statement (not an assertion).
 */
export function generateScreenshotCapture(
  options: ScreenshotOptions,
  emitOptions: VisualCheckEmitOptions = {}
): string {
  const { pageVar = 'page', baselinesPath, includeComments = false } = emitOptions;
  const lines: string[] = [];

  if (includeComments && options.name) {
    lines.push(`// Capture screenshot: ${options.name}`);
  }

  const screenshotName = options.name.endsWith('.png')
    ? options.name
    : `${options.name}.png`;

  const path = baselinesPath
    ? `${baselinesPath}/${screenshotName}`
    : screenshotName;

  const captureOptions: string[] = [];
  captureOptions.push(`path: '${escapeString(path)}'`);

  if (options.fullPage !== undefined) {
    captureOptions.push(`fullPage: ${options.fullPage}`);
  }

  if (options.animations) {
    captureOptions.push(`animations: '${options.animations}'`);
  }

  if (options.mask && options.mask.length > 0) {
    const maskCode = generateMaskArray(options.mask, pageVar);
    captureOptions.push(`mask: ${maskCode}`);
  }

  lines.push(
    `await ${pageVar}.screenshot({ ${captureOptions.join(', ')} });`
  );

  return lines.join('\n');
}

/**
 * Generates code for comparing two screenshot paths.
 * This is useful for custom comparison logic outside of Playwright's built-in assertions.
 */
export function generateScreenshotCompare(
  actualPath: string,
  expectedPath: string,
  options: { threshold?: number } = {}
): string {
  const { threshold = 0.05 } = options;
  return `
// Compare screenshots
const actualBuffer = await fs.readFile('${escapeString(actualPath)}');
const expectedBuffer = await fs.readFile('${escapeString(expectedPath)}');
const { diffPixelRatio } = await compareImages(actualBuffer, expectedBuffer);
expect(diffPixelRatio).toBeLessThanOrEqual(${threshold});
`.trim();
}

/**
 * Generates a helper import statement for visual comparisons.
 */
export function generateVisualImports(): string {
  return `import { expect } from '@playwright/test';`;
}

/**
 * Generates wait-for-animations code before taking a screenshot.
 */
export function generateWaitForAnimations(pageVar = 'page'): string {
  return `// Wait for animations to complete
await ${pageVar}.waitForLoadState('networkidle');
await ${pageVar}.waitForTimeout(500);`;
}
