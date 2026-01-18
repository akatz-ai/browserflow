// @browserflow/exploration - AI exploration engine

// Main orchestrator
export { Explorer } from './explorer';
export type { ExplorerConfig, BrowserSession, BrowserLaunchOptions } from './explorer';

// Adapters
export { ClaudeAdapter } from './adapters/claude';
export type { ClaudeAdapterConfig } from './adapters/claude';

// Browser Session Adapters
export { AgentBrowserSession, createBrowserSession } from './agent-browser-session';

// Core types
export type {
  AIAdapter,
  ExploreParams,
  ExplorationOutput,
  RetryParams,
  ReviewFeedback,
  Spec,
  SpecStep,
  StepResult,
  StepExecution,
  StepScreenshots,
  OutcomeCheck,
  EnhancedSnapshot,
  FindElementResult,
} from './adapters/types';

// Step execution
export { StepExecutor } from './step-executor';
export type { StepExecutorConfig } from './step-executor';

// Evidence collection
export { EvidenceCollector } from './evidence';
export type {
  EvidenceCollectorConfig,
  EvidenceMetadata,
  ScreenshotOptions,
} from './evidence';

// Locator generation
export { LocatorCandidateGenerator } from './locator-candidates';
export type {
  LocatorCandidateGeneratorConfig,
  LocatorCandidate,
  ElementInfo,
} from './locator-candidates';
