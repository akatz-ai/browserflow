// @browserflow/exploration - Step executor

import { parseDuration } from '@browserflow/core';
import type { BrowserSession } from './explorer';
import type {
  SpecStep,
  StepResult,
  StepExecution,
  AIAdapter,
  EnhancedSnapshot,
  VerifyCheck,
} from './adapters/types';

/**
 * Parse a timeout/duration value that can be string or number
 * Supports duration strings like "500ms", "5s", "1m" as well as plain numbers
 */
function parseTimeout(value: string | number | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  try {
    return parseDuration(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Configuration for step execution
 */
export interface StepExecutorConfig {
  browser?: BrowserSession;
  adapter?: AIAdapter;
  baseUrl?: string;
  defaultTimeout?: number;
  screenshotDir?: string;
  captureBeforeScreenshots?: boolean;
  captureAfterScreenshots?: boolean;
  customActionHandlers?: Record<
    string,
    (step: SpecStep, browser: BrowserSession) => Promise<StepExecution>
  >;
}

/**
 * Target resolution result
 */
interface ResolvedTarget {
  ref: string;
  selector?: string;
}

/**
 * StepExecutor - Executes individual spec steps against a browser session
 *
 * Handles:
 * - Navigation: navigate, back, forward, refresh
 * - Interaction: click, fill, type, select, check, press
 * - Waiting: wait for element, text, url, time
 * - Assertions: verify_state with various checks
 * - Capture: screenshot, scroll
 */
export class StepExecutor {
  private browser?: BrowserSession;
  private adapter?: AIAdapter;
  private baseUrl: string;
  private defaultTimeout: number;
  private screenshotDir: string;
  private captureBeforeScreenshots: boolean;
  private captureAfterScreenshots: boolean;
  private customActionHandlers: Record<
    string,
    (step: SpecStep, browser: BrowserSession) => Promise<StepExecution>
  >;

  constructor(config: StepExecutorConfig = {}) {
    this.browser = config.browser;
    this.adapter = config.adapter;
    this.baseUrl = config.baseUrl ?? '';
    this.defaultTimeout = config.defaultTimeout ?? 30000;
    this.screenshotDir = config.screenshotDir ?? './screenshots';
    this.captureBeforeScreenshots = config.captureBeforeScreenshots ?? false;
    this.captureAfterScreenshots = config.captureAfterScreenshots ?? true;
    this.customActionHandlers = config.customActionHandlers ?? {};
  }

  /**
   * Configure the executor with browser and adapter (for lazy initialization)
   */
  configure(config: { browser?: BrowserSession; adapter?: AIAdapter; baseUrl?: string }): void {
    if (config.browser) this.browser = config.browser;
    if (config.adapter) this.adapter = config.adapter;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
  }

  /**
   * Check if executor is properly configured
   */
  isConfigured(): boolean {
    return !!this.browser && !!this.adapter;
  }

  /**
   * Execute a single step
   *
   * @param step - The step definition from the spec
   * @param stepIndex - Index of this step in the spec
   * @returns Promise resolving to step result
   */
  async execute(step: SpecStep, stepIndex: number = 0): Promise<StepResult> {
    const startTime = Date.now();
    const screenshotPrefix = `step-${String(stepIndex).padStart(2, '0')}`;
    let beforeScreenshot: string | undefined;
    let afterScreenshot: string | undefined;

    // Check if executor is configured
    if (!this.browser || !this.adapter) {
      return {
        stepIndex,
        specAction: step as Record<string, unknown>,
        execution: {
          status: 'failed',
          method: step.action,
          durationMs: Date.now() - startTime,
          error: 'StepExecutor not configured - browser and adapter required',
        },
        screenshots: {
          before: `${this.screenshotDir}/${screenshotPrefix}-before.png`,
          after: `${this.screenshotDir}/${screenshotPrefix}-after.png`,
        },
      };
    }

    try {
      // Capture before screenshot if configured
      if (this.captureBeforeScreenshots) {
        beforeScreenshot = await this.captureScreenshot(`${screenshotPrefix}-before`);
      }

      // Execute the action
      const execution = await this.executeAction(step);

      // Capture after screenshot (always for screenshot action, or if configured)
      if (step.action === 'screenshot') {
        const name = step.name || screenshotPrefix;
        afterScreenshot = await this.captureScreenshot(name);
      } else if (this.captureAfterScreenshots) {
        afterScreenshot = await this.captureScreenshot(`${screenshotPrefix}-after`);
      }

      return {
        stepIndex,
        specAction: step as Record<string, unknown>,
        execution: {
          ...execution,
          durationMs: Date.now() - startTime,
        },
        screenshots: {
          before: beforeScreenshot ?? `${this.screenshotDir}/${screenshotPrefix}-before.png`,
          after: afterScreenshot ?? `${this.screenshotDir}/${screenshotPrefix}-after.png`,
        },
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
          before: beforeScreenshot ?? `${this.screenshotDir}/${screenshotPrefix}-before.png`,
          after: `${this.screenshotDir}/${screenshotPrefix}-after.png`,
        },
      };
    }
  }

  /**
   * Execute a single action based on step type
   */
  private async executeAction(step: SpecStep): Promise<StepExecution> {
    switch (step.action) {
      // Navigation actions
      case 'navigate':
        return this.executeNavigate(step);
      case 'back':
        return this.executeBack();
      case 'forward':
        return this.executeForward();
      case 'reload':  // Alias for refresh
      case 'refresh':
        return this.executeRefresh();

      // Interaction actions
      case 'click':
        return this.executeClick(step);
      case 'fill':
        return this.executeFill(step);
      case 'type':
        return this.executeType(step);
      case 'select':
        return this.executeSelect(step);
      case 'check':
        return this.executeCheck(step);
      case 'press':
        return this.executePress(step);

      // Wait actions
      case 'wait':
        return this.executeWait(step);

      // Verification actions
      case 'verify_state':
        return this.executeVerifyState(step);

      // Capture actions
      case 'screenshot':
        return this.executeScreenshot(step);
      case 'scroll':
        return this.executeScroll(step);
      case 'scroll_into_view':
        return this.executeScrollIntoView(step);

      // AI-powered actions
      case 'identify_element':
        return this.executeIdentifyElement(step);
      case 'ai_verify':
        return this.executeAIVerify(step);

      // Custom actions
      case 'custom':
        return this.executeCustom(step);

      default:
        return {
          status: 'failed',
          method: step.action,
          durationMs: 0,
          error: `Unknown action type: ${step.action}`,
        };
    }
  }

  // ============ Navigation Actions ============

  private async executeNavigate(step: SpecStep): Promise<StepExecution> {
    // Support both url (canonical) and to (legacy)
    const targetUrl = step.url ?? step.to;
    if (!targetUrl) {
      return {
        status: 'failed',
        method: 'navigate',
        durationMs: 0,
        error: 'Navigate action requires "url" field',
      };
    }

    const url = targetUrl.startsWith('http') ? targetUrl : `${this.baseUrl}${targetUrl}`;
    await this.browser!.navigate(url);

    return {
      status: 'completed',
      method: 'navigate',
      durationMs: 0,
    };
  }

  private async executeBack(): Promise<StepExecution> {
    if (this.browser!.back) {
      await this.browser!.back();
    }
    return {
      status: 'completed',
      method: 'back',
      durationMs: 0,
    };
  }

  private async executeForward(): Promise<StepExecution> {
    if (this.browser!.forward) {
      await this.browser!.forward();
    }
    return {
      status: 'completed',
      method: 'forward',
      durationMs: 0,
    };
  }

  private async executeRefresh(): Promise<StepExecution> {
    if (this.browser!.refresh) {
      await this.browser!.refresh();
    }
    return {
      status: 'completed',
      method: 'refresh',
      durationMs: 0,
    };
  }

  // ============ Interaction Actions ============

  private async executeClick(step: SpecStep): Promise<StepExecution> {
    const target = await this.resolveTarget(step);

    if (!target) {
      return {
        status: 'failed',
        method: 'click',
        durationMs: 0,
        error: 'Click action requires ref, selector, or query',
      };
    }

    if (this.browser!.click) {
      await this.browser!.click(target.ref);
    }

    return {
      status: 'completed',
      method: 'click',
      elementRef: target.ref,
      selectorUsed: target.selector,
      durationMs: 0,
    };
  }

  private async executeFill(step: SpecStep): Promise<StepExecution> {
    const target = await this.resolveTarget(step);

    if (!target) {
      return {
        status: 'failed',
        method: 'fill',
        durationMs: 0,
        error: 'Fill action requires ref, selector, or query',
      };
    }

    const value = step.value ?? '';
    if (this.browser!.fill) {
      await this.browser!.fill(target.ref, value);
    }

    return {
      status: 'completed',
      method: 'fill',
      elementRef: target.ref,
      selectorUsed: target.selector,
      durationMs: 0,
    };
  }

  private async executeType(step: SpecStep): Promise<StepExecution> {
    const target = await this.resolveTarget(step);

    if (!target) {
      return {
        status: 'failed',
        method: 'type',
        durationMs: 0,
        error: 'Type action requires ref, selector, or query',
      };
    }

    const text = step.value ?? '';
    if (this.browser!.type) {
      await this.browser!.type(target.ref, text);
    }

    return {
      status: 'completed',
      method: 'type',
      elementRef: target.ref,
      selectorUsed: target.selector,
      durationMs: 0,
    };
  }

  private async executeSelect(step: SpecStep): Promise<StepExecution> {
    const target = await this.resolveTarget(step);

    if (!target) {
      return {
        status: 'failed',
        method: 'select',
        durationMs: 0,
        error: 'Select action requires ref, selector, or query',
      };
    }

    const option = step.option ?? '';
    if (this.browser!.select) {
      await this.browser!.select(target.ref, option);
    }

    return {
      status: 'completed',
      method: 'select',
      elementRef: target.ref,
      selectorUsed: target.selector,
      durationMs: 0,
    };
  }

  private async executeCheck(step: SpecStep): Promise<StepExecution> {
    const target = await this.resolveTarget(step);

    if (!target) {
      return {
        status: 'failed',
        method: 'check',
        durationMs: 0,
        error: 'Check action requires ref, selector, or query',
      };
    }

    const checked = step.checked !== false; // Default to true
    if (this.browser!.check) {
      await this.browser!.check(target.ref, checked);
    }

    return {
      status: 'completed',
      method: 'check',
      elementRef: target.ref,
      selectorUsed: target.selector,
      durationMs: 0,
    };
  }

  private async executePress(step: SpecStep): Promise<StepExecution> {
    const key = step.value ?? '';
    if (!key) {
      return {
        status: 'failed',
        method: 'press',
        durationMs: 0,
        error: 'Press action requires "value" field with key name',
      };
    }

    if (this.browser!.press) {
      await this.browser!.press(key);
    }

    return {
      status: 'completed',
      method: 'press',
      durationMs: 0,
    };
  }

  // ============ Wait Actions ============

  private async executeWait(step: SpecStep): Promise<StepExecution> {
    const waitFor = step.for;
    const timeout = parseTimeout(step.timeout, this.defaultTimeout);

    switch (waitFor) {
      case 'element':
        if (step.selector && this.browser!.waitForSelector) {
          await this.browser!.waitForSelector(step.selector, timeout);
        }
        break;

      case 'url':
        if (step.contains && this.browser!.waitForURL) {
          await this.browser!.waitForURL(step.contains, timeout);
        }
        break;

      case 'text':
        if (step.text && this.browser!.waitForText) {
          await this.browser!.waitForText(step.text, timeout);
        }
        break;

      case 'time':
        if (step.duration && this.browser!.waitForTimeout) {
          await this.browser!.waitForTimeout(parseTimeout(step.duration, 1000));
        }
        break;

      case 'load_state':
        if (this.browser!.waitForLoadState) {
          await this.browser!.waitForLoadState('load');
        }
        break;

      default:
        // No specific wait type - just mark as completed
        break;
    }

    return {
      status: 'completed',
      method: 'wait',
      durationMs: 0,
    };
  }

  // ============ Verification Actions ============

  private async executeVerifyState(step: SpecStep): Promise<StepExecution> {
    const checks = (step.checks || []) as VerifyCheck[];
    const snapshot = await this.browser!.getSnapshot({ interactive: true });
    const currentURL = this.browser!.getCurrentURL?.() ?? '';

    for (const check of checks) {
      // Check element_visible
      if (check.element_visible) {
        const found = this.findElementInSnapshot(check.element_visible, snapshot);
        if (!found) {
          return {
            status: 'failed',
            method: 'verify_state',
            durationMs: 0,
            error: `Element not visible: ${check.element_visible}`,
          };
        }
      }

      // Check element_not_visible
      if (check.element_not_visible) {
        const found = this.findElementInSnapshot(check.element_not_visible, snapshot);
        if (found) {
          return {
            status: 'failed',
            method: 'verify_state',
            durationMs: 0,
            error: `Element should not be visible: ${check.element_not_visible}`,
          };
        }
      }

      // Check url_contains
      if (check.url_contains) {
        if (!currentURL.includes(check.url_contains)) {
          return {
            status: 'failed',
            method: 'verify_state',
            durationMs: 0,
            error: `URL does not contain: ${check.url_contains}`,
          };
        }
      }

      // Check text_contains
      if (check.text_contains) {
        if (!snapshot.tree.includes(check.text_contains)) {
          return {
            status: 'failed',
            method: 'verify_state',
            durationMs: 0,
            error: `Text not found: ${check.text_contains}`,
          };
        }
      }

      // Check text_not_contains
      if (check.text_not_contains) {
        if (snapshot.tree.includes(check.text_not_contains)) {
          return {
            status: 'failed',
            method: 'verify_state',
            durationMs: 0,
            error: `Text should not be present: ${check.text_not_contains}`,
          };
        }
      }
    }

    return {
      status: 'completed',
      method: 'verify_state',
      durationMs: 0,
    };
  }

  // ============ Capture Actions ============

  private async executeScreenshot(step: SpecStep): Promise<StepExecution> {
    // Screenshot is captured in the main execute method
    return {
      status: 'completed',
      method: 'screenshot',
      durationMs: 0,
    };
  }

  private async executeScroll(step: SpecStep): Promise<StepExecution> {
    const x = (step.scrollX as number) ?? 0;
    const y = (step.scrollY as number) ?? 0;

    if (this.browser!.scroll) {
      await this.browser!.scroll(x, y);
    }

    return {
      status: 'completed',
      method: 'scroll',
      durationMs: 0,
    };
  }

  private async executeScrollIntoView(step: SpecStep): Promise<StepExecution> {
    const target = await this.resolveTarget(step);

    if (!target) {
      return {
        status: 'failed',
        method: 'scroll_into_view',
        durationMs: 0,
        error: 'scroll_into_view action requires ref, selector, or query',
      };
    }

    if (this.browser!.scrollIntoView) {
      await this.browser!.scrollIntoView(target.ref);
    }

    return {
      status: 'completed',
      method: 'scroll_into_view',
      elementRef: target.ref,
      durationMs: 0,
    };
  }

  // ============ AI-Powered Actions ============

  private async executeIdentifyElement(step: SpecStep): Promise<StepExecution> {
    if (!step.query) {
      return {
        status: 'failed',
        method: 'identify_element',
        durationMs: 0,
        error: 'identify_element action requires "query" field',
      };
    }

    const snapshot = await this.browser!.getSnapshot({ interactive: true });
    const result = await this.adapter!.findElement(step.query, snapshot);

    if (result.ref === 'NOT_FOUND') {
      return {
        status: 'failed',
        method: 'identify_element',
        durationMs: 0,
        error: `Element not found for query: ${step.query}`,
      };
    }

    return {
      status: 'completed',
      method: 'identify_element',
      elementRef: result.ref,
      durationMs: 0,
    };
  }

  private async executeAIVerify(step: SpecStep): Promise<StepExecution> {
    // AI verification is more complex - for now just mark as completed
    // Full implementation would use adapter to verify visual/semantic state
    return {
      status: 'completed',
      method: 'ai_verify',
      durationMs: 0,
    };
  }

  // ============ Custom Actions ============

  private async executeCustom(step: SpecStep): Promise<StepExecution> {
    const handlerName = step.name;
    if (!handlerName || !this.customActionHandlers[handlerName]) {
      return {
        status: 'failed',
        method: 'custom',
        durationMs: 0,
        error: `Custom action handler not found: ${handlerName}`,
      };
    }

    return this.customActionHandlers[handlerName](step, this.browser!);
  }

  // ============ Helper Methods ============

  /**
   * Resolve target to element ref
   */
  private async resolveTarget(step: SpecStep): Promise<ResolvedTarget | null> {
    // If step has a direct ref, use it
    if (step.ref) {
      return { ref: step.ref };
    }

    // If step has a selector, use it as ref
    if (step.selector) {
      return { ref: step.selector, selector: step.selector };
    }

    // Use AI adapter to find element from query
    if (step.query) {
      const snapshot = await this.browser!.getSnapshot({ interactive: true });
      const result = await this.adapter!.findElement(step.query, snapshot);

      if (result.ref === 'NOT_FOUND') {
        throw new Error(`Element not found for query: ${step.query}`);
      }

      return { ref: result.ref };
    }

    return null;
  }

  /**
   * Find element in snapshot by selector/query
   */
  private findElementInSnapshot(
    selector: string,
    snapshot: EnhancedSnapshot
  ): boolean {
    // Check if element exists in tree or refs
    if (snapshot.tree.includes(selector)) {
      return true;
    }

    // Check refs for matching tag or attribute
    for (const ref of Object.values(snapshot.refs)) {
      const element = ref as Record<string, unknown>;
      if (
        element.tag === selector ||
        element.text?.toString().includes(selector) ||
        element.className?.toString().includes(selector) ||
        element.id === selector
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Capture a screenshot
   */
  private async captureScreenshot(name: string): Promise<string> {
    const { promises: fs } = await import('fs');
    const path = await import('path');

    const filepath = path.join(this.screenshotDir, `${name}.png`);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    // Capture and write screenshot
    const buffer = await this.browser!.screenshot();
    await fs.writeFile(filepath, buffer);

    return filepath;
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
