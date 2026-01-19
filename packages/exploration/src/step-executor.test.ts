// @browserflow/exploration - Step executor tests
import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { StepExecutor } from './step-executor';
import type { BrowserSession } from './explorer';
import type { AIAdapter, SpecStep } from './adapters/types';

// Mock browser session
function createMockBrowserSession(options: Partial<BrowserSession> = {}): BrowserSession {
  return {
    isLaunched: () => true,
    launch: async () => {},
    navigate: async () => {},
    screenshot: async () => Buffer.from('fake-image'),
    close: async () => {},
    getSnapshot: async () => ({
      tree: '<button ref="e1">Submit</button><input ref="e2" type="text">',
      refs: {
        e1: { tag: 'button', text: 'Submit' },
        e2: { tag: 'input', type: 'text' },
      },
    }),
    click: async () => {},
    fill: async () => {},
    type: async () => {},
    select: async () => {},
    check: async () => {},
    press: async () => {},
    back: async () => {},
    forward: async () => {},
    refresh: async () => {},
    scrollIntoView: async () => {},
    scroll: async () => {},
    waitForSelector: async () => {},
    waitForURL: async () => {},
    waitForText: async () => {},
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    ...options,
  };
}

// Mock AI adapter
function createMockAdapter(options: Partial<AIAdapter> = {}): AIAdapter {
  return {
    name: 'mock',
    explore: async () => ({
      spec: 'test',
      specPath: 'test.yaml',
      explorationId: 'exp-test',
      timestamp: new Date().toISOString(),
      durationMs: 100,
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
      baseUrl: 'http://localhost:3000',
      steps: [],
      outcomeChecks: [],
      overallStatus: 'completed',
      errors: [],
    }),
    findElement: async () => ({
      ref: 'e1',
      reasoning: 'Found element',
      confidence: 0.95,
    }),
    ...options,
  };
}

describe('StepExecutor', () => {
  let executor: StepExecutor;
  let mockBrowser: BrowserSession;
  let mockAdapter: AIAdapter;

  beforeEach(() => {
    mockBrowser = createMockBrowserSession();
    mockAdapter = createMockAdapter();
    executor = new StepExecutor({
      browser: mockBrowser,
      adapter: mockAdapter,
      baseUrl: 'http://localhost:3000',
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const exec = new StepExecutor({
        browser: mockBrowser,
        adapter: mockAdapter,
        baseUrl: 'http://localhost:3000',
      });
      expect(exec.getDefaultTimeout()).toBe(30000);
    });

    it('should use custom timeout when provided', () => {
      const exec = new StepExecutor({
        browser: mockBrowser,
        adapter: mockAdapter,
        baseUrl: 'http://localhost:3000',
        defaultTimeout: 5000,
      });
      expect(exec.getDefaultTimeout()).toBe(5000);
    });

    it('should use custom screenshot directory when provided', () => {
      const exec = new StepExecutor({
        browser: mockBrowser,
        adapter: mockAdapter,
        baseUrl: 'http://localhost:3000',
        screenshotDir: './custom-screenshots',
      });
      expect(exec.getScreenshotDir()).toBe('./custom-screenshots');
    });
  });

  describe('navigate action', () => {
    it('should execute navigate to absolute URL with canonical "url" field', async () => {
      const navigateSpy = spyOn(mockBrowser, 'navigate');
      const step: SpecStep = { action: 'navigate', url: 'https://example.com' };

      const result = await executor.execute(step, 0);

      expect(navigateSpy).toHaveBeenCalledWith('https://example.com');
      expect(result.execution.status).toBe('completed');
      expect(result.execution.method).toBe('navigate');
    });

    it('should execute navigate with relative URL using baseUrl (url field)', async () => {
      const navigateSpy = spyOn(mockBrowser, 'navigate');
      const step: SpecStep = { action: 'navigate', url: '/login' };

      await executor.execute(step, 0);

      expect(navigateSpy).toHaveBeenCalledWith('http://localhost:3000/login');
    });

    it('should execute navigate to absolute URL (legacy "to" field for backward compat)', async () => {
      const navigateSpy = spyOn(mockBrowser, 'navigate');
      const step: SpecStep = { action: 'navigate', to: 'https://example.com' };

      const result = await executor.execute(step, 0);

      expect(navigateSpy).toHaveBeenCalledWith('https://example.com');
      expect(result.execution.status).toBe('completed');
      expect(result.execution.method).toBe('navigate');
    });

    it('should execute navigate with relative URL using baseUrl (legacy "to" field)', async () => {
      const navigateSpy = spyOn(mockBrowser, 'navigate');
      const step: SpecStep = { action: 'navigate', to: '/login' };

      await executor.execute(step, 0);

      expect(navigateSpy).toHaveBeenCalledWith('http://localhost:3000/login');
    });

    it('should prefer "url" field when both "url" and "to" are present', async () => {
      const navigateSpy = spyOn(mockBrowser, 'navigate');
      const step: SpecStep = { action: 'navigate', url: 'https://canonical.com', to: 'https://legacy.com' };

      const result = await executor.execute(step, 0);

      expect(navigateSpy).toHaveBeenCalledWith('https://canonical.com');
      expect(result.execution.status).toBe('completed');
    });

    it('should fail when navigate missing both "url" and "to" fields', async () => {
      const step: SpecStep = { action: 'navigate' };

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('failed');
      expect(result.execution.error).toContain('url');
    });
  });

  describe('back/forward/refresh actions', () => {
    it('should execute back action', async () => {
      const backSpy = spyOn(mockBrowser, 'back' as keyof BrowserSession);
      const step: SpecStep = { action: 'back' };

      const result = await executor.execute(step, 0);

      expect(backSpy).toHaveBeenCalled();
      expect(result.execution.status).toBe('completed');
    });

    it('should execute forward action', async () => {
      const forwardSpy = spyOn(mockBrowser, 'forward' as keyof BrowserSession);
      const step: SpecStep = { action: 'forward' };

      const result = await executor.execute(step, 0);

      expect(forwardSpy).toHaveBeenCalled();
      expect(result.execution.status).toBe('completed');
    });

    it('should execute refresh action', async () => {
      const refreshSpy = spyOn(mockBrowser, 'refresh' as keyof BrowserSession);
      const step: SpecStep = { action: 'refresh' };

      const result = await executor.execute(step, 0);

      expect(refreshSpy).toHaveBeenCalled();
      expect(result.execution.status).toBe('completed');
    });

    it('should execute reload action (alias for refresh)', async () => {
      const refreshSpy = spyOn(mockBrowser, 'refresh' as keyof BrowserSession);
      const step: SpecStep = { action: 'reload' };

      const result = await executor.execute(step, 0);

      expect(refreshSpy).toHaveBeenCalled();
      expect(result.execution.status).toBe('completed');
    });
  });

  describe('click action', () => {
    it('should click element by ref', async () => {
      const clickSpy = spyOn(mockBrowser, 'click' as keyof BrowserSession);
      const step: SpecStep = { action: 'click', ref: 'e1' };

      const result = await executor.execute(step, 0);

      expect(clickSpy).toHaveBeenCalledWith('e1');
      expect(result.execution.status).toBe('completed');
      expect(result.execution.elementRef).toBe('e1');
    });

    it('should click element by selector', async () => {
      const clickSpy = spyOn(mockBrowser, 'click' as keyof BrowserSession);
      const step: SpecStep = { action: 'click', selector: 'button.submit' };

      const result = await executor.execute(step, 0);

      expect(clickSpy).toHaveBeenCalledWith('button.submit');
      expect(result.execution.selectorUsed).toBe('button.submit');
    });

    it('should click element by query using AI adapter', async () => {
      const findSpy = spyOn(mockAdapter, 'findElement');
      const clickSpy = spyOn(mockBrowser, 'click' as keyof BrowserSession);
      const step: SpecStep = { action: 'click', query: 'submit button' };

      const result = await executor.execute(step, 0);

      expect(findSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledWith('e1');
      expect(result.execution.elementRef).toBe('e1');
    });

    it('should click element with custom timeout (string format)', async () => {
      const clickSpy = spyOn(mockBrowser, 'click' as keyof BrowserSession);
      const step: SpecStep = { action: 'click', ref: 'e1', timeout: '10s' };

      const result = await executor.execute(step, 0);

      expect(clickSpy).toHaveBeenCalledWith('e1');
      expect(result.execution.status).toBe('completed');
      expect(result.execution.elementRef).toBe('e1');
    });

    it('should fail when element not found', async () => {
      mockAdapter.findElement = async () => ({
        ref: 'NOT_FOUND',
        reasoning: 'Could not find element',
        confidence: 0,
      });
      const step: SpecStep = { action: 'click', query: 'nonexistent button' };

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('failed');
      expect(result.execution.error).toContain('not found');
    });

    it('should fail when no target specified', async () => {
      const step: SpecStep = { action: 'click' };

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('failed');
      expect(result.execution.error).toContain('ref, selector, or query');
    });
  });

  describe('fill action', () => {
    it('should fill element with value', async () => {
      const fillSpy = spyOn(mockBrowser, 'fill' as keyof BrowserSession);
      const step: SpecStep = { action: 'fill', ref: 'e2', value: 'test@example.com' };

      const result = await executor.execute(step, 0);

      expect(fillSpy).toHaveBeenCalledWith('e2', 'test@example.com');
      expect(result.execution.status).toBe('completed');
    });

    it('should fill element found by query', async () => {
      const fillSpy = spyOn(mockBrowser, 'fill' as keyof BrowserSession);
      const step: SpecStep = { action: 'fill', query: 'email input', value: 'user@test.com' };

      const result = await executor.execute(step, 0);

      expect(fillSpy).toHaveBeenCalledWith('e1', 'user@test.com');
      expect(result.execution.status).toBe('completed');
    });

    it('should handle empty value', async () => {
      const fillSpy = spyOn(mockBrowser, 'fill' as keyof BrowserSession);
      const step: SpecStep = { action: 'fill', ref: 'e2', value: '' };

      const result = await executor.execute(step, 0);

      expect(fillSpy).toHaveBeenCalledWith('e2', '');
      expect(result.execution.status).toBe('completed');
    });
  });

  describe('type action', () => {
    it('should type text character by character', async () => {
      const typeSpy = spyOn(mockBrowser, 'type' as keyof BrowserSession);
      const step: SpecStep = { action: 'type', ref: 'e2', value: 'hello' };

      const result = await executor.execute(step, 0);

      expect(typeSpy).toHaveBeenCalledWith('e2', 'hello');
      expect(result.execution.status).toBe('completed');
    });
  });

  describe('select action', () => {
    it('should select option by value', async () => {
      const selectSpy = spyOn(mockBrowser, 'select' as keyof BrowserSession);
      const step: SpecStep = { action: 'select', ref: 'e1', option: 'option1' };

      const result = await executor.execute(step, 0);

      expect(selectSpy).toHaveBeenCalledWith('e1', 'option1');
      expect(result.execution.status).toBe('completed');
    });
  });

  describe('check action', () => {
    it('should check a checkbox', async () => {
      const checkSpy = spyOn(mockBrowser, 'check' as keyof BrowserSession);
      const step: SpecStep = { action: 'check', ref: 'e1', checked: true };

      const result = await executor.execute(step, 0);

      expect(checkSpy).toHaveBeenCalledWith('e1', true);
      expect(result.execution.status).toBe('completed');
    });

    it('should uncheck a checkbox when checked=false', async () => {
      const checkSpy = spyOn(mockBrowser, 'check' as keyof BrowserSession);
      const step: SpecStep = { action: 'check', ref: 'e1', checked: false };

      await executor.execute(step, 0);

      expect(checkSpy).toHaveBeenCalledWith('e1', false);
    });

    it('should default to checked=true when not specified', async () => {
      const checkSpy = spyOn(mockBrowser, 'check' as keyof BrowserSession);
      const step: SpecStep = { action: 'check', ref: 'e1' };

      await executor.execute(step, 0);

      expect(checkSpy).toHaveBeenCalledWith('e1', true);
    });
  });

  describe('press action', () => {
    it('should press a key', async () => {
      const pressSpy = spyOn(mockBrowser, 'press' as keyof BrowserSession);
      const step: SpecStep = { action: 'press', value: 'Enter' };

      const result = await executor.execute(step, 0);

      expect(pressSpy).toHaveBeenCalledWith('Enter');
      expect(result.execution.status).toBe('completed');
    });
  });

  describe('wait action', () => {
    it('should wait for element', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForSelector' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'element', selector: '.loaded' };

      const result = await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith('.loaded', expect.any(Number));
      expect(result.execution.status).toBe('completed');
    });

    it('should wait for URL to contain string', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForURL' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'url', contains: '/dashboard' };

      const result = await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith('/dashboard', expect.any(Number));
      expect(result.execution.status).toBe('completed');
    });

    it('should wait for text to appear', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForText' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'text', text: 'Welcome' };

      const result = await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith('Welcome', expect.any(Number));
      expect(result.execution.status).toBe('completed');
    });

    it('should wait for time duration', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForTimeout' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'time', duration: 1000 };

      const result = await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith(1000);
      expect(result.execution.status).toBe('completed');
    });

    it('should wait for time duration with string format (500ms)', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForTimeout' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'time', duration: '500ms' };

      const result = await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith(500);
      expect(result.execution.status).toBe('completed');
    });

    it('should wait for time duration with string format (2s)', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForTimeout' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'time', duration: '2s' };

      const result = await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith(2000);
      expect(result.execution.status).toBe('completed');
    });

    it('should use custom timeout when specified', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForSelector' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'element', selector: '.slow', timeout: 60000 };

      await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith('.slow', 60000);
    });

    it('should use custom timeout with string format (5s)', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForSelector' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'element', selector: '.slow', timeout: '5s' };

      await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith('.slow', 5000);
    });

    it('should use custom timeout with string format (3000ms)', async () => {
      const waitSpy = spyOn(mockBrowser, 'waitForSelector' as keyof BrowserSession);
      const step: SpecStep = { action: 'wait', for: 'element', selector: '.slow', timeout: '3000ms' };

      await executor.execute(step, 0);

      expect(waitSpy).toHaveBeenCalledWith('.slow', 3000);
    });
  });

  describe('verify_state action', () => {
    it('should verify element is visible', async () => {
      const step: SpecStep = {
        action: 'verify_state',
        checks: [{ element_visible: 'button' }],
      };

      // Mock snapshot to include the element
      mockBrowser.getSnapshot = async () => ({
        tree: '<button ref="e1">Submit</button>',
        refs: { e1: { tag: 'button', text: 'Submit', visible: true } },
      });

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('completed');
    });

    it('should fail when element not visible', async () => {
      const step: SpecStep = {
        action: 'verify_state',
        checks: [{ element_visible: 'button.hidden' }],
      };

      // Mock snapshot without the element
      mockBrowser.getSnapshot = async () => ({
        tree: '',
        refs: {},
      });

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('failed');
    });

    it('should verify URL contains string', async () => {
      const step: SpecStep = {
        action: 'verify_state',
        checks: [{ url_contains: '/login' }],
      };

      // Mock browser to return current URL
      (mockBrowser as any).getCurrentURL = () => 'http://localhost:3000/login';

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('completed');
    });

    it('should verify text content', async () => {
      const step: SpecStep = {
        action: 'verify_state',
        checks: [{ text_contains: 'Welcome' }],
      };

      mockBrowser.getSnapshot = async () => ({
        tree: '<h1>Welcome to our site</h1>',
        refs: {},
      });

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('completed');
    });

    it('should handle multiple checks', async () => {
      const step: SpecStep = {
        action: 'verify_state',
        checks: [
          { element_visible: 'button' },
          { text_contains: 'Submit' },
        ],
      };

      mockBrowser.getSnapshot = async () => ({
        tree: '<button ref="e1">Submit</button>',
        refs: { e1: { tag: 'button', text: 'Submit' } },
      });

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('completed');
    });
  });

  describe('screenshot action', () => {
    it('should capture screenshot with name', async () => {
      const screenshotSpy = spyOn(mockBrowser, 'screenshot');
      const step: SpecStep = { action: 'screenshot', name: 'login-page' };

      const result = await executor.execute(step, 0);

      expect(screenshotSpy).toHaveBeenCalled();
      expect(result.execution.status).toBe('completed');
      expect(result.screenshots.after).toContain('login-page');
    });

    it('should use step index for screenshot name when not provided', async () => {
      const step: SpecStep = { action: 'screenshot' };

      const result = await executor.execute(step, 5);

      expect(result.screenshots.after).toContain('05');
    });
  });

  describe('scroll actions', () => {
    it('should scroll element into view', async () => {
      const scrollSpy = spyOn(mockBrowser, 'scrollIntoView' as keyof BrowserSession);
      const step: SpecStep = { action: 'scroll_into_view', ref: 'e1' };

      const result = await executor.execute(step, 0);

      expect(scrollSpy).toHaveBeenCalledWith('e1');
      expect(result.execution.status).toBe('completed');
    });

    it('should scroll by offset', async () => {
      const scrollSpy = spyOn(mockBrowser, 'scroll' as keyof BrowserSession);
      const step: SpecStep = { action: 'scroll', scrollX: 0, scrollY: 500 };

      const result = await executor.execute(step, 0);

      expect(scrollSpy).toHaveBeenCalledWith(0, 500);
      expect(result.execution.status).toBe('completed');
    });
  });

  describe('identify_element action', () => {
    it('should find element using AI and return ref', async () => {
      const findSpy = spyOn(mockAdapter, 'findElement');
      const step: SpecStep = { action: 'identify_element', query: 'login button' };

      const result = await executor.execute(step, 0);

      expect(findSpy).toHaveBeenCalled();
      expect(result.execution.status).toBe('completed');
      expect(result.execution.elementRef).toBe('e1');
    });
  });

  describe('screenshot capture around actions', () => {
    it('should capture before screenshot when configured', async () => {
      const exec = new StepExecutor({
        browser: mockBrowser,
        adapter: mockAdapter,
        baseUrl: 'http://localhost:3000',
        captureBeforeScreenshots: true,
      });
      const screenshotSpy = spyOn(mockBrowser, 'screenshot');
      const step: SpecStep = { action: 'click', ref: 'e1' };

      const result = await exec.execute(step, 0);

      expect(result.screenshots.before).toBeDefined();
      // Screenshot should be called at least once for before
      expect(screenshotSpy).toHaveBeenCalled();
    });

    it('should capture after screenshot by default', async () => {
      const screenshotSpy = spyOn(mockBrowser, 'screenshot');
      const step: SpecStep = { action: 'click', ref: 'e1' };

      const result = await executor.execute(step, 0);

      expect(result.screenshots.after).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return failed status on browser error', async () => {
      mockBrowser.click = async () => {
        throw new Error('Element not interactable');
      };
      const step: SpecStep = { action: 'click', ref: 'e1' };

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('failed');
      expect(result.execution.error).toContain('Element not interactable');
    });

    it('should include duration even on failure', async () => {
      mockBrowser.click = async () => {
        throw new Error('Failed');
      };
      const step: SpecStep = { action: 'click', ref: 'e1' };

      const result = await executor.execute(step, 0);

      expect(result.execution.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return failed for unknown action type', async () => {
      const step: SpecStep = { action: 'unknown_action' as any };

      const result = await executor.execute(step, 0);

      expect(result.execution.status).toBe('failed');
      expect(result.execution.error).toContain('Unknown action');
    });
  });

  describe('custom action', () => {
    it('should handle custom action with handler', async () => {
      const exec = new StepExecutor({
        browser: mockBrowser,
        adapter: mockAdapter,
        baseUrl: 'http://localhost:3000',
        customActionHandlers: {
          'my_custom_action': async (step, browser) => {
            return { status: 'completed', method: 'custom', durationMs: 0 };
          },
        },
      });
      const step: SpecStep = { action: 'custom', name: 'my_custom_action' };

      const result = await exec.execute(step, 0);

      expect(result.execution.status).toBe('completed');
    });
  });
});
