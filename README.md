# BrowserFlow

**AI-Driven E2E Test Creation with Human Feedback**

BrowserFlow is a tool **designed for AI agents** (like Claude) to create reliable Playwright tests through structured browser exploration and human feedback. The AI drives the workflow, humans provide feedback via comments and visual highlights, and together they iterate until the test is ready.

## Core Philosophy

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

**Key insight:** The iteration loop is central. The AI reads exploration data + human feedback, diagnoses issues, fixes them, and the cycle repeats until the workflow is validated.

### Token Economics

| Phase | Token Cost | Frequency |
|-------|-----------|-----------|
| Exploration | ~10-50k tokens | Once per spec (+ iterations) |
| Review | 0 tokens | Human time only |
| Test Generation | ~5-10k tokens | Once per validated spec |
| CI Execution | 0 tokens | Every PR/push |

**Result**: Pay tokens once to create tests, run them forever in CI for free.

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) package manager (or npm)
- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (recommended)

### Installation

#### Option 1: Claude Code Plugin (Recommended)

Install BrowserFlow as a Claude Code plugin to get AI-assisted test creation:

```bash
# In Claude Code, add the marketplace
/plugin marketplace add akatz-ai/browserflow

# Install the plugin
/plugin install browserflow@browserflow
```

Or load directly for development:
```bash
claude --plugin-dir ./browserflow-plugin
```

#### Option 2: CLI Only

```bash
# Install globally
bun add -g @browserflow/cli

# Or install from source
git clone https://github.com/akatz-ai/browserflow.git
cd browserflow
bun install
bun run build
cd packages/cli && bun link
```

Then install Playwright browsers:
```bash
bun x playwright install chromium
```

### Initialize a Project

```bash
bf init
```

This creates:
- `browserflow.yaml` - Project configuration
- `specs/` - Directory for test specifications

---

## The Workflow

### Step 1: Write a Spec

Specs describe **what** the user does (intent), not **how** to click elements:

```yaml
# specs/add-todo.yaml
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

### Step 2: Explore

```bash
bf explore --spec add-todo --url http://localhost:3000
```

The exploration engine:
- Reads `specs/add-todo.yaml`
- Launches browser and executes each step
- Captures before/after screenshots
- Records DOM snapshots with Playwright locator refs
- Saves everything to `.browserflow/explorations/exp-<id>/`

**Output:**
```
.browserflow/explorations/exp-<id>/
├── exploration.json    # Step execution data, locators, timing
├── screenshots/        # Before/after images per step
└── review.json         # Human feedback (created during review)
```

### Step 3: Review (Human Feedback)

```bash
bf review --exploration exp-<id>
```

Opens a web UI at `http://localhost:8190` where humans provide **free-form feedback**:

- **View screenshots** - Before/after for each step
- **Add comments** - Explain what looks wrong or needs attention
- **Draw masks** - Highlight specific areas on screenshots that need fixing
- **Write overall notes** - Summarize findings

**Important:** Masks are for **highlighting issues** (pointing at problems), not for hiding dynamic content. Each mask requires a comment explaining what's wrong.

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

1. Reading `exploration.json` for step data and locators
2. Reading `review.json` for any locked locators or feedback
3. Writing deterministic Playwright TypeScript code

The AI writes the test directly—there's no separate codify command. The test goes in `e2e/tests/`.

---

## Exploration Artifacts

### exploration.json

```json
{
  "spec": "add-todo",
  "explorationId": "exp-1234567890-abc123",
  "timestamp": "2026-01-20T00:00:00Z",
  "baseUrl": "http://localhost:3000",
  "browser": "chromium",
  "viewport": { "width": 1280, "height": 720 },

  "steps": [
    {
      "stepIndex": 0,
      "specAction": { "id": "fill-todo", "action": "fill", ... },
      "execution": {
        "status": "completed",
        "method": "fill",
        "elementRef": "[data-testid='todo-input']",
        "durationMs": 150
      },
      "screenshots": {
        "before": "screenshots/step-00-before.png",
        "after": "screenshots/step-00-after.png"
      },
      "snapshotAfter": {
        "refs": {
          "e1": { "selector": "getByRole('textbox', { name: 'Enter a task' })" },
          "e2": { "selector": "getByRole('button', { name: 'Add' })" }
        }
      }
    }
  ],

  "overallStatus": "completed",
  "durationMs": 1500,
  "errors": []
}
```

### review.json

```json
{
  "exploration_id": "exp-1234567890-abc123",
  "spec_name": "add-todo",
  "reviewed_at": "2026-01-20T01:00:00Z",
  "overall_comment": "Looks good, but step 2 clicked wrong button",

  "steps": [
    {
      "step_index": 0,
      "status": "reviewed",
      "comment": "Input filled correctly"
    },
    {
      "step_index": 1,
      "status": "reviewed",
      "comment": "Wrong button - clicked Cancel instead of Add",
      "masks": [
        {
          "id": "mask-123",
          "x": 45.5,
          "y": 30.2,
          "width": 10.0,
          "height": 5.0,
          "reason": "This is the Cancel button, not Add"
        }
      ],
      "annotated_screenshot": "screenshots/step-01-review.png"
    }
  ]
}
```

When masks are added, an **annotated screenshot** is saved with the masks rendered as colored overlays. This allows the AI to directly see what was highlighted without interpreting percentage coordinates.

---

## Spec Format (v2)

### Actions

| Action | Description |
|--------|-------------|
| `click` | Click an element |
| `fill` | Fill a text input |
| `select` | Select dropdown option |
| `check` | Check/uncheck checkbox |
| `navigate` | Go to URL |
| `wait` | Wait for condition |
| `verify_state` | Assert UI state |
| `screenshot` | Capture named screenshot |

### Target Strategies

```yaml
# By test ID (preferred)
target: { testid: submit-button }

# By role + name
target: { role: button, name: "Submit" }

# By text content
target: { text: "Click here" }

# By CSS selector (fallback)
target: { css: ".submit-btn" }

# By natural language query (AI resolves during exploration)
target: { query: "The primary submit button in the form" }
```

### Verification Checks

```yaml
- action: verify_state
  checks:
    - text_contains: "Success"
    - text_not_contains: "Error"
    - element_visible: ".confirmation"
    - element_not_visible: ".loading"
    - url_contains: "/dashboard"
```

---

## CLI Reference

```bash
# Initialize project
bf init

# Validate specs
bf lint

# Run exploration
bf explore --spec <name> --url <base-url>

# Start review UI
bf review [--exploration <exp-id>]

# Run generated tests
bf run [--spec <name>] [--headed]

# Check environment
bf doctor
```

---

## Project Structure

```
your-project/
├── browserflow.yaml          # Configuration
├── specs/                    # Test specifications
│   └── add-todo.yaml
├── .browserflow/             # Runtime artifacts (gitignored)
│   ├── explorations/         # Exploration runs
│   │   └── exp-<id>/
│   │       ├── exploration.json
│   │       ├── review.json
│   │       └── screenshots/
│   └── baselines/            # Visual regression baselines
└── e2e/                      # Generated Playwright tests
    └── tests/
        └── add-todo.spec.ts
```

---

## Configuration

```yaml
# browserflow.yaml
project:
  name: my-app
  base_url: http://localhost:3000

runtime:
  browser: chromium
  headless: true
  viewport:
    width: 1280
    height: 720
  timeout: 30s

locators:
  prefer_testid: true
  testid_attributes:
    - data-testid

review:
  port: 8190
```

---

## Claude Code Plugin

BrowserFlow includes a Claude Code plugin that gives Claude the knowledge to help you create E2E tests. The plugin provides:

- **Skill documentation** - Claude understands the full BrowserFlow workflow
- **Spec format reference** - Claude can write valid YAML specs
- **Artifact schemas** - Claude knows how to read exploration and review data
- **Adapter guidance** - Claude can help create custom AI adapters

### Install the Plugin

```bash
# In Claude Code
/plugin marketplace add akatz-ai/browserflow
/plugin install browserflow@browserflow
```

Once installed, Claude will automatically use the BrowserFlow skill when:
- You ask to create E2E tests
- You're working with `.browserflow/` directories or `specs/*.yaml` files
- You mention `bf explore`, `bf review`, or Playwright testing

### Plugin Structure

```
browserflow-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
└── skills/
    └── browserflow/
        ├── SKILL.md          # Main skill (loaded when triggered)
        └── references/       # Detailed docs (loaded as needed)
            ├── spec-schema.md
            ├── artifacts.md
            └── adapters.md
```

---

## Integration with AI Agents

BrowserFlow is designed as a tool for AI agents. When working with Claude Code:

1. **Agent writes spec** based on feature requirements
2. **Agent runs exploration** via `bf explore`
3. **Human reviews** in browser, adds feedback
4. **Agent reads feedback** from `review.json` and annotated screenshots
5. **Agent diagnoses and fixes** issues (app code or spec)
6. **Repeat** until workflow validates
7. **Agent generates Playwright test** from exploration artifacts

The structured output (JSON, screenshots) is optimized for LLM context. The annotated screenshots with rendered masks allow Claude to directly see what humans highlighted.

---

## License

MIT License

---

## Acknowledgments

BrowserFlow builds on:
- [Playwright](https://playwright.dev) - Browser automation
- [agent-browser](https://github.com/anthropics/agent-browser) - AI-friendly browser control
