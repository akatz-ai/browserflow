# Exploration Artifacts

BrowserFlow produces two main artifacts after exploration and review.

## exploration.json

Complete step-by-step execution data with screenshots and DOM snapshots.

```typescript
interface ExplorationOutput {
  // Metadata
  spec: string;                    // Spec name
  specPath: string;                // Path to spec file
  explorationId: string;           // Unique ID (exp-<timestamp>-<random>)
  timestamp: string;               // ISO8601
  durationMs: number;              // Total exploration time
  browser: 'chromium' | 'firefox' | 'webkit';
  viewport: { width: number; height: number };
  baseUrl: string;

  // Execution
  steps: StepResult[];
  outcomeChecks: CheckResult[];

  // Status
  overallStatus: 'completed' | 'failed' | 'timeout';
  errors: string[];                // All error messages
}

interface StepResult {
  stepIndex: number;
  specAction: SpecStep;            // Original spec step definition

  execution: {
    status: 'completed' | 'failed' | 'skipped';
    method: string;                // 'click', 'fill', 'navigate', etc.
    elementRef?: string;           // Element ref used (e.g., 'e1')
    selectorUsed?: string;         // Playwright selector string
    durationMs: number;
    error?: string;                // Error message if failed
  };

  screenshots: {
    before: string;                // Path: screenshots/step-XX-before.png
    after: string;                 // Path: screenshots/step-XX-after.png
  };

  snapshotBefore?: DOMSnapshot;
  snapshotAfter?: DOMSnapshot;
}

interface DOMSnapshot {
  tree: string;                    // Accessibility tree (text format)
  refs: {                          // Element references with Playwright locators
    [ref: string]: {
      selector: string;            // e.g., "getByRole('button', { name: 'Add' })"
      role: string;
      name: string;
      // Additional metadata
    };
  };
}

interface CheckResult {
  check: string;                   // Check type
  expected: any;
  actual: any;
  passed: boolean;
}
```

### Key Fields for Test Generation

**Locators from refs:**
```typescript
// Get Playwright locator for an element
const ref = exploration.steps[2].snapshotAfter.refs['e1'];
const selector = ref.selector;  // "getByRole('button', { name: 'Submit' })"
```

**Checking for failures:**
```typescript
// Find failed steps
const failures = exploration.steps.filter(s => s.execution.status === 'failed');
failures.forEach(s => console.log(s.stepIndex, s.execution.error));

// Or check errors array
exploration.errors.forEach(err => console.log(err));
```

## review.json

Human feedback with comments and visual mask highlights.

```typescript
interface ReviewOutput {
  exploration_id: string;
  spec_name: string;
  reviewed_at: string;             // ISO8601 timestamp
  overall_comment?: string;        // Summary of findings

  steps: StepReview[];
}

interface StepReview {
  step_index: number;
  status: 'reviewed' | 'pending';  // Has feedback vs no feedback

  comment?: string;                // Human notes for this step

  masks?: Mask[];                  // Highlighted regions on screenshot

  locked_locator?: string;         // Human-preferred locator

  annotated_screenshot?: string;   // Path with mask overlays rendered
}

interface Mask {
  id: string;
  x: number;                       // Percentage (0-100)
  y: number;
  width: number;
  height: number;
  reason: string;                  // Required explanation of what's highlighted
}
```

### Understanding Review Status

- **`reviewed`**: Step has a comment or mask - human provided feedback
- **`pending`**: No feedback yet - may be fine or just not reviewed

There is no approve/reject. Reviews are free-form feedback.

### Using Masks

Masks highlight issues on screenshots. The `reason` explains what's wrong.

```typescript
// Check if step has highlighted issues
if (review.steps[2].masks?.length > 0) {
  review.steps[2].masks.forEach(mask => {
    console.log(`Issue at (${mask.x}%, ${mask.y}%): ${mask.reason}`);
  });

  // View annotated screenshot with mask overlays
  const annotatedPath = review.steps[2].annotated_screenshot;
  // screenshots/step-02-review.png
}
```

## File Locations

```
.browserflow/explorations/<exp-id>/
├── exploration.json          # Full exploration data
├── review.json              # Human feedback (after bf review)
└── screenshots/
    ├── step-00-before.png
    ├── step-00-after.png
    ├── step-01-before.png
    ├── step-01-after.png
    ├── step-01-review.png   # Annotated with masks (if any)
    └── ...
```

## Finding Explorations

```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Find latest exploration for a spec
async function findLatestExploration(specName: string): Promise<string | null> {
  const dir = '.browserflow/explorations';
  const entries = await readdir(dir);

  // Sort by timestamp (newest first)
  const sorted = entries.filter(e => e.startsWith('exp-')).sort().reverse();

  for (const id of sorted) {
    const data = JSON.parse(
      await readFile(join(dir, id, 'exploration.json'), 'utf-8')
    );
    if (data.spec === specName) return id;
  }
  return null;
}

// Load both artifacts
async function loadArtifacts(expId: string) {
  const base = `.browserflow/explorations/${expId}`;
  const exploration = JSON.parse(await readFile(`${base}/exploration.json`, 'utf-8'));

  let review = null;
  try {
    review = JSON.parse(await readFile(`${base}/review.json`, 'utf-8'));
  } catch (e) {
    // review.json doesn't exist yet
  }

  return { exploration, review };
}
```

## Common Patterns

### Diagnosing Failures

```typescript
const { exploration, review } = await loadArtifacts(expId);

// 1. Check overall errors
if (exploration.errors.length > 0) {
  console.log('Exploration errors:', exploration.errors);
}

// 2. Check human summary
if (review?.overall_comment) {
  console.log('Review summary:', review.overall_comment);
}

// 3. Check each step
exploration.steps.forEach((step, i) => {
  const stepReview = review?.steps.find(s => s.step_index === i);

  if (step.execution.status === 'failed') {
    console.log(`Step ${i} failed:`, step.execution.error);
  }

  if (stepReview?.comment) {
    console.log(`Step ${i} feedback:`, stepReview.comment);
  }

  if (stepReview?.masks?.length) {
    console.log(`Step ${i} has ${stepReview.masks.length} highlighted issues`);
  }
});
```

### Generating Playwright Test

```typescript
const { exploration, review } = await loadArtifacts(expId);

// Build test code
let testCode = `
import { test, expect } from '@playwright/test';

test('${exploration.spec}', async ({ page }) => {
  await page.goto('${exploration.baseUrl}');
`;

exploration.steps.forEach((step, i) => {
  const stepReview = review?.steps.find(s => s.step_index === i);

  // Prefer locked_locator if human selected one
  let selector = stepReview?.locked_locator;

  // Otherwise use ref from exploration
  if (!selector && step.execution.elementRef) {
    const ref = step.snapshotAfter?.refs[step.execution.elementRef];
    selector = ref?.selector;
  }

  switch (step.specAction.action) {
    case 'click':
      testCode += `  await page.${selector}.click();\n`;
      break;
    case 'fill':
      testCode += `  await page.${selector}.fill('${step.specAction.value}');\n`;
      break;
    // ... handle other actions
  }
});

testCode += '});\n';
```
