/**
 * playwright-ts.test.ts
 * Tests for the Playwright test generator.
 */

import { describe, it, expect } from 'bun:test';
import type { ExplorationLockfile, ExplorationStep, LegacySpecStep, ReviewData } from '@browserflow/core';
import { PlaywrightGenerator, generateTest } from './playwright-ts.js';

/**
 * Creates a minimal ExplorationLockfile for testing.
 */
function createMockLockfile(
  overrides: Partial<ExplorationLockfile> = {}
): ExplorationLockfile {
  return {
    spec: 'test-spec',
    spec_path: 'specs/test-spec.yaml',
    exploration_id: 'exp-123',
    timestamp: '2026-01-15T10:00:00Z',
    duration_ms: 5000,
    browser: 'chromium',
    viewport: { width: 1280, height: 720 },
    base_url: 'http://localhost:3000',
    steps: [],
    outcome_checks: [],
    overall_status: 'completed',
    errors: [],
    ...overrides,
  };
}

/**
 * Creates a minimal ExplorationStep for testing.
 */
function createMockStep(
  action: LegacySpecStep,
  execution: Partial<ExplorationStep['execution']> = {}
): ExplorationStep {
  return {
    step_index: 0,
    spec_action: action,
    execution: {
      status: 'completed',
      duration_ms: 100,
      ...execution,
    },
    screenshots: {},
  };
}

/**
 * Creates a minimal ReviewData for testing.
 */
function createMockReview(
  overrides: Partial<ReviewData> = {}
): ReviewData {
  return {
    exploration_id: 'exp-123',
    started_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T12:00:00Z',
    steps: [],
    verdict: 'approved',
    ...overrides,
  };
}

describe('PlaywrightGenerator', () => {
  describe('generate()', () => {
    it('generates valid TypeScript test structure', () => {
      const lockfile = createMockLockfile();
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("import { test, expect } from '@playwright/test'");
      expect(result.content).toContain("test.describe('test-spec'");
      expect(result.content).toContain("test('Test Spec'");
      expect(result.content).toContain('async ({ page })');
    });

    it('includes generation metadata in header', () => {
      const lockfile = createMockLockfile({
        exploration_id: 'exp-abc123',
        spec: 'checkout-cart',
        spec_path: 'specs/checkout-cart.yaml',
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('BrowserFlow Generated Test: checkout-cart');
      expect(result.content).toContain('Spec: specs/checkout-cart.yaml');
      expect(result.content).toContain('Exploration: exp-abc123');
      expect(result.content).toContain('Generated:');
    });

    it('includes reviewer info when provided', () => {
      const lockfile = createMockLockfile();
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile, createMockReview({
        reviewer: 'john.doe',
        submitted_at: '2026-01-15T12:00:00Z',
      }));

      expect(result.content).toContain('Approved by: john.doe @ 2026-01-15T12:00:00Z');
    });
  });

  describe('test.step() wrapping', () => {
    it('wraps click action in test.step()', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'click', query: 'Add to Cart button' },
            {
              locator: { method: 'getByTestId', args: { testId: 'add-to-cart' } },
            }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("await test.step('step_0'");
      expect(result.content).toContain("await page.getByTestId('add-to-cart').click()");
    });

    it('wraps fill action in test.step()', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'fill', query: 'Email input', value: 'test@example.com' },
            {
              locator: { method: 'getByLabel', args: { text: 'Email' } },
              value_used: 'test@example.com',
            }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("await test.step('step_0'");
      expect(result.content).toContain("await page.getByLabel('Email').fill('test@example.com')");
    });

    it('wraps navigate action in test.step()', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'navigate', to: '/products' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("await test.step('step_0'");
      expect(result.content).toContain("await page.goto('/products')");
    });

    it('wraps wait action in test.step()', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'wait', for: 'text', text: 'Success' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("await test.step('step_0'");
      expect(result.content).toContain("page.getByText('Success').waitFor");
    });

    it('uses step description as test.step name when available', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'click', query: 'Submit', description: 'submit_form' },
            { locator: { selector: 'button[type=submit]' } }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("await test.step('submit_form'");
    });

    it('generates multiple test.step() calls for multiple steps', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'navigate', to: '/' },
            {}
          ),
          createMockStep(
            { action: 'click', query: 'Login button' },
            { locator: { selector: 'button.login' } }
          ),
          createMockStep(
            { action: 'fill', query: 'Username', value: 'user' },
            {
              locator: { method: 'getByLabel', args: { text: 'Username' } },
              value_used: 'user',
            }
          ),
        ],
      });
      lockfile.steps[1].step_index = 1;
      lockfile.steps[2].step_index = 2;

      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("await test.step('step_0'");
      expect(result.content).toContain("await test.step('step_1'");
      expect(result.content).toContain("await test.step('step_2'");
    });

    it('includes comments inside test.step()', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'click', query: 'Add to Cart button on first product' },
            { locator: { selector: 'button.add-to-cart' }, method: 'css' }
          ),
        ],
      });
      const generator = new PlaywrightGenerator({ includeComments: true });
      const result = generator.generate(lockfile);

      expect(result.content).toContain('// Step 0: Click');
    });

    it('respects includeComments: false option', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'click', query: 'Button' },
            { locator: { selector: 'button' } }
          ),
        ],
      });
      const generator = new PlaywrightGenerator({ includeComments: false });
      const result = generator.generate(lockfile);

      expect(result.content).not.toContain('// Step 0');
    });
  });

  describe('action types', () => {
    it('generates click action code', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'click' },
            { locator: { method: 'getByRole', args: { role: 'button', name: 'Submit' } } }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("page.getByRole('button', { name: 'Submit' }).click()");
    });

    it('generates navigate action code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'navigate', to: '/dashboard' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("await page.goto('/dashboard')");
    });

    it('generates fill action code', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'fill', value: 'test@email.com' },
            {
              locator: { method: 'getByPlaceholder', args: { text: 'Email' } },
              value_used: 'test@email.com',
            }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("page.getByPlaceholder('Email').fill('test@email.com')");
    });

    it('generates type action code with pressSequentially', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'type', value: 'search term' },
            {
              locator: { selector: 'input.search' },
              value_used: 'search term',
            }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("pressSequentially('search term')");
    });

    it('generates type action with pressEnter', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'type', value: 'query', pressEnter: true },
            { locator: { selector: 'input' }, value_used: 'query' }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("pressSequentially('query')");
      expect(result.content).toContain("press('Enter')");
    });

    it('generates wait for element code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'wait', for: 'element', selector: '.modal' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("page.locator('.modal').waitFor");
    });

    it('generates wait for text code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'wait', for: 'text', text: 'Loading complete' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("page.getByText('Loading complete').waitFor");
    });

    it('generates wait for URL code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'wait', for: 'url', contains: '/success' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("page.waitForURL(url => url.href.includes('/success')");
    });

    it('generates wait for time code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'wait', for: 'time', duration: 2000 })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('page.waitForTimeout(2000)');
    });

    it('generates select action code', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'select', option: 'us' },
            { locator: { selector: 'select#country' } }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("selectOption('us')");
    });

    it('generates check action code', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'check', checked: true },
            { locator: { selector: 'input[type=checkbox]' } }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('.check()');
    });

    it('generates uncheck action code', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'check', checked: false },
            { locator: { selector: 'input[type=checkbox]' } }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('.uncheck()');
    });

    it('generates back action code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'back' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('await page.goBack()');
    });

    it('generates forward action code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'forward' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('await page.goForward()');
    });

    it('generates refresh action code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'refresh' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('await page.reload()');
    });

    it('generates verify_state action code', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep({
            action: 'verify_state',
            checks: [
              { element_visible: '.success-message' },
              { text_contains: 'Order confirmed' },
            ],
          }),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("expect(page.locator('.success-message')).toBeVisible()");
      expect(result.content).toContain("expect(page.getByText('Order confirmed')).toBeVisible()");
    });

    it('generates screenshot action code', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'screenshot', name: 'checkout-page' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('toHaveScreenshot');
      expect(result.content).toContain('checkout-page.png');
    });

    it('generates screenshot with selector-based mask', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep({
            action: 'screenshot',
            name: 'dashboard',
            mask: [
              { selector: '.timestamp' },
              { selector: '.user-avatar' },
            ],
          }),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('toHaveScreenshot');
      expect(result.content).toContain("mask: [page.locator('.timestamp'), page.locator('.user-avatar')]");
    });

    it('generates screenshot with region-based mask and setup code', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep({
            action: 'screenshot',
            name: 'homepage',
            mask: [
              { region: { x: 10, y: 20, width: 100, height: 50 } },
            ],
          }),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      // Should include mask setup code before screenshot
      expect(result.content).toContain('await page.evaluate');
      expect(result.content).toContain('data-bf-mask');
      expect(result.content).toContain('left:10%');
      expect(result.content).toContain('top:20%');
      expect(result.content).toContain('width:100%');
      expect(result.content).toContain('height:50%');

      // Should include screenshot with mask reference
      expect(result.content).toContain('toHaveScreenshot');
      expect(result.content).toContain("mask: [page.locator('[data-bf-mask=\"0\"]')]");
    });

    it('generates screenshot with mixed selector and region masks', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep({
            action: 'screenshot',
            name: 'complex-page',
            mask: [
              { selector: '.header' },
              { region: { x: 0, y: 90, width: 100, height: 10 } },
              { selector: '.footer' },
              { region: { x: 80, y: 5, width: 15, height: 10 } },
            ],
          }),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      // Should include setup code for both region masks
      expect(result.content).toContain('await page.evaluate');
      expect(result.content).toContain('left:0%');
      expect(result.content).toContain('top:90%');
      expect(result.content).toContain('left:80%');
      expect(result.content).toContain('top:5%');

      // Should include all masks in proper order
      expect(result.content).toContain("page.locator('.header')");
      expect(result.content).toContain("page.locator('[data-bf-mask=\"0\"]')");
      expect(result.content).toContain("page.locator('.footer')");
      expect(result.content).toContain("page.locator('[data-bf-mask=\"1\"]')");
    });

    it('generates screenshot without mask setup when only selector masks', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep({
            action: 'screenshot',
            name: 'page',
            mask: [
              { selector: '.timestamp' },
              { selector: '.avatar' },
            ],
          }),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      // Should NOT include page.evaluate for mask setup
      expect(result.content).not.toContain('await page.evaluate');
      expect(result.content).not.toContain('data-bf-mask');

      // Should still include selector masks
      expect(result.content).toContain("page.locator('.timestamp')");
      expect(result.content).toContain("page.locator('.avatar')");
    });

    it('handles identify_element action as comment', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'identify_element', query: 'Main navigation menu', save_as: 'nav' },
            {}
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      // identify_element is exploratory and shouldn't generate runtime code
      expect(result.content).toContain('identify_element');
    });

    it('handles ai_verify action as comment', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'ai_verify', question: 'Is the cart empty?', expected: true },
            {}
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      // ai_verify is AI-powered and shouldn't generate deterministic test code
      expect(result.content).toContain('ai_verify');
    });

    it('handles custom action as comment', () => {
      const lockfile = createMockLockfile({
        steps: [createMockStep({ action: 'custom' })],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('custom');
    });
  });

  describe('locator resolution', () => {
    it('uses lockfile locator over exploration refs', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'click', ref: '@e23' },
            { locator: { method: 'getByTestId', args: { testId: 'submit' } } }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      // Should use the resolved locator, not the ref
      expect(result.content).toContain("page.getByTestId('submit')");
      expect(result.content).not.toContain('@e23');
    });

    it('falls back to selector_used when locator is not available', () => {
      const lockfile = createMockLockfile({
        steps: [
          createMockStep(
            { action: 'click' },
            { selector_used: 'button.fallback' }
          ),
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain("page.locator('button.fallback')");
    });
  });

  describe('outcome checks', () => {
    it('generates outcome verification code for passed checks', () => {
      const lockfile = createMockLockfile({
        outcome_checks: [
          { check: 'cart_total', expected: 99.99, actual: 99.99, passed: true },
          { check: 'item_count', expected: 3, actual: 3, passed: true },
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).toContain('Outcome: cart_total');
      expect(result.content).toContain('Outcome: item_count');
    });

    it('does not generate code for failed outcome checks', () => {
      const lockfile = createMockLockfile({
        outcome_checks: [
          { check: 'cart_total', expected: 99.99, actual: 50.00, passed: false },
        ],
      });
      const generator = new PlaywrightGenerator();
      const result = generator.generate(lockfile);

      expect(result.content).not.toContain('cart_total');
    });
  });

  describe('generateTest convenience function', () => {
    it('generates test using default options', () => {
      const lockfile = createMockLockfile();
      const result = generateTest(lockfile);

      expect(result.content).toContain("import { test, expect }");
      expect(result.path).toBe('tests/test-spec.spec.ts');
    });

    it('passes options to generator', () => {
      const lockfile = createMockLockfile();
      const result = generateTest(lockfile, { includeComments: false });

      expect(result.content).not.toContain('//');
    });

    it('passes review data to generator', () => {
      const lockfile = createMockLockfile();
      const result = generateTest(lockfile, {}, createMockReview({
        reviewer: 'alice',
        submitted_at: '2026-01-15T14:00:00Z',
      }));

      expect(result.content).toContain('Approved by: alice');
    });
  });
});
