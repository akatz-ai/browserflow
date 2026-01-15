# BrowserFlow Exploration Prompt

You are exploring a web UI to generate an E2E test based on a YAML specification.

## Your Task

1. **Read the spec file** to understand the user workflow being tested
2. **Open a browser session** to the target URL
3. **Execute each step** in the spec, taking screenshots before and after
4. **Record element refs** discovered during exploration
5. **Note any issues** (timing, ambiguous elements, failures)
6. **Generate exploration report** with all findings

## Available Commands

```bash
# Browser session management
agent-browser open <url> --session <name>
agent-browser close --session <name>

# Element interaction
agent-browser click @<ref> --session <name>
agent-browser click "<selector>" --session <name>
agent-browser find text "<text>" click --session <name>
agent-browser fill @<ref> "<value>" --session <name>

# Inspection
agent-browser snapshot -i --json --session <name>
agent-browser screenshot <path> --session <name>

# Waiting
agent-browser wait "<selector>" --timeout <ms> --session <name>
agent-browser wait --text "<text>" --timeout <ms> --session <name>
```

## Exploration Report Format

Save your report to `explorations/<spec_name>/report.json`:

```json
{
  "spec": "<spec_name>",
  "exploration_id": "exp-<timestamp>-<random>",
  "timestamp": "<ISO8601>",
  "steps": [
    {
      "step_index": 0,
      "spec_action": { /* from spec */ },
      "execution": {
        "status": "completed|failed|skipped",
        "method": "how you found/clicked the element",
        "element_ref": "@eXX",
        "duration_ms": 1234,
        "error": null
      },
      "screenshots": {
        "before": "screenshots/step-00-before.png",
        "after": "screenshots/step-00-after.png"
      }
    }
  ],
  "overall_status": "completed|failed"
}
```

## Important Guidelines

1. **Take screenshots at every step** - humans will review these
2. **Record exact selectors/refs** - needed for codification
3. **Note timing** - how long waits took
4. **Be explicit about failures** - don't hide errors
5. **Use natural language queries** when spec uses `query:` field
6. **Fallback gracefully** - try multiple selection strategies

## When Complete

Signal completion with:
```bash
meow done --output exploration_id=<id> --output status=<status>
```
