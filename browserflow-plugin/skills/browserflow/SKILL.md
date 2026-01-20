---
name: browserflow
description: AI-assisted Playwright test creation through structured browser exploration with human feedback. Use when creating E2E tests for web applications, exploring web UIs to understand element structure, generating Playwright test code from exploration artifacts, or working with projects containing .browserflow/ or specs/*.yaml files. Triggers on "create E2E test", "explore this page", "write Playwright test", "bf explore", "bf review", or browser automation testing tasks.
---

# BrowserFlow

Create reliable Playwright tests through AI-driven browser exploration with human feedback.

## Installation

**Install this plugin in Claude Code:**

```bash
# Add the marketplace
/plugin marketplace add akatz-ai/browserflow

# Install the plugin
/plugin install browserflow@browserflow
```

Or load directly for development:
```bash
claude --plugin-dir ./browserflow-plugin
```

**Install bf CLI in your project:**

```bash
bun add -D @browserflow/cli && bunx playwright install chromium
```

## Quick Start

```bash
# 1. Install bf CLI (if not already installed)
bun add -D @browserflow/cli && bunx playwright install chromium

# 2. Write a spec
cat > specs/login.yaml << 'EOF'
version: 2
name: user-login
description: Test user login flow

steps:
  - id: fill-email
    action: fill
    target: { label: "Email" }
    value: "test@example.com"

  - id: fill-password
    action: fill
    target: { label: "Password" }
    value: "password123"

  - id: click-login
    action: click
    target: { text: "Sign In" }

  - id: verify-logged-in
    action: expect
    checks:
      - url_contains: "/dashboard"
EOF

# 3. Explore
bf explore --spec user-login --url http://localhost:3000

# 4. Review (human provides feedback)
bf review

# 5. Generate test from artifacts (AI writes Playwright code)
```

## Workflow

```
SPEC (yaml) → EXPLORE (AI) → REVIEW (human) → ITERATE → Generate Test
```

1. **Spec**: Describe user intent in YAML (`specs/<name>.yaml`)
2. **Explore**: `bf explore --spec <name> --url <url>` captures screenshots + DOM
3. **Review**: `bf review` opens UI for human feedback (comments, mask highlights)
4. **Iterate**: AI reads artifacts, fixes issues, re-explores until validated
5. **Generate**: AI writes Playwright test from exploration data

## Commands

```bash
bf explore --spec <name> --url <url> [--adapter claude|claude-cli]
bf review [--exploration <exp-id>]
bf list                    # List explorations
```

**Adapters:**
- `claude` (default): Requires `ANTHROPIC_API_KEY`
- `claude-cli`: Uses existing Claude Code auth

## Spec Format

See [references/spec-schema.md](references/spec-schema.md) for full schema.

```yaml
version: 2
name: feature-name
description: What this tests

steps:
  - id: unique-step-id
    action: click | fill | navigate | wait | expect | verify_state
    target:                    # Element targeting (pick one)
      query: "natural language description"
      testid: "data-testid"
      label: "Form label"
      text: "Button text"
      role: "button"
      css: ".selector"
    value: "for fill actions"  # Optional
    checks:                    # For expect/verify_state
      - visible: { target: {...} }
      - text_contains: "expected text"
      - url_contains: "/path"
```

## Reading Artifacts

After exploration, read these files to diagnose issues or generate tests:

**`.browserflow/explorations/<exp-id>/exploration.json`**
```typescript
{
  steps: [{
    execution: { status, error },
    snapshotAfter: {
      refs: { "e1": { selector: "getByRole(...)" } }  // Playwright locators
    }
  }],
  errors: string[]
}
```

**`.browserflow/explorations/<exp-id>/review.json`**
```typescript
{
  overall_comment: string,
  steps: [{
    comment: string,           // Human feedback
    masks: [{ reason }],       // Highlighted issues
    annotated_screenshot: path // Visual with highlights
  }]
}
```

See [references/artifacts.md](references/artifacts.md) for complete schemas.

## Diagnosing Issues

1. Read `exploration.errors` for failures
2. Read `review.overall_comment` for human summary
3. Check per-step: `exploration.steps[i].execution.error` + `review.steps[i].comment`
4. View annotated screenshots to see mask highlights
5. Fix app/spec and re-explore

## Generating Tests

When workflow is validated:

1. Read `exploration.json` for locators (`steps[].snapshotAfter.refs`)
2. Read `review.json` for `locked_locator` preferences
3. Write Playwright test using refs as selectors
4. Use Playwright auto-waiting (no `waitForTimeout`)

Output to: `e2e/tests/<spec-name>.spec.ts`

## Project Structure

```
project/
├── specs/                    # Test specifications
│   └── feature.yaml
├── .browserflow/             # Runtime artifacts (gitignored)
│   └── explorations/
│       └── exp-<id>/
│           ├── exploration.json
│           ├── review.json
│           └── screenshots/
└── e2e/tests/                # Generated tests (committed)
    └── feature.spec.ts
```

## Custom Adapters

See [references/adapters.md](references/adapters.md) for creating custom LLM adapters.

```typescript
import type { AIAdapter, FindElementResult } from '@browserflow/exploration';

class MyAdapter implements AIAdapter {
  readonly name = 'my-adapter';
  async findElement(query, snapshot): Promise<FindElementResult> {
    return { ref: 'e1', confidence: 0.9, reasoning: '...' };
  }
}
```
