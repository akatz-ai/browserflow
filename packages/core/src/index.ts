/**
 * @browserflow/core - Shared types, schemas, and utilities
 */

// Spec schema and types
export {
  specSchema,
  specStepSchema,
  stepSchema,
  actionTypeSchema,
  verifyCheckSchema,
  expectedOutcomeSchema,
  highlightRegionSchema,
  maskRegionSchema,
  durationSchema,
  targetSchema,
  preconditionsSchema,
  stateSchema,
  type ActionType,
  type VerifyCheck,
  type HighlightRegion,
  type MaskRegion,
  type SpecStep,
  type LegacySpecStep,
  type ExpectedOutcome,
  type BrowserFlowSpec,
  type Target,
  type State,
  type Preconditions,
} from './spec-schema.js';

// Locator types and resolution
export {
  type LocatorObject,
  type LocatorStrategy,
  type LocatorStrategyType,
  type LocatorScoping,
  type LocatorProof,
  type DOMFingerprint,
  type BoundingBox,
  type ResolveOptions,
  type LocatorMethod,
  type LocatorArgs,
  type LegacyLocatorObject,
  locatorObjectSchema,
  locatorStrategySchema,
  locatorStrategyTypeSchema,
  locatorScopingSchema,
  locatorProofSchema,
  domFingerprintSchema,
  boundingBoxSchema,
  resolveLocator,
  strategyToLocator,
  resolveLegacyLocator,
} from './locator-object.js';

// Lockfile types
export {
  type Lockfile,
  type Mask,
  type Assertion,
  type AssertionType,
  type GenerationMetadata,
  type ExplorationLockfile,
  type ExplorationStep,
  type StepExecution,
  type OutcomeCheck,
  type ExplorationError,
  lockfileSchema,
  maskSchema,
  assertionSchema,
  assertionTypeSchema,
  generationMetadataSchema,
  validateLockfile,
  computeSpecHash,
  readLockfile,
  writeLockfile,
} from './lockfile.js';

// Duration utilities
export { parseDuration, formatDuration, isValidDuration } from './duration.js';

// Run store utilities
export {
  type RunDirectoryPaths,
  type RunStore,
  createRunStore,
  createRunId,
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

