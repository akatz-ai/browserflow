/**
 * Lockfile types for exploration results
 *
 * @see bf-aak for implementation task
 */

import type { LocatorObject } from './locator-object.js';
import type { SpecStep } from './spec-schema.js';

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
