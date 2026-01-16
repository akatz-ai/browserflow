/**
 * @browserflow/core - Shared types, schemas, and utilities
 */

// Spec schema and types
export {
  specSchema,
  specStepSchema,
  actionTypeSchema,
  verifyCheckSchema,
  expectedOutcomeSchema,
  highlightRegionSchema,
  maskRegionSchema,
  type ActionType,
  type VerifyCheck,
  type HighlightRegion,
  type MaskRegion,
  type SpecStep,
  type ExpectedOutcome,
  type BrowserFlowSpec,
} from './spec-schema.js';

// Locator types and resolution
export {
  type LocatorObject,
  type LocatorMethod,
  type LocatorArgs,
  resolveLocator,
} from './locator-object.js';

// Lockfile types
export {
  type ExplorationLockfile,
  type ExplorationStep,
  type StepExecution,
  type OutcomeCheck,
  type ExplorationError,
} from './lockfile.js';

// Duration utilities
export { parseDuration, formatDuration } from './duration.js';

// Run store utilities
export {
  type RunDirectoryPaths,
  getRunPaths,
  generateExplorationId,
  getScreenshotPath,
} from './run-store.js';

// Configuration types
export {
  type GeneratorOutputFormat,
  type BrowserType,
  type PlaywrightProject,
  type PlaywrightConfigOptions,
  type GeneratorConfig,
  type ReviewStepData,
  type ReviewData,
  type GeneratedTest,
  type GeneratedConfig,
} from './config.js';

