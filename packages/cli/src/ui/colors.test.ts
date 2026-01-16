import { describe, it, expect } from 'bun:test';
import { colors, symbols, chalk } from './colors.js';

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

describe('symbols', () => {
  it('should have pre-rendered pass symbol', () => {
    expect(symbols.pass).toContain('✓');
  });

  it('should have pre-rendered fail symbol', () => {
    expect(symbols.fail).toContain('✗');
  });

  it('should have pre-rendered pending symbol', () => {
    expect(symbols.pending).toContain('○');
  });

  it('should have pre-rendered arrow symbol', () => {
    expect(symbols.arrow).toContain('→');
  });

  it('should have pre-rendered bullet symbol', () => {
    expect(symbols.bullet).toContain('•');
  });

  it('should have pre-rendered info symbol', () => {
    expect(symbols.info).toContain('ℹ');
  });

  it('should have pre-rendered warn symbol', () => {
    expect(symbols.warn).toContain('⚠');
  });
});
