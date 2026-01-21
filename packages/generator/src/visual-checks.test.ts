/**
 * visual-checks.test.ts
 * Tests for visual check code generation, including region mask support.
 */

import { describe, it, expect } from 'bun:test';
import type { MaskRegion } from '@akatz-ai/core';
import {
  generateScreenshotAssertion,
  generateScreenshotCapture,
  generateMaskSetupCode,
} from './visual-checks.js';

describe('visual-checks', () => {
  describe('generateScreenshotAssertion', () => {
    it('generates basic screenshot assertion without masks', () => {
      const result = generateScreenshotAssertion({ name: 'homepage' });

      expect(result).toContain("await expect(page).toHaveScreenshot('homepage.png');");
    });

    it('generates screenshot assertion with selector-based mask', () => {
      const masks: MaskRegion[] = [
        { selector: '.timestamp', reason: 'Dynamic timestamp' },
      ];
      const result = generateScreenshotAssertion({ name: 'homepage', mask: masks });

      expect(result).toContain("mask: [page.locator('.timestamp')]");
    });

    it('generates screenshot assertion with region-based mask', () => {
      const masks: MaskRegion[] = [
        {
          region: { x: 10, y: 20, width: 100, height: 50 },
          reason: 'Dynamic ad section',
        },
      ];
      const result = generateScreenshotAssertion({ name: 'homepage', mask: masks });

      // Should generate overlay element reference
      expect(result).toContain("mask: [page.locator('[data-bf-mask=\"0\"]')]");
    });

    it('generates screenshot assertion with mixed masks', () => {
      const masks: MaskRegion[] = [
        { selector: '.timestamp' },
        { region: { x: 10, y: 20, width: 100, height: 50 } },
        { selector: '.user-avatar' },
        { region: { x: 80, y: 5, width: 15, height: 10 } },
      ];
      const result = generateScreenshotAssertion({ name: 'dashboard', mask: masks });

      // Should include both selector and region masks
      expect(result).toContain("page.locator('.timestamp')");
      expect(result).toContain("page.locator('[data-bf-mask=\"0\"]')");
      expect(result).toContain("page.locator('.user-avatar')");
      expect(result).toContain("page.locator('[data-bf-mask=\"1\"]')");
    });

    it('handles empty mask array', () => {
      const result = generateScreenshotAssertion({ name: 'page', mask: [] });

      // Should not include mask option when array is empty
      expect(result).not.toContain('mask:');
    });

    it('uses correct page variable for masks', () => {
      const masks: MaskRegion[] = [
        { selector: '.dynamic-content' },
      ];
      const result = generateScreenshotAssertion(
        { name: 'test', mask: masks },
        { pageVar: 'customPage' }
      );

      expect(result).toContain("customPage.locator('.dynamic-content')");
    });
  });

  describe('generateScreenshotCapture', () => {
    it('generates capture with selector-based mask', () => {
      const masks: MaskRegion[] = [
        { selector: '.timestamp' },
      ];
      const result = generateScreenshotCapture({ name: 'capture', mask: masks });

      expect(result).toContain("mask: [page.locator('.timestamp')]");
    });

    it('generates capture with region-based mask', () => {
      const masks: MaskRegion[] = [
        { region: { x: 25, y: 30, width: 40, height: 20 } },
      ];
      const result = generateScreenshotCapture({ name: 'capture', mask: masks });

      expect(result).toContain("mask: [page.locator('[data-bf-mask=\"0\"]')]");
    });

    it('generates capture with mixed masks', () => {
      const masks: MaskRegion[] = [
        { selector: '.header' },
        { region: { x: 0, y: 90, width: 100, height: 10 } },
      ];
      const result = generateScreenshotCapture({ name: 'capture', mask: masks });

      expect(result).toContain("page.locator('.header')");
      expect(result).toContain("page.locator('[data-bf-mask=\"0\"]')");
    });
  });

  describe('generateMaskSetupCode', () => {
    it('generates no setup code when no region masks present', () => {
      const masks: MaskRegion[] = [
        { selector: '.timestamp' },
        { selector: '.user-avatar' },
      ];
      const result = generateMaskSetupCode(masks);

      expect(result).toBe('');
    });

    it('generates overlay injection for single region mask', () => {
      const masks: MaskRegion[] = [
        { region: { x: 10, y: 20, width: 100, height: 50 } },
      ];
      const result = generateMaskSetupCode(masks);

      // Should inject overlay element with correct positioning
      expect(result).toContain('await page.evaluate');
      expect(result).toContain('document.createElement');
      expect(result).toContain("div.setAttribute('data-bf-mask'");
      expect(result).toContain('left:10%');
      expect(result).toContain('top:20%');
      expect(result).toContain('width:100%');
      expect(result).toContain('height:50%');
      expect(result).toContain('position:fixed');
      expect(result).toContain('pointer-events:none');
      expect(result).toContain('z-index:99999');
      expect(result).toContain('document.body.appendChild');
    });

    it('generates overlay injection for multiple region masks', () => {
      const masks: MaskRegion[] = [
        { selector: '.header' },
        { region: { x: 10, y: 20, width: 30, height: 40 } },
        { region: { x: 80, y: 5, width: 15, height: 10 } },
        { selector: '.footer' },
      ];
      const result = generateMaskSetupCode(masks);

      // Should only process region masks (indices 0 and 1 for regions)
      expect(result).toContain('await page.evaluate');
      expect(result).toContain('left:10%');
      expect(result).toContain('top:20%');
      expect(result).toContain('left:80%');
      expect(result).toContain('top:5%');
      // Should create two overlay elements
      expect((result.match(/data-bf-mask/g) || []).length).toBe(2);
    });

    it('uses correct data attribute indices for region masks', () => {
      const masks: MaskRegion[] = [
        { region: { x: 0, y: 0, width: 50, height: 50 } },  // index 0
        { selector: '.selector1' },                         // not counted
        { region: { x: 50, y: 50, width: 50, height: 50 } }, // index 1
        { selector: '.selector2' },                         // not counted
        { region: { x: 25, y: 25, width: 50, height: 50 } }, // index 2
      ];
      const result = generateMaskSetupCode(masks);

      // Should use indices 0, 1, 2 for the three region masks
      expect(result).toContain("'data-bf-mask', '0'");
      expect(result).toContain("'data-bf-mask', '1'");
      expect(result).toContain("'data-bf-mask', '2'");
    });

    it('handles empty mask array', () => {
      const result = generateMaskSetupCode([]);

      expect(result).toBe('');
    });

    it('uses custom page variable when provided', () => {
      const masks: MaskRegion[] = [
        { region: { x: 10, y: 20, width: 30, height: 40 } },
      ];
      const result = generateMaskSetupCode(masks, 'customPage');

      expect(result).toContain('await customPage.evaluate');
    });
  });

  describe('mask array generation edge cases', () => {
    it('preserves order of mixed masks', () => {
      const masks: MaskRegion[] = [
        { selector: '.first' },
        { region: { x: 10, y: 10, width: 10, height: 10 } },
        { selector: '.second' },
        { region: { x: 20, y: 20, width: 20, height: 20 } },
        { selector: '.third' },
      ];
      const result = generateScreenshotAssertion({ name: 'test', mask: masks });

      // Should maintain order in mask array
      // Use greedy match to handle attribute selectors with brackets
      const maskArrayMatch = result.match(/mask: \[(.*)\]/s);
      expect(maskArrayMatch).toBeTruthy();

      const maskArray = maskArrayMatch![1];
      const firstIndex = maskArray.indexOf("'.first'");
      const secondIndex = maskArray.indexOf('[data-bf-mask="0"]');
      const thirdIndex = maskArray.indexOf("'.second'");
      const fourthIndex = maskArray.indexOf('[data-bf-mask="1"]');
      const fifthIndex = maskArray.indexOf("'.third'");

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
      expect(thirdIndex).toBeLessThan(fourthIndex);
      expect(fourthIndex).toBeLessThan(fifthIndex);
    });

    it('escapes special characters in selector masks', () => {
      const masks: MaskRegion[] = [
        { selector: "div[data-test='value']" },
      ];
      const result = generateScreenshotAssertion({ name: 'test', mask: masks });

      // Should properly escape the selector string
      expect(result).toContain("page.locator('div[data-test=\\'value\\']')");
    });
  });
});
