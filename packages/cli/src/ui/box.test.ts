import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { printBox, formatBox } from './box.js';

describe('box', () => {
  let logs: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    logs = [];
    originalLog = console.log;
    console.log = mock((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    console.log = originalLog;
  });

  describe('formatBox', () => {
    it('should format a box with title and content', () => {
      const result = formatBox('Test Title', ['Line 1', 'Line 2']);
      expect(result).toContain('Test Title');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    it('should use box-drawing characters', () => {
      const result = formatBox('Title', ['Content']);
      expect(result).toContain('┌');
      expect(result).toContain('┐');
      expect(result).toContain('└');
      expect(result).toContain('┘');
      expect(result).toContain('│');
      expect(result).toContain('─');
    });

    it('should handle empty content', () => {
      const result = formatBox('Title', []);
      expect(result).toContain('Title');
      // Should still have box structure
      expect(result).toContain('┌');
      expect(result).toContain('└');
    });

    it('should respect custom width', () => {
      const result = formatBox('Title', ['Content'], { width: 40 });
      const lines = result.split('\n');
      // Top border should be width characters
      expect(lines[0].length).toBeLessThanOrEqual(42); // width + 2 for corners
    });
  });

  describe('printBox', () => {
    it('should output box to console', () => {
      printBox('My Title', ['Item 1', 'Item 2']);

      expect(logs.length).toBeGreaterThan(0);
      const output = logs.join('\n');
      expect(output).toContain('My Title');
      expect(output).toContain('Item 1');
      expect(output).toContain('Item 2');
    });
  });
});
