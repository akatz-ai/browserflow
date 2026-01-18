/**
 * BrowserSession adapter using agent-browser's BrowserManager
 *
 * This adapter wraps agent-browser to provide a clean BrowserSession interface
 * for the exploration engine.
 */

import { BrowserManager } from 'agent-browser/dist/browser.js';
import type { BrowserSession, BrowserLaunchOptions } from './explorer';
import type { EnhancedSnapshot } from './adapters/types';

/**
 * AgentBrowserSession implements BrowserSession using agent-browser
 */
export class AgentBrowserSession implements BrowserSession {
  private browser: BrowserManager;

  constructor() {
    this.browser = new BrowserManager();
  }

  isLaunched(): boolean {
    return this.browser.isLaunched();
  }

  async launch(options?: BrowserLaunchOptions): Promise<void> {
    const launchOptions = {
      id: 'launch',
      action: 'launch' as const,
      headless: options?.headless ?? true,
      viewport: options?.viewport ?? { width: 1280, height: 720 },
      browser: 'chromium' as const,
    };

    try {
      await this.browser.launch(launchOptions);
    } catch (error) {
      throw new Error(
        `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async navigate(url: string): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.goto(url, { waitUntil: 'load' });
    } catch (error) {
      throw new Error(
        `Failed to navigate to ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async screenshot(): Promise<Buffer> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      const buffer = await page.screenshot({ type: 'png' });
      return Buffer.from(buffer);
    } catch (error) {
      throw new Error(
        `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getSnapshot(options?: {
    interactive?: boolean;
    maxDepth?: number;
    compact?: boolean;
    selector?: string;
  }): Promise<EnhancedSnapshot> {
    this.ensureLaunched();

    try {
      const snapshot = await this.browser.getSnapshot(options);
      return {
        tree: snapshot.tree,
        refs: snapshot.refs,
      };
    } catch (error) {
      throw new Error(
        `Failed to get snapshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async close(): Promise<void> {
    if (this.browser.isLaunched()) {
      try {
        await this.browser.close();
      } catch (error) {
        // Ignore errors on close - browser might already be closed
      }
    }
  }

  // Interaction methods
  async click(ref: string): Promise<void> {
    this.ensureLaunched();

    try {
      const locator = this.browser.getLocator(ref);
      await locator.click();
    } catch (error) {
      throw new Error(
        `Failed to click ${ref}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async fill(ref: string, value: string): Promise<void> {
    this.ensureLaunched();

    try {
      const locator = this.browser.getLocator(ref);
      await locator.fill(value);
    } catch (error) {
      throw new Error(
        `Failed to fill ${ref}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async type(ref: string, text: string): Promise<void> {
    this.ensureLaunched();

    try {
      const locator = this.browser.getLocator(ref);
      await locator.pressSequentially(text);
    } catch (error) {
      throw new Error(
        `Failed to type into ${ref}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async select(ref: string, option: string): Promise<void> {
    this.ensureLaunched();

    try {
      const locator = this.browser.getLocator(ref);
      await locator.selectOption(option);
    } catch (error) {
      throw new Error(
        `Failed to select option in ${ref}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async check(ref: string, checked: boolean): Promise<void> {
    this.ensureLaunched();

    try {
      const locator = this.browser.getLocator(ref);
      if (checked) {
        await locator.check();
      } else {
        await locator.uncheck();
      }
    } catch (error) {
      throw new Error(
        `Failed to ${checked ? 'check' : 'uncheck'} ${ref}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async press(key: string): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.keyboard.press(key);
    } catch (error) {
      throw new Error(
        `Failed to press key ${key}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Navigation methods
  async back(): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.goBack();
    } catch (error) {
      throw new Error(
        `Failed to go back: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async forward(): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.goForward();
    } catch (error) {
      throw new Error(
        `Failed to go forward: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async refresh(): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.reload();
    } catch (error) {
      throw new Error(
        `Failed to refresh page: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Wait methods
  async waitForSelector(selector: string, timeout: number): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.waitForSelector(selector, { timeout });
    } catch (error) {
      throw new Error(
        `Failed to wait for selector ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async waitForURL(urlPattern: string, timeout: number): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.waitForURL(urlPattern, { timeout });
    } catch (error) {
      throw new Error(
        `Failed to wait for URL ${urlPattern}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async waitForText(text: string, timeout: number): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.locator(`text=${text}`).waitFor({ timeout });
    } catch (error) {
      throw new Error(
        `Failed to wait for text "${text}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      await page.waitForLoadState(state);
    } catch (error) {
      throw new Error(
        `Failed to wait for load state ${state}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async waitForTimeout(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Scroll methods
  async scrollIntoView(ref: string): Promise<void> {
    this.ensureLaunched();

    try {
      const locator = this.browser.getLocator(ref);
      await locator.scrollIntoViewIfNeeded();
    } catch (error) {
      throw new Error(
        `Failed to scroll ${ref} into view: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async scroll(x: number, y: number): Promise<void> {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      // Use mouse wheel for scrolling (more reliable than evaluate)
      await page.mouse.wheel(x, y);
    } catch (error) {
      throw new Error(
        `Failed to scroll by (${x}, ${y}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // State methods
  getCurrentURL(): string {
    this.ensureLaunched();

    try {
      const page = this.browser.getPage();
      return page.url();
    } catch (error) {
      throw new Error(
        `Failed to get current URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ensures browser is launched before performing operations
   */
  private ensureLaunched(): void {
    if (!this.browser.isLaunched()) {
      throw new Error('Browser is not launched. Call launch() first.');
    }
  }
}

/**
 * Factory function to create a new browser session
 */
export function createBrowserSession(): BrowserSession {
  return new AgentBrowserSession();
}
