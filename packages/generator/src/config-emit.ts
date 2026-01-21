/**
 * config-emit.ts
 * Generates playwright.config.ts content.
 */

import type {
  PlaywrightConfigOptions,
  PlaywrightProject,
  GeneratedConfig,
} from '@browserflow-ai/core';
import Handlebars from 'handlebars';

/**
 * Configuration for generating playwright.config.ts.
 */
export interface ConfigGeneratorOptions {
  /** Base URL for tests */
  baseUrl?: string;
  /** Test directory */
  testDir?: string;
  /** Output directory for results */
  outputDir?: string;
  /** Playwright config options */
  config?: PlaywrightConfigOptions;
  /** Custom Handlebars template */
  template?: string;
}

/**
 * Default playwright.config.ts template.
 */
const DEFAULT_CONFIG_TEMPLATE = `import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for BrowserFlow-generated tests.
 * Generated: {{generatedAt}}
 */
export default defineConfig({
  testDir: '{{testDir}}',
  {{#if outputDir}}
  outputDir: '{{outputDir}}',
  {{/if}}

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? {{retries}} : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : {{workers}},

  /* Reporter to use */
  reporter: '{{reporter}}',

  /* Shared settings for all the projects below */
  use: {
    {{#if baseUrl}}
    /* Base URL to use in actions like \`await page.goto('/')\` */
    baseURL: '{{baseUrl}}',
    {{/if}}

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Test timeout */
  timeout: {{timeout}},

  /* Configure projects for major browsers */
  projects: [
{{#each projects}}
    {
      name: '{{name}}',
      use: {
        ...devices['{{deviceName}}'],
        {{#if viewport}}
        viewport: { width: {{viewport.width}}, height: {{viewport.height}} },
        {{/if}}
      },
    },
{{/each}}
  ],
{{#if webServer}}

  /* Run your local dev server before starting the tests */
  webServer: {
    command: '{{webServer.command}}',
    url: '{{webServer.url}}',
    reuseExistingServer: !process.env.CI,
  },
{{/if}}
});
`;

/**
 * Default browser projects configuration.
 */
const DEFAULT_PROJECTS: Array<{
  name: string;
  deviceName: string;
  viewport?: { width: number; height: number };
}> = [
  { name: 'chromium', deviceName: 'Desktop Chrome' },
  { name: 'firefox', deviceName: 'Desktop Firefox' },
  { name: 'webkit', deviceName: 'Desktop Safari' },
];

/**
 * Generates a playwright.config.ts file.
 */
export function generatePlaywrightConfig(
  options: ConfigGeneratorOptions = {}
): GeneratedConfig {
  const {
    baseUrl,
    testDir = './tests',
    outputDir,
    config = {},
    template = DEFAULT_CONFIG_TEMPLATE,
  } = options;

  const {
    timeout = 30000,
    retries = 2,
    workers = 4,
    reporter = 'html',
    projects,
    webServer,
  } = config;

  // Build projects data
  const projectsData =
    projects?.map((p) => ({
      name: p.name,
      deviceName: getDeviceName(p),
      viewport: p.use.viewport,
    })) ?? DEFAULT_PROJECTS;

  // Compile template
  const compiledTemplate = Handlebars.compile(template);

  const content = compiledTemplate({
    generatedAt: new Date().toISOString(),
    testDir,
    outputDir,
    baseUrl,
    timeout,
    retries,
    workers,
    reporter,
    projects: projectsData,
    webServer,
  });

  return {
    path: 'playwright.config.ts',
    content,
  };
}

/**
 * Maps a PlaywrightProject to a Playwright device name.
 */
function getDeviceName(project: PlaywrightProject): string {
  const browserName = project.use.browserName ?? 'chromium';

  const deviceMap: Record<string, string> = {
    chromium: 'Desktop Chrome',
    firefox: 'Desktop Firefox',
    webkit: 'Desktop Safari',
  };

  return deviceMap[browserName] ?? 'Desktop Chrome';
}

/**
 * Generates a minimal playwright.config.ts for a single browser.
 */
export function generateMinimalConfig(options: {
  baseUrl?: string;
  testDir?: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
}): GeneratedConfig {
  const { baseUrl, testDir = './tests', browser = 'chromium' } = options;

  const deviceName = {
    chromium: 'Desktop Chrome',
    firefox: 'Desktop Firefox',
    webkit: 'Desktop Safari',
  }[browser];

  const content = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '${testDir}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    ${baseUrl ? `baseURL: '${baseUrl}',` : ''}
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: '${browser}',
      use: { ...devices['${deviceName}'] },
    },
  ],
});
`;

  return {
    path: 'playwright.config.ts',
    content,
  };
}

/**
 * Generates package.json scripts for running Playwright tests.
 */
export function generatePlaywrightScripts(): Record<string, string> {
  return {
    'test:e2e': 'playwright test',
    'test:e2e:headed': 'playwright test --headed',
    'test:e2e:debug': 'playwright test --debug',
    'test:e2e:ui': 'playwright test --ui',
    'test:e2e:update-snapshots': 'playwright test --update-snapshots',
  };
}

/**
 * Generates the commands needed to set up Playwright in a project.
 */
export function generateSetupInstructions(): string {
  return `# Install Playwright
bun add -D @playwright/test

# Install browsers
bunx playwright install

# Run tests
bun run test:e2e
`;
}
