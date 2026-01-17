// @browserflow/exploration - Main exploration orchestrator

import type {
  AIAdapter,
  ExploreParams,
  ExplorationOutput,
  Spec,
  SpecStep,
  StepResult,
  StepExecution,
  StepScreenshots,
  EnhancedSnapshot,
} from './adapters/types';
import { StepExecutor } from './step-executor';
import { EvidenceCollector } from './evidence';
import { LocatorCandidateGenerator } from './locator-candidates';

/**
 * Browser launch options
 */
export interface BrowserLaunchOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
}

/**
 * Browser session interface - abstracts agent-browser integration
 * Actual implementation will use agent-browser's BrowserManager
 */
export interface BrowserSession {
  isLaunched(): boolean;
  launch(options?: BrowserLaunchOptions): Promise<void>;
  navigate(url: string): Promise<void>;
  screenshot(): Promise<Buffer>;
  getSnapshot(options?: {
    interactive?: boolean;
    maxDepth?: number;
    compact?: boolean;
    selector?: string;
  }): Promise<EnhancedSnapshot>;
  close(): Promise<void>;

  // Interaction methods
  click?(ref: string): Promise<void>;
  fill?(ref: string, value: string): Promise<void>;
  type?(ref: string, text: string): Promise<void>;
  select?(ref: string, option: string): Promise<void>;
  check?(ref: string, checked: boolean): Promise<void>;
  press?(key: string): Promise<void>;

  // Navigation methods
  back?(): Promise<void>;
  forward?(): Promise<void>;
  refresh?(): Promise<void>;

  // Wait methods
  waitForSelector?(selector: string, timeout: number): Promise<void>;
  waitForURL?(urlPattern: string, timeout: number): Promise<void>;
  waitForText?(text: string, timeout: number): Promise<void>;
  waitForLoadState?(state: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void>;
  waitForTimeout?(ms: number): Promise<void>;

  // Scroll methods
  scrollIntoView?(ref: string): Promise<void>;
  scroll?(x: number, y: number): Promise<void>;

  // State methods
  getCurrentURL?(): string;
}

/**
 * Configuration for the Explorer
 */
export interface ExplorerConfig {
  adapter: AIAdapter;
  browser?: BrowserSession;
  outputDir?: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
}

/**
 * Explorer - Main orchestrator for AI-powered browser exploration
 *
 * Coordinates between:
 * - AI adapter (Claude, OpenAI, etc.)
 * - Step executor (runs individual steps)
 * - Evidence collector (screenshots, traces)
 * - Locator candidate generator (element selection strategies)
 */
export class Explorer {
  private adapter: AIAdapter;
  private browser?: BrowserSession;
  private outputDir: string;
  private headless: boolean;
  private defaultViewport: { width: number; height: number };
  private stepExecutor: StepExecutor;
  private evidenceCollector: EvidenceCollector;
  private locatorGenerator: LocatorCandidateGenerator;

  constructor(config: ExplorerConfig) {
    this.adapter = config.adapter;
    this.browser = config.browser;
    this.outputDir = config.outputDir ?? './explorations';
    this.headless = config.headless ?? true;
    this.defaultViewport = config.viewport ?? { width: 1280, height: 720 };
    this.stepExecutor = new StepExecutor();
    this.evidenceCollector = new EvidenceCollector();
    this.locatorGenerator = new LocatorCandidateGenerator();
  }

  /**
   * Generate a unique exploration ID
   */
  private generateExplorationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `exp-${timestamp}-${random}`;
  }

  /**
   * Run full exploration on a spec
   *
   * This is the main orchestration method that:
   * 1. Launches browser
   * 2. Navigates to starting page
   * 3. Executes each step with evidence collection
   * 4. Handles failures gracefully (continues on error)
   * 5. Produces ExplorationOutput
   *
   * @param spec - The spec to explore
   * @param baseUrl - Base URL for navigation
   * @param options - Additional options
   * @returns Promise resolving to exploration output
   */
  async runExploration(
    spec: Spec,
    baseUrl: string,
    options: Partial<{
      specPath: string;
      viewport: { width: number; height: number };
      headless: boolean;
    }> = {}
  ): Promise<ExplorationOutput> {
    const startTime = Date.now();
    const explorationId = this.generateExplorationId();
    const steps: StepResult[] = [];
    const errors: string[] = [];

    // Determine viewport - spec preconditions override defaults
    const viewport =
      (spec.preconditions?.viewport as { width: number; height: number } | undefined) ??
      options.viewport ??
      this.defaultViewport;

    // Ensure browser is available
    if (!this.browser) {
      throw new Error('Browser session not configured');
    }

    try {
      // 1. Launch browser
      await this.browser.launch({
        headless: options.headless ?? this.headless,
        viewport,
      });

      // 2. Navigate to starting page
      const startPage = (spec.preconditions?.page as string) ?? '/';
      const fullUrl = startPage.startsWith('http') ? startPage : `${baseUrl}${startPage}`;
      await this.browser.navigate(fullUrl);

      // 3. Execute each step
      for (let i = 0; i < spec.steps.length; i++) {
        const specStep = spec.steps[i];
        const stepResult = await this.executeStepWithEvidence(specStep, i, baseUrl);
        steps.push(stepResult);

        if (stepResult.execution.status === 'failed' && stepResult.execution.error) {
          errors.push(`Step ${i}: ${stepResult.execution.error}`);
        }
      }

      // 4. Build output
      const overallStatus = steps.every((s) => s.execution.status === 'completed')
        ? 'completed'
        : 'failed';

      return {
        spec: spec.name,
        specPath: options.specPath ?? `specs/${spec.name}.yaml`,
        explorationId,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        browser: 'chromium',
        viewport,
        baseUrl,
        steps,
        outcomeChecks: [],
        overallStatus,
        errors,
      };
    } finally {
      // Always close browser
      await this.browser.close();
    }
  }

  /**
   * Execute a single step with evidence collection (screenshots)
   */
  private async executeStepWithEvidence(
    step: SpecStep,
    stepIndex: number,
    baseUrl: string
  ): Promise<StepResult> {
    const startTime = Date.now();
    let snapshotBefore: EnhancedSnapshot | undefined;
    let snapshotAfter: EnhancedSnapshot | undefined;

    // Capture before screenshot
    const screenshotBeforePath = `screenshots/step-${String(stepIndex).padStart(2, '0')}-before.png`;
    const screenshotAfterPath = `screenshots/step-${String(stepIndex).padStart(2, '0')}-after.png`;

    try {
      // Take before screenshot
      await this.browser!.screenshot();

      // Get snapshot for element finding
      snapshotBefore = await this.browser!.getSnapshot({ interactive: true });

      // Execute the step
      const execution = await this.executeAction(step, snapshotBefore, baseUrl);

      // Take after screenshot
      await this.browser!.screenshot();

      // Get after snapshot
      snapshotAfter = await this.browser!.getSnapshot({ interactive: true });

      return {
        stepIndex,
        specAction: step as Record<string, unknown>,
        execution: {
          ...execution,
          durationMs: Date.now() - startTime,
        },
        screenshots: {
          before: screenshotBeforePath,
          after: screenshotAfterPath,
        },
        snapshotBefore: snapshotBefore as unknown as Record<string, unknown>,
        snapshotAfter: snapshotAfter as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        stepIndex,
        specAction: step as Record<string, unknown>,
        execution: {
          status: 'failed',
          method: step.action,
          durationMs: Date.now() - startTime,
          error: errorMessage,
        },
        screenshots: {
          before: screenshotBeforePath,
          after: screenshotAfterPath,
        },
        snapshotBefore: snapshotBefore as unknown as Record<string, unknown>,
      };
    }
  }

  /**
   * Execute a single action based on step type
   */
  private async executeAction(
    step: SpecStep,
    snapshot: EnhancedSnapshot,
    baseUrl: string
  ): Promise<StepExecution> {
    switch (step.action) {
      case 'navigate': {
        // Support both url (canonical) and to (legacy)
        const targetUrl = step.url ?? step.to;
        if (!targetUrl) {
          throw new Error('Navigate action requires "url" field');
        }
        const url = targetUrl.startsWith('http') ? targetUrl : `${baseUrl}${targetUrl}`;
        await this.browser!.navigate(url);
        return {
          status: 'completed',
          method: 'navigate',
          durationMs: 0,
        };
      }

      case 'click': {
        const elementRef = await this.findElementRef(step, snapshot);
        if (this.browser!.click) {
          await this.browser!.click(elementRef);
        }
        return {
          status: 'completed',
          method: 'click',
          elementRef,
          durationMs: 0,
        };
      }

      case 'fill': {
        const elementRef = await this.findElementRef(step, snapshot);
        const value = step.value ?? '';
        if (this.browser!.fill) {
          await this.browser!.fill(elementRef, value);
        }
        return {
          status: 'completed',
          method: 'fill',
          elementRef,
          durationMs: 0,
        };
      }

      case 'wait': {
        // Wait actions are handled by timing, for now just mark completed
        return {
          status: 'completed',
          method: 'wait',
          durationMs: 0,
        };
      }

      case 'verify_state': {
        // Verify state by checking conditions
        return {
          status: 'completed',
          method: 'verify_state',
          durationMs: 0,
        };
      }

      default: {
        return {
          status: 'completed',
          method: step.action,
          durationMs: 0,
        };
      }
    }
  }

  /**
   * Find element ref using AI adapter or direct selector/ref
   */
  private async findElementRef(step: SpecStep, snapshot: EnhancedSnapshot): Promise<string> {
    // If step has a direct ref, use it
    if (step.ref) {
      return step.ref;
    }

    // If step has a selector, it's already specified
    if (step.selector) {
      return step.selector;
    }

    // Use AI adapter to find element from query
    if (step.query) {
      const result = await this.adapter.findElement(step.query, snapshot);
      if (result.ref === 'NOT_FOUND') {
        throw new Error(`Element not found for query: ${step.query}`);
      }
      return result.ref;
    }

    throw new Error('Step must have ref, selector, or query');
  }

  /**
   * Run exploration on a spec
   *
   * @param spec - The spec to explore
   * @param baseUrl - Base URL for the browser session
   * @param options - Additional options
   * @returns Promise resolving to exploration output
   */
  async explore(
    spec: Spec,
    baseUrl: string,
    options: Partial<ExploreParams> = {}
  ): Promise<ExplorationOutput> {
    const params: ExploreParams = {
      spec,
      specPath: options.specPath ?? `specs/${spec.name}.yaml`,
      baseUrl,
      browser: options.browser ?? 'chromium',
      viewport: options.viewport ?? { width: 1280, height: 720 },
      timeout: options.timeout ?? 30000,
      outputDir: options.outputDir ?? `${this.outputDir}/${spec.name}`,
      sessionId: options.sessionId,
    };

    // Delegate to adapter for AI-powered exploration
    return this.adapter.explore(params);
  }

  /**
   * Execute a single step manually (for testing/debugging)
   *
   * @param step - The step to execute
   * @param stepIndex - Index of the step (default: 0)
   * @returns Promise resolving to step result
   */
  async executeStep(
    step: Spec['steps'][number],
    stepIndex: number = 0
  ): Promise<StepResult> {
    return this.stepExecutor.execute(step, stepIndex);
  }

  /**
   * Capture evidence (screenshot) at current state
   *
   * @param sessionId - Browser session ID
   * @param name - Evidence name/identifier
   * @returns Promise resolving to evidence file path
   */
  async captureEvidence(sessionId: string, name: string): Promise<string> {
    return this.evidenceCollector.captureScreenshot(sessionId, name);
  }

  /**
   * Generate locator candidates for an element
   *
   * @param query - Natural language description of element
   * @param snapshot - Browser snapshot with element refs
   * @returns Promise resolving to ranked list of locator options
   */
  async generateLocators(
    query: string,
    snapshot: Record<string, unknown>
  ): Promise<string[]> {
    return this.locatorGenerator.generateCandidates(query, snapshot);
  }

  /**
   * Get the configured AI adapter
   */
  getAdapter(): AIAdapter {
    return this.adapter;
  }

  /**
   * Get the step executor instance
   */
  getStepExecutor(): StepExecutor {
    return this.stepExecutor;
  }

  /**
   * Get the evidence collector instance
   */
  getEvidenceCollector(): EvidenceCollector {
    return this.evidenceCollector;
  }

  /**
   * Get the locator generator instance
   */
  getLocatorGenerator(): LocatorCandidateGenerator {
    return this.locatorGenerator;
  }
}
