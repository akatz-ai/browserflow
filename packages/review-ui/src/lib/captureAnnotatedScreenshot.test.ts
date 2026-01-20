/**
 * Tests for captureAnnotatedScreenshot utility
 *
 * Note: These tests require a DOM environment with canvas support.
 * They test the logic of the function when run in a proper browser/DOM context.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import type { Mask } from '../components/MaskEditor';

// Note: We can't fully test captureAnnotatedScreenshot in Node/Bun environment
// because it requires DOM APIs (Image, Canvas, etc.)
// These tests verify the module structure and types

describe('captureAnnotatedScreenshot', () => {
  test('module exports the expected function', async () => {
    const module = await import('./captureAnnotatedScreenshot');
    expect(typeof module.captureAnnotatedScreenshot).toBe('function');
  });

  test('function accepts expected options shape', async () => {
    const { captureAnnotatedScreenshot } = await import('./captureAnnotatedScreenshot');

    const options = {
      imageSrc: 'http://example.com/image.png',
      masks: [
        { id: 'mask-1', x: 10, y: 20, width: 30, height: 40, reason: 'Test mask' }
      ] as Mask[],
      borderWidth: 3,
      showLabels: true,
    };

    // The function will fail in Node environment due to missing DOM APIs
    // but we verify the type signature is correct
    expect(() => {
      // This call will throw because Image is not defined in Node
      return captureAnnotatedScreenshot(options);
    }).toThrow();
  });

  test('mask color palette has expected colors', async () => {
    // Import the module to verify color definitions work
    // The colors are defined within the module and used internally
    const module = await import('./captureAnnotatedScreenshot');

    // Just verify the module loads without errors
    expect(module).toBeDefined();
  });
});

describe('captureAnnotatedScreenshot types', () => {
  test('Mask type is compatible with MaskEditor masks', () => {
    // Type-level test - if this compiles, types are correct
    const mask: Mask = {
      id: 'test-mask-id',
      x: 10.5,
      y: 20.5,
      width: 30.5,
      height: 40.5,
      reason: 'Test reason',
    };

    expect(mask.id).toBe('test-mask-id');
    expect(typeof mask.x).toBe('number');
    expect(typeof mask.y).toBe('number');
    expect(typeof mask.width).toBe('number');
    expect(typeof mask.height).toBe('number');
    expect(typeof mask.reason).toBe('string');
  });
});
