# BrowserFlow Codification Prompt

You are generating a deterministic bash test script from an approved exploration.

## Inputs

1. **Exploration report**: `explorations/<spec>/report.json`
2. **Review verdict**: `reviews/<spec>/verdict.json`
3. **Approved screenshots**: `explorations/<spec>/screenshots/`

## Output

Generate: `generated/<spec>.sh`

## Requirements

The generated test must:

1. **Be deterministic** - same result every run (no AI during execution)
2. **Use approved selectors** - exactly what worked in exploration
3. **Include appropriate waits** - based on timing from exploration
4. **Compare screenshots** - against approved baselines
5. **Handle cleanup** - close browser on success or failure
6. **Exit with correct code** - 0 for pass, non-zero for fail

## Script Template

```bash
#!/bin/bash
# BrowserFlow Generated Test: <spec_name>
# Approved by: <reviewer> @ <timestamp>
# Do not edit manually - regenerate from exploration

set -euo pipefail
source "$(dirname "$0")/../lib/browserflow.sh"

TEST_NAME="<spec_name>"
SESSION="bf-${TEST_NAME}-$$"

cleanup() { bf_close_session "$SESSION" 2>/dev/null || true; }
trap cleanup EXIT

bf_open_session "$SESSION" "$BASE_URL"
bf_wait_ready "$SESSION"

# Step 0: <description>
bf_click "$SESSION" "<approved_selector>"
bf_wait_text "$SESSION" "<expected_text>" <timeout>
bf_screenshot "$SESSION" "$SCREENSHOTS_DIR/step-00.png"
bf_compare_baseline "$SCREENSHOTS_DIR/step-00.png" "$BASELINES_DIR/step-00.png"

# ... more steps ...

bf_log_success "$TEST_NAME"
```

## Using Review Feedback

Check `reviews/<spec>/verdict.json` for:
- **Rejected steps**: Use reviewer's suggested fixes
- **Comments**: May contain selector hints
- **Tags**: `#timing` means add more wait time

## When Complete

```bash
meow done --output test_path=generated/<spec>.sh
```
