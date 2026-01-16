// @browserflow/exploration - Adapter types

/**
 * Represents a step execution result from AI exploration
 */
export interface StepExecution {
  status: 'completed' | 'failed' | 'skipped';
  method: string;
  elementRef?: string;
  selectorUsed?: string;
  durationMs: number;
  error?: string | null;
}

/**
 * Screenshots captured during a step
 */
export interface StepScreenshots {
  before: string;
  after: string;
}

/**
 * Result of executing a single step
 */
export interface StepResult {
  stepIndex: number;
  specAction: Record<string, unknown>;
  execution: StepExecution;
  screenshots: StepScreenshots;
  snapshotBefore?: Record<string, unknown>;
  snapshotAfter?: Record<string, unknown>;
}

/**
 * Outcome check result
 */
export interface OutcomeCheck {
  check: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

/**
 * Complete output from an exploration run
 */
export interface ExplorationOutput {
  spec: string;
  specPath: string;
  explorationId: string;
  timestamp: string;
  durationMs: number;
  browser: string;
  viewport: { width: number; height: number };
  baseUrl: string;
  steps: StepResult[];
  outcomeChecks: OutcomeCheck[];
  overallStatus: 'completed' | 'failed' | 'timeout';
  errors: string[];
}

/**
 * Step definition from a spec file
 */
export interface SpecStep {
  action: string;
  query?: string;
  selector?: string;
  ref?: string;
  to?: string;
  value?: string;
  for?: string;
  text?: string;
  timeout?: number;
  duration?: number;
  checks?: unknown[];
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Spec file structure
 */
export interface Spec {
  name: string;
  description: string;
  preconditions?: Record<string, unknown>;
  steps: SpecStep[];
  expectedOutcomes?: Record<string, unknown>[];
  tags?: string[];
  timeout?: string;
  priority?: string;
}

/**
 * Parameters for running an exploration
 */
export interface ExploreParams {
  spec: Spec;
  specPath: string;
  baseUrl: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  viewport?: { width: number; height: number };
  timeout?: number;
  outputDir: string;
  sessionId?: string;
}

/**
 * Parameters for retrying with feedback
 */
export interface RetryParams extends ExploreParams {
  previousExploration: ExplorationOutput;
  reviewFeedback: ReviewFeedback;
}

/**
 * Review feedback structure
 */
export interface ReviewFeedback {
  explorationId: string;
  reviewer: string;
  steps: {
    stepIndex: number;
    status: 'approved' | 'rejected' | 'pending';
    comment?: string;
    tags?: string[];
  }[];
  overallNotes?: string;
  verdict: 'approved' | 'rejected';
}

/**
 * Enhanced snapshot from browser - includes tree and element refs
 */
export interface EnhancedSnapshot {
  tree: string;
  refs: Record<string, unknown>;
}

/**
 * Result from findElement operation
 */
export interface FindElementResult {
  /** Element reference (e.g., "e5") or "NOT_FOUND" */
  ref: string;
  /** AI reasoning for why this element was selected */
  reasoning: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * AI Adapter interface - defines the contract for LLM integrations
 */
export interface AIAdapter {
  /**
   * Name of the adapter (e.g., 'claude', 'openai')
   */
  readonly name: string;

  /**
   * Run exploration on a spec
   */
  explore(params: ExploreParams): Promise<ExplorationOutput>;

  /**
   * Find element from natural language query
   * Uses AI to interpret the query and match against snapshot elements
   */
  findElement(query: string, snapshot: EnhancedSnapshot): Promise<FindElementResult>;

  /**
   * Retry exploration with review feedback
   */
  retryWithFeedback?(params: RetryParams): Promise<ExplorationOutput>;
}
