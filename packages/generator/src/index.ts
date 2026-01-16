/**
 * @browserflow/generator
 *
 * Playwright test generator for BrowserFlow.
 * Converts exploration lockfiles into deterministic Playwright Test code.
 */

// Main generator class
export { PlaywrightGenerator, generateTest } from './playwright-ts.js';
export type { TestGeneratorOptions } from './playwright-ts.js';

// Locator code generation
export {
  generateLocatorCode,
  resolveLocatorCode,
  escapeString,
  selectorToLocator,
  roleLocator,
  textLocator,
  testIdLocator,
} from './locator-emit.js';
export type { LocatorEmitOptions } from './locator-emit.js';

// Visual check code generation
export {
  generateScreenshotAssertion,
  generateElementScreenshotAssertion,
  generateScreenshotCapture,
  generateScreenshotCompare,
  generateVisualImports,
  generateWaitForAnimations,
} from './visual-checks.js';
export type { ScreenshotOptions, VisualCheckEmitOptions } from './visual-checks.js';

// Config generation
export {
  generatePlaywrightConfig,
  generateMinimalConfig,
  generatePlaywrightScripts,
  generateSetupInstructions,
} from './config-emit.js';
export type { ConfigGeneratorOptions } from './config-emit.js';

// Re-export core types for convenience
export type {
  ExplorationLockfile,
  ExplorationStep,
  GeneratorConfig,
  GeneratedTest,
  GeneratedConfig,
  LocatorObject,
  LocatorMethod,
  LocatorArgs,
  ReviewData,
  PlaywrightConfigOptions,
  PlaywrightProject,
} from '@browserflow/core';
