/**
 * Configuration types for BrowserFlow
 */

/**
 * Generator output format options
 */
export type GeneratorOutputFormat = 'playwright-ts' | 'playwright-js' | 'bash';

/**
 * Browser types supported by Playwright
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Playwright project configuration
 */
export interface PlaywrightProject {
  name: string;
  use: {
    browserName?: BrowserType;
    viewport?: { width: number; height: number };
    headless?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Playwright configuration options for generated tests
 */
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
  /** Web server configuration */
  webServer?: {
    command: string;
    url: string;
    reuseExistingServer?: boolean;
  };
}

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  /** Output format for generated tests */
  outputFormat: GeneratorOutputFormat;
  /** Include baseline screenshot comparisons */
  includeBaselineChecks: boolean;
  /** Directory for baseline screenshots */
  baselinesDir?: string;
  /** Playwright config options */
  playwrightConfig?: PlaywrightConfigOptions;
}

/**
 * Review step data
 */
export interface ReviewStepData {
  step_index: number;
  status: 'approved' | 'rejected' | 'pending';
  comment?: string;
  tags?: string[];
}

/**
 * Review data for an exploration
 */
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

/**
 * Generated test output
 */
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

/**
 * Generated config output
 */
export interface GeneratedConfig {
  /** Config file path */
  path: string;
  /** Config file content */
  content: string;
}
