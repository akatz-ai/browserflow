/**
 * Spec loading and normalization utilities
 * @see bf-7ne - preconditions.page string coercion
 */

import type { Preconditions, BrowserFlowSpec } from './spec-schema.js';
import { specSchema } from './spec-schema.js';
import type { z } from 'zod';

/**
 * Normalize preconditions to handle backward-compatible formats
 * Coerces string page values to object format
 */
export function normalizePreconditions(preconditions: unknown): Preconditions {
  if (!preconditions || typeof preconditions !== 'object') {
    return {};
  }

  const pre = { ...preconditions } as Record<string, unknown>;

  // Coerce string page to object format
  if (typeof pre.page === 'string') {
    pre.page = { url: pre.page };
  }

  return pre as Preconditions;
}

/**
 * Load and validate a spec with normalization
 * Returns a Zod SafeParseReturnType for detailed error handling
 */
export function loadSpec(rawSpec: unknown): z.SafeParseReturnType<unknown, BrowserFlowSpec> {
  if (!rawSpec || typeof rawSpec !== 'object') {
    return specSchema.safeParse(rawSpec);
  }

  const spec = { ...rawSpec } as Record<string, unknown>;

  // Normalize preconditions if present
  if (spec.preconditions) {
    spec.preconditions = normalizePreconditions(spec.preconditions);
  }

  // Validate with Zod schema
  return specSchema.safeParse(spec);
}
