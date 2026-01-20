# BrowserFlow Project Instructions

## E2E Testing with Playwright

**Important**: The `@playwright/test` runner does NOT work with Bun's Node.js compatibility layer (hangs indefinitely due to incomplete worker thread/IPC support).

### Working Approach

Use the `playwright` package directly via `e2e/test-runner.ts`:

```bash
# Install Playwright browsers (one-time)
bun x playwright install chromium

# Start test server
cd test-site && python3 -m http.server 3001 &

# Run e2e tests
TEST_BASE_URL=http://localhost:3001 bun run e2e/test-runner.ts
```

### What Works / Doesn't Work

| Approach | Works with Bun? | Notes |
|----------|-----------------|-------|
| `@playwright/test` runner | No | Hangs - Bun doesn't support worker threads/IPC |
| `playwright` package directly | Yes | Use `e2e/test-runner.ts` |

### Spec-Driven E2E Tests (Recommended)

The preferred approach is spec-driven testing using the E2E harness:

```bash
# Run full pipeline E2E tests
bun run e2e/full-pipeline.test.ts
```

**Structure:**
- `e2e/specs/*.yaml` - Test specifications with `why` documentation
- `e2e/harness.ts` - Test utilities (server management, CLI execution, assertions)
- `e2e/*.test.ts` - Test implementations

See `e2e/README.md` for full documentation.

### Legacy Simple Runner

For quick manual tests, use `e2e/test-runner.ts`:

```bash
TEST_BASE_URL=http://localhost:3001 bun run e2e/test-runner.ts
```

Do NOT create `.spec.ts` files expecting `@playwright/test` runner to work.

---

## BrowserFlow Workflow

BrowserFlow is a tool **designed for AI agents to use** when creating reliable Playwright tests. It provides structured browser exploration with human feedback, optimized for LLM context and understanding.

**Core Philosophy:** The `bf` CLI outputs structured data for AI consumption. The AI agent drives the workflow, humans provide feedback, and together they iterate until the test is ready.

### When to Use BrowserFlow

Use BrowserFlow when:
- Creating E2E tests for completed features (tracked in beads)
- You need to test user workflows in the browser
- You want human feedback on AI-driven browser exploration
- Building tests that require iteration and refinement

### The Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   SPEC   │───▶│ EXPLORE  │───▶│  REVIEW  │───▶│ ITERATE  │───▶ Generate Test
│  (YAML)  │    │   (AI)   │    │ (Human)  │    │(AI+Human)│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
 Intent-first   Screenshots +   Comments +      Diagnose &
 what to test   DOM snapshots   mask highlights fix issues
```

**Key insight:** The iteration loop is central. The AI reads exploration + review feedback, diagnoses issues, suggests fixes, and the cycle repeats until the workflow is validated.

### Step 1: Write Spec

Create `specs/<name>.yaml` describing **what** the user does (intent), not **how** to click elements:

```yaml
version: 2
name: add-todo
description: Test adding a new todo item

steps:
  - id: fill-todo
    action: fill
    target: { testid: todo-input }
    value: "Buy groceries"

  - id: click-add
    action: click
    target: { testid: add-button }

  - id: verify-added
    action: verify_state
    checks:
      - text_contains: "Buy groceries"
```

See the BrowserFlow skill for full spec schema documentation.

### Step 2: Exploration

```bash
bf explore --spec <spec-name> --url <target-url>
```

**What it does:**
- Reads `specs/<spec-name>.yaml`
- Launches browser and executes steps
- Captures screenshots before/after each step
- Records DOM snapshots with element refs for Playwright locators
- Saves to `.browserflow/explorations/exp-<id>/`

**Output artifacts:**
```
.browserflow/explorations/exp-<id>/
├── exploration.json    # Full step execution data
├── screenshots/        # Before/after images per step
└── review.json         # Human feedback (after review)
```

### Step 3: Review (Human Feedback)

```bash
bf review --exploration <exp-id>
```

Opens web UI (http://localhost:8190) where human provides **free-form feedback**:
- Views before/after screenshots for each step
- Adds **comments** explaining what looks wrong or needs attention
- Draws **masks** (highlights) on screenshots to point at specific issues
- Writes overall notes summarizing findings

**Important:** Masks are for **highlighting issues**, not hiding dynamic content. Each mask requires a comment explaining what's wrong.

**Output:**
- `.browserflow/explorations/<exp-id>/review.json` - Comments, masks, overall feedback

### Step 4: Iterate (AI + Human)

This is the core loop:

1. **AI reads artifacts:**
   - `exploration.json` - What happened during exploration
   - `review.json` - Human feedback (comments, mask highlights)
   - Screenshots - Visual evidence

2. **AI diagnoses issues:**
   - Check `exploration.errors` for failures
   - Read human comments and mask highlights
   - Identify what needs fixing in the app or spec

3. **Fix and re-explore:**
   - If app bug: fix the code, re-run exploration
   - If spec issue: update spec, re-run exploration
   - If locator issue: note for test generation

4. **Human reviews again** until satisfied

### Step 5: Generate Test

When the workflow is validated, the AI generates a Playwright test by:

1. **Reading the exploration artifact** - Step data, locators, screenshots
2. **Reading the review feedback** - Human comments, any locked locators
3. **Writing Playwright test code** - Using the locators and assertions from exploration

```typescript
// Example: Read artifacts and generate test
const exploration = JSON.parse(
  await readFile('.browserflow/explorations/<exp-id>/exploration.json', 'utf-8')
);
const review = JSON.parse(
  await readFile('.browserflow/explorations/<exp-id>/review.json', 'utf-8')
);

// Use exploration.steps[].snapshotAfter.refs for Playwright locators
// e.g., refs.e1.selector = "getByRole('button', { name: 'Add' })"
```

The AI writes the test directly - there's no separate `bf codify` command. The test generation happens in conversation, informed by exploration data and human feedback.

### Understanding exploration.json

The exploration artifact contains step-by-step execution data:

```typescript
{
  spec: string;              // Spec name
  explorationId: string;     // Unique exploration ID (exp-<timestamp>)
  timestamp: string;         // ISO8601 timestamp
  baseUrl: string;           // Target URL
  browser: string;           // chromium | firefox | webkit
  viewport: { width, height };

  steps: [                   // Array of step results
    {
      stepIndex: number;
      specAction: {...};     // Original spec step definition
      execution: {
        status: 'success' | 'failed';
        method: string;      // 'click', 'fill', etc.
        elementRef: string;  // Locator used
        selectorUsed: string;
        durationMs: number;
        error?: string;
      },
      screenshots: {
        before: string;      // Path to before screenshot
        after: string;       // Path to after screenshot
      },
      snapshotBefore: string;  // DOM snapshot (HTML)
      snapshotAfter: string;
    }
  ],

  outcomeChecks: [          // Assertions executed
    {
      check: string;
      expected: any;
      actual: any;
      passed: boolean;
    }
  ],

  overallStatus: 'completed' | 'failed' | 'timeout';
  durationMs: number;
  errors: string[];
}
```

### Understanding review.json

The review artifact contains human feedback (comments and mask highlights):

```typescript
{
  exploration_id: string;
  spec_name: string;
  reviewed_at: string;          // ISO8601 timestamp
  overall_comment?: string;     // Summary of findings

  steps: [                      // Per-step feedback
    {
      step_index: number;
      status: 'reviewed' | 'pending';  // Has feedback vs no feedback yet
      comment?: string;                // Human notes for this step
      masks?: [                        // Highlighted regions (issues to address)
        {
          id: string;
          x: number;            // Percentage (0-100)
          y: number;
          width: number;
          height: number;
          reason: string;       // Required comment explaining the highlight
        }
      ];
      locked_locator?: string;  // Preferred locator if human selected one
    }
  ]
}
```

**Note:** There's no `approved`/`rejected` status. The review is free-form feedback. Steps with comments or masks are marked `reviewed`; steps without feedback are `pending`.

### How to Use These Artifacts

**When diagnosing issues:**

1. **Read `exploration.errors`** - Array of error messages from exploration
2. **Read `review.overall_comment`** - Human's summary of findings
3. **For each step, check:**
   - `exploration.steps[].execution.error` - Step failure details
   - `review.steps[].comment` - Human feedback on what's wrong
   - `review.steps[].masks` - Visual highlights pointing at issues

**When generating tests:**

1. **Read both files** to understand what was explored and what feedback was given
2. **Use locators from exploration** - `steps[].snapshotAfter.refs` has Playwright selectors
3. **Prefer `locked_locator`** if human selected one in review
4. **Address mask highlights** - These point at issues that may need fixes before test generation
5. **Write deterministic Playwright code** - No AI calls at runtime, no fixed sleeps

### Example: Finding Latest Exploration for a Spec

```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function findLatestExploration(specName: string): Promise<string | null> {
  const explorationsDir = '.browserflow/explorations';
  const entries = await readdir(explorationsDir);

  // Sort by timestamp (newest first)
  const matching = entries
    .filter(e => e.startsWith('exp-'))
    .sort()
    .reverse();

  for (const id of matching) {
    const explorationPath = join(explorationsDir, id, 'exploration.json');
    const data = JSON.parse(await readFile(explorationPath, 'utf-8'));
    if (data.spec === specName) {
      return id;
    }
  }

  return null;
}
```

### Integration with Beads

When working on E2E tests for completed features:

1. **Find completed features:** `bd list --status=closed --type=feature`
2. **Read feature bead:** `bd show <bead-id>`
3. **Write spec YAML** describing user flow (see BrowserFlow skill for spec format)
4. **Run exploration:** `bf explore --spec <name> --url <url>`
5. **Review in browser:** `bf review` (human provides feedback via comments + masks)
6. **Iterate:** AI reads feedback, fixes issues, re-explores if needed
7. **Generate test** when workflow is validated (AI writes Playwright code from artifacts)
8. **Commit results:**
   ```bash
   git add specs/ e2e/tests/
   git commit -m "test: add E2E spec and test for <feature> (bf-xxx)"
   ```

### See Also

- **BrowserFlow skill** (`~/.claude/skills/browserflow-testing.md`) - Detailed workflow guidance, spec format, best practices
- **Spec YAML format** - Intent-first test specifications (v2 schema)
