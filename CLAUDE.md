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

BrowserFlow is an AI-driven E2E testing tool for **Claude to use** when generating reliable Playwright tests. It follows an **explore → review → generate** workflow where Claude explores the application, humans approve the results, and then Claude generates deterministic test code.

### When to Use BrowserFlow

Use BrowserFlow when:
- Creating E2E tests for completed features (tracked in beads)
- You need to test user workflows in the browser
- You want to generate Playwright tests from exploration artifacts

### The Workflow

```
1. EXPLORE (bf explore) → AI explores app, records evidence
2. REVIEW (bf review)   → Human approves/rejects steps in web UI
3. GENERATE (Claude)    → Claude reads artifacts and generates Playwright test
```

### Step 1: Exploration

```bash
bf explore --spec <spec-name> --url <target-url>
```

**What it does:**
- Reads `specs/<spec-name>.yaml` (intent-first spec describing user actions)
- Launches browser and executes steps with AI assistance
- Captures screenshots before/after each step
- Records locator candidates, accessibility info, DOM snapshots
- Saves to `.browserflow/explorations/exp-<timestamp>/`

**Output artifacts:**
```
.browserflow/explorations/exp-<id>/
├── exploration.json    # Full step execution data
├── screenshots/        # Before/after images
├── console.log         # Browser console output
└── network.json        # Network request summary
```

### Step 2: Review

```bash
bf review
```

Opens web UI (http://localhost:3000) where human:
- Views screenshots for each step
- Approves or rejects steps
- Locks preferred locators (test ID > role > CSS)
- Adds assertions and visual baselines

**Output:**
- `.browserflow/explorations/<exp-id>/review.json` - Approval data, selected locators, feedback

### Step 3: Generate Test (Claude's Job)

After review is complete, **Claude should generate the Playwright test** by:

1. **Reading the exploration artifact** (`.browserflow/explorations/<exp-id>/exploration.json`)
2. **Reading the review artifact** (`.browserflow/explorations/<exp-id>/review.json`)
3. **Using the generator package** to create Playwright test code

**Example:**
```typescript
import { generateTest } from '@browserflow/generator';
import { readFile, writeFile } from 'node:fs/promises';

// Read artifacts
const exploration = JSON.parse(
  await readFile('.browserflow/explorations/<exp-id>/exploration.json', 'utf-8')
);
const review = JSON.parse(
  await readFile('.browserflow/explorations/<exp-id>/review.json', 'utf-8')
);

// Generate test
const result = generateTest(exploration, { includeVisualChecks: true }, review);

// Write to file
await writeFile(`e2e/tests/${specName}.spec.ts`, result.content);
```

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

The review artifact contains human approval decisions:

```typescript
{
  exploration_id: string;
  reviewer?: string;
  started_at: string;       // ISO8601
  updated_at: string;
  verdict: 'approved' | 'rejected' | 'pending';

  steps: [                  // Per-step review decisions
    {
      step_index: number;
      approved: boolean;
      selected_locator?: string;  // Locked-in locator to use
      feedback?: string;          // Human notes/corrections
      add_assertion?: boolean;
      visual_baseline?: boolean;
    }
  ],

  overall_notes?: string;
  submitted_at?: string;
}
```

### How Claude Should Use These Artifacts

**When generating tests:**

1. **Read both files** to understand what was explored and what was approved
2. **Use approved steps only** (check `review.steps[].approved`)
3. **Prefer selected locators** from review over exploration candidates
4. **Include assertions** where `add_assertion: true`
5. **Add visual checks** where `visual_baseline: true`
6. **Use the generator package** - it handles the complexity of:
   - Stable locator chains with fallbacks
   - Deterministic waits (no fixed sleeps)
   - Proper Playwright test structure
   - Type-safe code generation

**When diagnosing issues:**

- **Check `exploration.errors`** - Array of error messages from exploration
- **Check `steps[].execution.error`** - Per-step failure details
- **Check `overallStatus`** - Overall exploration result
- **Read review feedback** - Human notes on what went wrong or needs adjustment

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
5. **Review in browser:** `bf review` (human approves/rejects)
6. **Generate test** (Claude reads artifacts and uses generator)
7. **Commit results:**
   ```bash
   git add specs/ e2e/tests/
   git commit -m "test: add E2E spec and test for <feature> (bf-xxx)"
   ```

### See Also

- **BrowserFlow skill** (`~/.claude/skills/browserflow-testing.md`) - Detailed workflow guidance, spec format, best practices
- **Spec YAML format** - Intent-first test specifications (v2 schema)
- **Generator package** (`@browserflow/generator`) - Test code generation utilities
