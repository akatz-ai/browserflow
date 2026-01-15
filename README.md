# BrowserFlow

**Human-in-the-Loop E2E Test Generation with AI Exploration**

BrowserFlow is a framework for creating reliable, maintainable end-to-end browser tests through AI-powered exploration and human verification. It bridges the gap between natural language test specifications and deterministic CI-ready test scripts.

## The Problem

Traditional E2E testing has fundamental tensions:

1. **Brittle selectors**: CSS selectors and XPaths break when UI changes
2. **Maintenance burden**: Tests require constant updates as UI evolves
3. **AI non-determinism**: LLMs can explore UI but make mistakes
4. **CI token costs**: Running AI for every test run is expensive
5. **False confidence**: Tests pass but don't verify what humans expect

## The Solution

BrowserFlow introduces a **three-phase workflow** that combines AI flexibility with human judgment and CI efficiency:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Phase 1: EXPLORATION          Phase 2: REVIEW           Phase 3: CODIFY  │
│   ─────────────────────         ─────────────────         ───────────────  │
│                                                                             │
│   ┌─────────────────┐          ┌─────────────────┐       ┌───────────────┐ │
│   │  YAML Spec      │          │  Human Reviews  │       │  Deterministic│ │
│   │  (intent)       │─────────▶│  Screenshots    │──────▶│  Bash Script  │ │
│   │                 │          │  + Comments     │       │  (CI-ready)   │ │
│   └─────────────────┘          └─────────────────┘       └───────────────┘ │
│           │                            │                         │         │
│           ▼                            ▼                         ▼         │
│   ┌─────────────────┐          ┌─────────────────┐       ┌───────────────┐ │
│   │  AI Explores    │          │  Approve/Reject │       │  Golden       │ │
│   │  Takes Screenshots│         │  Per Step       │       │  Baselines    │ │
│   │  Discovers Refs │          │  Add Feedback   │       │  Stored       │ │
│   └─────────────────┘          └─────────────────┘       └───────────────┘ │
│                                        │                                    │
│                                        │ Rejected?                          │
│                                        ▼                                    │
│                                ┌─────────────────┐                          │
│                                │  AI Retries     │                          │
│                                │  With Feedback  │──────┐                   │
│                                └─────────────────┘      │                   │
│                                        ▲                │                   │
│                                        └────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Token Economics

| Phase | Token Cost | Frequency |
|-------|-----------|-----------|
| Exploration | ~10-50k tokens | Once per spec (+ retries) |
| Review | 0 tokens | Human time only |
| Codification | ~5-10k tokens | Once per approved spec |
| CI Execution | 0 tokens | Every PR/push |

**Result**: Pay tokens once to create tests, run them forever in CI for free.

---

## Core Concepts

### 1. Specs (Human Intent)

Specs are YAML files describing user workflows in natural language. They capture **what** should happen, not **how**.

```yaml
name: checkout-cart
description: |
  User adds item to cart, proceeds to checkout,
  and verifies the order summary is correct.

preconditions:
  logged_in: true
  cart_empty: true

steps:
  - action: click
    query: "Add to Cart button on the first product"
    description: Add the first product to cart

  - action: wait
    for: text
    text: "Added to cart"
    timeout: 3000

  - action: navigate
    to: "/cart"
    description: Go to shopping cart

  - action: verify_state
    checks:
      - element_visible: ".cart-item"
      - text_contains: "1 item"

  - action: screenshot
    name: "cart-with-item"

  - action: click
    query: "Proceed to Checkout button"

  - action: verify_state
    checks:
      - url_contains: "/checkout"
      - element_visible: ".order-summary"

expected_outcomes:
  - checkout_page_loaded: true
  - cart_item_count: 1

tags:
  - checkout
  - critical_path
```

### 2. Explorations (AI Discovery)

During exploration, AI:
- Reads the spec to understand intent
- Opens a browser session
- Attempts each step using its best judgment
- Takes screenshots at each step
- Records element refs, timing, errors
- Generates a structured exploration report

The exploration is inherently **non-deterministic** - the AI might:
- Click the wrong element
- Miss timing windows
- Misinterpret the spec
- Discover that the spec is ambiguous

This is why human review is essential.

### 3. Reviews (Human Verification)

The review phase presents an interactive HTML report where humans:
- See each step with before/after screenshots
- Compare actual behavior to spec intent
- Add comments explaining issues
- Approve or reject each step
- Submit overall verdict

**This is the quality gate.** No test gets codified without human sign-off.

### 4. Codification (Deterministic Tests)

Once approved, AI generates a bash script that:
- Uses the verified element refs from exploration
- Includes appropriate wait times learned from exploration
- Adds assertions based on human comments
- Compares screenshots to approved baselines
- Runs without AI involvement

---

## Architecture

```
browserflow/
├── bin/
│   ├── bf                    # Main CLI entry point
│   ├── bf-explore            # Run AI exploration
│   ├── bf-review             # Start review server
│   ├── bf-codify             # Generate test from approved exploration
│   └── bf-run                # Run codified tests
│
├── lib/
│   ├── browser.sh            # Browser automation helpers
│   ├── screenshot.sh         # Screenshot capture and comparison
│   ├── report.sh             # HTML report generation
│   └── runner.sh             # Test execution framework
│
├── adapters/
│   ├── claude/               # Claude Code adapter
│   ├── openai/               # OpenAI adapter
│   └── ollama/               # Local LLM adapter
│
├── templates/
│   ├── exploration-prompt.md # Prompt template for exploration
│   ├── codify-prompt.md      # Prompt template for codification
│   └── retry-prompt.md       # Prompt template for retry with feedback
│
├── review-ui/
│   ├── index.html            # Review interface
│   ├── app.js                # Review app logic
│   └── style.css             # Review styling
│
├── workflows/                # MEOW workflow templates
│   ├── explore.meow.toml
│   ├── review.meow.toml
│   └── full-cycle.meow.toml
│
└── examples/
    ├── simple-nav/           # Simple navigation example
    ├── form-submit/          # Form interaction example
    └── comfygit/             # Real-world complex example
```

---

## Spec Format Reference

### Required Fields

```yaml
name: unique-kebab-case-identifier
description: |
  Human-readable explanation of what this test verifies
  and why it matters to users.

steps:
  - action: <action_type>
    # ... action-specific parameters
```

### Optional Fields

```yaml
preconditions:
  # State requirements before test runs
  logged_in: true
  page: "/dashboard"
  feature_flag: "new-checkout"

timeout: 120s          # Max time for entire workflow
priority: critical     # critical | high | normal | low

expected_outcomes:
  # Assertions to verify after all steps
  - url_contains: "/success"
  - element_visible: ".confirmation"

tags:
  - smoke
  - checkout
  - p0
```

### Action Types

#### Navigation Actions

```yaml
# Click an element
- action: click
  query: "Submit button in the form"     # Natural language (AI finds it)
  # OR
  selector: "button[type=submit]"        # CSS selector
  # OR
  ref: "@e17"                            # Element ref from snapshot

# Navigate to URL
- action: navigate
  to: "/checkout"
  # OR
  to: "https://example.com/page"

# Go back/forward
- action: back
- action: forward

# Refresh page
- action: refresh
```

#### Input Actions

```yaml
# Fill input field
- action: fill
  query: "Email input field"
  value: "test@example.com"

# Type with keyboard events
- action: type
  query: "Search box"
  value: "search term"
  pressEnter: true

# Select dropdown option
- action: select
  query: "Country dropdown"
  option: "United States"

# Check/uncheck checkbox
- action: check
  query: "Terms and conditions checkbox"
  checked: true
```

#### Wait Actions

```yaml
# Wait for element
- action: wait
  for: element
  selector: ".loading-complete"
  timeout: 10000

# Wait for text
- action: wait
  for: text
  text: "Order confirmed"
  timeout: 5000

# Wait for URL
- action: wait
  for: url
  contains: "/success"
  timeout: 5000

# Wait fixed time (discouraged, use sparingly)
- action: wait
  for: time
  duration: 2000
```

#### Verification Actions

```yaml
# Verify UI state
- action: verify_state
  checks:
    - element_visible: ".success-message"
    - element_not_visible: ".error"
    - text_contains: "Thank you"
    - text_not_contains: "Error"
    - url_contains: "/confirmation"
    - element_count:
        selector: ".cart-item"
        expected: 3
    - attribute:
        selector: "input[name=email]"
        attribute: "value"
        equals: "test@example.com"
```

#### Screenshot Actions

```yaml
# Capture screenshot (required for review)
- action: screenshot
  name: "checkout-complete"
  description: "Final checkout confirmation page"
  
  # Optional: mark regions of interest
  highlight:
    - selector: ".order-total"
      label: "Total should show $99.99"
```

#### AI-Assisted Actions

```yaml
# Let AI find an element based on description
- action: identify_element
  query: "The primary call-to-action button above the fold"
  save_as: main_cta

# Use saved element reference
- action: click
  ref: "{{ main_cta }}"

# Let AI make a judgment call
- action: ai_verify
  question: "Does the page show a successful order confirmation?"
  expected: true
```

---

## Exploration Report Format

After exploration, BrowserFlow generates a structured report:

```json
{
  "spec": "checkout-cart",
  "spec_path": "specs/checkout-cart.yaml",
  "exploration_id": "exp-20260115-031000-abc123",
  "timestamp": "2026-01-15T03:10:00Z",
  "duration_ms": 45000,
  "browser": "chromium",
  "viewport": { "width": 1280, "height": 720 },
  "base_url": "http://localhost:3000",
  
  "steps": [
    {
      "step_index": 0,
      "spec_action": {
        "action": "click",
        "query": "Add to Cart button on the first product"
      },
      "execution": {
        "status": "completed",
        "method": "found via role=button name='Add to Cart'",
        "element_ref": "@e23",
        "selector_used": "button:has-text('Add to Cart')",
        "duration_ms": 1200,
        "error": null
      },
      "screenshots": {
        "before": "screenshots/step-00-before.png",
        "after": "screenshots/step-00-after.png"
      },
      "snapshot_before": { /* element refs */ },
      "snapshot_after": { /* element refs */ }
    },
    // ... more steps
  ],
  
  "outcome_checks": [
    {
      "check": "checkout_page_loaded",
      "expected": true,
      "actual": true,
      "passed": true
    }
  ],
  
  "overall_status": "completed",  // completed | failed | timeout
  "errors": []
}
```

---

## Review Interface

The review UI is a single-page application that:

### Per-Step Review

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: Click "Proceed to Checkout button"                     [Pending ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Spec Intent                          Actual Execution                      │
│  ─────────────                        ────────────────                      │
│  Click the proceed to checkout        Found: button@e45 "Checkout"          │
│  button                               Method: text match                    │
│                                       Duration: 850ms                       │
│                                                                             │
│  ┌─────────────────────────┐  ──▶  ┌─────────────────────────┐             │
│  │                         │       │                         │             │
│  │  [Before Screenshot]    │       │  [After Screenshot]     │             │
│  │                         │       │                         │             │
│  │  Cart page with items   │       │  Checkout page loaded   │             │
│  │                         │       │                         │             │
│  └─────────────────────────┘       └─────────────────────────┘             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Comment (optional):                                                     ││
│  │ ┌─────────────────────────────────────────────────────────────────────┐ ││
│  │ │ Looks correct. The checkout page loaded with order summary visible. │ ││
│  │ └─────────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  Tags: [ ] #timing  [ ] #wrong-element  [ ] #assertion-needed  [ ] #flaky  │
│                                                                             │
│                                        [✓ Approve Step]  [✗ Reject Step]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Overall Verdict

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Review Summary: checkout-cart                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Steps: 8 total                                                             │
│    ✓ Approved: 6                                                            │
│    ✗ Rejected: 1 (Step 5: wrong element clicked)                            │
│    ○ Pending: 1                                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Overall Notes:                                                          ││
│  │ ┌─────────────────────────────────────────────────────────────────────┐ ││
│  │ │ Step 5 clicked the "Cancel" button instead of "Continue". The AI   │ ││
│  │ │ should use the button with class .checkout-continue not just text  │ ││
│  │ │ matching "Continue" since there are multiple buttons with that text│ ││
│  │ └─────────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│               [Submit: Approve & Codify]  [Submit: Reject & Retry]          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Review Data Persistence

Reviews are saved to JSON files that persist across sessions:

```json
{
  "exploration_id": "exp-20260115-031000-abc123",
  "reviewer": "alex",
  "started_at": "2026-01-15T03:15:00Z",
  "updated_at": "2026-01-15T03:18:00Z",
  
  "steps": [
    {
      "step_index": 0,
      "status": "approved",
      "comment": null,
      "tags": []
    },
    {
      "step_index": 4,
      "status": "rejected",
      "comment": "Clicked Cancel instead of Continue. Use .checkout-continue selector.",
      "tags": ["wrong-element"]
    }
  ],
  
  "overall_notes": "Step 5 needs selector fix. Rest looks good.",
  "verdict": "rejected",
  "submitted_at": "2026-01-15T03:20:00Z"
}
```

---

## Codified Test Format

After approval, BrowserFlow generates a deterministic bash script:

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# BrowserFlow Generated Test: checkout-cart
# ═══════════════════════════════════════════════════════════════════════════
# Spec: specs/checkout-cart.yaml
# Exploration: exp-20260115-031000-abc123
# Approved by: alex @ 2026-01-15T03:20:00Z
# Generated: 2026-01-15T03:25:00Z
#
# This test was generated from an approved exploration. Do not edit manually.
# To update, re-run exploration and get new approval.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Load BrowserFlow library
source "$(dirname "$0")/../lib/browserflow.sh"

# Test configuration
TEST_NAME="checkout-cart"
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-30000}"
SESSION="bf-${TEST_NAME}-$$"
BASELINES_DIR="$(dirname "$0")/../baselines/${TEST_NAME}"
SCREENSHOTS_DIR="/tmp/browserflow/${TEST_NAME}/screenshots"

# Cleanup on exit
cleanup() {
    bf_close_session "$SESSION" 2>/dev/null || true
}
trap cleanup EXIT

# Initialize
bf_log_info "Starting test: $TEST_NAME"
mkdir -p "$SCREENSHOTS_DIR"

# Setup browser session
bf_open_session "$SESSION" "$BASE_URL"
bf_wait_ready "$SESSION" "$TIMEOUT"

# ───────────────────────────────────────────────────────────────────────────
# Step 0: Click "Add to Cart button on the first product"
# Approved element: button[role=button]:has-text('Add to Cart')
# ───────────────────────────────────────────────────────────────────────────
bf_log_step 0 "Click Add to Cart"
bf_screenshot "$SESSION" "$SCREENSHOTS_DIR/step-00-before.png"

bf_click "$SESSION" "button:has-text('Add to Cart')" || {
    bf_log_fail "Step 0: Could not click Add to Cart button"
    exit 1
}

bf_wait_text "$SESSION" "Added to cart" 3000 || {
    bf_log_fail "Step 0: 'Added to cart' text not found"
    exit 1
}

bf_screenshot "$SESSION" "$SCREENSHOTS_DIR/step-00-after.png"

# Baseline comparison (if baselines exist)
if [[ -f "$BASELINES_DIR/step-00-after.png" ]]; then
    if ! bf_compare_screenshots "$SCREENSHOTS_DIR/step-00-after.png" "$BASELINES_DIR/step-00-after.png"; then
        bf_log_warn "Step 0: Screenshot differs from baseline"
        # Non-fatal in CI, but logged for review
    fi
fi

# ───────────────────────────────────────────────────────────────────────────
# Step 1: Navigate to /cart
# ───────────────────────────────────────────────────────────────────────────
bf_log_step 1 "Navigate to cart"
bf_navigate "$SESSION" "/cart"
bf_wait_url "$SESSION" "/cart" 5000

# ... more steps ...

# ───────────────────────────────────────────────────────────────────────────
# Final Verification
# ───────────────────────────────────────────────────────────────────────────
bf_log_info "Running final verifications"

bf_verify_url "$SESSION" "/checkout" || {
    bf_log_fail "Final: Not on checkout page"
    exit 1
}

bf_verify_element_visible "$SESSION" ".order-summary" || {
    bf_log_fail "Final: Order summary not visible"
    exit 1
}

# ───────────────────────────────────────────────────────────────────────────
# Success
# ───────────────────────────────────────────────────────────────────────────
bf_log_success "$TEST_NAME completed successfully"
exit 0
```

---

## MEOW Workflow Integration

BrowserFlow provides MEOW workflow templates for orchestration:

### Full Cycle Workflow

```toml
# workflows/full-cycle.meow.toml
#
# Complete E2E test creation workflow with human review gate
#
# Usage:
#   meow run full-cycle --var spec=checkout-cart
#   meow run full-cycle --var spec=checkout-cart --var adapter=claude-haiku

[main]
name = "browserflow-full-cycle"
description = "Explore → Review → Codify with human verification"

[main.vars]
spec = { required = true }
base_url = { default = "http://localhost:3000" }
adapter = { default = "claude" }
max_retries = { default = "3" }
review_port = { default = "8190" }

# ═══════════════════════════════════════════════════════════════════════════
# Phase 1: Exploration
# ═══════════════════════════════════════════════════════════════════════════

[[main.steps]]
id = "explore"
executor = "expand"
template = "exploration"

# ═══════════════════════════════════════════════════════════════════════════
# Phase 2: Human Review Gate
# ═══════════════════════════════════════════════════════════════════════════

[[main.steps]]
id = "serve-review"
executor = "shell"
needs = ["explore"]
command = """
bf review serve \
  --exploration "{{steps.explore.outputs.exploration_id}}" \
  --port {{review_port}} \
  --background
  
echo "Review available at http://localhost:{{review_port}}"
echo "Run 'meow approve review-{{spec}}' to approve"
echo "Run 'meow reject review-{{spec}} --reason \"...\"' to reject"
"""

[[main.steps]]
id = "await-review"
executor = "gate"
needs = ["serve-review"]
gate_id = "review-{{spec}}"
timeout = "24h"

[[main.steps]]
id = "stop-review-server"
executor = "shell"
needs = ["await-review"]
command = "bf review stop --port {{review_port}}"

# ═══════════════════════════════════════════════════════════════════════════
# Phase 3: Branch on Verdict
# ═══════════════════════════════════════════════════════════════════════════

[[main.steps]]
id = "check-verdict"
executor = "branch"
needs = ["stop-review-server"]
condition = "gate_approved('review-{{spec}}')"
then_expand = "codification"
else_expand = "retry-or-fail"

# ═══════════════════════════════════════════════════════════════════════════
# Templates
# ═══════════════════════════════════════════════════════════════════════════

[exploration]
name = "exploration"

[[exploration.steps]]
id = "run-exploration"
executor = "agent"
adapter = "{{adapter}}"
timeout = "300s"
prompt = """
You are exploring a web UI to generate an E2E test.

Read the spec at: specs/{{spec}}.yaml

Follow each step, taking screenshots before and after each action.
Save your exploration report to: explorations/{{spec}}/

Use the browserflow CLI:
  bf explore start --spec {{spec}} --url {{base_url}}
  bf explore step <step_index> --screenshot
  bf explore complete

See the exploration prompt template for detailed instructions.
"""

[[exploration.steps]]
id = "validate-exploration"
executor = "shell"
needs = ["run-exploration"]
command = """
exploration_dir="explorations/{{spec}}"
if [[ ! -f "$exploration_dir/report.json" ]]; then
    echo "ERROR: Exploration report not found"
    exit 1
fi

exploration_id=$(jq -r '.exploration_id' "$exploration_dir/report.json")
echo "exploration_id=$exploration_id"
"""
outputs = ["exploration_id"]

# ─────────────────────────────────────────────────────────────────────────────

[codification]
name = "codification"

[[codification.steps]]
id = "generate-test"
executor = "agent"
adapter = "{{adapter}}"
timeout = "120s"
prompt = """
Generate a deterministic bash test script from the approved exploration.

Exploration: explorations/{{spec}}/
Review: reviews/{{spec}}/verdict.json

The test must:
1. Use the exact element selectors from approved steps
2. Include wait times learned from exploration
3. Add assertions for screenshot comparison
4. Handle cleanup on failure

Output to: generated/{{spec}}.sh
"""

[[codification.steps]]
id = "save-baselines"
executor = "shell"
needs = ["generate-test"]
command = """
mkdir -p baselines/{{spec}}
cp explorations/{{spec}}/screenshots/*.png baselines/{{spec}}/
chmod +x generated/{{spec}}.sh
echo "Test generated: generated/{{spec}}.sh"
"""

# ─────────────────────────────────────────────────────────────────────────────

[retry-or-fail]
name = "retry-or-fail"

[[retry-or-fail.steps]]
id = "check-retries"
executor = "shell"
command = """
retry_count_file="/tmp/browserflow-retry-{{spec}}"
if [[ -f "$retry_count_file" ]]; then
    count=$(cat "$retry_count_file")
else
    count=0
fi

count=$((count + 1))
echo "$count" > "$retry_count_file"

if [[ $count -ge {{max_retries}} ]]; then
    echo "Max retries ({{max_retries}}) reached"
    exit 1
fi

echo "Retry $count of {{max_retries}}"
echo "retry_count=$count"
"""
outputs = ["retry_count"]

[[retry-or-fail.steps]]
id = "re-explore"
executor = "agent"
needs = ["check-retries"]
adapter = "{{adapter}}"
timeout = "300s"
prompt = """
Your previous exploration was rejected. Review the feedback and try again.

Spec: specs/{{spec}}.yaml
Previous exploration: explorations/{{spec}}/
Review feedback: reviews/{{spec}}/verdict.json

Pay special attention to the reviewer's comments on rejected steps.
Adjust your approach based on the feedback.

Re-run exploration with corrections.
"""

[[retry-or-fail.steps]]
id = "loop-back"
executor = "goto"
needs = ["re-explore"]
target = "serve-review"
```

---

## CLI Reference

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/browserflow.git

# Add to PATH
export PATH="$PATH:$(pwd)/browserflow/bin"

# Install dependencies
bf setup
```

### Commands

```bash
# Initialize BrowserFlow in a project
bf init

# Explore a spec (runs AI exploration)
bf explore --spec checkout-cart --url http://localhost:3000

# Start review server
bf review serve --spec checkout-cart --port 8190

# Submit review verdict (alternative to web UI)
bf review approve --spec checkout-cart
bf review reject --spec checkout-cart --reason "Step 3 failed"

# Generate test from approved exploration
bf codify --spec checkout-cart

# Run codified tests
bf run                          # Run all tests
bf run checkout-cart            # Run specific test
bf run --tag smoke              # Run tests by tag

# Update baselines (after intentional UI changes)
bf baseline update --spec checkout-cart

# CI mode (non-interactive, fails on any issue)
bf ci --spec checkout-cart
bf ci --all
```

---

## Configuration

### Project Configuration

```yaml
# browserflow.yaml (project root)

project:
  name: my-web-app
  base_url: http://localhost:3000
  
browser:
  engine: chromium          # chromium | firefox | webkit
  headless: true
  viewport:
    width: 1280
    height: 720
  timeout: 30000            # Default timeout in ms

exploration:
  adapter: claude           # claude | openai | ollama
  max_retries: 3
  screenshot_on_error: true

review:
  port: 8190
  auto_open_browser: true

codification:
  output_format: bash       # bash | python | javascript
  include_baseline_checks: true
  
ci:
  fail_on_baseline_diff: false  # Warn only, don't fail
  screenshot_diff_threshold: 0.05  # 5% pixel difference allowed
  parallel: 4
```

### Adapter Configuration

```yaml
# adapters/claude.yaml

adapter:
  type: claude
  model: claude-sonnet-4-20250514
  max_tokens: 8192
  
prompts:
  exploration: templates/exploration-prompt.md
  codification: templates/codify-prompt.md
  retry: templates/retry-prompt.md
```

---

## Screenshot Comparison

BrowserFlow uses perceptual hashing for baseline comparison:

```bash
# How it works
1. Convert screenshot to grayscale
2. Resize to 32x32
3. Compute DCT (discrete cosine transform)
4. Generate 64-bit hash from top-left 8x8

# Comparison
- Hamming distance between hashes
- Distance < 10 = likely same image
- Distance 10-20 = minor differences (animations, timestamps)
- Distance > 20 = significant change
```

### Masking Dynamic Content

For pages with timestamps, avatars, or other dynamic content:

```yaml
# In spec file
- action: screenshot
  name: "dashboard"
  mask:
    - selector: ".timestamp"
      reason: "Dynamic timestamp"
    - selector: ".user-avatar"
      reason: "User-specific content"
    - region: { x: 10, y: 10, width: 100, height: 50 }
      reason: "Ad banner"
```

---

## Examples

### Example 1: Simple Navigation Test

```yaml
# specs/view-products.yaml
name: view-products
description: User browses to products page and views a product

steps:
  - action: navigate
    to: "/"
    
  - action: click
    query: "Products link in navigation"
    
  - action: wait
    for: url
    contains: "/products"
    
  - action: screenshot
    name: "products-listing"
    
  - action: click
    query: "First product card"
    
  - action: wait
    for: element
    selector: ".product-detail"
    
  - action: screenshot
    name: "product-detail"

expected_outcomes:
  - product_detail_visible: true
```

### Example 2: Form Submission Test

```yaml
# specs/contact-form.yaml
name: contact-form
description: User submits contact form and sees confirmation

preconditions:
  page: "/contact"

steps:
  - action: fill
    query: "Name input"
    value: "Test User"
    
  - action: fill
    query: "Email input"
    value: "test@example.com"
    
  - action: fill
    query: "Message textarea"
    value: "This is a test message from BrowserFlow"
    
  - action: screenshot
    name: "form-filled"
    
  - action: click
    query: "Submit button"
    
  - action: wait
    for: text
    text: "Thank you"
    timeout: 5000
    
  - action: screenshot
    name: "confirmation"
    
  - action: verify_state
    checks:
      - element_visible: ".success-message"
      - text_contains: "We'll get back to you"

expected_outcomes:
  - form_submitted: true
  - confirmation_shown: true
```

### Example 3: Authentication Flow

```yaml
# specs/login-flow.yaml
name: login-flow
description: User logs in with valid credentials

preconditions:
  logged_in: false

steps:
  - action: navigate
    to: "/login"
    
  - action: fill
    selector: "input[name=email]"
    value: "{{TEST_USER_EMAIL}}"  # Environment variable
    
  - action: fill
    selector: "input[name=password]"
    value: "{{TEST_USER_PASSWORD}}"
    
  - action: screenshot
    name: "login-form-filled"
    
  - action: click
    selector: "button[type=submit]"
    
  - action: wait
    for: url
    contains: "/dashboard"
    timeout: 10000
    
  - action: screenshot
    name: "logged-in-dashboard"
    
  - action: verify_state
    checks:
      - url_contains: "/dashboard"
      - element_visible: ".user-menu"
      - text_contains: "Welcome"

expected_outcomes:
  - logged_in: true
  - redirected_to_dashboard: true

tags:
  - auth
  - critical
  - smoke
```

---

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup BrowserFlow
        run: |
          git clone https://github.com/your-org/browserflow.git /tmp/browserflow
          echo "/tmp/browserflow/bin" >> $GITHUB_PATH
          bf setup
          
      - name: Start application
        run: |
          npm start &
          bf wait-for-url http://localhost:3000 --timeout 60
          
      - name: Run E2E tests
        run: bf ci --all
        
      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-screenshots
          path: /tmp/browserflow/*/screenshots/
```

### GitLab CI

```yaml
# .gitlab-ci.yml
e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0
  
  script:
    - git clone https://github.com/your-org/browserflow.git /tmp/browserflow
    - export PATH="$PATH:/tmp/browserflow/bin"
    - bf setup
    - npm start &
    - bf wait-for-url http://localhost:3000 --timeout 60
    - bf ci --all
    
  artifacts:
    when: on_failure
    paths:
      - /tmp/browserflow/*/screenshots/
```

---

## Extending BrowserFlow

### Custom Adapters

Create adapters for different LLM providers:

```bash
# adapters/my-llm/adapter.sh

bf_adapter_explore() {
    local spec_path="$1"
    local base_url="$2"
    
    # Your LLM API call here
    # Must output structured exploration report
}

bf_adapter_codify() {
    local exploration_path="$1"
    local review_path="$2"
    
    # Generate test script from approved exploration
}
```

### Custom Actions

Add project-specific actions:

```yaml
# browserflow.yaml
custom_actions:
  - name: login_as_admin
    script: scripts/login-admin.sh
    
  - name: reset_database
    script: scripts/reset-db.sh
```

```yaml
# In spec file
steps:
  - action: custom
    name: login_as_admin
    
  - action: custom
    name: reset_database
```

---

## Roadmap

### Phase 1: Core Framework (Current)
- [x] Spec format definition
- [x] Exploration report format
- [x] Review UI design
- [ ] CLI implementation
- [ ] Basic browser automation library
- [ ] Claude adapter

### Phase 2: Review System
- [ ] Interactive HTML review interface
- [ ] Comment persistence
- [ ] Verdict submission
- [ ] MEOW gate integration

### Phase 3: Codification
- [ ] Bash test generation
- [ ] Baseline management
- [ ] Screenshot comparison

### Phase 4: CI Integration
- [ ] GitHub Actions workflow
- [ ] GitLab CI template
- [ ] Failure reporting

### Phase 5: Polish
- [ ] Dashboard for multi-spec review
- [ ] Flaky test detection
- [ ] Performance metrics
- [ ] Documentation site

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

BrowserFlow builds on ideas from:
- [agent-browser](https://github.com/vercel-labs/agent-browser) - AI-friendly browser automation
- [MEOW](https://github.com/meow-stack/meow-machine) - Workflow orchestration
- [Playwright](https://playwright.dev) - Browser automation engine
- The ComfyGit Manager project - Where these patterns were first developed
