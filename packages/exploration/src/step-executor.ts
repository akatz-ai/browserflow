// @browserflow/exploration - Step executor

import type { SpecStep, StepResult, StepExecution, StepScreenshots } from './adapters/types';

/**
 * Configuration for step execution
 */
export interface StepExecutorConfig {
  defaultTimeout?: number;
  screenshotDir?: string;
}

/**
 * StepExecutor - Executes individual spec steps against a browser session
 *
 * Handles:
 * - Click, fill, navigate actions
 * - Wait conditions
 * - State verification
 * - Screenshot capture around each step
 */
export class StepExecutor {
  private defaultTimeout: number;
  private screenshotDir: string;

  constructor(config: StepExecutorConfig = {}) {
    this.defaultTimeout = config.defaultTimeout ?? 30000;
    this.screenshotDir = config.screenshotDir ?? './screenshots';
  }

  /**
   * Execute a single step
   *
   * @param step - The step definition from the spec
   * @param sessionId - Browser session ID
   * @param stepIndex - Index of this step in the spec
   * @returns Promise resolving to step result
   */
  async execute(
    step: SpecStep,
    sessionId: string,
    stepIndex: number = 0
  ): Promise<StepResult> {
    // TODO: Implement in bf-c4o (C.3: Implement step executor)
    // This stub returns a minimal valid structure for compilation
    const startTime = Date.now();

    const execution: StepExecution = {
      status: 'completed',
      method: `stub execution for ${step.action}`,
      durationMs: Date.now() - startTime,
    };

    const screenshots: StepScreenshots = {
      before: `${this.screenshotDir}/step-${String(stepIndex).padStart(2, '0')}-before.png`,
      after: `${this.screenshotDir}/step-${String(stepIndex).padStart(2, '0')}-after.png`,
    };

    return {
      stepIndex,
      specAction: step as Record<string, unknown>,
      execution,
      screenshots,
    };
  }

  /**
   * Execute a click action
   */
  async executeClick(
    sessionId: string,
    target: { query?: string; selector?: string; ref?: string }
  ): Promise<StepExecution> {
    // TODO: Implement in bf-c4o
    return {
      status: 'completed',
      method: 'click',
      durationMs: 0,
    };
  }

  /**
   * Execute a fill action
   */
  async executeFill(
    sessionId: string,
    target: { query?: string; selector?: string; ref?: string },
    value: string
  ): Promise<StepExecution> {
    // TODO: Implement in bf-c4o
    return {
      status: 'completed',
      method: 'fill',
      durationMs: 0,
    };
  }

  /**
   * Execute a navigate action
   */
  async executeNavigate(sessionId: string, url: string): Promise<StepExecution> {
    // TODO: Implement in bf-c4o
    return {
      status: 'completed',
      method: 'navigate',
      durationMs: 0,
    };
  }

  /**
   * Execute a wait action
   */
  async executeWait(
    sessionId: string,
    condition: { for: string; selector?: string; text?: string; contains?: string },
    timeout?: number
  ): Promise<StepExecution> {
    // TODO: Implement in bf-c4o
    return {
      status: 'completed',
      method: 'wait',
      durationMs: 0,
    };
  }

  /**
   * Execute a verify_state action
   */
  async executeVerifyState(
    sessionId: string,
    checks: unknown[]
  ): Promise<StepExecution> {
    // TODO: Implement in bf-c4o
    return {
      status: 'completed',
      method: 'verify_state',
      durationMs: 0,
    };
  }

  /**
   * Get the default timeout value
   */
  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }

  /**
   * Get the screenshot directory
   */
  getScreenshotDir(): string {
    return this.screenshotDir;
  }
}
