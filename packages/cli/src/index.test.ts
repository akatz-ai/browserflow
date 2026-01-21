import { describe, it, expect } from 'bun:test';
import { createRequire } from 'node:module';
import { createProgram } from './index.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

describe('bf CLI', () => {
  it('should have correct name and description', () => {
    const program = createProgram();
    expect(program.name()).toBe('bf');
    expect(program.description()).toBe('BrowserFlow - Human-in-the-Loop E2E Test Generation');
  });

  it('should have correct version', () => {
    const program = createProgram();
    expect(program.version()).toBe(pkg.version);
  });

  it('should have init command', () => {
    const program = createProgram();
    const initCmd = program.commands.find(c => c.name() === 'init');
    expect(initCmd).toBeDefined();
    expect(initCmd?.description()).toBe('Initialize BrowserFlow in the current project');
  });

  it('should have doctor command', () => {
    const program = createProgram();
    const doctorCmd = program.commands.find(c => c.name() === 'doctor');
    expect(doctorCmd).toBeDefined();
    expect(doctorCmd?.description()).toBe('Check environment and dependencies');
  });

  it('should have lint command', () => {
    const program = createProgram();
    const lintCmd = program.commands.find(c => c.name() === 'lint');
    expect(lintCmd).toBeDefined();
    expect(lintCmd?.description()).toBe('Validate BrowserFlow spec files');
  });

  it('should have run command', () => {
    const program = createProgram();
    const runCmd = program.commands.find(c => c.name() === 'run');
    expect(runCmd).toBeDefined();
    expect(runCmd?.description()).toBe('Run BrowserFlow tests via Playwright');
  });

  it('should list all commands in help', () => {
    const program = createProgram();
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('init');
    expect(commands).toContain('doctor');
    expect(commands).toContain('lint');
    expect(commands).toContain('run');
  });
});
