# Spec YAML Schema (v2)

BrowserFlow specs describe **what** the user does (intent), not implementation details.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | `2` | Schema version |
| `name` | string | Kebab-case test name |
| `description` | string | What this test verifies |
| `steps` | array | Action steps |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `base_url` | string | Base URL (supports `${ENV_VAR}`) |
| `timeout` | string | Global timeout (e.g., `2m`, `30s`) |
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `tags` | array | Labels for filtering |
| `preconditions` | object | Initial state requirements |

## Step Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (kebab-case) |
| `action` | Yes | Action type |
| `name` | No | Short display name (1-4 words) for UI |
| `description` | No | What this step does |
| `why` | No | Rationale for this step |
| `target` | Depends | Element target (for interactions) |
| `value` | No | Input value (for `fill`, `type`) |
| `checks` | No | Assertions (for `expect`, `verify_state`) |
| `screenshot` | No | Screenshot options |

## Action Types

### Navigation

```yaml
- id: go-home
  action: navigate
  to: /                    # Relative or absolute URL

- id: go-back
  action: navigate
  direction: back          # or: forward, reload
```

### Click Actions

```yaml
- id: click-button
  action: click
  target: { text: "Submit" }

- id: double-click
  action: dblclick
  target: { testid: "item" }
```

### Input Actions

```yaml
- id: fill-email
  action: fill              # Clears then types
  target: { label: "Email" }
  value: "user@example.com"

- id: type-search
  action: type              # Types without clearing
  target: { placeholder: "Search..." }
  value: "query"

- id: press-enter
  action: press
  key: Enter               # or: Tab, Escape, Control+a
```

### Wait Actions

```yaml
- id: wait-modal
  action: wait
  for: element
  target: { css: ".modal" }
  timeout: 5s

- id: wait-text
  action: wait
  for: text
  text: "Success"

- id: wait-url
  action: wait
  for: url
  url_contains: "/dashboard"

- id: wait-network
  action: wait
  for: network
  state: idle              # or: load, domcontentloaded
```

### Assertion Actions

```yaml
- id: verify-visible
  action: expect
  checks:
    - visible: { target: { text: "Welcome" } }

- id: verify-state
  action: verify_state
  checks:
    - text_contains: "Success"
    - url_contains: "/dashboard"
    - element_visible: "modal"
    - element_count:
        target: { css: ".item" }
        count: 3
```

### Form Actions

```yaml
- id: check-terms
  action: check
  target: { label: "I agree" }

- id: uncheck-newsletter
  action: uncheck
  target: { label: "Subscribe" }

- id: select-country
  action: select
  target: { label: "Country" }
  value: "United States"
```

## Target Queries

Prefer intent-based queries. AI resolves them during exploration.

```yaml
# Best: Natural language (AI finds element)
target:
  query: "the submit button in the login form"

# Good: Semantic selectors
target:
  testid: "submit-btn"     # data-testid
target:
  label: "Email"           # Form label
target:
  text: "Sign In"          # Visible text
target:
  role: button
  name: "Submit"           # ARIA role + name

# Avoid: CSS selectors (fragile)
target:
  css: "form > button.primary"
```

## Checks (Assertions)

```yaml
checks:
  # Element visibility
  - visible: { target: { text: "Welcome" } }
  - hidden: { target: { css: ".loading" } }

  # Text content
  - text_contains: "Success"
  - text_equals: "Order #12345"

  # URL
  - url_contains: "/dashboard"
  - url_equals: "https://example.com/home"

  # Element count
  - element_count:
      target: { css: ".item" }
      count: 5

  # Input value
  - value_equals:
      target: { label: "Email" }
      value: "test@example.com"
```

## Screenshot Options

```yaml
- id: capture-result
  action: click
  target: { text: "Submit" }
  screenshot:
    before: true           # Capture before action
    after: true            # Capture after action
    full_page: false       # Full page vs viewport
```

## Environment Variables

Use `${VAR}` syntax for dynamic values:

```yaml
base_url: ${BASE_URL}

steps:
  - id: fill-password
    action: fill
    target: { label: "Password" }
    value: ${TEST_PASSWORD}
```

## Complete Example

```yaml
version: 2
name: checkout-flow
description: User adds item to cart and completes checkout
base_url: ${BASE_URL}
timeout: 2m
priority: critical
tags: [checkout, smoke]

preconditions:
  page: /products

steps:
  - id: add-to-cart
    name: Add To Cart
    action: click
    target:
      query: "Add to Cart button on first product"
    description: Click the Add to Cart button on the first product in the list.
    why: Core e-commerce action - validates product can be added to cart.
    screenshot: { before: true, after: true }

  - id: wait-cart-update
    name: Wait For Feedback
    action: wait
    for: text
    text: "Added to cart"
    timeout: 3s
    description: Wait for the "Added to cart" confirmation message.
    why: Confirms the cart update was successful before proceeding.

  - id: go-to-cart
    name: Go To Cart
    action: navigate
    to: /cart
    description: Navigate to the shopping cart page.
    why: User needs to review cart before checkout.

  - id: verify-item-in-cart
    name: Verify Cart Item
    action: expect
    checks:
      - visible: { target: { css: ".cart-item" } }
      - text_contains: "1 item"
    description: Verify the cart shows the added item.
    why: Ensures cart state is correct before checkout.

  - id: proceed-to-checkout
    name: Proceed To Checkout
    action: click
    target: { text: "Checkout" }
    description: Click the Checkout button to start the checkout flow.
    why: Entry point to the checkout process.

  - id: verify-checkout-page
    name: Verify Checkout Page
    action: expect
    checks:
      - url_contains: "/checkout"
      - visible: { target: { testid: "order-summary" } }
    description: Verify checkout page loaded with order summary.
    why: Confirms checkout page is accessible and displays order details.
```
