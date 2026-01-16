# BrowserFlow 1.0 Product Specification

**Version:** 1.0.0-final
**Date:** 2026-01-15
**Status:** Implementation-ready
**Audience:** Engineers, agentic dev tools, designers, DevOps

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Core Concepts](#3-core-concepts)
4. [User Personas & Use Cases](#4-user-personas--use-cases)
5. [Repository & Artifact Layout](#5-repository--artifact-layout)
6. [Spec YAML v2 Schema](#6-spec-yaml-v2-schema)
7. [Locator Object Model](#7-locator-object-model)
8. [Exploration Phase](#8-exploration-phase)
9. [Review Phase](#9-review-phase)
10. [Generation Phase](#10-generation-phase)
11. [Runtime & Runner](#11-runtime--runner)
12. [Repair Mode](#12-repair-mode)
13. [Baseline Management](#13-baseline-management)
14. [CLI Specification](#14-cli-specification)
15. [Configuration](#15-configuration)
16. [AI Adapter Interface](#16-ai-adapter-interface)
17. [agent-browser Integration](#17-agent-browser-integration)
18. [Architecture & Monorepo Structure](#18-architecture--monorepo-structure)
19. [Quality Principles](#19-quality-principles)
20. [Epics & Task Breakdown](#20-epics--task-breakdown)
21. [Milestones](#21-milestones)
22. [Definitions of Done](#22-definitions-of-done)
23. [Appendix: JSON Schemas](#appendix-a-json-schemas)

---

## 1. Executive Summary

BrowserFlow is a standalone tool for converting human intent into reliable, deterministic E2E tests using an AI exploration + human review workflow. It emphasizes premium UX, minimal setup overhead, and adaptability across codebases.

### The Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BrowserFlow Pipeline                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │   SPEC   │───▶│ EXPLORE  │───▶│  REVIEW  │───▶│ GENERATE │───▶│   RUN    │  │
│  │  (YAML)  │    │   (AI)   │    │ (Human)  │    │  (Code)  │    │  (CI)    │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │               │         │
│       ▼               ▼               ▼               ▼               ▼         │
│   Intent-first   Evidence +      Lock locators   Playwright TS   Deterministic │
│   what user does candidates      approve steps   + baselines     0 AI tokens   │
│                                  add assertions                                  │
│                                                                                  │
│                            ┌──────────┐                                         │
│                            │  REPAIR  │◀── CI failure triggers                  │
│                            └──────────┘                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Promise

**Pay AI tokens at creation/repair time, not on every CI run.**

| Phase | Token Cost | Frequency |
|-------|-----------|-----------|
| Exploration | ~10-50k tokens | Once per spec (+ retries) |
| Review | 0 tokens | Human time only |
| Generation | ~5-10k tokens | Once per approved spec |
| CI Execution | 0 tokens | Every PR/push |
| Repair | ~5-20k tokens | Only when tests break |

---

## 2. Goals & Non-Goals

### 2.1 Product Goals

| Goal | Description |
|------|-------------|
| **Premium Review UX** | Stripe-level experience: fast, opinionated, polished, keyboard-driven |
| **Deterministic CI** | No AI in runtime. Failures are actionable with rich artifacts |
| **Low Setup Overhead** | Install in minutes; minimal project changes required |
| **Cross-Project Portability** | Works with any web app stack; configurable selector strategies |
| **First-Class Maintainability** | Repair mode reduces E2E test churn |

### 2.2 Engineering Goals

| Goal | Description |
|------|-------------|
| **Stable Schemas** | JSON Schema validation for specs and configs |
| **Stable Identifiers** | Step IDs and screenshot names prevent baseline churn |
| **Durable Locators** | Locator Object with preferred + fallback chain replaces brittle refs |
| **High-Signal Diffs** | Baseline/actual/diff overlay with masking and thresholds |
| **Immutable Runs** | Every exploration creates a new run directory; no overwrites |

### 2.3 Non-Goals (v1.0)

| Non-Goal | Rationale |
|----------|-----------|
| Cloud SaaS hosting | BrowserFlow is local-first |
| Multi-tenant auth/RBAC | Out of scope for local tooling |
| Mobile native testing | Web + responsive viewport only |
| General AI QA platform | Focus on codifying deterministic tests |
| Python test output | Playwright TypeScript only for v1.0 |
| Bash test output | Playwright TypeScript is strictly superior |

---

## 3. Core Concepts

### 3.1 Specs Are Intent-First

A spec describes **what** the user does and **what** should be true—not **how** to click elements.

```yaml
# Good: Intent-first
- id: add_product
  action: click
  target:
    query: "Add to Cart button on the first product"

# Bad: Implementation-specific
- id: add_product
  action: click
  target:
    css: "div.product-grid > div:first-child > button.btn-primary"
```

Specs can include ambiguous `query:` fields. These are resolved to stable locators during exploration/review.

### 3.2 Exploration Produces Evidence + Candidates (Not Final Truth)

Exploration is inherently non-deterministic. The AI might:
- Click the wrong element
- Miss timing windows
- Misinterpret ambiguous specs
- Discover that the spec is incomplete

Exploration collects:
- Before/after screenshots per step
- Accessibility snapshot excerpts
- Timing/performance metrics
- Console/network error summaries
- **Locator candidates** for each interaction target

### 3.3 Review Is Where Intent Becomes Deterministic

The human reviewer approves:
- Behavior correctness (via screenshots + optional trace replay)
- Chosen locator strategy (lock preferred locators)
- Masks for dynamic regions
- Required assertions

Review outputs a **lockfile** that is the sole source of truth for generation.

### 3.4 Generation Emits Playwright Test

Output includes:
- Stable locators with fallback chain
- Deterministic waits (no fixed sleeps)
- Assertions (DOM + visual)
- Trace/video configuration for CI
- Artifact bundling on failure

### 3.5 Repair Mode Makes Maintenance a Feature

When CI fails:
1. BrowserFlow collects a failure bundle (trace, screenshots, DOM, logs)
2. Optionally runs AI to propose a fix
3. Human reviews and approves the patch
4. Tool applies fix to lockfile and regenerates tests

---

## 4. User Personas & Use Cases

### Persona A: App Developer (Quick Coverage)

> "I want smoke tests fast; I don't want to learn a new framework."

**Workflow:**
```bash
bf init
bf create checkout-cart
# Review in browser, approve steps
# Tests appear in e2e/tests/
git add e2e/ baselines/ && git commit
```

### Persona B: QA/Automation Engineer (Control)

> "I want stable locators, visual diffs, and repair workflows."

**Workflow:**
- Author detailed specs with explicit assertions
- Enforce `data-testid` policy via config
- Manage baselines with `bf baseline diff/accept`
- Use repair mode for locator drift

### Persona C: Maintainer (Low Churn)

> "UI changes often; I need repair that doesn't burn hours."

**Workflow:**
```bash
# CI fails
bf repair --from-run .browserflow/runs/checkout-cart/run-xxx/failure.json
# Review proposed fix, approve
# Re-run locally to confirm
git add && git commit
```

---

## 5. Repository & Artifact Layout

### 5.1 Recommended Project Structure

```
project-root/
├── specs/                              # Committed: YAML test specifications
│   ├── checkout-cart.yaml
│   ├── login-flow.yaml
│   └── product-search.yaml
│
├── e2e/                                # Committed: Generated Playwright tests
│   ├── playwright.config.ts
│   ├── lib/
│   │   └── browserflow.ts              # Optional helpers
│   └── tests/
│       ├── checkout-cart.spec.ts
│       ├── login-flow.spec.ts
│       └── product-search.spec.ts
│
├── baselines/                          # Committed: Visual regression baselines
│   ├── checkout-cart/
│   │   ├── cart-with-item.png
│   │   └── checkout-confirmation.png
│   └── login-flow/
│       └── logged-in-dashboard.png
│
├── .browserflow/                       # Git-ignored: Runtime workspace
│   ├── runs/
│   │   └── checkout-cart/
│   │       ├── run-20260115-031000-abc123/
│   │       │   ├── exploration.json
│   │       │   ├── review.json
│   │       │   ├── lockfile.json
│   │       │   └── artifacts/
│   │       │       ├── screenshots/
│   │       │       │   ├── add_first_product-before.png
│   │       │       │   └── add_first_product-after.png
│   │       │       ├── trace.zip
│   │       │       ├── video.webm
│   │       │       ├── diffs/
│   │       │       └── logs/
│   │       │           ├── console.json
│   │       │           └── network.json
│   │       └── latest -> run-20260115-031000-abc123
│   ├── cache/
│   │   └── browsers/
│   └── tmp/
│
├── browserflow.yaml                    # Committed: Project configuration
└── .gitignore                          # Includes .browserflow/
```

### 5.2 Run Directory Structure

Each exploration creates an immutable run directory:

```
run-20260115-031000-abc123/
├── exploration.json        # AI exploration results
├── review.json             # Human review decisions
├── lockfile.json           # Resolved locators, assertions, masks
├── failure.json            # Only present if run failed
└── artifacts/
    ├── screenshots/
    │   ├── {step_id}-before.png
    │   └── {step_id}-after.png
    ├── trace.zip           # Playwright trace
    ├── video.webm          # Optional video recording
    ├── diffs/
    │   ├── {screenshot_name}-baseline.png
    │   ├── {screenshot_name}-actual.png
    │   └── {screenshot_name}-diff.png
    └── logs/
        ├── console.json    # Console messages
        └── network.json    # Network requests/failures
```

### 5.3 Symlink Pointers

For convenience, `latest` symlink always points to the most recent run:

```
.browserflow/runs/checkout-cart/latest -> run-20260115-031000-abc123/
```

This allows commands like `bf review --spec checkout-cart` to open the latest run by default.

---

## 6. Spec YAML v2 Schema

### 6.1 Top-Level Schema

```yaml
# Required fields
version: 2                              # Schema version (required)
name: checkout-cart                     # Unique kebab-case identifier (required)

# Optional metadata
description: |                          # Human-readable description
  User adds an item to cart, proceeds to checkout,
  and verifies order summary.

base_url: ${BASE_URL}                   # Override project base_url (optional)
timeout: 2m                             # Max duration for entire spec (duration string)
priority: critical                      # critical | high | normal | low
tags: [checkout, critical_path, smoke]  # Classification tags

# Preconditions (optional)
preconditions:
  page: /                               # Starting page (navigated before first step)
  auth: session:default                 # Auth state reference
  viewport:                             # Override viewport for this spec
    width: 1920
    height: 1080
  data:
    seed: minimal_catalog               # Project-defined data seed
  feature_flags:
    new_checkout: true
  mocks:                                # Network mocks for determinism
    - url: "**/api/products"
      response: fixtures/products.json

# Variables (optional)
variables:
  TEST_USER_EMAIL: ${TEST_USER_EMAIL}
  TEST_USER_PASSWORD: ${TEST_USER_PASSWORD}

# Steps (required, non-empty)
steps:
  - id: step_id                         # Unique within spec (required)
    action: action_type                 # See Action Types below
    # ... action-specific fields

# Expected outcomes (optional)
expected_outcomes:
  - id: outcome_id
    type: dom | visual | url
    check: visible | text_contains | url_matches | screenshot
    target: { ... }
```

### 6.2 Duration Strings

All duration fields use human-readable strings:

| Format | Example | Milliseconds |
|--------|---------|--------------|
| Milliseconds | `500ms` | 500 |
| Seconds | `3s` | 3000 |
| Minutes | `2m` | 120000 |
| Hours | `1h` | 3600000 |
| Combined | `1m30s` | 90000 |

**Never use raw numbers for durations.**

### 6.3 Target Object

All element references use a `target` object:

```yaml
target:
  # Intent-based (AI resolves during exploration)
  query: "Add to Cart button on the first product"

  # OR explicit locator strategies (one of):
  testid: "add-to-cart"                 # data-testid attribute
  role: button                          # ARIA role
    name: "Add to Cart"                 # Accessible name (optional)
    exact: true                         # Exact match (default: true)
  label: "Email address"                # Form label text
  placeholder: "Enter email"            # Placeholder text
  text: "Submit"                        # Visible text content
  css: "button.primary"                 # CSS selector (last resort)

  # Scoping (optional, applies to any strategy)
  within:
    css: "[data-testid='product-grid']"
  nth: 0                                # Index when multiple matches
```

### 6.4 Action Types

#### Navigation Actions

```yaml
# Navigate to URL
- id: go_home
  action: navigate
  to: /                                 # Relative or absolute URL
  wait_until: networkidle               # load | domcontentloaded | networkidle

# Click element
- id: click_button
  action: click
  target:
    query: "Submit button"
  button: left                          # left | right | middle (default: left)
  click_count: 1                        # Number of clicks (default: 1)
  screenshot:
    before: true
    after: true

# History navigation
- id: go_back
  action: back

- id: go_forward
  action: forward

# Reload page
- id: refresh_page
  action: reload
```

#### Input Actions

```yaml
# Fill input (clears first)
- id: enter_email
  action: fill
  target:
    label: "Email"
  value: "test@example.com"

# Type text (doesn't clear)
- id: type_search
  action: type
  target:
    placeholder: "Search..."
  value: "product name"
  press_enter: true                     # Press Enter after typing

# Select dropdown option
- id: select_country
  action: select
  target:
    label: "Country"
  option: "United States"               # By visible text
  # OR
  value: "us"                           # By option value

# Checkbox/radio
- id: accept_terms
  action: check
  target:
    label: "I accept the terms"
  checked: true                         # true | false

# Upload files
- id: upload_avatar
  action: upload
  target:
    testid: "file-input"
  files:
    - fixtures/avatar.png
```

#### Wait Actions

```yaml
# Wait for element
- id: wait_modal
  action: wait
  for: element
  target:
    css: ".modal"
  state: visible                        # visible | hidden | attached | detached
  timeout: 5s

# Wait for text
- id: wait_confirmation
  action: wait
  for: text
  text: "Order confirmed"
  timeout: 10s

# Wait for URL
- id: wait_redirect
  action: wait
  for: url
  pattern: "**/checkout/success"        # Glob pattern
  timeout: 5s

# Wait for network idle
- id: wait_load
  action: wait
  for: load_state
  state: networkidle                    # load | domcontentloaded | networkidle
  timeout: 30s

# Wait for JavaScript condition
- id: wait_data_loaded
  action: wait
  for: function
  expression: "window.dataLoaded === true"
  timeout: 10s
```

#### Assertion Actions

```yaml
# Expect (first-class assertions)
- id: verify_cart
  action: expect
  checks:
    - visible:
        target: { css: ".cart-item" }
    - hidden:
        target: { testid: "empty-cart-message" }
    - text_contains:
        target: { css: ".cart-summary" }
        text: "1 item"
    - text_equals:
        target: { testid: "total" }
        text: "$99.00"
    - url_contains: "/cart"
    - url_matches: "**/cart?*"
    - count:
        target: { css: ".cart-item" }
        equals: 3
    - attribute:
        target: { testid: "submit-btn" }
        name: "disabled"
        value: null                     # null means attribute absent
    - checked:
        target: { label: "Remember me" }
        value: true
```

#### Screenshot Actions

```yaml
# Capture screenshot for visual regression
- id: cart_visual
  action: screenshot
  name: cart-with-item                  # Stable name (required)
  full_page: false                      # Capture full scrollable page
  mask:
    - target: { css: ".timestamp" }
      reason: "Dynamic timestamp"
    - target: { css: ".user-avatar" }
      reason: "User-specific content"
    - region:
        x: 10
        y: 10
        width: 100
        height: 50
      reason: "Ad banner"
  threshold: 0.05                       # Pixel diff threshold (0-1)
```

#### Keyboard Actions

```yaml
# Press key or key combination
- id: submit_form
  action: press
  key: Enter

- id: select_all
  action: press
  key: Control+a

- id: copy
  action: press
  key: Control+c
```

#### Scroll Actions

```yaml
# Scroll page
- id: scroll_down
  action: scroll
  direction: down                       # up | down | left | right
  amount: 500                           # Pixels (optional, default: viewport)

# Scroll element into view
- id: show_footer
  action: scroll_into_view
  target:
    css: "footer"
```

### 6.5 Complete Example Spec

```yaml
version: 2
name: checkout-cart
description: |
  User adds an item to cart, proceeds to checkout,
  and verifies order summary.

base_url: ${BASE_URL}
timeout: 2m
priority: critical
tags: [checkout, critical_path, smoke]

preconditions:
  page: /
  auth: session:default
  data:
    seed: minimal_catalog

variables:
  TEST_USER_EMAIL: ${TEST_USER_EMAIL}

steps:
  - id: add_first_product
    action: click
    target:
      query: "Add to Cart button on the first product"
    screenshot:
      before: true
      after: true

  - id: cart_toast
    action: wait
    for: text
    text: "Added to cart"
    timeout: 3s

  - id: open_cart
    action: navigate
    to: /cart
    screenshot:
      after: true

  - id: verify_cart_state
    action: expect
    checks:
      - visible:
          target: { css: ".cart-item" }
      - text_contains:
          target: { css: "body" }
          text: "1 item"

  - id: cart_visual
    action: screenshot
    name: cart-with-item
    mask:
      - target: { css: ".timestamp" }
        reason: "Dynamic timestamp"

  - id: proceed_checkout
    action: click
    target:
      query: "Proceed to Checkout button"

  - id: verify_checkout_state
    action: expect
    checks:
      - url_contains: "/checkout"
      - visible:
          target: { css: ".order-summary" }

expected_outcomes:
  - id: order_summary_present
    type: dom
    check: visible
    target: { css: ".order-summary" }
```

---

## 7. Locator Object Model

### 7.1 Overview

The Locator Object is the core primitive for deterministic element selection. It captures:
- **Preferred** strategy (what to use first)
- **Fallbacks** (what to try if preferred fails)
- **Scoping** (narrow down to specific container/index)
- **Proof** (evidence from exploration for debugging)

### 7.2 Locator Object Schema

```typescript
interface LocatorObject {
  // Unique identifier within the lockfile
  locator_id: string;

  // Primary locator strategy (always tried first)
  preferred: LocatorStrategy;

  // Fallback strategies (tried in order if preferred fails)
  fallbacks: LocatorStrategy[];

  // Scoping constraints
  scoping?: {
    // Parent container(s) to search within
    within?: LocatorStrategy[];
    // Index when multiple elements match (0-based)
    nth?: number;
  };

  // Evidence from exploration (for debugging/repair)
  proof: {
    // ARIA role observed during exploration
    a11y_role?: string;
    // Accessible name observed
    a11y_name?: string;
    // DOM fingerprint for similarity matching
    dom_fingerprint?: {
      tag: string;
      classes: string[];
      attributes?: Record<string, string>;
    };
    // Screenshot region where element was found
    bounding_box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

interface LocatorStrategy {
  type: 'testid' | 'role' | 'label' | 'placeholder' | 'text' | 'css';

  // For testid
  value?: string;
  attribute?: string;  // Default: data-testid

  // For role
  role?: string;
  name?: string;
  exact?: boolean;

  // For label/placeholder/text
  text?: string;

  // For css
  selector?: string;
}
```

### 7.3 Example Locator Object

```json
{
  "locator_id": "add_to_cart_primary",
  "preferred": {
    "type": "testid",
    "value": "add-to-cart",
    "attribute": "data-testid"
  },
  "fallbacks": [
    {
      "type": "role",
      "role": "button",
      "name": "Add to Cart",
      "exact": true
    },
    {
      "type": "css",
      "selector": "button:has-text('Add to Cart')"
    }
  ],
  "scoping": {
    "within": [
      {
        "type": "testid",
        "value": "product-grid"
      }
    ],
    "nth": 0
  },
  "proof": {
    "a11y_role": "button",
    "a11y_name": "Add to Cart",
    "dom_fingerprint": {
      "tag": "button",
      "classes": ["btn", "btn-primary", "add-to-cart"],
      "attributes": {
        "data-product-id": "123"
      }
    },
    "bounding_box": {
      "x": 450,
      "y": 320,
      "width": 120,
      "height": 40
    }
  }
}
```

### 7.4 Locator Resolution Rules

Order of preference (configurable):

1. **data-testid** (most stable, developer-controlled)
2. **role + accessible name** (semantic, resilient to styling changes)
3. **label / placeholder** (form-specific, user-facing)
4. **text content** (visible to users, may change with i18n)
5. **CSS selector** (last resort, most brittle)

### 7.5 Runtime Behavior

```typescript
// In CI (default): Fail fast, high determinism
const CI_MODE = {
  use_fallbacks: false,
  strict_mode: true,
  timeout: '5s'
};

// In local dev: More forgiving, suggests repair
const DEV_MODE = {
  use_fallbacks: true,
  warn_on_fallback: true,
  suggest_repair: true,
  timeout: '30s'
};
```

When fallbacks are used:
1. Log which fallback succeeded
2. Suggest updating the preferred locator
3. Optionally auto-create repair proposal

---

## 8. Exploration Phase

### 8.1 Overview

The exploration phase uses AI to drive a browser and attempt each spec step. It produces evidence and locator candidates—**not final truth**.

### 8.2 Exploration Engine Requirements

| Requirement | Description |
|-------------|-------------|
| Drive browser | Execute each step using agent-browser |
| Capture screenshots | Before/after for every action step |
| Record trace | Playwright trace for step-by-step replay |
| Generate candidates | Multiple locator strategies per target |
| Collect errors | Console messages, network failures |
| Measure timing | Duration per step and wait |

### 8.3 agent-browser Integration

BrowserFlow uses agent-browser as a library for exploration:

```typescript
import { BrowserManager } from 'agent-browser';
import { getEnhancedSnapshot } from 'agent-browser/snapshot';

async function exploreStep(step: Step, browser: BrowserManager) {
  // Get accessibility snapshot with refs
  const snapshot = await browser.getSnapshot({ interactive: true });

  // AI analyzes snapshot to find target element
  const targetRef = await aiAgent.findElement(step.target, snapshot);

  // Get locator from ref
  const locator = browser.getLocatorFromRef(targetRef);

  // Execute action
  await executeAction(step.action, locator);

  // Generate locator candidates from DOM inspection
  const candidates = await generateLocatorCandidates(locator);

  return { ref: targetRef, candidates, snapshot };
}
```

### 8.4 Handling Ambiguity

When `query:` maps to multiple plausible elements:

1. Exploration records **top 3-5 candidates** with confidence scores
2. Each candidate includes:
   - Screenshot crop showing the element
   - Locator strategies that would match it
   - Accessibility info (role, name)
3. Review UI forces human to **lock the intended element**

### 8.5 Exploration Output Schema

```typescript
interface ExplorationOutput {
  // Run identification
  run_id: string;
  spec_name: string;
  spec_hash: string;  // SHA256 of spec file

  // Context
  app_context: {
    base_url: string;
    git_sha?: string;
    build_id?: string;
    viewport: { width: number; height: number };
    browser: {
      engine: 'chromium' | 'firefox' | 'webkit';
      version: string;
    };
    timestamp: string;  // ISO8601
  };

  // Step-by-step results
  steps: ExplorationStep[];

  // Overall status
  status: 'completed' | 'failed' | 'timeout';
  duration_ms: number;
  errors: string[];
}

interface ExplorationStep {
  step_id: string;

  // Original spec intent
  intent: {
    action: string;
    target?: TargetObject;
    description?: string;
  };

  // What actually happened
  execution: {
    status: 'completed' | 'failed' | 'skipped';
    strategy: string;  // How element was found
    ref_used?: string;  // agent-browser ref (e.g., "e1")
    duration_ms: number;
    error?: string;
  };

  // Evidence collected
  evidence: {
    screenshots: {
      before?: string;  // Relative path
      after?: string;
    };
    trace_segment?: string;
    console_errors: string[];
    network_failures: string[];
  };

  // Locator candidates for review
  candidates: {
    locators: LocatorCandidate[];
    assertion_suggestions: AssertionSuggestion[];
  };
}

interface LocatorCandidate {
  strategy: LocatorStrategy;
  confidence: number;  // 0-1
  match_count: number;  // How many elements match
  screenshot_crop?: string;  // Path to cropped image
}

interface AssertionSuggestion {
  type: 'visible' | 'text_contains' | 'attribute';
  target: TargetObject;
  expected_value?: string;
  reason: string;  // Why AI suggests this
}
```

### 8.6 Exploration File Location

```
.browserflow/runs/{spec}/run-{id}/exploration.json
```

---

## 9. Review Phase

### 9.1 Overview

Review is the human gate where intent becomes deterministic. A premium UI lets reviewers:
- Approve/reject each step
- Lock preferred locators
- Add/adjust masks for dynamic content
- Define assertions
- Comment and tag for future reference

### 9.2 Review UI Information Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BrowserFlow Review: checkout-cart                    [Run: abc123] [Ctrl+?]   │
├─────────────┬───────────────────────────────────────────┬───────────────────────┤
│             │                                           │                       │
│  STEPS      │  MAIN PANEL                               │  INSPECTOR            │
│  ─────────  │  ──────────                               │  ─────────            │
│             │                                           │                       │
│  ┌────────┐ │  Step: add_first_product                  │  LOCATOR              │
│  │ thumb  │ │  ────────────────────────                 │  ────────             │
│  │   1    │ │                                           │  Preferred:           │
│  │  ✓     │ │  ┌─────────────────┐ ┌─────────────────┐  │  [testid] add-to-cart │
│  └────────┘ │  │                 │ │                 │  │                       │
│  ┌────────┐ │  │  BEFORE         │ │  AFTER          │  │  Fallbacks:           │
│  │ thumb  │ │  │                 │ │                 │  │  [role] button "Add"  │
│  │   2    │ │  │                 │ │                 │  │  [css] button.add     │
│  │  ○     │ │  │                 │ │                 │  │                       │
│  └────────┘ │  └─────────────────┘ └─────────────────┘  │  [Lock Preferred]     │
│  ┌────────┐ │                                           │  [Edit Fallbacks]     │
│  │ thumb  │ │  [Side-by-Side] [Slider] [Blink] [Diff]   │                       │
│  │   3    │ │                                           │  ─────────────────    │
│  │  ✗     │ │  ──────────────────────────────────────   │  MASKS                │
│  └────────┘ │                                           │  ─────                │
│             │  Comment:                                 │  .timestamp (dynamic) │
│  ──────     │  ┌───────────────────────────────────┐    │  [+ Add Mask]         │
│  [Filter]   │  │ Looks correct. Button was clicked │    │                       │
│  [Search]   │  │ and cart updated.                 │    │  ─────────────────    │
│             │  └───────────────────────────────────┘    │  ASSERTIONS           │
│             │                                           │  ──────────           │
│             │  Tags: [timing] [✓ assertion-added]       │  ✓ text "Added"       │
│             │                                           │  [+ Add Assertion]    │
│             │        [✓ Approve] [✗ Reject]             │                       │
│             │                                           │  ─────────────────    │
│             │                                           │  EVIDENCE             │
│             │                                           │  ────────             │
│             │                                           │  [▶ Show Details]     │
│             │                                           │                       │
├─────────────┴───────────────────────────────────────────┴───────────────────────┤
│  Progress: 2/8 approved │ 1 rejected │ 5 pending     [Submit Review] [Ctrl+S]   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Next step |
| `k` / `↑` | Previous step |
| `a` | Approve current step |
| `r` | Reject current step |
| `m` | Add mask |
| `l` | Lock locator (open picker) |
| `e` | Add assertion |
| `c` | Focus comment field |
| `/` | Search steps |
| `1-4` | Switch screenshot view mode |
| `Ctrl+S` | Submit review |
| `Ctrl+?` | Show keyboard shortcuts |

### 9.4 Screenshot Viewing Modes

| Mode | Description |
|------|-------------|
| **Side-by-Side** | Before and after images next to each other |
| **Slider** | Drag slider to wipe between before/after |
| **Blink** | Auto-toggle between images (configurable speed) |
| **Diff** | Overlay showing pixel differences highlighted |

### 9.5 Mask Editor

The mask editor allows reviewers to exclude dynamic regions from visual comparison:

**Features:**
- **Draw rectangle** - Click and drag to create mask region
- **Click element** - Click on element to auto-mask based on locator
- **Resize/move** - Drag handles to adjust existing masks
- **Delete** - Click mask and press Delete
- **Reason field** - Document why region is masked

**Mask persistence:**
- Masks are stored in the lockfile
- Applied during generation to Playwright's `mask` option

### 9.6 Assertion Builder

When a reviewer tags a step as "assertion needed":

| Assertion Type | Description |
|----------------|-------------|
| `visible` | Element is visible on page |
| `hidden` | Element is not visible |
| `text_contains` | Element contains text |
| `text_equals` | Element text exactly matches |
| `url_contains` | URL contains substring |
| `url_matches` | URL matches glob pattern |
| `count` | Number of matching elements |
| `attribute` | Element has attribute value |
| `screenshot` | Visual regression check |

Assertions can be attached to:
- The specific step
- Global expected outcomes

### 9.7 Locator Locking Flow

For each target in click/fill/expect actions:

1. UI shows "Preferred locator" and fallback candidates
2. Reviewer can:
   - **Select** which candidate becomes preferred
   - **Edit** the locator strategy
   - **Adjust scoping** (within container, nth index)
   - **Require testid** if policy is enabled
3. Locked locators are stored in the lockfile

### 9.8 Review Output Schema

```typescript
// review.json - Human decisions
interface ReviewOutput {
  run_id: string;
  reviewer: string;
  started_at: string;
  updated_at: string;

  steps: ReviewStep[];

  overall_notes: string;
  verdict: 'approved' | 'rejected' | 'pending';
  submitted_at?: string;
}

interface ReviewStep {
  step_id: string;
  status: 'approved' | 'rejected' | 'pending';
  comment?: string;
  tags: string[];
}

// lockfile.json - Resolved locators, masks, assertions
interface Lockfile {
  run_id: string;
  spec_name: string;
  spec_hash: string;
  created_at: string;

  // Resolved locators for each target
  locators: Record<string, LocatorObject>;

  // Masks for screenshots
  masks: Record<string, Mask[]>;

  // Finalized assertions
  assertions: Assertion[];

  // Generation metadata
  generation: {
    format: 'playwright-ts';
    output_path: string;
    generated_at?: string;
  };
}
```

### 9.9 Review File Locations

```
.browserflow/runs/{spec}/run-{id}/review.json
.browserflow/runs/{spec}/run-{id}/lockfile.json
```

---

## 10. Generation Phase

### 10.1 Overview

Generation converts the approved lockfile into deterministic Playwright Test code. No AI is involved in the generated tests.

### 10.2 Output Files

| File | Description |
|------|-------------|
| `e2e/tests/{spec}.spec.ts` | The test file |
| `e2e/playwright.config.ts` | Playwright config (if absent) |
| `e2e/lib/browserflow.ts` | Optional helpers |
| `baselines/{spec}/*.png` | Baseline screenshots (on first run) |

### 10.3 Generated Test Structure

```typescript
// e2e/tests/checkout-cart.spec.ts
import { test, expect } from '@playwright/test';

/**
 * BrowserFlow Generated Test
 *
 * Spec: checkout-cart
 * Run: run-20260115-031000-abc123
 * Approved by: alex @ 2026-01-15T03:20:00Z
 * Generated: 2026-01-15T03:25:00Z
 *
 * WARNING: Do not edit manually. Regenerate via `bf generate --spec checkout-cart`
 */

test.describe('checkout-cart', () => {
  test.beforeEach(async ({ page }) => {
    // Load auth state if configured
    // await page.context().storageState({ path: '.browserflow/auth/default.json' });
  });

  test('checkout-cart', async ({ page }) => {
    // Precondition: navigate to starting page
    await page.goto('/');

    // ─────────────────────────────────────────────────────────────────────────
    // Step: add_first_product
    // Intent: Click "Add to Cart button on the first product"
    // ─────────────────────────────────────────────────────────────────────────
    await test.step('add_first_product', async () => {
      const target = page
        .locator('[data-testid="product-grid"]')
        .getByRole('button', { name: 'Add to Cart', exact: true })
        .first();

      await target.click();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step: cart_toast
    // Intent: Wait for "Added to cart" text
    // ─────────────────────────────────────────────────────────────────────────
    await test.step('cart_toast', async () => {
      await expect(page.getByText('Added to cart')).toBeVisible({
        timeout: 3000,
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step: open_cart
    // Intent: Navigate to /cart
    // ─────────────────────────────────────────────────────────────────────────
    await test.step('open_cart', async () => {
      await page.goto('/cart');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step: verify_cart_state
    // Intent: Verify cart has items
    // ─────────────────────────────────────────────────────────────────────────
    await test.step('verify_cart_state', async () => {
      await expect(page.locator('.cart-item')).toBeVisible();
      await expect(page.locator('body')).toContainText('1 item');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step: cart_visual
    // Intent: Screenshot "cart-with-item"
    // ─────────────────────────────────────────────────────────────────────────
    await test.step('cart_visual', async () => {
      await expect(page).toHaveScreenshot('cart-with-item.png', {
        mask: [page.locator('.timestamp')],
        maxDiffPixelRatio: 0.05,
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step: proceed_checkout
    // Intent: Click "Proceed to Checkout button"
    // ─────────────────────────────────────────────────────────────────────────
    await test.step('proceed_checkout', async () => {
      await page.getByRole('button', { name: 'Proceed to Checkout', exact: true }).click();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step: verify_checkout_state
    // Intent: Verify checkout page loaded
    // ─────────────────────────────────────────────────────────────────────────
    await test.step('verify_checkout_state', async () => {
      await expect(page).toHaveURL(/.*\/checkout.*/);
      await expect(page.locator('.order-summary')).toBeVisible();
    });
  });
});
```

### 10.4 Locator Generation Rules

```typescript
function generateLocator(locator: LocatorObject): string {
  const { preferred, scoping } = locator;

  let code = 'page';

  // Apply scoping first
  if (scoping?.within) {
    for (const scope of scoping.within) {
      code += generateLocatorStrategy(scope);
    }
  }

  // Apply preferred strategy
  code += generateLocatorStrategy(preferred);

  // Apply nth if needed
  if (scoping?.nth !== undefined) {
    if (scoping.nth === 0) {
      code += '.first()';
    } else if (scoping.nth === -1) {
      code += '.last()';
    } else {
      code += `.nth(${scoping.nth})`;
    }
  }

  return code;
}

function generateLocatorStrategy(strategy: LocatorStrategy): string {
  switch (strategy.type) {
    case 'testid':
      return `.getByTestId('${strategy.value}')`;
    case 'role':
      const opts = strategy.name
        ? `{ name: '${strategy.name}', exact: ${strategy.exact ?? true} }`
        : '';
      return `.getByRole('${strategy.role}'${opts ? ', ' + opts : ''})`;
    case 'label':
      return `.getByLabel('${strategy.text}')`;
    case 'placeholder':
      return `.getByPlaceholder('${strategy.text}')`;
    case 'text':
      return `.getByText('${strategy.text}')`;
    case 'css':
      return `.locator('${strategy.selector}')`;
  }
}
```

### 10.5 Visual Regression Generation

For screenshot steps:

```typescript
// With masks and threshold from lockfile
await expect(page).toHaveScreenshot('cart-with-item.png', {
  mask: [
    page.locator('.timestamp'),
    page.locator('.user-avatar'),
  ],
  maxDiffPixelRatio: 0.05,
});
```

Playwright handles:
- Baseline creation on first run
- Pixel diff comparison on subsequent runs
- Diff image generation on failure

### 10.6 Playwright Config Generation

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // BrowserFlow visual regression settings
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
    },
  },
});
```

---

## 11. Runtime & Runner

### 11.1 Overview

`bf run` is a wrapper around Playwright that:
- Executes generated tests
- Collects artifacts into the run folder
- Produces failure bundles for repair mode
- Prints human-friendly summaries

### 11.2 Running Tests

```bash
# Run all tests
bf run

# Run specific spec
bf run --spec checkout-cart

# Run by tag
bf run --tag smoke

# Run with parallelism
bf run --parallel 4

# Run in headed mode (for debugging)
bf run --headed

# Run with trace recording
bf run --trace on
```

### 11.3 Playwright Integration

```typescript
// bf run internally calls:
npx playwright test \
  --config e2e/playwright.config.ts \
  --reporter json \
  --output .browserflow/runs/{spec}/run-{id}/artifacts
```

### 11.4 Failure Bundles

When a test fails, BrowserFlow creates a failure bundle:

```
.browserflow/runs/{spec}/run-{id}/
├── failure.json            # Machine-readable failure info
├── artifacts/
│   ├── trace.zip           # Playwright trace
│   ├── video.webm          # Video of failure (if enabled)
│   ├── screenshots/
│   │   └── failure.png     # Screenshot at failure point
│   ├── diffs/
│   │   ├── cart-with-item-baseline.png
│   │   ├── cart-with-item-actual.png
│   │   └── cart-with-item-diff.png
│   └── logs/
│       ├── console.json
│       └── network.json
```

### 11.5 Failure JSON Schema

```typescript
interface FailureBundle {
  run_id: string;
  spec_name: string;
  failed_at: string;

  failure: {
    step_id: string;
    action: string;
    error_message: string;
    error_type: 'locator_not_found' | 'timeout' | 'assertion_failed' | 'screenshot_diff' | 'unknown';
  };

  context: {
    url: string;
    viewport: { width: number; height: number };
    browser: string;
  };

  artifacts: {
    trace?: string;
    video?: string;
    screenshot?: string;
    diff?: {
      baseline: string;
      actual: string;
      diff: string;
    };
    console_log?: string;
    network_log?: string;
  };

  // For repair suggestions
  suggestions?: RepairSuggestion[];
}

interface RepairSuggestion {
  type: 'update_locator' | 'add_wait' | 'update_assertion' | 'update_mask';
  description: string;
  confidence: number;
  patch?: object;  // Partial lockfile update
}
```

### 11.6 CLI Output

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BrowserFlow Test Results                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  checkout-cart ─────────────────────────────────────────────────────────────────│
│    ✓ add_first_product (1.2s)                                                   │
│    ✓ cart_toast (0.8s)                                                          │
│    ✓ open_cart (0.5s)                                                           │
│    ✓ verify_cart_state (0.3s)                                                   │
│    ✗ cart_visual (2.1s)                                                         │
│      Screenshot differs from baseline by 12.3%                                  │
│      → .browserflow/runs/checkout-cart/run-xxx/artifacts/diffs/                 │
│    ○ proceed_checkout (skipped)                                                 │
│    ○ verify_checkout_state (skipped)                                            │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  1 failed │ 4 passed │ 2 skipped │ 5.2s total                                   │
│                                                                                  │
│  Next steps:                                                                     │
│    • View diff: open .browserflow/runs/checkout-cart/run-xxx/artifacts/diffs/   │
│    • Accept new baseline: bf baseline accept --spec checkout-cart               │
│    • Repair test: bf repair --spec checkout-cart                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Repair Mode

### 12.1 Overview

Repair mode helps fix broken tests without re-running full exploration. It's designed for common failures:
- Locator drift (element moved/renamed)
- Timing issues (need longer waits)
- Visual changes (need baseline update)
- Assertion mismatches (need updated expected values)

### 12.2 Entry Points

```bash
# Repair specific spec (uses latest failed run)
bf repair --spec checkout-cart

# Repair from specific failure bundle
bf repair --from-run .browserflow/runs/checkout-cart/run-xxx/failure.json

# Repair with AI assistance
bf repair --spec checkout-cart --ai
```

### 12.3 Repair Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Repair Flow                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. LOAD CONTEXT                                                                 │
│     ├── Failure bundle (trace, screenshots, logs)                               │
│     ├── Original spec                                                           │
│     └── Current lockfile                                                        │
│                                                                                  │
│  2. ANALYZE FAILURE                                                              │
│     ├── Determine failure type                                                  │
│     └── Generate deterministic fix suggestions                                  │
│                                                                                  │
│  3. (OPTIONAL) AI PROPOSAL                                                       │
│     ├── Re-run failing step in headed mode                                      │
│     ├── AI inspects current DOM                                                 │
│     └── AI proposes locator/assertion updates                                   │
│                                                                                  │
│  4. HUMAN REVIEW                                                                 │
│     ├── Review UI shows proposed patch                                          │
│     ├── Human approves/modifies/rejects                                         │
│     └── Save updated lockfile                                                   │
│                                                                                  │
│  5. REGENERATE                                                                   │
│     ├── Generate new test from updated lockfile                                 │
│     └── Run locally to confirm fix                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 12.4 Deterministic Fixes

Before involving AI, attempt these fixes automatically:

| Failure Type | Deterministic Fix |
|--------------|-------------------|
| `locator_not_found` | Try fallback locators from lockfile |
| `timeout` | Increase timeout by 2x |
| `screenshot_diff` | Suggest mask for changed region |
| `assertion_failed` | Show actual vs expected, suggest update |

### 12.5 AI Proposal Mode

When `--ai` flag is used:

1. Open browser to failure point
2. Take fresh snapshot
3. AI compares:
   - Original lockfile locator
   - Current DOM state
   - Failure context
4. AI proposes patch:
   - New preferred locator
   - Updated fallbacks
   - New/modified assertions
   - Suggested masks

### 12.6 Repair UI

The Review UI includes a "Repair" tab:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BrowserFlow Repair: checkout-cart                                [Run: xyz789] │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  FAILURE SUMMARY                                                                 │
│  ───────────────                                                                 │
│  Step: cart_visual                                                               │
│  Type: screenshot_diff                                                           │
│  Error: Screenshot differs from baseline by 12.3%                                │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  [Baseline]           [Actual]             [Diff]                           ││
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                    ││
│  │  │             │     │             │     │  ░░░░░░░░░  │                    ││
│  │  │  baseline   │     │  actual     │     │  diff       │                    ││
│  │  │  image      │     │  image      │     │  highlighted│                    ││
│  │  │             │     │             │     │             │                    ││
│  │  └─────────────┘     └─────────────┘     └─────────────┘                    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  PROPOSED FIXES                                                                  │
│  ─────────────                                                                   │
│  ○ Accept new baseline (screenshot changed intentionally)                        │
│  ○ Add mask for changed region (dynamic content)                                 │
│  ○ Increase threshold to 15% (minor visual variation)                            │
│                                                                                  │
│  [Apply Fix] [Skip] [Edit Manually]                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 12.7 Repair Output

```typescript
interface RepairPatch {
  run_id: string;
  original_run_id: string;

  changes: RepairChange[];

  applied_at?: string;
  applied_by?: string;
}

interface RepairChange {
  type: 'locator_update' | 'wait_update' | 'assertion_update' | 'mask_update' | 'baseline_update';
  step_id: string;

  before: object;
  after: object;

  reason: string;
}
```

### 12.8 Repair File Location

```
.browserflow/runs/{spec}/run-{id}/repair_patch.json
```

---

## 13. Baseline Management

### 13.1 Overview

Baselines are the "golden" screenshots that visual regression tests compare against. BrowserFlow provides explicit workflow for managing baselines.

### 13.2 Baseline Commands

```bash
# Show baseline status for a spec
bf baseline status --spec checkout-cart

# Show diff gallery (opens Review UI)
bf baseline diff --spec checkout-cart

# Accept new baselines from specific run
bf baseline accept --spec checkout-cart --run-id abc123

# Accept all pending baseline updates
bf baseline accept --spec checkout-cart --all

# Update baselines from latest exploration (convenience)
bf baseline update --spec checkout-cart
```

### 13.3 Baseline Policy Controls

```yaml
# browserflow.yaml
visual:
  enabled: true
  pixel_diff_threshold: 0.05  # 5% default

  # Per-priority failure behavior
  fail_on_diff_by_priority:
    critical: true   # Fail CI on diff
    high: true
    normal: false    # Warn only
    low: false

  # Per-screenshot threshold overrides (in lockfile)
  # Allows different thresholds for different screenshots
```

### 13.4 Diff Outputs

On every visual comparison, generate:

| File | Description |
|------|-------------|
| `{name}-baseline.png` | Expected image |
| `{name}-actual.png` | Captured image |
| `{name}-diff.png` | Highlighted differences |
| `{name}-diff.json` | Machine-readable diff data |

```typescript
interface DiffSummary {
  screenshot_name: string;
  baseline_path: string;
  actual_path: string;
  diff_path: string;

  metrics: {
    diff_pixel_count: number;
    diff_pixel_ratio: number;
    threshold: number;
    passed: boolean;
  };

  masks_applied: string[];  // Locators that were masked
}
```

### 13.5 Baseline Acceptance Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  bf baseline accept --spec checkout-cart                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Pending baseline updates for: checkout-cart                                     │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ Screenshot         │ Change    │ Diff %  │ Action                        │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ cart-with-item     │ Modified  │ 8.2%    │ [Accept] [Reject] [View]      │  │
│  │ checkout-confirm   │ New       │ N/A     │ [Accept] [Reject] [View]      │  │
│  │ order-summary      │ Unchanged │ 0.0%    │ (no action needed)            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Accept 2 changes? [y/N]                                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 13.6 Baseline Metadata

When accepting baselines, store metadata:

```json
{
  "baselines/checkout-cart/cart-with-item.png": {
    "accepted_at": "2026-01-15T03:25:00Z",
    "accepted_by": "alex",
    "run_id": "run-20260115-031000-abc123",
    "previous_hash": "sha256:abc...",
    "current_hash": "sha256:def...",
    "reason": "Updated cart design"
  }
}
```

---

## 14. CLI Specification

### 14.1 Command Overview

```bash
bf <command> [options]

Commands:
  init        Initialize BrowserFlow in current project
  doctor      Check dependencies and configuration
  lint        Validate spec files
  create      Full workflow: explore → review → generate → run
  explore     Run AI exploration for a spec
  review      Launch review UI
  generate    Generate test from approved lockfile
  run         Execute tests
  repair      Fix failing tests
  baseline    Manage visual regression baselines

Global Options:
  -h, --help      Show help
  -v, --version   Show version
  --verbose       Enable verbose output
  --json          Output JSON (for scripting)
  -C, --workdir   Set working directory
```

### 14.2 Command Details

#### `bf init`

Initialize BrowserFlow in a project.

```bash
bf init [options]

Options:
  --force    Overwrite existing configuration
  --example  Create example spec

Creates:
  - browserflow.yaml (project config)
  - specs/ directory
  - .gitignore entries for .browserflow/
  - Example spec (if --example)
```

#### `bf doctor`

Check environment and dependencies.

```bash
bf doctor [options]

Options:
  --fix    Attempt to fix issues automatically

Checks:
  - Node.js version (>=18)
  - agent-browser installation
  - Playwright browsers installed
  - Configuration validity
  - Port availability (review server)
```

#### `bf lint`

Validate spec files against schema.

```bash
bf lint [options] [files...]

Options:
  --fix    Auto-fix simple issues (formatting)

Arguments:
  files    Specific files to lint (default: specs/*.yaml)

Validates:
  - Schema compliance
  - Required fields (version, name, steps, step ids)
  - Duration string format
  - Target object structure
  - No duplicate step IDs
```

#### `bf create`

Full happy-path workflow.

```bash
bf create <spec-name> [options]

Options:
  --url <url>       Base URL (overrides config)
  --headed          Run exploration in headed mode
  --skip-review     Skip review (use for CI seeding)

Flow:
  1. Validate spec exists and is valid
  2. Run exploration
  3. Open review UI, wait for approval
  4. Generate test
  5. Run test once to verify
```

#### `bf explore`

Run AI exploration only.

```bash
bf explore --spec <name> [options]

Options:
  --spec <name>     Spec to explore (required)
  --url <url>       Base URL override
  --headed          Show browser window
  --trace           Record Playwright trace
  --video           Record video
  --adapter <name>  AI adapter (default: claude)
  --max-retries <n> Max retry attempts

Output:
  .browserflow/runs/<spec>/run-<id>/exploration.json
```

#### `bf review`

Launch review UI.

```bash
bf review [options]

Options:
  --spec <name>     Spec to review (opens latest run)
  --run-id <id>     Specific run ID
  --port <port>     Server port (default: 8190)
  --no-open         Don't auto-open browser

Serves:
  http://localhost:8190/review/<spec>/<run-id>
```

#### `bf generate`

Generate test from lockfile.

```bash
bf generate --spec <name> [options]

Options:
  --spec <name>     Spec to generate (required)
  --run-id <id>     Specific run ID (default: latest approved)
  --output <dir>    Output directory (default: e2e/tests)
  --force           Overwrite existing test

Output:
  e2e/tests/<spec>.spec.ts
```

#### `bf run`

Execute tests.

```bash
bf run [options] [specs...]

Options:
  --spec <name>     Run specific spec
  --tag <tag>       Filter by tag
  --parallel <n>    Worker count
  --headed          Show browser
  --trace <mode>    Trace mode: on|off|on-first-retry
  --update-snapshots  Update visual baselines

Arguments:
  specs    Specific specs to run (default: all)
```

#### `bf repair`

Fix failing tests.

```bash
bf repair [options]

Options:
  --spec <name>         Spec to repair
  --from-run <path>     Path to failure.json
  --ai                  Use AI to propose fixes
  --apply               Auto-apply suggested fixes
  --headed              Show browser during repair

Flow:
  1. Load failure bundle
  2. Analyze failure type
  3. Generate repair suggestions
  4. Open repair UI for approval
  5. Apply patch, regenerate test
  6. Run to verify fix
```

#### `bf baseline`

Manage visual baselines.

```bash
bf baseline <subcommand> [options]

Subcommands:
  status    Show baseline state for spec
  diff      Open diff gallery in Review UI
  accept    Accept new baselines
  update    Update from latest run (convenience alias)

Options (accept):
  --spec <name>     Spec name (required)
  --run-id <id>     Accept from specific run
  --all             Accept all pending changes
  --screenshot <n>  Accept specific screenshot only
```

### 14.3 CLI UX Guidelines

| Principle | Implementation |
|-----------|----------------|
| **Crisp output** | Minimal, informative, no JSON unless `--json` |
| **Consistent formatting** | Icons, colors, indentation |
| **Next steps** | Always suggest what to do next |
| **Progress indicators** | Spinners for long operations |
| **Error messages** | Actionable, include fix suggestions |

### 14.4 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Spec validation failed |
| 4 | Exploration failed |
| 5 | Test execution failed |
| 6 | Configuration error |

---

## 15. Configuration

### 15.1 Project Configuration

```yaml
# browserflow.yaml

# Project metadata
project:
  name: my-web-app
  base_url: http://localhost:3000

# Runtime settings
runtime:
  browser: chromium              # chromium | firefox | webkit
  headless: true
  viewport:
    width: 1280
    height: 720
  timeout: 30s                   # Default step timeout
  parallel: 4                    # Playwright workers

# Locator preferences
locators:
  prefer_testid: true
  testid_attributes:             # Checked in order
    - data-testid
    - data-test
    - data-qa
  allow_fallbacks_in_ci: false   # Fail fast in CI
  require_testid_policy: false   # Warn if no testid available

# Visual regression
visual:
  enabled: true
  pixel_diff_threshold: 0.05
  fail_on_diff_by_priority:
    critical: true
    high: true
    normal: false
    low: false

# Exploration settings
exploration:
  adapter: claude
  max_retries: 3
  record_trace: true
  record_video: false

# Review UI settings
review:
  port: 8190
  auto_open: true

# Output settings
output:
  tests_dir: e2e/tests
  baselines_dir: baselines
  workspace_dir: .browserflow

# Auth state management
auth:
  default:
    type: storage_state
    path: .browserflow/auth/default.json
  # Additional auth profiles
  admin:
    type: storage_state
    path: .browserflow/auth/admin.json
```

### 15.2 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Application base URL | from config |
| `BROWSERFLOW_ADAPTER` | AI adapter override | `claude` |
| `BROWSERFLOW_HEADLESS` | Headless mode | `true` |
| `BROWSERFLOW_PARALLEL` | Worker count | `4` |
| `BROWSERFLOW_TIMEOUT` | Default timeout | `30s` |
| `CI` | CI mode detection | auto-detected |

### 15.3 Per-Spec Overrides

Specs can override project settings:

```yaml
# specs/mobile-checkout.yaml
version: 2
name: mobile-checkout

base_url: ${BASE_URL}
timeout: 3m  # Override project timeout

preconditions:
  viewport:
    width: 375
    height: 812
  # ... rest of spec
```

---

## 16. AI Adapter Interface

### 16.1 Adapter Contract

```typescript
interface AIAdapter {
  name: string;

  // Exploration: Given spec + browser state, execute steps
  explore(params: ExploreParams): Promise<ExplorationOutput>;

  // Repair proposal: Given failure bundle, suggest fixes
  proposeRepair?(params: RepairParams): Promise<RepairProposal>;
}

interface ExploreParams {
  spec: SpecYAML;
  browser: BrowserManager;  // agent-browser instance
  config: ProjectConfig;

  // Callbacks
  onStepStart?: (stepId: string) => void;
  onStepComplete?: (stepId: string, result: StepResult) => void;
  onError?: (error: Error) => void;
}

interface RepairParams {
  failure: FailureBundle;
  spec: SpecYAML;
  lockfile: Lockfile;
  browser: BrowserManager;
}

interface RepairProposal {
  changes: RepairChange[];
  confidence: number;
  reasoning: string;
}
```

### 16.2 Claude Adapter Implementation

```typescript
// packages/exploration/src/adapters/claude.ts

import Anthropic from '@anthropic-ai/sdk';
import { BrowserManager } from 'agent-browser';

export class ClaudeAdapter implements AIAdapter {
  name = 'claude';
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async explore(params: ExploreParams): Promise<ExplorationOutput> {
    const { spec, browser, config } = params;

    // Build exploration prompt
    const systemPrompt = buildExplorationSystemPrompt(config);
    const userPrompt = buildExplorationUserPrompt(spec);

    // Execute exploration via tool use
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: buildBrowserTools(browser),
    });

    // Process tool calls and build exploration output
    return processExplorationResponse(response, browser, spec);
  }

  async proposeRepair(params: RepairParams): Promise<RepairProposal> {
    // Similar pattern for repair proposals
  }
}
```

### 16.3 Adapter Guardrails

**Critical:** AI must never run during `bf run` or CI execution unless explicitly invoked via `bf repair --ai`.

```typescript
// Enforce guardrails
function ensureNotInCIMode(operation: string): void {
  if (process.env.CI && operation !== 'repair') {
    throw new Error(
      `AI operation "${operation}" is not allowed in CI mode. ` +
      `Generated tests must be deterministic.`
    );
  }
}
```

---

## 17. agent-browser Integration

### 17.1 Integration Strategy

BrowserFlow uses agent-browser **as a library** (not CLI subprocess):

```typescript
import { BrowserManager } from 'agent-browser';
import { getEnhancedSnapshot, parseRef } from 'agent-browser/snapshot';
```

### 17.2 Why Library Over CLI

| Aspect | Library | CLI Subprocess |
|--------|---------|----------------|
| Error handling | Direct exceptions | Parse stderr |
| Performance | No IPC overhead | JSON serialization |
| Type safety | Full TypeScript | Runtime validation |
| Debugging | Stack traces | Log parsing |
| LLM friendliness | Cleaner code | More moving parts |

### 17.3 Key Integration Points

#### Browser Lifecycle

```typescript
class ExplorationEngine {
  private browser: BrowserManager;

  async initialize(config: ProjectConfig): Promise<void> {
    this.browser = new BrowserManager();
    await this.browser.launch({
      headless: config.runtime.headless,
      viewport: config.runtime.viewport,
    });
  }

  async cleanup(): Promise<void> {
    await this.browser.close();
  }
}
```

#### Snapshot + Ref Resolution

```typescript
async function findElement(
  target: TargetObject,
  browser: BrowserManager
): Promise<{ ref: string; candidates: LocatorCandidate[] }> {
  // Get accessibility snapshot with refs
  const snapshot = await browser.getSnapshot({ interactive: true });

  // AI analyzes snapshot to find target
  const ref = await aiAgent.identifyElement(target, snapshot);

  // Generate candidate locators from DOM inspection
  const locator = browser.getLocatorFromRef(ref);
  const candidates = await inspectElement(locator);

  return { ref, candidates };
}
```

#### Screenshot Capture

```typescript
async function captureStepScreenshots(
  stepId: string,
  browser: BrowserManager,
  runDir: string
): Promise<{ before: string; after: string }> {
  const page = browser.getPage();

  const beforePath = path.join(runDir, 'artifacts/screenshots', `${stepId}-before.png`);
  const afterPath = path.join(runDir, 'artifacts/screenshots', `${stepId}-after.png`);

  await page.screenshot({ path: beforePath });
  // ... execute action ...
  await page.screenshot({ path: afterPath });

  return { before: beforePath, after: afterPath };
}
```

#### Trace Recording

```typescript
async function withTracing<T>(
  browser: BrowserManager,
  runDir: string,
  fn: () => Promise<T>
): Promise<T> {
  const context = browser.getPage().context();

  await context.tracing.start({
    screenshots: true,
    snapshots: true,
  });

  try {
    return await fn();
  } finally {
    await context.tracing.stop({
      path: path.join(runDir, 'artifacts/trace.zip'),
    });
  }
}
```

### 17.4 Ref System Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Ref System Lifecycle                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  EXPLORATION TIME                                                                │
│  ────────────────                                                                │
│  agent-browser ref (@e1)                                                         │
│       │                                                                          │
│       ▼                                                                          │
│  { selector: "getByRole('button', {name: 'Add', exact: true})",                 │
│    role: "button", name: "Add", nth: 0 }                                        │
│                                                                                  │
│                          │                                                       │
│                          ▼                                                       │
│                                                                                  │
│  LOCKFILE (DURABLE)                                                              │
│  ──────────────────                                                              │
│  LocatorObject {                                                                 │
│    locator_id: "add_to_cart_primary",                                           │
│    preferred: { type: "testid", value: "add-to-cart" },                         │
│    fallbacks: [                                                                  │
│      { type: "role", role: "button", name: "Add to Cart" },                     │
│      { type: "css", selector: "button.add-to-cart" }                            │
│    ],                                                                            │
│    proof: { a11y_role: "button", a11y_name: "Add to Cart", ... }                │
│  }                                                                               │
│                                                                                  │
│                          │                                                       │
│                          ▼                                                       │
│                                                                                  │
│  GENERATED TEST (DETERMINISTIC)                                                  │
│  ──────────────────────────────                                                  │
│  page.getByTestId('add-to-cart').click()                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Architecture & Monorepo Structure

### 18.1 Monorepo Layout

```
browserflow/
├── packages/
│   ├── core/                    # Shared types, schemas, utilities
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── spec-schema.ts       # Zod schemas for YAML v2
│   │   │   ├── locator-object.ts    # Locator types and resolution
│   │   │   ├── lockfile.ts          # Lockfile types
│   │   │   ├── duration.ts          # Duration string parsing
│   │   │   ├── run-store.ts         # Immutable run management
│   │   │   └── config.ts            # Configuration types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── exploration/             # AI exploration engine
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── explorer.ts          # Main exploration orchestrator
│   │   │   ├── step-executor.ts     # Execute individual steps
│   │   │   ├── evidence.ts          # Screenshot/trace capture
│   │   │   ├── locator-candidates.ts # Generate locator options
│   │   │   └── adapters/
│   │   │       ├── index.ts
│   │   │       ├── types.ts
│   │   │       └── claude.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── review-ui/               # React Review Application
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── StepTimeline.tsx
│   │   │   │   ├── StepDetail.tsx
│   │   │   │   ├── ScreenshotViewer.tsx
│   │   │   │   ├── LocatorPicker.tsx
│   │   │   │   ├── MaskEditor.tsx
│   │   │   │   ├── AssertionBuilder.tsx
│   │   │   │   ├── RepairPanel.tsx
│   │   │   │   └── BaselineDiffGallery.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useKeyboardShortcuts.ts
│   │   │   │   ├── useReviewState.ts
│   │   │   │   └── useScreenshotComparison.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           # Communicate with CLI server
│   │   │   │   └── diff.ts          # Image diff utilities
│   │   │   └── styles/
│   │   │       └── globals.css
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   │
│   ├── generator/               # Playwright test code generation
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── playwright-ts.ts     # TypeScript test generator
│   │   │   ├── locator-emit.ts      # Convert LocatorObject → code
│   │   │   ├── visual-checks.ts     # Screenshot assertion generation
│   │   │   └── config-emit.ts       # Playwright config generation
│   │   ├── templates/
│   │   │   ├── test.ts.hbs          # Handlebars template
│   │   │   └── config.ts.hbs
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                     # bf command-line tool
│       ├── src/
│       │   ├── index.ts             # Entry point
│       │   ├── commands/
│       │   │   ├── init.ts
│       │   │   ├── doctor.ts
│       │   │   ├── lint.ts
│       │   │   ├── create.ts
│       │   │   ├── explore.ts
│       │   │   ├── review.ts
│       │   │   ├── generate.ts
│       │   │   ├── run.ts
│       │   │   ├── repair.ts
│       │   │   └── baseline.ts
│       │   ├── server/
│       │   │   ├── index.ts         # Review UI server
│       │   │   └── api.ts           # API endpoints
│       │   └── ui/
│       │       ├── spinner.ts
│       │       ├── colors.ts
│       │       └── prompts.ts
│       ├── bin/
│       │   └── bf.js
│       ├── package.json
│       └── tsconfig.json
│
├── schemas/                     # JSON Schemas for validation
│   ├── spec-v2.schema.json
│   ├── browserflow.schema.json
│   ├── lockfile.schema.json
│   └── exploration.schema.json
│
├── examples/                    # Example projects
│   └── demo-app/
│       ├── specs/
│       │   └── homepage-nav.yaml
│       ├── browserflow.yaml
│       └── README.md
│
├── docs/                        # Documentation
│   ├── SPEC-v1.0.md            # This document
│   ├── getting-started.md
│   ├── configuration.md
│   └── api-reference.md
│
├── package.json                 # Workspace root
├── bun.lockb
├── tsconfig.base.json
└── README.md
```

### 18.2 Package Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Package Dependency Graph                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              @browserflow/cli                                    │
│                                    │                                             │
│                 ┌──────────────────┼──────────────────┐                          │
│                 │                  │                  │                          │
│                 ▼                  ▼                  ▼                          │
│        @browserflow/         @browserflow/    @browserflow/                      │
│         exploration           generator         review-ui                        │
│                 │                  │                  │                          │
│                 └──────────────────┼──────────────────┘                          │
│                                    │                                             │
│                                    ▼                                             │
│                            @browserflow/core                                     │
│                                    │                                             │
│                 ┌──────────────────┼──────────────────┐                          │
│                 │                  │                  │                          │
│                 ▼                  ▼                  ▼                          │
│           agent-browser      playwright-core        zod                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 18.3 Workspace Configuration

```json
// package.json (root)
{
  "name": "browserflow",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "bun run --filter '*' build",
    "test": "bun run --filter '*' test",
    "lint": "bun run --filter '*' lint",
    "typecheck": "bun run --filter '*' typecheck",
    "dev": "bun run --filter @browserflow/cli dev"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0"
  }
}
```

### 18.4 Technology Choices

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| **Runtime** | Node.js 18+ | Playwright requirement, wide adoption |
| **Package Manager** | Bun | Fast installs, native workspaces |
| **Language** | TypeScript | Type safety, IDE support |
| **Browser Automation** | agent-browser (Playwright) | Best-in-class, trace support |
| **Schema Validation** | Zod | Runtime + static types |
| **Review UI Framework** | React | Component ecosystem, shadcn/ui |
| **Review UI Styling** | Tailwind CSS | Rapid iteration, consistent design |
| **Review UI Components** | shadcn/ui | Premium look, accessible |
| **CLI Framework** | Commander.js | Simple, widely used |
| **Test Code Generation** | Handlebars | Logic-less templates |

---

## 19. Quality Principles

### 19.1 Premium UX Principles

| Principle | Description |
|-----------|-------------|
| **Progressive Disclosure** | Show what matters first; details on expand |
| **Fast Interactions** | Keyboard shortcuts everywhere; instant feedback |
| **Great Visuals** | Diff overlays, slider comparisons, clean typography |
| **Trust Building** | Every decision is explainable (why this locator, why this wait) |
| **Helpful Errors** | Every error includes suggested fix |

### 19.2 Determinism Principles

| Principle | Description |
|-----------|-------------|
| **Stable IDs** | Step IDs and screenshot names never change unless spec changes |
| **Lockfile as Truth** | Lockfile is the deterministic source for generation |
| **No Runtime AI** | Generated tests never call AI during execution |
| **Explicit Baselines** | Baselines only update via explicit acceptance |
| **Immutable Runs** | Every run creates new directory; no overwrites |

### 19.3 Code Quality

| Aspect | Standard |
|--------|----------|
| **Type Coverage** | 100% TypeScript, no `any` |
| **Error Handling** | All errors are typed and actionable |
| **Testing** | Unit tests for core logic, integration tests for CLI |
| **Documentation** | JSDoc for public APIs |
| **Linting** | ESLint + Prettier enforced |

---

## 20. Epics & Task Breakdown

### Epic A: Core Infrastructure

**Deliverables:**
- Monorepo setup with bun workspaces
- TypeScript configuration
- Shared types and schemas (Zod)
- Duration parsing utility
- Run store (immutable directories)

**Key Tasks:**
1. Initialize monorepo structure
2. Configure TypeScript paths and references
3. Implement `@browserflow/core` package
4. Define Zod schemas for spec v2
5. Implement duration parser (ms/s/m/h)
6. Implement run ID generator and directory management
7. Add JSON Schema exports for IDE validation

**Acceptance Criteria:**
- `bun install` succeeds
- `bun run build` compiles all packages
- Duration parsing handles all formats
- Run directories are created immutably

---

### Epic B: CLI Foundation

**Deliverables:**
- `bf` command with subcommands
- `bf init` creates project structure
- `bf doctor` checks environment
- `bf lint` validates specs

**Key Tasks:**
1. Set up CLI package with Commander.js
2. Implement `init` command
3. Implement `doctor` command
4. Implement `lint` command with spec validation
5. Add color output and spinner utilities
6. Add `--json` output mode

**Acceptance Criteria:**
- `bf init` creates correct structure
- `bf doctor` identifies missing dependencies
- `bf lint` catches schema violations
- Exit codes are correct

---

### Epic C: Exploration Engine

**Deliverables:**
- Exploration orchestrator using agent-browser
- Step executor for each action type
- Evidence capture (screenshots, trace, logs)
- Locator candidate generation
- Claude adapter

**Key Tasks:**
1. Integrate agent-browser as library
2. Implement step executor mapping (click, fill, wait, expect, etc.)
3. Implement screenshot capture (before/after)
4. Implement trace recording
5. Generate locator candidates from DOM inspection
6. Implement Claude adapter with tool use
7. Create exploration.json output

**Acceptance Criteria:**
- Exploration produces valid exploration.json
- Screenshots exist for configured steps
- Locator candidates include multiple strategies
- Trace files are valid Playwright traces

---

### Epic D: Review UI v1

**Deliverables:**
- React SPA with step timeline
- Screenshot viewer (4 modes)
- Approve/reject workflow
- Locator picker
- Keyboard shortcuts

**Key Tasks:**
1. Set up Vite + React + Tailwind + shadcn/ui
2. Build step timeline component with thumbnails
3. Implement screenshot viewer modes (side-by-side, slider, blink, diff)
4. Build locator picker with candidate selection
5. Implement approve/reject buttons
6. Add comment and tag fields
7. Implement keyboard shortcuts
8. Create API for saving review.json and lockfile.json
9. Build CLI server to serve UI and handle API

**Acceptance Criteria:**
- Reviewer can approve/reject all steps
- Keyboard navigation works (j/k/a/r)
- Locator locking persists to lockfile
- Review produces valid lockfile.json

---

### Epic E: Generator

**Deliverables:**
- Playwright Test TypeScript generator
- Locator-to-code conversion
- Visual regression check generation
- Playwright config generation

**Key Tasks:**
1. Implement LocatorObject → Playwright code conversion
2. Create test file template (Handlebars)
3. Implement step-by-step test generation
4. Add screenshot assertion generation with masks
5. Generate playwright.config.ts if absent
6. Store generation metadata in lockfile

**Acceptance Criteria:**
- Generated tests compile with TypeScript
- Generated tests run deterministically
- Visual checks include masks and thresholds
- Tests produce trace on failure

---

### Epic F: Runner & Failure Bundles

**Deliverables:**
- `bf run` wraps Playwright
- Failure bundle generation
- Human-friendly CLI output
- Artifact collection

**Key Tasks:**
1. Implement Playwright test runner wrapper
2. Collect artifacts into run directory
3. Generate failure.json on test failure
4. Implement CLI output formatting
5. Add "next steps" suggestions

**Acceptance Criteria:**
- `bf run` executes generated tests
- Failing tests produce complete failure bundles
- CLI output is human-friendly
- Artifacts are in correct locations

---

### Epic G: Baseline Management

**Deliverables:**
- `bf baseline status/diff/accept/update`
- Baseline diff gallery in Review UI
- Explicit acceptance workflow
- Metadata tracking

**Key Tasks:**
1. Implement baseline state detection
2. Build baseline diff gallery component
3. Implement accept flow with metadata
4. Add per-priority fail policy
5. Track acceptance history

**Acceptance Criteria:**
- Baselines never update implicitly
- `bf baseline diff` shows visual comparison
- Acceptance includes reviewer and timestamp
- Policy controls work correctly

---

### Epic H: Review UI v2 (Polish)

**Deliverables:**
- Mask editor (draw rectangles, click-to-mask)
- Assertion builder UI
- Evidence drawer (console, network)
- Repair panel

**Key Tasks:**
1. Build canvas-based mask editor
2. Implement click-to-mask from locator
3. Build assertion builder component
4. Create evidence drawer with expandable sections
5. Build repair panel for fix proposals
6. Polish animations and transitions
7. Add loading states and error boundaries

**Acceptance Criteria:**
- Masks can be drawn and adjusted
- Assertions can be added without editing JSON
- Evidence is viewable but not overwhelming
- Repair suggestions are actionable

---

### Epic I: Repair Mode

**Deliverables:**
- `bf repair` command
- Deterministic fix suggestions
- Optional AI proposal mode
- Patch application

**Key Tasks:**
1. Implement failure bundle loading
2. Implement deterministic fix analysis
3. Add AI proposal mode (Claude)
4. Build repair UI in Review app
5. Implement patch application to lockfile
6. Regenerate test after repair
7. Run verification after repair

**Acceptance Criteria:**
- Common failures can be repaired in minutes
- AI proposals are optional (--ai flag)
- Human approval required before applying
- Repaired tests pass

---

### Epic J: Documentation & Examples

**Deliverables:**
- Getting started guide
- Configuration reference
- Example project
- CI templates

**Key Tasks:**
1. Write getting started documentation
2. Document all configuration options
3. Create example demo app with specs
4. Create GitHub Actions workflow template
5. Create GitLab CI template
6. Add inline help to CLI commands

**Acceptance Criteria:**
- New user can go from install to first test in <10 minutes
- All config options are documented
- CI templates work out of the box

---

## 21. Milestones

### Milestone 1: "Working Loop"

**Goal:** Complete end-to-end flow from spec to running test.

**Includes:**
- Epic A: Core Infrastructure
- Epic B: CLI Foundation
- Epic C: Exploration Engine
- Epic D: Review UI v1 (basic)
- Epic E: Generator
- Epic F: Runner (basic)

**Definition of Done:**
- `bf create my-spec` works end-to-end
- Generated test runs deterministically
- Basic review UI allows approval

---

### Milestone 2: "Premium Visual Regression"

**Goal:** Production-quality visual regression workflow.

**Includes:**
- Epic G: Baseline Management
- Epic H: Review UI v2 (mask editor, diff modes)

**Definition of Done:**
- Visual diffs generate baseline/actual/diff
- Mask editor works for dynamic content
- Baseline acceptance is explicit and logged

---

### Milestone 3: "Repair Mode"

**Goal:** Self-healing tests via repair workflow.

**Includes:**
- Epic I: Repair Mode

**Definition of Done:**
- `bf repair` suggests fixes for common failures
- AI proposal mode works for complex repairs
- Repaired tests pass verification

---

### Milestone 4: "Production Ready"

**Goal:** Ready for external users.

**Includes:**
- Epic J: Documentation & Examples
- Performance optimization
- Error message polish
- Edge case handling

**Definition of Done:**
- Docs enable self-service onboarding
- CI templates work on major platforms
- No known critical bugs

---

## 22. Definitions of Done

A feature is **done** when it meets ALL of these criteria:

### Functionality
- [ ] Feature works as specified
- [ ] Edge cases are handled
- [ ] Error messages are actionable

### UX
- [ ] No raw JSON editing required for normal workflows
- [ ] Keyboard shortcuts work (where applicable)
- [ ] Loading states and feedback are present

### Determinism
- [ ] Generated tests produce same result on every run
- [ ] No AI calls during test execution
- [ ] Artifacts are reproducible

### Quality
- [ ] TypeScript compiles without errors
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No ESLint warnings

### Documentation
- [ ] Feature is documented
- [ ] Example usage exists
- [ ] CLI `--help` is accurate

---

## Appendix A: JSON Schemas

### A.1 Spec v2 Schema Location

```
schemas/spec-v2.schema.json
```

Schema validates:
- Required fields: `version`, `name`, `steps`
- Step structure with required `id` and `action`
- Duration string format
- Target object structure
- Action-specific fields

### A.2 Configuration Schema Location

```
schemas/browserflow.schema.json
```

Schema validates:
- Project settings
- Runtime configuration
- Locator preferences
- Visual settings
- Auth configuration

### A.3 Lockfile Schema Location

```
schemas/lockfile.schema.json
```

Schema validates:
- Locator objects
- Masks
- Assertions
- Generation metadata

### A.4 Exploration Output Schema Location

```
schemas/exploration.schema.json
```

Schema validates:
- Run identification
- App context
- Step results
- Evidence paths
- Locator candidates

---

## Appendix B: Keyboard Shortcuts Reference

### Review UI

| Key | Action |
|-----|--------|
| `j` / `↓` | Next step |
| `k` / `↑` | Previous step |
| `a` | Approve current step |
| `r` | Reject current step |
| `m` | Add mask |
| `l` | Lock locator |
| `e` | Add assertion |
| `c` | Focus comment |
| `/` | Search steps |
| `1` | Side-by-side view |
| `2` | Slider view |
| `3` | Blink view |
| `4` | Diff view |
| `Ctrl+S` | Submit review |
| `Ctrl+?` | Show shortcuts |
| `Escape` | Close modal/cancel |

---

## Appendix C: Duration String Format

### Supported Formats

| Format | Example | Milliseconds |
|--------|---------|--------------|
| Milliseconds | `500ms` | 500 |
| Seconds | `3s` | 3000 |
| Minutes | `2m` | 120000 |
| Hours | `1h` | 3600000 |
| Combined | `1m30s` | 90000 |
| Combined | `1h30m` | 5400000 |

### Parsing Implementation

```typescript
function parseDuration(input: string): number {
  const regex = /(\d+)(ms|s|m|h)/g;
  let totalMs = 0;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'ms': totalMs += value; break;
      case 's': totalMs += value * 1000; break;
      case 'm': totalMs += value * 60 * 1000; break;
      case 'h': totalMs += value * 60 * 60 * 1000; break;
    }
  }

  if (totalMs === 0) {
    throw new Error(`Invalid duration string: ${input}`);
  }

  return totalMs;
}
```

---

## Appendix D: Locator Strategy Priority

Default order of preference (configurable):

1. **data-testid** - Most stable, developer-controlled
2. **role + name** - Semantic, resilient to styling
3. **label** - Form-specific, user-facing
4. **placeholder** - Input-specific
5. **text** - Visible content, may change with i18n
6. **css** - Last resort, most brittle

### Configuring Priority

```yaml
# browserflow.yaml
locators:
  priority:
    - testid
    - role
    - label
    - placeholder
    - text
    - css
  prefer_testid: true
  testid_attributes:
    - data-testid
    - data-test
    - data-qa
```

---

*End of BrowserFlow 1.0 Product Specification*
