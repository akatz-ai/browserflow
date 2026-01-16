import { describe, it, expect } from 'bun:test';
import { colors, chalk } from './colors.js';

describe('colors', () => {
  it('should export chalk instance', () => {
    expect(chalk).toBeDefined();
    expect(typeof chalk.green).toBe('function');
  });

  it('should have status colors', () => {
    expect(typeof colors.success).toBe('function');
    expect(typeof colors.error).toBe('function');
    expect(typeof colors.warning).toBe('function');
    expect(typeof colors.info).toBe('function');
  });

  it('should have UI element styles', () => {
    expect(typeof colors.dim).toBe('function');
    expect(typeof colors.bold).toBe('function');
    expect(typeof colors.underline).toBe('function');
  });

  it('should have semantic colors', () => {
    expect(typeof colors.pass).toBe('function');
    expect(typeof colors.fail).toBe('function');
    expect(typeof colors.skip).toBe('function');
  });

  it('should apply colors to text', () => {
    const result = colors.success('test');
    expect(result).toContain('test');
  });
});
