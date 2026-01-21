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

## Unit Testing

Different packages use different test runners based on their needs:

| Package | Test Runner | Why |
|---------|-------------|-----|
| `packages/cli` | `bun:test` | No DOM needed |
| `packages/core` | `bun:test` | No DOM needed |
| `packages/exploration` | `bun:test` | No DOM needed |
| `packages/generator` | `bun:test` | No DOM needed |
| `packages/review-ui` | `vitest` | Needs jsdom for React/DOM testing |

**Key rule:** Check the package's `package.json` scripts to see which runner it uses before writing tests.

```bash
# Running tests
bun test                           # Root - runs bun:test for most packages
cd packages/review-ui && bun test  # Uses vitest (see package.json)
```

**Import patterns:**
```typescript
// For bun:test packages
import { describe, test, expect } from 'bun:test';

// For review-ui (vitest)
import { describe, test, expect, vi } from 'vitest';
```

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
bf explore --spec <spec-name> --url <target-url> [--adapter <adapter>]
```

**Adapter options:**
- `claude` (default) - Uses Anthropic SDK, requires `ANTHROPIC_API_KEY`
- `claude-cli` - Uses `claude` CLI, leverages your existing Claude Code auth

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

Use `bf codify` to generate a Playwright test from an exploration:

```bash
# Generate from a specific exploration
bf codify --exploration <exp-id>

# Find latest exploration for a spec
bf codify --spec <spec-name>

# Dry run - print test without writing
bf codify --exploration <exp-id> --dry-run

# Custom output path
bf codify --exploration <exp-id> --output path/to/test.spec.ts

# Skip comments or visual assertions
bf codify --exploration <exp-id> --no-comments
bf codify --exploration <exp-id> --no-visual

# Require review approval before generating
bf codify --exploration <exp-id> --require-review
```

The codify command:
1. Loads exploration data (and optional review feedback)
2. Resolves element refs to Playwright locators from snapshot data
3. Generates deterministic Playwright test code
4. Outputs to `e2e/tests/{specName}.spec.ts` by default

### Understanding exploration.json

The exploration artifact contains step-by-step execution data:

```typescript
{
  spec: string;              // Spec name
  specPath: string;          // Path to spec file
  explorationId: string;     // Unique exploration ID (exp-<timestamp>)
  timestamp: string;         // ISO8601 timestamp
  baseUrl: string;           // Target URL
  browser: string;           // chromium | firefox | webkit
  viewport: { width, height };
  durationMs: number;        // Total exploration time

  steps: [                   // Array of step results
    {
      stepIndex: number;
      specAction: {...};     // Original spec step definition
      execution: {
        status: 'completed' | 'failed' | 'skipped';
        method: string;        // 'click', 'fill', etc.
        elementRef?: string;   // Element reference used
        selectorUsed?: string; // Actual selector
        durationMs: number;
        error?: string;        // Error message if failed
      },
      screenshots: {
        before: string;      // Path to before screenshot
        after: string;       // Path to after screenshot
      },
      snapshotBefore?: {...};  // DOM snapshot with tree and refs
      snapshotAfter?: {
        tree: string;          // Accessibility tree
        refs: {                // Element references with Playwright locators
          "e1": { selector: "getByRole(...)", role: "button", name: "Add" }
        }
      }
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
  errors: string[];          // List of error messages
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
      locked_locator?: string;         // Preferred locator if human selected one
      annotated_screenshot?: string;   // Path to screenshot with mask overlays rendered
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

---

## AI Adapters

BrowserFlow uses AI adapters for element finding during exploration. The adapter system is pluggable, allowing you to use different LLM backends.

### Available Adapters

| Adapter | Flag | Requirements | Best For |
|---------|------|--------------|----------|
| `claude` | `--adapter claude` (default) | `ANTHROPIC_API_KEY` env var | Direct API access |
| `claude-cli` | `--adapter claude-cli` | `claude` CLI installed | Using existing Claude Code auth |

### Usage

```bash
# Use SDK adapter (default) - requires ANTHROPIC_API_KEY
bf explore --spec add-todo --url http://localhost:3001

# Use CLI adapter - uses your claude CLI authentication
bf explore --spec add-todo --url http://localhost:3001 --adapter claude-cli
```

### Creating Custom Adapters

Adapters implement the `AIAdapter` interface from `@browserflow-ai/exploration`:

```typescript
import type { AIAdapter, EnhancedSnapshot, FindElementResult, ExploreParams, ExplorationOutput } from '@browserflow-ai/exploration';

export class MyCustomAdapter implements AIAdapter {
  readonly name = 'my-adapter';

  async findElement(query: string, snapshot: EnhancedSnapshot): Promise<FindElementResult> {
    // Use your LLM to find the element matching the query
    // snapshot.tree = accessibility tree string
    // snapshot.refs = available element references (e.g., {e1: {...}, e2: {...}})

    return {
      ref: 'e1',           // Element ref or 'NOT_FOUND'
      confidence: 0.95,    // 0-1 confidence score
      reasoning: 'Found button with matching name'
    };
  }

  async explore(params: ExploreParams): Promise<ExplorationOutput> {
    // Return minimal structure - Explorer orchestrates the full exploration
    return {
      spec: params.spec.name,
      specPath: params.specPath,
      explorationId: `exp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      browser: params.browser ?? 'chromium',
      viewport: params.viewport ?? { width: 1280, height: 720 },
      baseUrl: params.baseUrl,
      steps: [],
      outcomeChecks: [],
      overallStatus: 'completed',
      errors: [],
    };
  }
}
```

### Adapter Files Location

Built-in adapters are in `packages/exploration/src/adapters/`:
- `claude.ts` - Anthropic SDK adapter
- `claude-cli.ts` - Claude CLI adapter
- `types.ts` - Interface definitions

To add a new adapter:
1. Create `packages/exploration/src/adapters/my-adapter.ts`
2. Export from `packages/exploration/src/adapters/index.ts`
3. Export from `packages/exploration/src/index.ts`
4. Add to CLI's adapter factory in `packages/cli/src/commands/explore.ts`

### See Also

- **BrowserFlow skill** (`~/.claude/skills/browserflow-testing.md`) - Detailed workflow guidance, spec format, best practices
- **Spec YAML format** - Intent-first test specifications (v2 schema)

---

## Publishing & Distribution

BrowserFlow is distributed via npm as a set of scoped packages under `@browserflow-ai/*`.

### Package Structure

| Package | Description |
|---------|-------------|
| `@browserflow-ai/cli` | Main CLI (`bf` command) - install this globally |
| `@browserflow-ai/core` | Shared types, schemas, Zod validators |
| `@browserflow-ai/exploration` | AI exploration engine (playwright, adapters) |
| `@browserflow-ai/generator` | Playwright test code generator |
| `@browserflow-ai/review-ui` | React review application |

### Installation (for users)

```bash
# Using bun (recommended)
bun add -g @browserflow-ai/cli

# Using npm
npm install -g @browserflow-ai/cli

# Or via install script
curl -fsSL https://raw.githubusercontent.com/akatz-ai/browserflow/main/scripts/install.sh | bash
```

### Publishing a New Release

**Prerequisites (one-time setup):**
1. Create npm account at https://www.npmjs.com/signup
2. Create automation token: https://www.npmjs.com/settings/<username>/tokens → "Automation"
3. Add `NPM_TOKEN` secret to GitHub: https://github.com/akatz-ai/browserflow/settings/secrets/actions

**To publish:**
```bash
# Just create and push a version tag - that's it!
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions workflow (`.github/workflows/release.yml`) will:
1. Build all packages
2. Run tests
3. **Extract version from git tag** (e.g., `v0.1.0` → `0.1.0`)
4. **Inject version into all package.json files** before publishing
5. Convert `workspace:*` references to actual versions
6. Publish packages in dependency order to npm
7. Create a GitHub Release with install instructions

**Version syncing:** The version in `package.json` files in the repo doesn't need to be updated manually. The publish script reads the version from the git tag and injects it into all packages before publishing. This ensures `bf --version` always matches the release tag.

**Local dry-run:**
```bash
bun run publish:dry  # Preview what would be published
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/publish.ts` | Handles version injection, workspace protocol conversion, and npm publish |
| `scripts/install.sh` | User-facing install script (wraps bun/npm) |
| `.github/workflows/release.yml` | CI/CD workflow triggered on `v*` tags |
| `packages/cli/src/index.ts` | Reads version from `package.json` at runtime |

### How review-ui Assets Work

When installed via npm, the CLI finds the review-ui assets through package resolution:
1. `review.ts` uses `import.meta.resolve('@browserflow-ai/review-ui/package.json')`
2. Resolves to the installed package location in `node_modules`
3. Serves static files from that package's `dist/` directory

In development (monorepo), it falls back to `packages/review-ui/dist`.
