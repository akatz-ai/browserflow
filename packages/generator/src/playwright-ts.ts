/**
 * playwright-ts.ts
 * Main TypeScript test generator for Playwright.
 */

import type {
  ExplorationLockfile,
  ExplorationStep,
  GeneratedTest,
  ReviewData,
  LegacySpecStep,
} from '@browserflow/core';
import Handlebars from 'handlebars';
import { resolveLocatorCode, escapeString } from './locator-emit.js';
import {
  generateScreenshotAssertion,
  generateWaitForAnimations,
  generateMaskSetupCode,
} from './visual-checks.js';

/**
 * Options for test generation.
 */
export interface TestGeneratorOptions {
  /** Include baseline screenshot comparisons */
  includeVisualChecks?: boolean;
  /** Directory for baseline screenshots */
  baselinesDir?: string;
  /** Include step comments */
  includeComments?: boolean;
  /** Custom test template */
  template?: string;
  /** Test timeout in ms */
  timeout?: number;
}

/**
 * Default test file template.
 */
const DEFAULT_TEST_TEMPLATE = `import { test, expect } from '@playwright/test';

/**
 * BrowserFlow Generated Test: {{specName}}
 * ═══════════════════════════════════════════════════════════════════════════
 * Spec: {{specPath}}
 * Exploration: {{explorationId}}
 * {{#if reviewer}}Approved by: {{reviewer}} @ {{reviewedAt}}{{/if}}
 * Generated: {{generatedAt}}
 *
 * This test was generated from an approved exploration. Do not edit manually.
 * To update, re-run exploration and get new approval.
 * ═══════════════════════════════════════════════════════════════════════════
 */

test.describe('{{specName}}', () => {
  test('{{testDescription}}', async ({ page }) => {
{{#each steps}}
{{{code}}}

{{/each}}
{{#if outcomeChecks}}
    // Final outcome verifications
{{#each outcomeChecks}}
{{{code}}}
{{/each}}
{{/if}}
  });
});
`;

/**
 * PlaywrightGenerator - Converts exploration lockfiles to Playwright tests.
 */
export class PlaywrightGenerator {
  private readonly options: TestGeneratorOptions;
  private readonly template: HandlebarsTemplateDelegate;

  constructor(options: TestGeneratorOptions = {}) {
    this.options = {
      includeVisualChecks: true,
      includeComments: true,
      timeout: 30000,
      ...options,
    };

    const templateSource = options.template ?? DEFAULT_TEST_TEMPLATE;
    this.template = Handlebars.compile(templateSource);
  }

  /**
   * Generates a Playwright test file from an exploration lockfile.
   */
  generate(
    lockfile: ExplorationLockfile,
    review?: ReviewData
  ): GeneratedTest {
    const steps = this.generateSteps(lockfile);
    const outcomeChecks = this.generateOutcomeChecks(lockfile);

    const content = this.template({
      specName: lockfile.spec,
      specPath: lockfile.spec_path,
      explorationId: lockfile.exploration_id,
      reviewer: review?.reviewer,
      reviewedAt: review?.submitted_at,
      generatedAt: new Date().toISOString(),
      testDescription: this.generateTestDescription(lockfile),
      steps,
      outcomeChecks: outcomeChecks.length > 0 ? outcomeChecks : undefined,
    });

    return {
      path: `tests/${lockfile.spec}.spec.ts`,
      content,
      specName: lockfile.spec,
      explorationId: lockfile.exploration_id,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a test description from the spec name.
   */
  private generateTestDescription(lockfile: ExplorationLockfile): string {
    // Convert kebab-case to readable description
    return lockfile.spec
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generates code for all steps.
   */
  private generateSteps(
    lockfile: ExplorationLockfile
  ): Array<{ code: string }> {
    return lockfile.steps.map((step, index) => {
      const code = this.generateStepCode(step, index);
      return { code };
    });
  }

  /**
   * Generates code for a single step wrapped in test.step().
   */
  private generateStepCode(step: ExplorationStep, index: number): string {
    const lines: string[] = [];
    const indent = '    '; // 4 spaces for inside test block
    const innerIndent = '      '; // 6 spaces for inside test.step block

    // Determine step name: use description if available, otherwise step_{index}
    const stepName = step.spec_action.description ?? `step_${index}`;

    // Generate action-specific code
    const actionCode = this.generateActionCode(step);

    // Start test.step() wrapper
    lines.push(`${indent}await test.step('${escapeString(stepName)}', async () => {`);

    // Add step comment inside the test.step block
    if (this.options.includeComments) {
      lines.push(
        `${innerIndent}// ─────────────────────────────────────────────────────────────────────────`
      );
      lines.push(
        `${innerIndent}// Step ${index}: ${this.describeAction(step.spec_action)}`
      );
      if (step.execution.method) {
        lines.push(`${innerIndent}// Found via: ${step.execution.method}`);
      }
      lines.push(
        `${innerIndent}// ─────────────────────────────────────────────────────────────────────────`
      );
    }

    // Add action code inside the test.step block
    lines.push(...actionCode.map((line) => `${innerIndent}${line}`));

    // Close test.step() wrapper
    lines.push(`${indent}});`);

    return lines.join('\n');
  }

  /**
   * Describes an action for comments.
   */
  private describeAction(action: LegacySpecStep): string {
    switch (action.action) {
      case 'click':
        return `Click: ${action.query ?? action.selector ?? 'element'}`;
      case 'navigate':
        return `Navigate to: ${action.to}`;
      case 'fill':
        return `Fill: ${action.query ?? action.selector ?? 'input'}`;
      case 'type':
        return `Type: ${action.query ?? action.selector ?? 'input'}`;
      case 'wait':
        return `Wait for: ${action.for ?? 'condition'}`;
      case 'screenshot':
        return `Screenshot: ${action.name ?? 'unnamed'}`;
      case 'verify_state':
        return 'Verify state';
      case 'select':
        return `Select: ${action.option ?? 'option'}`;
      case 'check':
        return `Checkbox: ${action.checked ? 'check' : 'uncheck'}`;
      default:
        return action.action;
    }
  }

  /**
   * Generates code for a specific action.
   */
  private generateActionCode(step: ExplorationStep): string[] {
    const { spec_action: action, execution } = step;
    const lines: string[] = [];

    switch (action.action) {
      case 'click':
        lines.push(...this.generateClickCode(step));
        break;

      case 'navigate':
        lines.push(...this.generateNavigateCode(action));
        break;

      case 'fill':
        lines.push(...this.generateFillCode(step));
        break;

      case 'type':
        lines.push(...this.generateTypeCode(step));
        break;

      case 'wait':
        lines.push(...this.generateWaitCode(action, execution.duration_ms));
        break;

      case 'screenshot':
        lines.push(...this.generateScreenshotCode(action));
        break;

      case 'verify_state':
        lines.push(...this.generateVerifyCode(action));
        break;

      case 'select':
        lines.push(...this.generateSelectCode(step));
        break;

      case 'check':
        lines.push(...this.generateCheckCode(step));
        break;

      case 'back':
        lines.push('await page.goBack();');
        break;

      case 'forward':
        lines.push('await page.goForward();');
        break;

      case 'refresh':
        lines.push('await page.reload();');
        break;

      default:
        lines.push(`// TODO: Unsupported action: ${action.action}`);
    }

    return lines;
  }

  /**
   * Generates click action code.
   */
  private generateClickCode(step: ExplorationStep): string[] {
    const locatorCode = resolveLocatorCode(
      step.execution.locator,
      step.execution.selector_used
    );
    return [`await ${locatorCode}.click();`];
  }

  /**
   * Generates navigate action code.
   */
  private generateNavigateCode(action: LegacySpecStep): string[] {
    const url = action.to ?? '/';
    return [`await page.goto('${escapeString(url)}');`];
  }

  /**
   * Generates fill action code.
   */
  private generateFillCode(step: ExplorationStep): string[] {
    const locatorCode = resolveLocatorCode(
      step.execution.locator,
      step.execution.selector_used
    );
    const value = step.execution.value_used ?? step.spec_action.value ?? '';
    return [`await ${locatorCode}.fill('${escapeString(value)}');`];
  }

  /**
   * Generates type action code.
   */
  private generateTypeCode(step: ExplorationStep): string[] {
    const lines: string[] = [];
    const locatorCode = resolveLocatorCode(
      step.execution.locator,
      step.execution.selector_used
    );
    const value = step.execution.value_used ?? step.spec_action.value ?? '';

    lines.push(`await ${locatorCode}.pressSequentially('${escapeString(value)}');`);

    if (step.spec_action.pressEnter) {
      lines.push(`await ${locatorCode}.press('Enter');`);
    }

    return lines;
  }

  /**
   * Generates wait action code.
   */
  private generateWaitCode(action: LegacySpecStep, actualDuration?: number): string[] {
    const lines: string[] = [];
    const timeout = action.timeout ?? this.options.timeout ?? 30000;

    switch (action.for) {
      case 'element':
        if (action.selector) {
          lines.push(
            `await page.locator('${escapeString(action.selector)}').waitFor({ timeout: ${timeout} });`
          );
        }
        break;

      case 'text':
        if (action.text) {
          lines.push(
            `await page.getByText('${escapeString(action.text)}').waitFor({ timeout: ${timeout} });`
          );
        }
        break;

      case 'url':
        if (action.contains) {
          lines.push(
            `await page.waitForURL(url => url.href.includes('${escapeString(action.contains)}'), { timeout: ${timeout} });`
          );
        }
        break;

      case 'time':
        const duration = action.duration ?? actualDuration ?? 1000;
        lines.push(`await page.waitForTimeout(${duration});`);
        break;

      default:
        lines.push(`await page.waitForLoadState('networkidle');`);
    }

    return lines;
  }

  /**
   * Generates screenshot action code.
   */
  private generateScreenshotCode(action: LegacySpecStep): string[] {
    const lines: string[] = [];
    const name = action.name ?? 'screenshot';

    if (this.options.includeVisualChecks) {
      // Add wait for animations before screenshot
      lines.push(generateWaitForAnimations());
      lines.push('');

      // Inject mask overlay elements if there are region-based masks
      if (action.mask && action.mask.length > 0) {
        const maskSetupCode = generateMaskSetupCode(action.mask);
        if (maskSetupCode) {
          lines.push(maskSetupCode);
          lines.push('');
        }
      }

      // Generate screenshot assertion
      const assertion = generateScreenshotAssertion(
        {
          name,
          mask: action.mask,
          animations: 'disabled',
        },
        { includeComments: this.options.includeComments }
      );
      lines.push(assertion);
    } else {
      // Just capture screenshot without assertion
      lines.push(`await page.screenshot({ path: 'screenshots/${escapeString(name)}.png' });`);
    }

    return lines;
  }

  /**
   * Generates verify_state action code.
   */
  private generateVerifyCode(action: LegacySpecStep): string[] {
    const lines: string[] = [];

    for (const check of action.checks ?? []) {
      if (check.element_visible) {
        lines.push(
          `await expect(page.locator('${escapeString(check.element_visible)}')).toBeVisible();`
        );
      }

      if (check.element_not_visible) {
        lines.push(
          `await expect(page.locator('${escapeString(check.element_not_visible)}')).not.toBeVisible();`
        );
      }

      if (check.text_contains) {
        lines.push(
          `await expect(page.getByText('${escapeString(check.text_contains)}')).toBeVisible();`
        );
      }

      if (check.text_not_contains) {
        lines.push(
          `await expect(page.getByText('${escapeString(check.text_not_contains)}')).not.toBeVisible();`
        );
      }

      if (check.url_contains) {
        lines.push(
          `await expect(page).toHaveURL(new RegExp('${escapeString(check.url_contains)}'));`
        );
      }

      if (check.element_count) {
        lines.push(
          `await expect(page.locator('${escapeString(check.element_count.selector)}')).toHaveCount(${check.element_count.expected});`
        );
      }

      if (check.attribute) {
        lines.push(
          `await expect(page.locator('${escapeString(check.attribute.selector)}')).toHaveAttribute('${escapeString(check.attribute.attribute)}', '${escapeString(check.attribute.equals)}');`
        );
      }
    }

    return lines;
  }

  /**
   * Generates select action code.
   */
  private generateSelectCode(step: ExplorationStep): string[] {
    const locatorCode = resolveLocatorCode(
      step.execution.locator,
      step.execution.selector_used
    );
    const option = step.spec_action.option ?? '';
    return [`await ${locatorCode}.selectOption('${escapeString(option)}');`];
  }

  /**
   * Generates check/uncheck action code.
   */
  private generateCheckCode(step: ExplorationStep): string[] {
    const locatorCode = resolveLocatorCode(
      step.execution.locator,
      step.execution.selector_used
    );
    const checked = step.spec_action.checked ?? true;

    if (checked) {
      return [`await ${locatorCode}.check();`];
    } else {
      return [`await ${locatorCode}.uncheck();`];
    }
  }

  /**
   * Generates code for outcome checks.
   */
  private generateOutcomeChecks(
    lockfile: ExplorationLockfile
  ): Array<{ code: string }> {
    return lockfile.outcome_checks
      .filter((check) => check.passed)
      .map((check) => {
        const code = `    // Outcome: ${check.check} = ${String(check.expected)}`;
        return { code };
      });
  }
}

/**
 * Convenience function to generate a test from a lockfile.
 */
export function generateTest(
  lockfile: ExplorationLockfile,
  options?: TestGeneratorOptions,
  review?: ReviewData
): GeneratedTest {
  const generator = new PlaywrightGenerator(options);
  return generator.generate(lockfile, review);
}
