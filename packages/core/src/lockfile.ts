/**
 * Lockfile types for exploration results
 *
 * @see bf-aak for implementation task
 */

import { z } from 'zod';
import { join } from 'path';
import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { locatorObjectSchema, type LocatorObject, type LegacyLocatorObject } from './locator-object.js';
import type { SpecStep, LegacySpecStep } from './spec-schema.js';

// Assertion types
export type AssertionType =
  | 'visible'
  | 'hidden'
  | 'text_contains'
  | 'text_equals'
  | 'url_contains'
  | 'url_matches'
  | 'count'
  | 'attribute'
  | 'checked'
  | 'screenshot';

export const assertionTypeSchema = z.enum([
  'visible',
  'hidden',
  'text_contains',
  'text_equals',
  'url_contains',
  'url_matches',
  'count',
  'attribute',
  'checked',
  'screenshot',
]);

// Mask interface
export interface Mask {
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
  locator?: string;
}

export const maskSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  reason: z.string(),
  locator: z.string().optional(),
});

// Assertion interface
export interface Assertion {
  id: string;
  type: AssertionType;
  target?: LocatorObject;
  expected?: string | number | boolean;
  step_id?: string;
}

export const assertionSchema = z.object({
  id: z.string(),
  type: assertionTypeSchema,
  target: locatorObjectSchema.optional(),
  expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
  step_id: z.string().optional(),
});

// Generation metadata
export interface GenerationMetadata {
  format: 'playwright-ts';
  output_path: string;
  generated_at?: string;
}

export const generationMetadataSchema = z.object({
  format: z.literal('playwright-ts'),
  output_path: z.string(),
  generated_at: z.string().optional(),
});

// Main Lockfile interface
export interface Lockfile {
  run_id: string;
  spec_name: string;
  spec_hash: string;
  created_at: string;
  locators: Record<string, LocatorObject>;
  masks: Record<string, Mask[]>;
  assertions: Assertion[];
  generation: GenerationMetadata;
}

export const lockfileSchema = z.object({
  run_id: z.string(),
  spec_name: z.string(),
  spec_hash: z.string(),
  created_at: z.string(),
  locators: z.record(locatorObjectSchema),
  masks: z.record(z.array(maskSchema)),
  assertions: z.array(assertionSchema),
  generation: generationMetadataSchema,
});

/**
 * Validates if an object is a valid Lockfile
 */
export function validateLockfile(lockfile: unknown): lockfile is Lockfile {
  return lockfileSchema.safeParse(lockfile).success;
}

/**
 * Computes SHA256 hash of spec file content
 */
export function computeSpecHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Reads a lockfile from a run directory
 */
export async function readLockfile(runDir: string): Promise<Lockfile> {
  const lockfilePath = join(runDir, 'lockfile.json');
  const content = await readFile(lockfilePath, 'utf-8');
  const parsed = JSON.parse(content);

  const result = lockfileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid lockfile: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Writes a lockfile to a run directory
 */
export async function writeLockfile(runDir: string, lockfile: Lockfile): Promise<void> {
  const lockfilePath = join(runDir, 'lockfile.json');
  const content = JSON.stringify(lockfile, null, 2);
  await writeFile(lockfilePath, content, 'utf-8');
}

// Legacy types for backwards compatibility
export interface ExplorationLockfile {
  spec: string;
  spec_path: string;
  exploration_id: string;
  timestamp: string;
  duration_ms: number;
  browser: 'chromium' | 'firefox' | 'webkit';
  viewport: { width: number; height: number };
  base_url: string;
  steps: ExplorationStep[];
  outcome_checks: OutcomeCheck[];
  overall_status: 'completed' | 'failed' | 'timeout';
  errors: ExplorationError[];
}

export interface ExplorationStep {
  step_index: number;
  spec_action: LegacySpecStep;
  execution: StepExecution;
  screenshots: {
    before?: string;
    after?: string;
  };
  snapshot_before?: Record<string, unknown>;
  snapshot_after?: Record<string, unknown>;
}

export interface StepExecution {
  status: 'completed' | 'failed' | 'skipped';
  method?: string;
  element_ref?: string;
  selector_used?: string;
  locator?: LegacyLocatorObject;
  duration_ms: number;
  error?: string;
  value_used?: string;
  url_used?: string;
}

export interface OutcomeCheck {
  check: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface ExplorationError {
  step_index?: number;
  message: string;
  stack?: string;
}
