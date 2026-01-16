/**
 * Tests for duration string parser
 * @see bf-x1q
 */

import { describe, expect, test } from 'bun:test';
import { parseDuration, formatDuration, isValidDuration } from './duration.js';

describe('parseDuration', () => {
  describe('basic units', () => {
    test('parses milliseconds', () => {
      expect(parseDuration('500ms')).toBe(500);
      expect(parseDuration('0ms')).toBe(0);
      expect(parseDuration('1ms')).toBe(1);
    });

    test('parses seconds', () => {
      expect(parseDuration('3s')).toBe(3000);
      expect(parseDuration('1s')).toBe(1000);
      expect(parseDuration('30s')).toBe(30000);
    });

    test('parses minutes', () => {
      expect(parseDuration('2m')).toBe(120000);
      expect(parseDuration('1m')).toBe(60000);
      expect(parseDuration('5m')).toBe(300000);
    });

    test('parses hours', () => {
      expect(parseDuration('1h')).toBe(3600000);
      expect(parseDuration('2h')).toBe(7200000);
    });
  });

  describe('combined units', () => {
    test('parses minute and seconds', () => {
      expect(parseDuration('1m30s')).toBe(90000);
      expect(parseDuration('2m15s')).toBe(135000);
    });

    test('parses hours and minutes', () => {
      expect(parseDuration('1h30m')).toBe(5400000);
      expect(parseDuration('2h45m')).toBe(9900000);
    });

    test('parses complex combinations', () => {
      expect(parseDuration('1h30m45s')).toBe(5445000);
      expect(parseDuration('1m30s500ms')).toBe(90500);
    });
  });

  describe('numeric input', () => {
    test('treats numeric input as milliseconds', () => {
      expect(parseDuration(500)).toBe(500);
      expect(parseDuration(3000)).toBe(3000);
      expect(parseDuration(0)).toBe(0);
    });

    test('parses plain number strings as milliseconds', () => {
      expect(parseDuration('500')).toBe(500);
      expect(parseDuration('3000')).toBe(3000);
    });
  });

  describe('whitespace handling', () => {
    test('trims whitespace', () => {
      expect(parseDuration('  3s  ')).toBe(3000);
      expect(parseDuration('\t2m\n')).toBe(120000);
    });

    test('handles lowercase conversion', () => {
      expect(parseDuration('3S')).toBe(3000);
      expect(parseDuration('2M')).toBe(120000);
      expect(parseDuration('1H')).toBe(3600000);
    });
  });

  describe('error handling', () => {
    test('throws for empty string', () => {
      expect(() => parseDuration('')).toThrow('Duration must be a non-empty string');
    });

    test('throws for whitespace-only string', () => {
      expect(() => parseDuration('   ')).toThrow('Duration must be a non-empty string');
    });

    test('throws for invalid format', () => {
      expect(() => parseDuration('3 seconds')).toThrow(/Invalid duration/);
      expect(() => parseDuration('abc')).toThrow(/Invalid duration/);
      expect(() => parseDuration('3x')).toThrow(/Invalid duration/);
    });

    test('provides helpful error message', () => {
      try {
        parseDuration('invalid');
      } catch (e) {
        expect((e as Error).message).toContain('3s');
        expect((e as Error).message).toContain('2m');
        expect((e as Error).message).toContain('500ms');
        expect((e as Error).message).toContain('1m30s');
      }
    });
  });

  describe('edge cases', () => {
    test('handles fractional values', () => {
      expect(parseDuration('1.5s')).toBe(1500);
      expect(parseDuration('0.5m')).toBe(30000);
    });

    test('handles zero values', () => {
      expect(parseDuration('0s')).toBe(0);
      expect(parseDuration('0m')).toBe(0);
    });
  });
});

describe('formatDuration', () => {
  test('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  test('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(3000)).toBe('3s');
    expect(formatDuration(30000)).toBe('30s');
  });

  test('formats minutes', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(120000)).toBe('2m');
  });

  test('formats hours', () => {
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(7200000)).toBe('2h');
  });

  test('formats combinations', () => {
    expect(formatDuration(90000)).toBe('1m30s');
    expect(formatDuration(5400000)).toBe('1h30m');
    expect(formatDuration(5445000)).toBe('1h30m45s');
  });

  test('formats sub-second remainders to seconds', () => {
    // formatDuration uses floor, so sub-second parts are dropped
    expect(formatDuration(1500)).toBe('1s');
    expect(formatDuration(90500)).toBe('1m30s');
  });
});

describe('isValidDuration', () => {
  test('returns true for valid durations', () => {
    expect(isValidDuration('3s')).toBe(true);
    expect(isValidDuration('2m')).toBe(true);
    expect(isValidDuration('1h')).toBe(true);
    expect(isValidDuration('500ms')).toBe(true);
    expect(isValidDuration('1m30s')).toBe(true);
    expect(isValidDuration('1h30m')).toBe(true);
  });

  test('returns false for invalid durations', () => {
    expect(isValidDuration('')).toBe(false);
    expect(isValidDuration('abc')).toBe(false);
    expect(isValidDuration('3 seconds')).toBe(false);
    expect(isValidDuration('3x')).toBe(false);
  });

  test('returns true for plain number strings', () => {
    expect(isValidDuration('500')).toBe(true);
    expect(isValidDuration('3000')).toBe(true);
  });
});
