/**
 * Zod schemas for BrowserFlow spec v2
 *
 * @see bf-dgs for implementation task
 */

import { z } from 'zod';
import { isValidDuration } from './duration.js';

// Duration validation
export const durationSchema = z.string().refine(isValidDuration, {
  message: 'Must be a valid duration string like "3s", "2m", "500ms", or "1m30s"',
});

// Target object - at least one locator strategy required
export const targetSchema: z.ZodType<Target> = z.lazy(() =>
  z
    .object({
      query: z.string().optional(),
      testid: z.string().optional(),
      role: z.string().optional(),
      name: z.string().optional(),
      label: z.string().optional(),
      placeholder: z.string().optional(),
      text: z.string().optional(),
      css: z.string().optional(),
      within: targetSchema.optional(),
      nth: z.number().int().optional(),
    })
    .refine(
      (data) =>
        data.query ||
        data.testid ||
        data.role ||
        data.label ||
        data.placeholder ||
        data.text ||
        data.css,
      'Target must have at least one locator strategy (query, testid, role, label, placeholder, text, or css)'
    )
);

// Action types from spec section 6.4
export const actionTypeSchema = z.enum([
  'click',
  'navigate',
  'back',
  'forward',
  'refresh',
  'reload',
  'fill',
  'type',
  'select',
  'check',
  'press',
  'upload',
  'wait',
  'expect',
  'screenshot',
  'scroll',
  'scroll_into_view',
  'verify_state',
  'identify_element',
  'ai_verify',
  'custom',
]);

// State values for expect action
export const stateSchema = z.enum([
  'visible',
  'hidden',
  'enabled',
  'disabled',
  'checked',
  'unchecked',
  'focused',
  'editable',
  'attached',
  'detached',
]);

// Step schema - id is REQUIRED
export const stepSchema = z
  .object({
    id: z.string().min(1, 'Step id is required'),
    action: actionTypeSchema,
    name: z.string().optional(), // 1-4 word display name for UI
    description: z.string().optional(),
    why: z.string().optional(), // Rationale for this step
    target: targetSchema.optional(),
    // Navigate action
    url: z.string().optional(),
    // Fill/type action
    value: z.string().optional(),
    text: z.string().optional(),
    // Select action
    option: z.string().optional(),
    // Check action
    checked: z.boolean().optional(),
    // Wait action
    duration: durationSchema.optional(),
    // Expect action
    state: stateSchema.optional(),
    // Timeout override
    timeout: durationSchema.optional(),
    // Keyboard
    pressEnter: z.boolean().optional(),
    // Verify state
    checks: z
      .array(
        z.object({
          element_visible: z.string().optional(),
          element_not_visible: z.string().optional(),
          text_contains: z.string().optional(),
          text_not_contains: z.string().optional(),
          url_contains: z.string().optional(),
          element_count: z
            .object({
              selector: z.string(),
              expected: z.number(),
            })
            .optional(),
          attribute: z
            .object({
              selector: z.string(),
              attribute: z.string(),
              equals: z.string(),
            })
            .optional(),
        })
      )
      .optional(),
    // Screenshot options
    highlight: z
      .array(
        z.object({
          selector: z.string(),
          label: z.string().optional(),
        })
      )
      .optional(),
    mask: z
      .array(
        z.object({
          selector: z.string().optional(),
          region: z
            .object({
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
            })
            .optional(),
          reason: z.string().optional(),
        })
      )
      .optional(),
    // AI verify
    question: z.string().optional(),
    expected: z.union([z.boolean(), z.string(), z.number()]).optional(),
    // Custom action
    save_as: z.string().optional(),
    ref: z.string().optional(),
    selector: z.string().optional(),
    for: z.enum(['element', 'text', 'url', 'time']).optional(),
    contains: z.string().optional(),
  })
  .strict();

// Preconditions schema
export const preconditionsSchema = z.object({
  page: z
    .object({
      url: z.string().optional(),
    })
    .optional(),
  auth: z
    .object({
      user: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  viewport: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  mocks: z
    .array(
      z.object({
        url: z.string(),
        response: z.unknown(),
      })
    )
    .optional(),
});

// Expected outcome schema
export const expectedOutcomeSchema = z.object({
  description: z.string().optional(),
  check: z.string().optional(),
  expected: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

// Top-level spec schema
export const specSchema = z
  .object({
    version: z.literal(2),
    name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be kebab-case (lowercase letters, numbers, and hyphens only)'),
    description: z.string().optional(),
    steps: z.array(stepSchema).min(1, 'At least one step required'),
    timeout: durationSchema.optional(),
    priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
    tags: z.array(z.string()).optional(),
    preconditions: preconditionsSchema.optional(),
    expected_outcomes: z.array(expectedOutcomeSchema).optional(),
  })
  .refine(
    (data) => {
      const ids = data.steps.map((s) => s.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Step IDs must be unique within spec' }
  );

// Type definitions
export type Target = {
  query?: string;
  testid?: string;
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  text?: string;
  css?: string;
  within?: Target;
  nth?: number;
};

export type ActionType = z.infer<typeof actionTypeSchema>;
export type State = z.infer<typeof stateSchema>;
export type SpecStep = z.infer<typeof stepSchema>;
export type Preconditions = z.infer<typeof preconditionsSchema>;
export type ExpectedOutcome = z.infer<typeof expectedOutcomeSchema>;
export type BrowserFlowSpec = z.infer<typeof specSchema>;

// Legacy exports for backwards compatibility
export const verifyCheckSchema = z.object({
  element_visible: z.string().optional(),
  element_not_visible: z.string().optional(),
  text_contains: z.string().optional(),
  text_not_contains: z.string().optional(),
  url_contains: z.string().optional(),
  element_count: z
    .object({
      selector: z.string(),
      expected: z.number(),
    })
    .optional(),
  attribute: z
    .object({
      selector: z.string(),
      attribute: z.string(),
      equals: z.string(),
    })
    .optional(),
});

export const highlightRegionSchema = z.object({
  selector: z.string(),
  label: z.string().optional(),
});

export const maskRegionSchema = z.object({
  selector: z.string().optional(),
  region: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  reason: z.string().optional(),
});

// Legacy type exports
export type VerifyCheck = z.infer<typeof verifyCheckSchema>;
export type HighlightRegion = z.infer<typeof highlightRegionSchema>;
export type MaskRegion = z.infer<typeof maskRegionSchema>;

// Alias for specStepSchema (legacy)
export const specStepSchema = stepSchema;

// Legacy SpecStep type (for backwards compatibility with generator)
export interface LegacySpecStep {
  id?: string;
  action: ActionType;
  name?: string; // 1-4 word display name for UI
  description?: string;
  why?: string; // Rationale for this step
  // Click/fill/type - query-based targeting
  query?: string;
  // Navigate action
  to?: string;
  // Fill action
  value?: string;
  // Wait action
  for?: 'element' | 'text' | 'url' | 'time';
  text?: string;
  duration?: string | number;
  contains?: string;
  // Select action
  option?: string;
  // Check action
  checked?: boolean;
  // Screenshot action - uses top-level 'name' field
  mask?: Array<{
    selector?: string;
    region?: { x: number; y: number; width: number; height: number };
    reason?: string;
  }>;
  // Verify state action
  checks?: Array<{
    element_visible?: string;
    element_not_visible?: string;
    text_contains?: string;
    text_not_contains?: string;
    url_contains?: string;
    element_count?: { selector: string; expected: number };
    attribute?: { selector: string; attribute: string; equals: string };
  }>;
  // AI verify
  question?: string;
  expected?: boolean | string | number;
  // Custom action
  save_as?: string;
  // Element reference
  ref?: string;
  // Legacy selector
  selector?: string;
  // Timeout override
  timeout?: string;
  // Keyboard
  pressEnter?: boolean;
}
