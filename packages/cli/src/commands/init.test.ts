import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile, access, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initCommand, DEFAULT_CONFIG, EXAMPLE_SPEC } from './init.js';

describe('initCommand', () => {
  it('should have correct name and description', () => {
    const cmd = initCommand();
    expect(cmd.name()).toBe('init');
    expect(cmd.description()).toBe('Initialize BrowserFlow in the current project');
  });

  it('should have --force option', () => {
    const cmd = initCommand();
    const opt = cmd.options.find(o => o.long === '--force');
    expect(opt).toBeDefined();
    expect(opt?.short).toBe('-f');
  });

  it('should have --example option', () => {
    const cmd = initCommand();
    const opt = cmd.options.find(o => o.long === '--example');
    expect(opt).toBeDefined();
  });
});

describe('DEFAULT_CONFIG', () => {
  it('should be valid YAML with required sections', () => {
    expect(DEFAULT_CONFIG).toContain('project:');
    expect(DEFAULT_CONFIG).toContain('runtime:');
    expect(DEFAULT_CONFIG).toContain('locators:');
    expect(DEFAULT_CONFIG).toContain('exploration:');
    expect(DEFAULT_CONFIG).toContain('review:');
    expect(DEFAULT_CONFIG).toContain('output:');
  });

  it('should have sensible default values', () => {
    expect(DEFAULT_CONFIG).toContain('base_url: http://localhost:3000');
    expect(DEFAULT_CONFIG).toContain('browser: chromium');
    expect(DEFAULT_CONFIG).toContain('headless: true');
    expect(DEFAULT_CONFIG).toContain('prefer_testid: true');
    expect(DEFAULT_CONFIG).toContain('port: 8190');
    expect(DEFAULT_CONFIG).toContain('tests_dir: e2e/tests');
  });
});

describe('EXAMPLE_SPEC', () => {
  it('should be valid YAML spec', () => {
    expect(EXAMPLE_SPEC).toContain('version: 2');
    expect(EXAMPLE_SPEC).toContain('name: example');
    expect(EXAMPLE_SPEC).toContain('steps:');
    expect(EXAMPLE_SPEC).toContain('action: navigate');
    expect(EXAMPLE_SPEC).toContain('action: screenshot');
  });
});

describe('init action', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'bf-init-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create browserflow.yaml', async () => {
    const { runInit } = await import('./init.js');
    await runInit({});

    const configPath = join(testDir, 'browserflow.yaml');
    // access() resolves with null if file exists
    await access(configPath);

    const content = await readFile(configPath, 'utf-8');
    expect(content).toBe(DEFAULT_CONFIG);
  });

  it('should create specs/ directory', async () => {
    const { runInit } = await import('./init.js');
    await runInit({});

    const specsDir = join(testDir, 'specs');
    // access() resolves with null if directory exists
    await access(specsDir);
  });

  it('should update .gitignore with required entries', async () => {
    const { runInit } = await import('./init.js');
    await runInit({});

    const gitignorePath = join(testDir, '.gitignore');
    // access() resolves with null if file exists
    await access(gitignorePath);

    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toContain('.browserflow/');
    expect(content).toContain('node_modules/');
  });

  it('should not duplicate .gitignore entries', async () => {
    // Pre-create .gitignore with some entries
    await writeFile(join(testDir, '.gitignore'), 'node_modules/\n');

    const { runInit } = await import('./init.js');
    await runInit({});

    const content = await readFile(join(testDir, '.gitignore'), 'utf-8');
    const nodeModulesCount = (content.match(/node_modules\//g) || []).length;
    expect(nodeModulesCount).toBe(1);
  });

  it('should not overwrite existing config without --force', async () => {
    const existingConfig = 'existing: config\n';
    await writeFile(join(testDir, 'browserflow.yaml'), existingConfig);

    const { runInit } = await import('./init.js');
    await runInit({});

    const content = await readFile(join(testDir, 'browserflow.yaml'), 'utf-8');
    expect(content).toBe(existingConfig);
  });

  it('should overwrite existing config with --force', async () => {
    const existingConfig = 'existing: config\n';
    await writeFile(join(testDir, 'browserflow.yaml'), existingConfig);

    const { runInit } = await import('./init.js');
    await runInit({ force: true });

    const content = await readFile(join(testDir, 'browserflow.yaml'), 'utf-8');
    expect(content).toBe(DEFAULT_CONFIG);
  });

  it('should create example spec with --example', async () => {
    const { runInit } = await import('./init.js');
    await runInit({ example: true });

    const examplePath = join(testDir, 'specs', 'example.yaml');
    // access() resolves with null if file exists
    await access(examplePath);

    const content = await readFile(examplePath, 'utf-8');
    expect(content).toBe(EXAMPLE_SPEC);
  });

  it('should not create example spec without --example', async () => {
    const { runInit } = await import('./init.js');
    await runInit({});

    const examplePath = join(testDir, 'specs', 'example.yaml');
    await expect(access(examplePath)).rejects.toThrow();
  });

  it('should return created files list', async () => {
    const { runInit } = await import('./init.js');
    const result = await runInit({ example: true });

    expect(result.created).toContain('browserflow.yaml');
    expect(result.created).toContain('specs/');
    expect(result.created).toContain('specs/example.yaml');
    expect(result.updated).toContain('.gitignore');
  });

  it('should handle existing specs directory', async () => {
    await mkdir(join(testDir, 'specs'));

    const { runInit } = await import('./init.js');
    const result = await runInit({});

    // Should still succeed, just not report as created
    expect(result.created).not.toContain('specs/');
  });
});
