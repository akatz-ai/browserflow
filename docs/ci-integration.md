# CI Integration

BrowserFlow integrates seamlessly with CI/CD pipelines. This guide provides templates for GitHub Actions and GitLab CI.

## GitHub Actions

Create `.github/workflows/e2e.yml` in your repository:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Install BrowserFlow
        run: bun add -g @browserflow/cli

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: Start application
        run: |
          bun run dev &
          sleep 5

      - name: Run E2E tests
        run: bf run

      - name: Upload failure artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: browserflow-failures
          path: |
            .browserflow/runs/**/failure.json
            .browserflow/runs/**/artifacts/
          retention-days: 7
```

### Customization Options

#### Running Specific Specs

```yaml
- name: Run E2E tests
  run: bf run --spec checkout-flow --spec user-auth
```

#### Running by Tag

```yaml
- name: Run smoke tests
  run: bf run --tag smoke

- name: Run full suite
  run: bf run --tag e2e
```

#### Parallel Execution

```yaml
- name: Run E2E tests (parallel)
  run: bf run --parallel 4
```

#### With Traces

```yaml
- name: Run E2E tests with traces
  run: bf run --trace on

- name: Upload traces
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-traces
    path: .browserflow/runs/**/artifacts/trace.zip
```

### Matrix Strategy for Multiple Browsers

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Install BrowserFlow
        run: bun add -g @browserflow/cli

      - name: Install Playwright browser
        run: bunx playwright install --with-deps ${{ matrix.browser }}

      - name: Start application
        run: |
          bun run dev &
          sleep 5

      - name: Run E2E tests
        run: bf run
        env:
          BF_BROWSER: ${{ matrix.browser }}
```

### Using wait-on for Application Startup

```yaml
- name: Install wait-on
  run: bun add -g wait-on

- name: Start application
  run: bun run dev &

- name: Wait for application
  run: wait-on http://localhost:3000 --timeout 60000

- name: Run E2E tests
  run: bf run
```

## GitLab CI

Create or update `.gitlab-ci.yml` in your repository:

```yaml
stages:
  - test

e2e:
  stage: test
  image: oven/bun:latest

  before_script:
    - bun add -g @browserflow/cli
    - bunx playwright install --with-deps chromium

  script:
    - bun install
    - bun run dev &
    - sleep 5
    - bf run

  artifacts:
    when: on_failure
    paths:
      - .browserflow/runs/**/failure.json
      - .browserflow/runs/**/artifacts/
    expire_in: 1 week
```

### Customization Options

#### Running Specific Specs

```yaml
script:
  - bun install
  - bun run dev &
  - sleep 5
  - bf run --spec checkout-flow
```

#### Running by Tag

```yaml
script:
  - bun install
  - bun run dev &
  - sleep 5
  - bf run --tag smoke
```

#### Parallel Execution

```yaml
e2e:
  stage: test
  image: oven/bun:latest
  parallel: 4

  before_script:
    - bun add -g @browserflow/cli
    - bunx playwright install --with-deps chromium

  script:
    - bun install
    - bun run dev &
    - sleep 5
    - bf run --parallel $CI_NODE_TOTAL
```

#### With Traces

```yaml
script:
  - bun install
  - bun run dev &
  - sleep 5
  - bf run --trace on

artifacts:
  when: always
  paths:
    - .browserflow/runs/**/artifacts/trace.zip
  expire_in: 1 week
```

### Using Services for Database

```yaml
e2e:
  stage: test
  image: oven/bun:latest

  services:
    - postgres:15

  variables:
    POSTGRES_DB: test
    POSTGRES_USER: test
    POSTGRES_PASSWORD: test
    DATABASE_URL: postgres://test:test@postgres/test

  before_script:
    - bun add -g @browserflow/cli
    - bunx playwright install --with-deps chromium

  script:
    - bun install
    - bun run db:migrate
    - bun run dev &
    - sleep 5
    - bf run
```

## Best Practices

### 1. Cache Dependencies

**GitHub Actions:**
```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('bun.lockb') }}

- name: Cache bun dependencies
  uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: bun-${{ runner.os }}-${{ hashFiles('bun.lockb') }}
```

**GitLab CI:**
```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - ~/.cache/ms-playwright/
```

### 2. Use Environment Variables

**GitHub Actions:**
```yaml
env:
  BASE_URL: http://localhost:3000
  BF_HEADLESS: true
```

**GitLab CI:**
```yaml
variables:
  BASE_URL: http://localhost:3000
  BF_HEADLESS: "true"
```

### 3. Run Only on Relevant Changes

**GitHub Actions:**
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'specs/**'
      - 'e2e/**'
      - 'package.json'
  pull_request:
    paths:
      - 'src/**'
      - 'specs/**'
      - 'e2e/**'
      - 'package.json'
```

**GitLab CI:**
```yaml
e2e:
  rules:
    - changes:
        - src/**/*
        - specs/**/*
        - e2e/**/*
        - package.json
```

### 4. Separate Smoke and Full Tests

**GitHub Actions:**
```yaml
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      # ... setup steps ...
      - name: Run smoke tests
        run: bf run --tag smoke

  full:
    runs-on: ubuntu-latest
    needs: smoke
    if: github.ref == 'refs/heads/main'
    steps:
      # ... setup steps ...
      - name: Run full suite
        run: bf run
```

**GitLab CI:**
```yaml
smoke:
  stage: test
  script:
    - bf run --tag smoke

full:
  stage: test
  needs: [smoke]
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  script:
    - bf run
```

## Exit Codes

BrowserFlow uses specific exit codes for CI integration:

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | General error (config issues, etc.) |
| 3 | Spec validation failed (lint errors) |
| 5 | Test execution failed |

Use these codes in conditional CI steps:

```yaml
- name: Run tests
  id: tests
  run: bf run
  continue-on-error: true

- name: Handle test failures
  if: steps.tests.outcome == 'failure'
  run: |
    echo "Tests failed, uploading debug artifacts..."
    # Additional debugging steps
```

## Debugging CI Failures

When tests fail in CI:

1. **Download artifacts** - Check the failure.json for detailed error information
2. **Review traces** - Use Playwright's trace viewer (`bunx playwright show-trace trace.zip`)
3. **Check screenshots** - Visual diffs are stored in artifacts
4. **Reproduce locally** - Run with `--headed` to watch the test

```bash
# Reproduce CI failure locally
bf run --spec failed-spec --headed --trace on
```

## What's Next?

- [Getting Started](./getting-started.md) - Basic setup guide
- [Configuration Reference](./configuration.md) - Full configuration options
- [Visual Regression](./visual-regression.md) - Managing baselines in CI
