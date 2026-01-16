/**
 * Zod schema for browserflow.yaml config files
 *
 * @see bf-cv6 for implementation task
 */

import { z } from 'zod';
import { durationSchema } from './spec-schema.js';

// Browser types supported by Playwright
export const browserTypeSchema = z.enum(['chromium', 'firefox', 'webkit']);

// Viewport configuration
export const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// Project section
export const projectConfigSchema = z.object({
  name: z.string().min(1),
  base_url: z.string().url().optional(),
});

// Runtime/browser section
export const runtimeConfigSchema = z.object({
  browser: browserTypeSchema.optional().default('chromium'),
  engine: browserTypeSchema.optional(), // Alias for browser
  headless: z.boolean().optional().default(true),
  viewport: viewportSchema.optional(),
  timeout: z.union([durationSchema, z.number()]).optional(),
});

// Locator preferences
export const locatorsConfigSchema = z.object({
  prefer_testid: z.boolean().optional().default(true),
  testid_attributes: z.array(z.string()).optional(),
});

// Exploration settings
export const explorationConfigSchema = z.object({
  adapter: z.string().optional().default('claude'),
  max_retries: z.number().int().nonnegative().optional().default(3),
});

// Review UI settings
export const reviewConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).optional().default(8190),
  auto_open: z.boolean().optional().default(true),
});

// Output paths
export const outputConfigSchema = z.object({
  tests_dir: z.string().optional().default('e2e/tests'),
  baselines_dir: z.string().optional().default('baselines'),
});

// CI settings
export const ciConfigSchema = z.object({
  fail_on_baseline_diff: z.boolean().optional().default(false),
  parallel: z.number().int().positive().optional(),
});

// Top-level browserflow.yaml config schema
export const browserflowConfigSchema = z.object({
  project: projectConfigSchema,
  runtime: runtimeConfigSchema.optional(),
  browser: runtimeConfigSchema.optional(), // Alias for runtime
  locators: locatorsConfigSchema.optional(),
  exploration: explorationConfigSchema.optional(),
  review: reviewConfigSchema.optional(),
  output: outputConfigSchema.optional(),
  ci: ciConfigSchema.optional(),
});

// Type exports
export type BrowserTypeConfig = z.infer<typeof browserTypeSchema>;
export type ViewportConfig = z.infer<typeof viewportSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
export type LocatorsConfig = z.infer<typeof locatorsConfigSchema>;
export type ExplorationConfig = z.infer<typeof explorationConfigSchema>;
export type ReviewConfig = z.infer<typeof reviewConfigSchema>;
export type OutputConfig = z.infer<typeof outputConfigSchema>;
export type CiConfig = z.infer<typeof ciConfigSchema>;
export type BrowserflowConfig = z.infer<typeof browserflowConfigSchema>;

/**
 * Validates a browserflow config object
 */
export function validateBrowserflowConfig(config: unknown): config is BrowserflowConfig {
  return browserflowConfigSchema.safeParse(config).success;
}

/**
 * Parses and validates a browserflow config with error details
 */
export function parseBrowserflowConfig(config: unknown): {
  success: boolean;
  data?: BrowserflowConfig;
  error?: string;
} {
  const result = browserflowConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
  };
}
