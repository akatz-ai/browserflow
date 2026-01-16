# agent-browser

**Headless browser automation CLI for AI agents. Fast Rust CLI with Node.js fallback.**

```bash
npm install -g agent-browser
```

## Overview

agent-browser is a universal browser automation tool designed for AI agents. It provides deterministic element selection via accessibility tree snapshots with refs, making it ideal for AI-driven browser automation workflows.

### Key Features

- **Universal** - Works with any AI agent: Claude Code, Cursor, Codex, Copilot, Gemini, opencode, and more
- **AI-first** - Snapshot returns accessibility tree with refs for deterministic element selection
- **Fast** - Native Rust CLI for instant command parsing
- **Complete** - 50+ commands for navigation, forms, screenshots, network, storage
- **Sessions** - Multiple isolated browser instances with separate auth
- **Cross-platform** - macOS, Linux, Windows with native binaries
- **Serverless** - Custom executable path for lightweight Chromium builds

---

## Quick Example

```bash
# Navigate and get snapshot
agent-browser open example.com
agent-browser snapshot -i

# Output:
# - heading "Example Domain" [ref=e1]
# - link "More information..." [ref=e2]

# Interact using refs
agent-browser click @e2
agent-browser screenshot page.png
agent-browser close
```

---

## Why Refs?

The `snapshot` command returns an accessibility tree where each element has a unique ref like `@e1`, `@e2`. This provides:

| Benefit | Description |
|---------|-------------|
| **Deterministic** | Ref points to exact element from snapshot |
| **Fast** | No DOM re-query needed |
| **AI-friendly** | LLMs can reliably parse and use refs |

---

## Architecture

Client-daemon architecture for optimal performance:

1. **Rust CLI** - Parses commands, communicates with daemon
2. **Node.js Daemon** - Manages Playwright browser instance

The daemon starts automatically and persists between commands.

### Platforms

Native Rust binaries for:
- macOS (ARM64, x64)
- Linux (ARM64, x64)
- Windows (x64)

---

## Installation

### npm (recommended)

```bash
npm install -g agent-browser
agent-browser install  # Download Chromium
```

### From source

```bash
git clone https://github.com/vercel-labs/agent-browser
cd agent-browser
pnpm install
pnpm build
pnpm build:native
./bin/agent-browser install
pnpm link --global
```

### Linux dependencies

On Linux, install system dependencies:

```bash
agent-browser install --with-deps
# or manually: npx playwright install-deps chromium
```

### Custom browser

Use a custom browser executable instead of bundled Chromium:

- **Serverless** - Use `@sparticuz/chromium` (~50MB vs ~684MB)
- **System browser** - Use existing Chrome installation
- **Custom builds** - Use modified browser builds

```bash
# Via flag
agent-browser --executable-path /path/to/chromium open example.com

# Via environment variable
AGENT_BROWSER_EXECUTABLE_PATH=/path/to/chromium agent-browser open example.com
```

#### Serverless example

```javascript
import chromium from '@sparticuz/chromium';
import { BrowserManager } from 'agent-browser';

export async function handler() {
  const browser = new BrowserManager();
  await browser.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  // ... use browser
}
```

---

## Quick Start

### Basic workflow

```bash
agent-browser open example.com
agent-browser snapshot                    # Get accessibility tree with refs
agent-browser click @e2                   # Click by ref from snapshot
agent-browser fill @e3 "test@example.com" # Fill by ref
agent-browser get text @e1                # Get text by ref
agent-browser screenshot page.png
agent-browser close
```

### Traditional selectors

CSS selectors and semantic locators are also supported:

```bash
agent-browser click "#submit"
agent-browser fill "#email" "test@example.com"
agent-browser find role button click --name "Submit"
```

### AI workflow (optimal)

```bash
# 1. Navigate and get snapshot
agent-browser open example.com
agent-browser snapshot -i --json   # AI parses tree and refs

# 2. AI identifies target refs from snapshot
# 3. Execute actions using refs
agent-browser click @e2
agent-browser fill @e3 "input text"

# 4. Get new snapshot if page changed
agent-browser snapshot -i --json
```

### Headed mode (debugging)

Show browser window for debugging:

```bash
agent-browser open example.com --headed
```

### JSON output

Use `--json` for machine-readable output:

```bash
agent-browser snapshot --json
agent-browser get text @e1 --json
agent-browser is visible @e2 --json
```

---

## Command Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `open <url>` | Navigate (aliases: `goto`, `navigate`) |
| `click <sel>` | Click element |
| `dblclick <sel>` | Double-click |
| `fill <sel> <text>` | Clear and fill |
| `type <sel> <text>` | Type into element |
| `press <key>` | Press key (Enter, Tab, Control+a) |
| `hover <sel>` | Hover element |
| `select <sel> <val>` | Select dropdown option |
| `check <sel>` | Check checkbox |
| `uncheck <sel>` | Uncheck checkbox |
| `scroll <dir> [px]` | Scroll (up/down/left/right) |
| `screenshot [path]` | Screenshot (`--full` for full page) |
| `snapshot` | Accessibility tree with refs |
| `eval <js>` | Run JavaScript |
| `close` | Close browser |

### Get Info

| Command | Description |
|---------|-------------|
| `get text <sel>` | Get text content |
| `get html <sel>` | Get innerHTML |
| `get value <sel>` | Get input value |
| `get attr <sel> <attr>` | Get attribute |
| `get title` | Get page title |
| `get url` | Get current URL |
| `get count <sel>` | Count matching elements |
| `get box <sel>` | Get bounding box |

### Check State

| Command | Description |
|---------|-------------|
| `is visible <sel>` | Check if visible |
| `is enabled <sel>` | Check if enabled |
| `is checked <sel>` | Check if checked |

### Find Elements

Semantic locators with actions (`click`, `fill`, `check`, `hover`, `text`):

```bash
agent-browser find role <role> <action> [value]
agent-browser find text <text> <action>
agent-browser find label <label> <action> [value]
agent-browser find placeholder <ph> <action> [value]
agent-browser find testid <id> <action> [value]
agent-browser find first <sel> <action> [value]
agent-browser find nth <n> <sel> <action> [value]
```

**Examples:**

```bash
agent-browser find role button click --name "Submit"
agent-browser find label "Email" fill "test@test.com"
agent-browser find first ".item" click
```

### Wait Commands

| Command | Description |
|---------|-------------|
| `wait <selector>` | Wait for element |
| `wait <ms>` | Wait for time |
| `wait --text "Welcome"` | Wait for text |
| `wait --url "**/dash"` | Wait for URL pattern |
| `wait --load networkidle` | Wait for load state |
| `wait --fn "condition"` | Wait for JS condition |

### Mouse Commands

| Command | Description |
|---------|-------------|
| `mouse move <x> <y>` | Move mouse |
| `mouse down [button]` | Press button |
| `mouse up [button]` | Release button |
| `mouse wheel <dy> [dx]` | Scroll wheel |

### Settings Commands

| Command | Description |
|---------|-------------|
| `set viewport <w> <h>` | Set viewport size |
| `set device <name>` | Emulate device ("iPhone 14") |
| `set geo <lat> <lng>` | Set geolocation |
| `set offline [on\|off]` | Toggle offline mode |
| `set headers <json>` | Extra HTTP headers |
| `set credentials <u> <p>` | HTTP basic auth |
| `set media [dark\|light]` | Emulate color scheme |

### Cookies & Storage

```bash
# Cookies
agent-browser cookies                     # Get all cookies
agent-browser cookies set <name> <val>    # Set cookie
agent-browser cookies clear               # Clear cookies

# localStorage
agent-browser storage local               # Get all localStorage
agent-browser storage local <key>         # Get specific key
agent-browser storage local set <k> <v>   # Set value
agent-browser storage local clear         # Clear all

# sessionStorage (same syntax)
agent-browser storage session
agent-browser storage session <key>
agent-browser storage session set <k> <v>
agent-browser storage session clear
```

### Network Commands

| Command | Description |
|---------|-------------|
| `network route <url>` | Intercept requests |
| `network route <url> --abort` | Block requests |
| `network route <url> --body <json>` | Mock response |
| `network unroute [url]` | Remove routes |
| `network requests` | View tracked requests |

### Tabs & Frames

| Command | Description |
|---------|-------------|
| `tab` | List tabs |
| `tab new [url]` | New tab |
| `tab <n>` | Switch to tab |
| `tab close [n]` | Close tab |
| `frame <sel>` | Switch to iframe |
| `frame main` | Back to main frame |

### Debug Commands

| Command | Description |
|---------|-------------|
| `trace start [path]` | Start trace |
| `trace stop [path]` | Stop and save trace |
| `console` | View console messages |
| `errors` | View page errors |
| `highlight <sel>` | Highlight element |
| `state save <path>` | Save auth state |
| `state load <path>` | Load auth state |

### Navigation

| Command | Description |
|---------|-------------|
| `back` | Go back |
| `forward` | Go forward |
| `reload` | Reload page |

---

## Selectors

### Refs (recommended for AI)

Refs provide deterministic element selection from snapshots. Best for AI agents.

```bash
# 1. Get snapshot with refs
agent-browser snapshot
# Output:
# - heading "Example Domain" [ref=e1] [level=1]
# - button "Submit" [ref=e2]
# - textbox "Email" [ref=e3]
# - link "Learn more" [ref=e4]

# 2. Use refs to interact
agent-browser click @e2                   # Click the button
agent-browser fill @e3 "test@example.com" # Fill the textbox
agent-browser get text @e1                # Get heading text
agent-browser hover @e4                   # Hover the link
```

### CSS Selectors

```bash
agent-browser click "#id"
agent-browser click ".class"
agent-browser click "div > button"
agent-browser click "[data-testid='submit']"
```

### Text & XPath

```bash
agent-browser click "text=Submit"
agent-browser click "xpath=//button[@type='submit']"
```

### Semantic Locators

Find elements by role, label, or other semantic properties:

```bash
agent-browser find role button click --name "Submit"
agent-browser find label "Email" fill "test@test.com"
agent-browser find placeholder "Search..." fill "query"
agent-browser find testid "submit-btn" click
```

---

## Sessions

Run multiple isolated browser instances:

```bash
# Different sessions
agent-browser --session agent1 open site-a.com
agent-browser --session agent2 open site-b.com

# Or via environment variable
AGENT_BROWSER_SESSION=agent1 agent-browser click "#btn"

# List active sessions
agent-browser session list
# Output:
# Active sessions:
# -> default
#    agent1

# Show current session
agent-browser session
```

### Session Isolation

Each session has its own:
- Browser instance
- Cookies and storage
- Navigation history
- Authentication state

### Authenticated Sessions

Use `--headers` to set HTTP headers for a specific origin:

```bash
# Headers scoped to api.example.com only
agent-browser open api.example.com --headers '{"Authorization": "Bearer <token>"}'

# Requests to api.example.com include the auth header
agent-browser snapshot -i --json
agent-browser click @e2

# Navigate to another domain - headers NOT sent
agent-browser open other-site.com
```

**Use cases:**
- Skipping login flows - Authenticate via headers
- Switching users - Different auth tokens per session
- API testing - Access protected endpoints
- Security - Headers scoped to origin, not leaked

### Multiple Origins

```bash
agent-browser open api.example.com --headers '{"Authorization": "Bearer token1"}'
agent-browser open api.acme.com --headers '{"Authorization": "Bearer token2"}'
```

### Global Headers

For headers on all domains:

```bash
agent-browser set headers '{"X-Custom-Header": "value"}'
```

---

## Snapshots

The `snapshot` command returns the accessibility tree with refs for AI-friendly interaction.

### Options

| Option | Description |
|--------|-------------|
| `-i, --interactive` | Only interactive elements (buttons, links, inputs) |
| `-c, --compact` | Remove empty structural elements |
| `-d, --depth` | Limit tree depth |
| `-s, --selector` | Scope to CSS selector |

**Filter output to reduce size:**

```bash
agent-browser snapshot                    # Full accessibility tree
agent-browser snapshot -i                 # Interactive elements only
agent-browser snapshot -c                 # Compact (remove empty elements)
agent-browser snapshot -d 3               # Limit depth to 3 levels
agent-browser snapshot -s "#main"         # Scope to CSS selector
agent-browser snapshot -i -c -d 5         # Combine options
```

### Output Format

```bash
agent-browser snapshot
# Output:
# - heading "Example Domain" [ref=e1] [level=1]
# - button "Submit" [ref=e2]
# - textbox "Email" [ref=e3]
# - link "Learn more" [ref=e4]
```

### JSON Output

```bash
agent-browser snapshot --json
# {"success":true,"data":{"snapshot":"...","refs":{"e1":{"role":"heading","name":"Title"},...}}}
```

### Best Practices

- Use `-i` to reduce output to actionable elements
- Use `--json` for structured parsing
- Re-snapshot after page changes to get updated refs
- Scope with `-s` for specific page sections

---

## Streaming

Stream the browser viewport via WebSocket for live preview or "pair browsing" where a human can watch and interact alongside an AI agent.

### Enable Streaming

Set the `AGENT_BROWSER_STREAM_PORT` environment variable to start a WebSocket server:

```bash
AGENT_BROWSER_STREAM_PORT=9223 agent-browser open example.com
```

The server streams viewport frames and accepts input events (mouse, keyboard, touch).

### WebSocket Protocol

Connect to `ws://localhost:9223` to receive frames and send input.

#### Frame Messages

The server sends frame messages with base64-encoded images:

```json
{
  "type": "frame",
  "data": "<base64-encoded-jpeg>",
  "metadata": {
    "deviceWidth": 1280,
    "deviceHeight": 720,
    "pageScaleFactor": 1,
    "offsetTop": 0,
    "scrollOffsetX": 0,
    "scrollOffsetY": 0
  }
}
```

#### Status Messages

```json
{
  "type": "status",
  "connected": true,
  "screencasting": true,
  "viewportWidth": 1280,
  "viewportHeight": 720
}
```

### Input Injection

Send input events to control the browser remotely.

#### Mouse Events

```javascript
// Click
{
  "type": "input_mouse",
  "eventType": "mousePressed",
  "x": 100,
  "y": 200,
  "button": "left",
  "clickCount": 1
}

// Release
{
  "type": "input_mouse",
  "eventType": "mouseReleased",
  "x": 100,
  "y": 200,
  "button": "left"
}

// Move
{
  "type": "input_mouse",
  "eventType": "mouseMoved",
  "x": 150,
  "y": 250
}

// Scroll
{
  "type": "input_mouse",
  "eventType": "mouseWheel",
  "x": 100,
  "y": 200,
  "deltaX": 0,
  "deltaY": 100
}
```

#### Keyboard Events

```javascript
// Key down
{
  "type": "input_keyboard",
  "eventType": "keyDown",
  "key": "Enter",
  "code": "Enter"
}

// Key up
{
  "type": "input_keyboard",
  "eventType": "keyUp",
  "key": "Enter",
  "code": "Enter"
}

// Type character
{
  "type": "input_keyboard",
  "eventType": "char",
  "text": "a"
}

// With modifiers (1=Alt, 2=Ctrl, 4=Meta, 8=Shift)
{
  "type": "input_keyboard",
  "eventType": "keyDown",
  "key": "c",
  "code": "KeyC",
  "modifiers": 2
}
```

#### Touch Events

```javascript
// Touch start
{
  "type": "input_touch",
  "eventType": "touchStart",
  "touchPoints": [{ "x": 100, "y": 200 }]
}

// Touch move
{
  "type": "input_touch",
  "eventType": "touchMove",
  "touchPoints": [{ "x": 150, "y": 250 }]
}

// Touch end
{
  "type": "input_touch",
  "eventType": "touchEnd",
  "touchPoints": []
}

// Multi-touch (pinch zoom)
{
  "type": "input_touch",
  "eventType": "touchStart",
  "touchPoints": [
    { "x": 100, "y": 200, "id": 0 },
    { "x": 200, "y": 200, "id": 1 }
  ]
}
```

### Programmatic API

For advanced use, control streaming directly via the TypeScript API:

```typescript
import { BrowserManager } from 'agent-browser';

const browser = new BrowserManager();
await browser.launch({ headless: true });
await browser.navigate('https://example.com');

// Start screencast with callback
await browser.startScreencast((frame) => {
  console.log('Frame:', frame.metadata.deviceWidth, 'x', frame.metadata.deviceHeight);
  // frame.data is base64-encoded image
}, {
  format: 'jpeg',  // or 'png'
  quality: 80,     // 0-100, jpeg only
  maxWidth: 1280,
  maxHeight: 720,
  everyNthFrame: 1
});

// Inject mouse event
await browser.injectMouseEvent({
  type: 'mousePressed',
  x: 100,
  y: 200,
  button: 'left',
  clickCount: 1
});

// Inject keyboard event
await browser.injectKeyboardEvent({
  type: 'keyDown',
  key: 'Enter',
  code: 'Enter'
});

// Inject touch event
await browser.injectTouchEvent({
  type: 'touchStart',
  touchPoints: [{ x: 100, y: 200 }]
});

// Check if screencasting
console.log('Active:', browser.isScreencasting());

// Stop screencast
await browser.stopScreencast();
```

### Use Cases

- **Pair browsing** - Human watches and assists AI agent in real-time
- **Remote preview** - View browser output in a separate UI
- **Recording** - Capture frames for video generation
- **Mobile testing** - Inject touch events for mobile emulation
- **Accessibility testing** - Manual interaction during automated tests

---

## Agent Mode

agent-browser works with any AI coding agent. Use `--json` for machine-readable output.

### Compatible Agents

- Claude Code
- Cursor
- GitHub Copilot
- OpenAI Codex
- Google Gemini
- opencode
- Any agent that can run shell commands

### JSON Output

```bash
agent-browser snapshot --json
# {"success":true,"data":{"snapshot":"...","refs":{...}}}

agent-browser get text @e1 --json
agent-browser is visible @e2 --json
```

### Optimal Workflow

```bash
# 1. Navigate and get snapshot
agent-browser open example.com
agent-browser snapshot -i --json   # AI parses tree and refs

# 2. AI identifies target refs from snapshot
# 3. Execute actions using refs
agent-browser click @e2
agent-browser fill @e3 "input text"

# 4. Get new snapshot if page changed
agent-browser snapshot -i --json
```

### Integration

#### Just Ask

The simplest approach:

```
Use agent-browser to test the login flow. Run agent-browser --help to see available commands.
```

The `--help` output is comprehensive.

#### AGENTS.md / CLAUDE.md

For consistent results, add to your instructions file:

```markdown
## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
```

#### Claude Code Skill

For richer context:

```bash
cp -r node_modules/agent-browser/skills/agent-browser .claude/skills/
```

Or download:

```bash
mkdir -p .claude/skills/agent-browser
curl -o .claude/skills/agent-browser/SKILL.md \
  https://raw.githubusercontent.com/vercel-labs/agent-browser/main/skills/agent-browser/SKILL.md
```

---

## CDP Mode

Connect to an existing browser via Chrome DevTools Protocol:

```bash
# Connect to Electron app
agent-browser --cdp 9222 snapshot

# Connect to Chrome with remote debugging
# (Start Chrome with: google-chrome --remote-debugging-port=9222)
agent-browser --cdp 9222 open about:blank
```

### Use Cases

This enables control of:
- Electron apps
- Chrome/Chromium with remote debugging
- WebView2 applications
- Any browser exposing a CDP endpoint

---

## Global Options

| Option | Description |
|--------|-------------|
| `--session <name>` | Use isolated session |
| `--headers <json>` | HTTP headers scoped to origin |
| `--executable-path` | Custom browser executable |
| `--json` | JSON output for agents |
| `--full, -f` | Full page screenshot |
| `--name, -n` | Locator name filter |
| `--exact` | Exact text match |
| `--headed` | Show browser window |
| `--cdp <port>` | CDP connection port |
| `--debug` | Debug output |

---

## BrowserFlow Integration

In the BrowserFlow framework, `agent-browser` is used during the **Exploration Phase** to:

1. Navigate to target URLs
2. Take snapshots to discover interactive elements
3. Capture screenshots for human review
4. Execute test steps using refs for deterministic selection

The refs-based approach aligns with BrowserFlow's goal of creating deterministic, CI-ready test scripts that don't require AI tokens at runtime.
