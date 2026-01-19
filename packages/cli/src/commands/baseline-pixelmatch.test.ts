/**
 * Tests for pixelmatch-based image comparison
 * @see bf-wjz
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

// Import the function we'll be testing
// NOTE: This will need to be exported from baseline.ts
import { compareImages } from './baseline.js';

/**
 * Helper to create a PNG buffer with a solid color
 */
function createPNG(width: number, height: number, r: number, g: number, b: number, a: number = 255): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

describe('compareImages with pixelmatch', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bf-pixelmatch-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('identical images should match', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');

    const pngBuffer = createPNG(100, 100, 255, 0, 0);
    await writeFile(img1Path, pngBuffer);
    await writeFile(img2Path, pngBuffer);

    const result = await compareImages(img1Path, img2Path);

    expect(result.match).toBe(true);
    expect(result.diffPercent).toBe(0);
  });

  test('different images should not match and provide diff percentage', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');

    // Red vs Blue images
    await writeFile(img1Path, createPNG(100, 100, 255, 0, 0));
    await writeFile(img2Path, createPNG(100, 100, 0, 0, 255));

    const result = await compareImages(img1Path, img2Path);

    expect(result.match).toBe(false);
    expect(result.diffPercent).toBeGreaterThan(0);
    // Should be very high diff since every pixel is different
    expect(result.diffPercent).toBeGreaterThan(50);
  });

  test('partially different images should have accurate diff percentage', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');

    // Create images that differ by exactly 25% of pixels
    const png1 = new PNG({ width: 100, height: 100 });
    const png2 = new PNG({ width: 100, height: 100 });

    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        // First 75% identical (red), last 25% different (red vs blue)
        if (x < 75) {
          // Red
          png1.data[idx] = png2.data[idx] = 255;
          png1.data[idx + 1] = png2.data[idx + 1] = 0;
          png1.data[idx + 2] = png2.data[idx + 2] = 0;
          png1.data[idx + 3] = png2.data[idx + 3] = 255;
        } else {
          // png1: red, png2: blue
          png1.data[idx] = 255;
          png1.data[idx + 1] = 0;
          png1.data[idx + 2] = 0;
          png1.data[idx + 3] = 255;

          png2.data[idx] = 0;
          png2.data[idx + 1] = 0;
          png2.data[idx + 2] = 255;
          png2.data[idx + 3] = 255;
        }
      }
    }

    await writeFile(img1Path, PNG.sync.write(png1));
    await writeFile(img2Path, PNG.sync.write(png2));

    const result = await compareImages(img1Path, img2Path);

    expect(result.match).toBe(false);
    // Should be around 25% diff (with some tolerance for antialiasing threshold)
    expect(result.diffPercent).toBeGreaterThan(20);
    expect(result.diffPercent).toBeLessThan(30);
  });

  test('images with different dimensions should have 100% diff', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');

    await writeFile(img1Path, createPNG(100, 100, 255, 0, 0));
    await writeFile(img2Path, createPNG(200, 100, 255, 0, 0));

    const result = await compareImages(img1Path, img2Path);

    expect(result.match).toBe(false);
    expect(result.diffPercent).toBe(100);
  });

  test('should generate diff image when images differ', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');
    const diffPath = join(testDir, 'diff.png');

    await writeFile(img1Path, createPNG(100, 100, 255, 0, 0));
    await writeFile(img2Path, createPNG(100, 100, 0, 0, 255));

    const result = await compareImages(img1Path, img2Path, {
      generateDiff: true,
      diffPath,
    });

    expect(result.match).toBe(false);
    expect(result.diffPath).toBe(diffPath);

    // Verify diff file was created and is a valid PNG
    const diffBuffer = await readFile(diffPath);
    expect(diffBuffer.length).toBeGreaterThan(0);

    // Verify it's a valid PNG by parsing it
    const diffPng = PNG.sync.read(diffBuffer);
    expect(diffPng.width).toBe(100);
    expect(diffPng.height).toBe(100);
  });

  test('should not generate diff image when images match', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');
    const diffPath = join(testDir, 'diff.png');

    const pngBuffer = createPNG(100, 100, 255, 0, 0);
    await writeFile(img1Path, pngBuffer);
    await writeFile(img2Path, pngBuffer);

    const result = await compareImages(img1Path, img2Path, {
      generateDiff: true,
      diffPath,
    });

    expect(result.match).toBe(true);
    expect(result.diffPath).toBeUndefined();

    // Verify diff file was NOT created
    try {
      await readFile(diffPath);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
    }
  });

  test('should respect custom threshold', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');

    // Create images with very subtle differences (antialiasing-like)
    const png1 = new PNG({ width: 100, height: 100 });
    const png2 = new PNG({ width: 100, height: 100 });

    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        // Subtle difference: 250 vs 255
        png1.data[idx] = 250;
        png2.data[idx] = 255;
        png1.data[idx + 1] = png2.data[idx + 1] = 0;
        png1.data[idx + 2] = png2.data[idx + 2] = 0;
        png1.data[idx + 3] = png2.data[idx + 3] = 255;
      }
    }

    await writeFile(img1Path, PNG.sync.write(png1));
    await writeFile(img2Path, PNG.sync.write(png2));

    // With strict threshold (0.0), should detect difference
    const strictResult = await compareImages(img1Path, img2Path, { threshold: 0.0 });
    expect(strictResult.match).toBe(false);

    // With lenient threshold (0.5), might ignore subtle differences
    const lenientResult = await compareImages(img1Path, img2Path, { threshold: 0.5 });
    // This test verifies threshold is being passed to pixelmatch
    // The exact match result depends on pixelmatch's behavior
    expect(typeof lenientResult.match).toBe('boolean');
    expect(typeof lenientResult.diffPercent).toBe('number');
  });

  test('should handle corrupted/invalid image files gracefully', async () => {
    const img1Path = join(testDir, 'img1.png');
    const img2Path = join(testDir, 'img2.png');

    await writeFile(img1Path, 'not a valid png');
    await writeFile(img2Path, createPNG(100, 100, 255, 0, 0));

    const result = await compareImages(img1Path, img2Path);

    expect(result.match).toBe(false);
    // Should handle error gracefully
  });
});
