# AI Adapters

BrowserFlow uses pluggable AI adapters for element finding during exploration.

## Built-in Adapters

| Adapter | Flag | Requirements | Description |
|---------|------|--------------|-------------|
| `claude` | `--adapter claude` | `ANTHROPIC_API_KEY` | Direct Anthropic SDK calls |
| `claude-cli` | `--adapter claude-cli` | `claude` CLI installed | Uses existing Claude Code auth |

## Usage

```bash
# Default: SDK adapter (requires API key)
bf explore --spec login --url http://localhost:3000

# CLI adapter (uses claude CLI authentication)
bf explore --spec login --url http://localhost:3000 --adapter claude-cli
```

## When to Use Each

**`claude` (SDK)**
- Direct API access with faster response
- Requires `ANTHROPIC_API_KEY` environment variable
- Best for CI/CD or automated pipelines

**`claude-cli`**
- No API key needed - uses existing Claude Code authentication
- Good for local development when you have Claude Code installed
- Spawns `claude --model haiku -p "..."` for each element lookup

## Creating Custom Adapters

Implement the `AIAdapter` interface from `@browserflow-ai/exploration`:

```typescript
import type {
  AIAdapter,
  EnhancedSnapshot,
  FindElementResult,
  ExploreParams,
  ExplorationOutput
} from '@browserflow-ai/exploration';

export interface MyAdapterConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
}

export class MyAdapter implements AIAdapter {
  readonly name = 'my-adapter';

  constructor(private config: MyAdapterConfig) {}

  /**
   * Find an element matching a natural language query.
   *
   * @param query - Natural language description (e.g., "Submit button in login form")
   * @param snapshot - Page snapshot with accessibility tree and element refs
   * @returns Element reference or NOT_FOUND
   */
  async findElement(
    query: string,
    snapshot: EnhancedSnapshot
  ): Promise<FindElementResult> {
    // snapshot.tree - Accessibility tree as string
    // snapshot.refs - Element references like { e1: { role, name, selector } }

    const prompt = `
Given this accessibility tree:
${snapshot.tree}

Find the element matching: "${query}"

Respond with JSON: { "ref": "eX", "confidence": 0.0-1.0, "reasoning": "..." }
If not found: { "ref": "NOT_FOUND", "confidence": 0, "reasoning": "..." }
`;

    // Call your LLM
    const response = await this.callLLM(prompt);
    const result = JSON.parse(response);

    return {
      ref: result.ref,           // 'e1', 'e2', or 'NOT_FOUND'
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  }

  /**
   * Explore a spec (optional - Explorer orchestrates this).
   * Return minimal structure; Explorer handles the full workflow.
   */
  async explore(params: ExploreParams): Promise<ExplorationOutput> {
    return {
      spec: params.spec.name,
      specPath: params.specPath,
      explorationId: `exp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      browser: params.browser ?? 'chromium',
      viewport: params.viewport ?? { width: 1280, height: 720 },
      baseUrl: params.baseUrl,
      steps: [],
      outcomeChecks: [],
      overallStatus: 'completed',
      errors: [],
    };
  }

  private async callLLM(prompt: string): Promise<string> {
    // Implementation depends on your LLM provider
    throw new Error('Implement callLLM');
  }
}
```

## Interface Types

```typescript
interface EnhancedSnapshot {
  tree: string;              // Accessibility tree (formatted text)
  refs: {
    [ref: string]: {
      selector: string;      // Playwright locator
      role: string;          // ARIA role
      name: string;          // Accessible name
      // Additional metadata
    };
  };
}

interface FindElementResult {
  ref: string;               // Element ref (e.g., 'e1') or 'NOT_FOUND'
  confidence: number;        // 0.0 to 1.0
  reasoning: string;         // Explanation
}

interface ExploreParams {
  spec: Spec;                // Parsed spec YAML
  specPath: string;
  baseUrl: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  viewport?: { width: number; height: number };
}
```

## Registering Custom Adapters

### In BrowserFlow Source

1. Create adapter file: `packages/exploration/src/adapters/my-adapter.ts`

2. Export from index: `packages/exploration/src/adapters/index.ts`
   ```typescript
   export { MyAdapter } from './my-adapter';
   export type { MyAdapterConfig } from './my-adapter';
   ```

3. Export from package: `packages/exploration/src/index.ts`
   ```typescript
   export { MyAdapter, type MyAdapterConfig } from './adapters';
   ```

4. Register in CLI: `packages/cli/src/commands/explore.ts`
   ```typescript
   function createAdapter(name: string): AIAdapter {
     switch (name) {
       case 'claude':
         return new ClaudeAdapter();
       case 'claude-cli':
         return new ClaudeCliAdapter();
       case 'my-adapter':
         return new MyAdapter({ apiKey: process.env.MY_API_KEY! });
       default:
         throw new Error(`Unknown adapter: ${name}`);
     }
   }
   ```

### Using Programmatically

```typescript
import { Explorer, MyAdapter } from '@browserflow-ai/exploration';

const adapter = new MyAdapter({
  apiKey: process.env.MY_API_KEY!,
  model: 'gpt-4',
});

const explorer = new Explorer(adapter);
const result = await explorer.explore({
  spec: parsedSpec,
  specPath: 'specs/login.yaml',
  baseUrl: 'http://localhost:3000',
});
```

## Example: OpenAI Adapter

```typescript
import OpenAI from 'openai';
import type { AIAdapter, EnhancedSnapshot, FindElementResult } from '@browserflow-ai/exploration';

export class OpenAIAdapter implements AIAdapter {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  }

  async findElement(query: string, snapshot: EnhancedSnapshot): Promise<FindElementResult> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'user',
        content: `Given this accessibility tree:\n${snapshot.tree}\n\nFind: "${query}"\n\nRespond with JSON only: {"ref":"eX","confidence":0.9,"reasoning":"..."}`
      }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return {
      ref: result.ref,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }

  async explore(params: ExploreParams): Promise<ExplorationOutput> {
    // Minimal stub - Explorer handles orchestration
    return {
      spec: params.spec.name,
      specPath: params.specPath,
      explorationId: `exp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      browser: params.browser ?? 'chromium',
      viewport: params.viewport ?? { width: 1280, height: 720 },
      baseUrl: params.baseUrl,
      steps: [],
      outcomeChecks: [],
      overallStatus: 'completed',
      errors: [],
    };
  }
}
```
