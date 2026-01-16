import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctorCommand } from './doctor.js';

describe('doctorCommand', () => {
  it('should have correct name and description', () => {
    const cmd = doctorCommand();
    expect(cmd.name()).toBe('doctor');
    expect(cmd.description()).toBe('Check environment and dependencies');
  });

  it('should have --fix option', () => {
    const cmd = doctorCommand();
    const opt = cmd.options.find(o => o.long === '--fix');
    expect(opt).toBeDefined();
  });

  it('should have --verbose option', () => {
    const cmd = doctorCommand();
    const opt = cmd.options.find(o => o.long === '--verbose');
    expect(opt).toBeDefined();
    expect(opt?.short).toBe('-v');
  });
});

describe('CheckResult interface', () => {
  it('should be used correctly by check functions', async () => {
    const { checkNodeVersion } = await import('./doctor.js');
    const result = await checkNodeVersion();

    // Verify the result conforms to CheckResult interface
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('message');
    expect(['pass', 'warn', 'fail']).toContain(result.status);
    expect(typeof result.message).toBe('string');
  });
});

describe('runDoctor', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'bf-doctor-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  it('should check Node.js version', async () => {
    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    const nodeCheck = results.checks.find(c => c.name === 'Node.js version');
    expect(nodeCheck).toBeDefined();
    // Current Node version should pass (we're running this test)
    expect(nodeCheck?.result.status).toBe('pass');
    expect(nodeCheck?.result.message).toContain('v');
  });

  it('should check for agent-browser', async () => {
    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    const abCheck = results.checks.find(c => c.name === 'agent-browser');
    expect(abCheck).toBeDefined();
    // Status can be pass or fail depending on environment
    expect(['pass', 'fail']).toContain(abCheck?.result.status);
  });

  it('should check for Playwright browsers', async () => {
    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    const pwCheck = results.checks.find(c => c.name === 'Playwright browsers');
    expect(pwCheck).toBeDefined();
    expect(['pass', 'warn', 'fail']).toContain(pwCheck?.result.status);
  });

  it('should check for browserflow.yaml configuration', async () => {
    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    const configCheck = results.checks.find(c => c.name === 'Configuration');
    expect(configCheck).toBeDefined();
    // No config file yet, should fail
    expect(configCheck?.result.status).toBe('fail');
    expect(configCheck?.result.fixHint).toContain('bf init');
  });

  it('should pass configuration check with valid browserflow.yaml', async () => {
    await writeFile(
      join(testDir, 'browserflow.yaml'),
      'project:\n  name: test\nreview:\n  port: 8190\n'
    );

    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    const configCheck = results.checks.find(c => c.name === 'Configuration');
    expect(configCheck?.result.status).toBe('pass');
  });

  it('should check review port availability', async () => {
    await writeFile(
      join(testDir, 'browserflow.yaml'),
      'project:\n  name: test\nreview:\n  port: 8190\n'
    );

    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    const portCheck = results.checks.find(c => c.name === 'Review port');
    expect(portCheck).toBeDefined();
    // Port should be either available (pass) or in use (warn)
    expect(['pass', 'warn']).toContain(portCheck?.result.status);
  });

  it('should provide fix hints for failures', async () => {
    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    // Configuration should fail and have a fix hint
    const configCheck = results.checks.find(c => c.name === 'Configuration');
    expect(configCheck?.result.fixHint).toBeDefined();
  });

  it('should calculate summary counts', async () => {
    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    expect(typeof results.summary.passed).toBe('number');
    expect(typeof results.summary.warnings).toBe('number');
    expect(typeof results.summary.failed).toBe('number');
    expect(results.summary.passed + results.summary.warnings + results.summary.failed)
      .toBe(results.checks.length);
  });

  it('should return correct exit code based on worst status', async () => {
    const { runDoctor } = await import('./doctor.js');
    const results = await runDoctor({});

    // With no config, we should have at least one failure
    expect(results.exitCode).toBe(1);
  });

  it('should return exit code 0 when all pass', async () => {
    await writeFile(
      join(testDir, 'browserflow.yaml'),
      'project:\n  name: test\nreview:\n  port: 8190\n'
    );

    const { runDoctor, createMockChecks } = await import('./doctor.js');
    // Use mock checks that all pass
    const results = await runDoctor({}, createMockChecks({ allPass: true }));

    expect(results.exitCode).toBe(0);
  });
});

describe('check implementations', () => {
  it('should detect Node.js version >= 18', async () => {
    const { checkNodeVersion } = await import('./doctor.js');
    const result = await checkNodeVersion();

    const major = parseInt(process.version.slice(1));
    if (major >= 18) {
      expect(result.status).toBe('pass');
    } else {
      expect(result.status).toBe('fail');
    }
  });

  it('should provide correct fix hint for agent-browser', async () => {
    const { checkAgentBrowser } = await import('./doctor.js');
    const result = await checkAgentBrowser();

    if (result.status === 'fail') {
      expect(result.fixHint).toContain('bun add -g agent-browser');
    }
  });
});
