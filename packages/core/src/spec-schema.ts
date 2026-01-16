/**
 * Zod schemas for BrowserFlow spec v2
 *
 * @see bf-dgs for implementation task
 */

import { z } from 'zod';

// Placeholder schemas - will be implemented in bf-dgs
export const actionTypeSchema = z.enum([
  'click',
  'navigate',
  'back',
  'forward',
  'refresh',
  'fill',
  'type',
  'select',
  'check',
  'wait',
  'verify_state',
  'screenshot',
  'identify_element',
  'ai_verify',
  'custom',
]);

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

export const specStepSchema = z.object({
  action: actionTypeSchema,
  query: z.string().optional(),
  selector: z.string().optional(),
  ref: z.string().optional(),
  description: z.string().optional(),
  to: z.string().optional(),
  value: z.string().optional(),
  for: z.enum(['element', 'text', 'url', 'time']).optional(),
  text: z.string().optional(),
  contains: z.string().optional(),
  timeout: z.number().optional(),
  duration: z.number().optional(),
  checks: z.array(verifyCheckSchema).optional(),
  name: z.string().optional(),
  highlight: z.array(highlightRegionSchema).optional(),
  mask: z.array(maskRegionSchema).optional(),
  option: z.string().optional(),
  checked: z.boolean().optional(),
  pressEnter: z.boolean().optional(),
  question: z.string().optional(),
  expected: z.boolean().optional(),
  save_as: z.string().optional(),
});

export const expectedOutcomeSchema = z.record(z.union([z.boolean(), z.number(), z.string()]));

export const specSchema = z.object({
  name: z.string(),
  description: z.string(),
  preconditions: z.record(z.unknown()).optional(),
  steps: z.array(specStepSchema),
  expected_outcomes: z.array(expectedOutcomeSchema).optional(),
  timeout: z.string().optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  tags: z.array(z.string()).optional(),
});

export type ActionType = z.infer<typeof actionTypeSchema>;
export type VerifyCheck = z.infer<typeof verifyCheckSchema>;
export type HighlightRegion = z.infer<typeof highlightRegionSchema>;
export type MaskRegion = z.infer<typeof maskRegionSchema>;
export type SpecStep = z.infer<typeof specStepSchema>;
export type ExpectedOutcome = z.infer<typeof expectedOutcomeSchema>;
export type BrowserFlowSpec = z.infer<typeof specSchema>;
