import { describe, it, expect } from 'bun:test';
import { runCommand } from './run.js';

describe('runCommand', () => {
  it('should have correct name and description', () => {
    const cmd = runCommand();
    expect(cmd.name()).toBe('run');
    expect(cmd.description()).toBe('Run BrowserFlow tests via Playwright');
  });

  it('should accept spec arguments', () => {
    const cmd = runCommand();
    const args = cmd.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('specs');
    expect(args[0].variadic).toBe(true);
  });

  it('should have --spec option', () => {
    const cmd = runCommand();
    const opt = cmd.options.find(o => o.long === '--spec');
    expect(opt).toBeDefined();
    expect(opt?.short).toBe('-s');
  });

  it('should have --tag option', () => {
    const cmd = runCommand();
    const opt = cmd.options.find(o => o.long === '--tag');
    expect(opt).toBeDefined();
    expect(opt?.short).toBe('-t');
  });

  it('should have --parallel option', () => {
    const cmd = runCommand();
    const opt = cmd.options.find(o => o.long === '--parallel');
    expect(opt).toBeDefined();
    expect(opt?.short).toBe('-p');
  });

  it('should have --headed option', () => {
    const cmd = runCommand();
    const opt = cmd.options.find(o => o.long === '--headed');
    expect(opt).toBeDefined();
  });

  it('should have --trace option with default value', () => {
    const cmd = runCommand();
    const opt = cmd.options.find(o => o.long === '--trace');
    expect(opt).toBeDefined();
    expect(opt?.defaultValue).toBe('off');
  });
});
