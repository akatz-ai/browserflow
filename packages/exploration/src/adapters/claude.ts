// @browserflow/exploration - Claude AI Adapter

import Anthropic from '@anthropic-ai/sdk';
import type {
  AIAdapter,
  ExploreParams,
  ExplorationOutput,
  RetryParams,
  EnhancedSnapshot,
  FindElementResult,
} from './types';

/**
 * Configuration options for the Claude adapter
 */
export interface ClaudeAdapterConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * System prompt for element finding
 */
const ELEMENT_FINDER_SYSTEM_PROMPT = `You are helping find UI elements based on natural language descriptions.
Given an accessibility snapshot of a web page, identify the element that best matches the user's description.

Rules:
1. Return the ref (like "e1", "e2") of the matching element using the select_element tool
2. If multiple elements could match, pick the most likely based on context
3. If no element matches, use ref "NOT_FOUND" with confidence 0
4. Consider the element's role, name, text content, and position in the hierarchy
5. Be precise - prefer exact matches over partial matches`;

/**
 * Tool definition for structured element selection
 */
const SELECT_ELEMENT_TOOL: Anthropic.Tool = {
  name: 'select_element',
  description: 'Select an element by its ref from the page snapshot',
  input_schema: {
    type: 'object' as const,
    properties: {
      ref: {
        type: 'string',
        description: 'Element ref like e1, e2, or NOT_FOUND if no match',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0-1 for the selection',
      },
      reasoning: {
        type: 'string',
        description: 'Explanation for why this element was selected',
      },
    },
    required: ['ref', 'confidence', 'reasoning'],
  },
};

/**
 * Claude adapter for AI-powered browser exploration
 *
 * Uses Claude's vision and reasoning capabilities to:
 * - Interpret spec steps
 * - Identify elements in browser snapshots
 * - Execute exploration workflows
 */
export class ClaudeAdapter implements AIAdapter {
  readonly name = 'claude';

  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: ClaudeAdapterConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model ?? 'claude-haiku-4-5';
    this.maxTokens = config.maxTokens ?? 8192;
  }

  /**
   * Find element from natural language query using Claude
   *
   * @param query - Natural language description of the element
   * @param snapshot - Browser snapshot with element tree and refs
   * @returns Promise resolving to element ref with reasoning
   */
  async findElement(query: string, snapshot: EnhancedSnapshot): Promise<FindElementResult> {
    const userMessage = `Find the element matching this description: "${query}"

Current page snapshot:
${snapshot.tree}

Available refs: ${Object.keys(snapshot.refs).join(', ')}

Use the select_element tool to return the ref of the best matching element.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: ELEMENT_FINDER_SYSTEM_PROMPT,
      tools: [SELECT_ELEMENT_TOOL],
      tool_choice: { type: 'tool', name: 'select_element' },
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Handle tool_use response (preferred)
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'select_element') {
        const input = block.input as { ref: string; confidence: number; reasoning: string };
        return {
          ref: input.ref,
          confidence: input.confidence,
          reasoning: input.reasoning,
        };
      }
    }

    // Fallback: parse text response if no tool_use
    for (const block of response.content) {
      if (block.type === 'text') {
        const refMatch = block.text.match(/\be(\d+)\b/);
        if (refMatch) {
          return {
            ref: refMatch[0],
            confidence: 0.7, // Lower confidence for text extraction
            reasoning: block.text,
          };
        }
      }
    }

    // No element found
    return {
      ref: 'NOT_FOUND',
      confidence: 0,
      reasoning: 'Could not extract element ref from response',
    };
  }

  /**
   * Run exploration on a spec using Claude
   *
   * Note: The primary AI method is findElement(). This explore() method is a stub
   * that returns a minimal valid structure. Full exploration is orchestrated by
   * the Explorer class which uses findElement() for AI-powered element discovery.
   *
   * @param params - Exploration parameters including spec and browser config
   * @returns Promise resolving to exploration output
   */
  async explore(params: ExploreParams): Promise<ExplorationOutput> {
    const explorationId = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      spec: params.spec.name,
      specPath: params.specPath,
      explorationId,
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

  /**
   * Retry exploration with review feedback
   *
   * Note: Currently delegates to explore(). Future enhancement could use
   * review feedback to improve element selection accuracy.
   *
   * @param params - Retry parameters including previous exploration and feedback
   * @returns Promise resolving to new exploration output
   */
  async retryWithFeedback(params: RetryParams): Promise<ExplorationOutput> {
    return this.explore(params);
  }
}
