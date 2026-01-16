// @browserflow/exploration - Main exploration orchestrator

import type {
  AIAdapter,
  ExploreParams,
  ExplorationOutput,
  Spec,
  StepResult,
} from './adapters/types';
import { StepExecutor } from './step-executor';
import { EvidenceCollector } from './evidence';
import { LocatorCandidateGenerator } from './locator-candidates';

/**
 * Browser session interface - abstracts agent-browser integration
 * Actual implementation will use agent-browser's BrowserManager
 */
export interface BrowserSession {
  isLaunched(): boolean;
  getSnapshot(options?: {
    interactive?: boolean;
    maxDepth?: number;
    compact?: boolean;
    selector?: string;
  }): Promise<{ tree: string; refs: Record<string, unknown> }>;
  close(): Promise<void>;
}

/**
 * Configuration for the Explorer
 */
export interface ExplorerConfig {
  adapter: AIAdapter;
  browser?: BrowserSession;
  outputDir?: string;
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
  private stepExecutor: StepExecutor;
  private evidenceCollector: EvidenceCollector;
  private locatorGenerator: LocatorCandidateGenerator;

  constructor(config: ExplorerConfig) {
    this.adapter = config.adapter;
    this.browser = config.browser;
    this.outputDir = config.outputDir ?? './explorations';
    this.stepExecutor = new StepExecutor();
    this.evidenceCollector = new EvidenceCollector();
    this.locatorGenerator = new LocatorCandidateGenerator();
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
   * @param sessionId - Browser session ID
   * @returns Promise resolving to step result
   */
  async executeStep(
    step: Spec['steps'][number],
    sessionId: string
  ): Promise<StepResult> {
    return this.stepExecutor.execute(step, sessionId);
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
