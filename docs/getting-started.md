# Getting Started with BrowserFlow

This guide will help you go from zero to running your first BrowserFlow test in under 10 minutes.

## Prerequisites

- Node.js 18+
- [Bun](https://bun.sh) package manager
- A web application to test

## Installation

```bash
# Install BrowserFlow CLI globally
bun add -g @browserflow/cli

# Install Playwright browsers
bunx playwright install chromium
```

## Quick Start

### 1. Initialize Your Project

Navigate to your web application directory and initialize BrowserFlow:

```bash
cd your-web-app
bf init --example
```

This creates:
- `browserflow.yaml` - Project configuration
- `specs/` - Directory for your test specs
- `specs/example.yaml` - An example spec to get started
- Updates `.gitignore` to exclude runtime directories

### 2. Check Your Setup

Verify your environment is correctly configured:

```bash
bf doctor
```

This checks:
- Node.js version (18+ required)
- agent-browser installation
- Playwright browsers
- Project configuration
- Review port availability

If anything fails, follow the fix hints provided.

### 3. Write Your First Spec

Edit `specs/example.yaml` or create a new spec file:

```yaml
# specs/homepage.yaml
version: 2
name: homepage-test
description: Verify homepage loads correctly

steps:
  - id: visit_home
    action: navigate
    to: /

  - id: check_hero
    action: expect
    state: visible
    target: { css: "h1" }

  - id: homepage_screenshot
    action: screenshot
    name: homepage

tags:
  - smoke
  - homepage
```

### 4. Validate Your Spec

Ensure your spec is valid before running:

```bash
bf lint
```

This validates all specs in the `specs/` directory against the BrowserFlow schema. Fix any errors before proceeding.

### 5. Run Your Tests

Start your application, then run the tests:

```bash
# Terminal 1: Start your app
bun run dev

# Terminal 2: Run tests
bf run --spec homepage-test
```

**Common options:**
- `--spec <name>` - Run a specific spec
- `--tag <tag>` - Filter by tag
- `--parallel <n>` - Number of parallel workers
- `--headed` - Show the browser window
- `--trace on` - Enable Playwright traces

### 6. Manage Visual Baselines

After running tests, you can manage visual regression baselines:

```bash
# Check baseline status
bf baseline status --spec homepage-test

# Accept screenshots as new baselines
bf baseline accept --spec homepage-test --all

# View differences
bf baseline diff --spec homepage-test
```

## Project Structure

After initialization, your project will have:

```
your-project/
├── browserflow.yaml      # Project configuration
├── specs/                # Test specifications
│   └── example.yaml
├── .browserflow/         # Runtime directory (gitignored)
│   ├── runs/             # Test run artifacts
│   └── baselines/        # Visual regression baselines
└── e2e/                  # Generated Playwright tests
    └── tests/
```

## Configuration

The `browserflow.yaml` file controls BrowserFlow behavior:

```yaml
project:
  name: my-project
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
    - data-test

exploration:
  adapter: claude
  max_retries: 3

review:
  port: 8190
  auto_open: true

output:
  tests_dir: e2e/tests
  baselines_dir: baselines
```

## Troubleshooting

### "Command not found: bf"

Ensure the CLI is installed globally:

```bash
bun add -g @browserflow/cli
```

Or run via bunx:

```bash
bunx @browserflow/cli init
```

### "No browserflow.yaml found"

Run `bf init` to create the configuration file:

```bash
bf init
```

### Playwright browsers not installed

Install the required browser:

```bash
bunx playwright install chromium
```

For CI environments, include system dependencies:

```bash
bunx playwright install --with-deps chromium
```

### Tests timing out

1. Check that your application is running at the configured `base_url`
2. Increase the timeout in `browserflow.yaml`:
   ```yaml
   runtime:
     timeout: 60s
   ```

### Spec validation errors

Run `bf lint` to see detailed error messages with line numbers. Common issues:
- Missing required `id` on steps
- Invalid duration format (use `3s`, `2m`, `500ms`)
- Name not in kebab-case

## CLI Reference

| Command | Description |
|---------|-------------|
| `bf init` | Initialize BrowserFlow in current directory |
| `bf doctor` | Check environment and dependencies |
| `bf lint` | Validate spec files |
| `bf run` | Execute tests via Playwright |
| `bf baseline status` | Show visual baseline status |
| `bf baseline accept` | Accept new baselines |
| `bf baseline update` | Update baselines from latest run |
| `bf baseline diff` | View baseline differences |
| `bf repair` | Fix broken tests using failure bundles |

## What's Next?

- [Configuration Reference](./configuration.md) - Full configuration options
- [Spec Format Reference](./spec-format.md) - Complete spec syntax
- [CI Integration](./ci-integration.md) - GitHub Actions and GitLab CI templates
- [Visual Regression](./visual-regression.md) - Managing baselines
