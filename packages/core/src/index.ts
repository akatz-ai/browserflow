// @browserflow/core - Shared types, schemas, and utilities

// ============================================================================
// Locator Types
// ============================================================================

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

// ============================================================================
// Spec Types (Input)
// ============================================================================

export interface BrowserFlowSpec {
  name: string;
  description: string;
  preconditions?: Record<string, unknown>;
  steps: SpecStep[];
  expected_outcomes?: ExpectedOutcome[];
  timeout?: string;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  tags?: string[];
}

export interface SpecStep {
  action: ActionType;
  query?: string;
  selector?: string;
  ref?: string;
  description?: string;
  to?: string;
  value?: string;
  for?: 'element' | 'text' | 'url' | 'time';
  text?: string;
  contains?: string;
  timeout?: number;
  duration?: number;
  checks?: VerifyCheck[];
  name?: string;
  highlight?: HighlightRegion[];
  mask?: MaskRegion[];
  option?: string;
  checked?: boolean;
  pressEnter?: boolean;
  question?: string;
  expected?: boolean;
  save_as?: string;
}

export type ActionType =
  | 'click'
  | 'navigate'
  | 'back'
  | 'forward'
  | 'refresh'
  | 'fill'
  | 'type'
  | 'select'
  | 'check'
  | 'wait'
  | 'verify_state'
  | 'screenshot'
  | 'identify_element'
  | 'ai_verify'
  | 'custom';

export interface VerifyCheck {
  element_visible?: string;
  element_not_visible?: string;
  text_contains?: string;
  text_not_contains?: string;
  url_contains?: string;
  element_count?: { selector: string; expected: number };
  attribute?: { selector: string; attribute: string; equals: string };
}

export interface ExpectedOutcome {
  [key: string]: boolean | number | string;
}

export interface HighlightRegion {
  selector: string;
  label?: string;
}

export interface MaskRegion {
  selector?: string;
  region?: { x: number; y: number; width: number; height: number };
  reason?: string;
}

// ============================================================================
// Exploration Types (Lockfile)
// ============================================================================

/**
 * The exploration lockfile - contains all information needed to generate
 * deterministic tests without AI involvement.
 */
export interface ExplorationLockfile {
  /** Spec name that was explored */
  spec: string;
  /** Path to the spec file */
  spec_path: string;
  /** Unique exploration identifier */
  exploration_id: string;
  /** When exploration was run */
  timestamp: string;
  /** Total exploration duration in ms */
  duration_ms: number;
  /** Browser used for exploration */
  browser: 'chromium' | 'firefox' | 'webkit';
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Base URL used */
  base_url: string;
  /** Step execution results */
  steps: ExplorationStep[];
  /** Outcome verification results */
  outcome_checks: OutcomeCheck[];
  /** Overall exploration status */
  overall_status: 'completed' | 'failed' | 'timeout';
  /** Any errors encountered */
  errors: ExplorationError[];
}

export interface ExplorationStep {
  /** Step index (0-based) */
  step_index: number;
  /** Original spec action */
  spec_action: SpecStep;
  /** Execution details */
  execution: StepExecution;
  /** Screenshot paths */
  screenshots: {
    before?: string;
    after?: string;
  };
  /** Element snapshot before action */
  snapshot_before?: Record<string, unknown>;
  /** Element snapshot after action */
  snapshot_after?: Record<string, unknown>;
}

export interface StepExecution {
  /** Execution status */
  status: 'completed' | 'failed' | 'skipped';
  /** Method used to find element */
  method?: string;
  /** Element reference found */
  element_ref?: string;
  /** Final selector used */
  selector_used?: string;
  /** Resolved locator object */
  locator?: LocatorObject;
  /** Execution duration in ms */
  duration_ms: number;
  /** Error message if failed */
  error?: string;
  /** Value that was filled/typed */
  value_used?: string;
  /** URL navigated to */
  url_used?: string;
}

export interface OutcomeCheck {
  check: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface ExplorationError {
  step_index?: number;
  message: string;
  stack?: string;
}

// ============================================================================
// Review Types
// ============================================================================

export interface ReviewData {
  exploration_id: string;
  reviewer?: string;
  started_at: string;
  updated_at: string;
  steps: ReviewStepData[];
  overall_notes?: string;
  verdict: 'approved' | 'rejected' | 'pending';
  submitted_at?: string;
}

export interface ReviewStepData {
  step_index: number;
  status: 'approved' | 'rejected' | 'pending';
  comment?: string;
  tags?: string[];
}

// ============================================================================
// Generator Config Types
// ============================================================================

export interface GeneratorConfig {
  /** Output format for generated tests */
  outputFormat: 'playwright-ts' | 'playwright-js' | 'bash';
  /** Include baseline screenshot comparisons */
  includeBaselineChecks: boolean;
  /** Directory for baseline screenshots */
  baselinesDir?: string;
  /** Playwright config options */
  playwrightConfig?: PlaywrightConfigOptions;
}

export interface PlaywrightConfigOptions {
  /** Test timeout in ms */
  timeout?: number;
  /** Number of retries */
  retries?: number;
  /** Number of workers */
  workers?: number;
  /** Reporter to use */
  reporter?: 'html' | 'list' | 'dot' | 'json';
  /** Projects configuration */
  projects?: PlaywrightProject[];
  /** Use webServer config */
  webServer?: {
    command: string;
    url: string;
    reuseExistingServer?: boolean;
  };
}

export interface PlaywrightProject {
  name: string;
  use: {
    browserName?: 'chromium' | 'firefox' | 'webkit';
    viewport?: { width: number; height: number };
    headless?: boolean;
    [key: string]: unknown;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export interface GeneratedTest {
  /** Test file path (relative) */
  path: string;
  /** Test file content */
  content: string;
  /** Spec name this was generated from */
  specName: string;
  /** Exploration ID used */
  explorationId: string;
  /** Generation timestamp */
  generatedAt: string;
}

export interface GeneratedConfig {
  /** Config file path */
  path: string;
  /** Config file content */
  content: string;
}
