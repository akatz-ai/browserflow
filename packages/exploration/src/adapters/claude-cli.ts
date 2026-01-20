// @browserflow/exploration - Claude CLI Adapter
// Uses the `claude` CLI tool instead of the Anthropic SDK
// This allows users to leverage their existing Claude Code authentication

import { spawn } from 'node:child_process';

// Debug flag - set via BF_DEBUG=1 environment variable
const DEBUG = process.env.BF_DEBUG === '1';

function debug(...args: unknown[]): void {
  if (DEBUG) {
    console.error('[claude-cli]', ...args);
  }
}
import type {
  AIAdapter,
  ExploreParams,
  ExplorationOutput,
  RetryParams,
  EnhancedSnapshot,
  FindElementResult,
} from './types';

/**
 * Configuration options for the Claude CLI adapter
 */
export interface ClaudeCliAdapterConfig {
  /** Model to use (default: haiku) */
  model?: string;
  /** Path to claude CLI executable (default: 'claude') */
  cliPath?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * System prompt for element finding - embedded in the user prompt
 */
const ELEMENT_FINDER_PROMPT = `You are helping find UI elements based on natural language descriptions.
Given an accessibility snapshot of a web page, identify the element that best matches the user's description.

Rules:
1. Return the ref (like "e1", "e2") of the matching element
2. If multiple elements could match, pick the most likely based on context
3. If no element matches, use ref "NOT_FOUND" with confidence 0
4. Consider the element's role, name, text content, and position in the hierarchy
5. Be precise - prefer exact matches over partial matches`;

/**
 * Claude CLI adapter for AI-powered browser exploration
 *
 * Uses the `claude` CLI tool to make LLM calls, allowing users to:
 * - Use their existing Claude Code authentication
 * - Leverage local CLI configuration
 * - Avoid managing API keys separately
 */
export class ClaudeCliAdapter implements AIAdapter {
  readonly name = 'claude-cli';

  private model: string;
  private cliPath: string;
  private timeout: number;

  constructor(config: ClaudeCliAdapterConfig = {}) {
    this.model = config.model ?? 'haiku';
    this.cliPath = config.cliPath ?? 'claude';
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Execute claude CLI with a prompt and return the response
   */
  private async runClaude(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Note: --dangerously-skip-permissions is required for non-interactive mode
      // because the CLI may otherwise wait for trust/permission dialogs
      const args = ['--model', this.model, '--dangerously-skip-permissions', '-p', prompt];

      debug('Spawning CLI:', this.cliPath, args.slice(0, 2).join(' '), '...');
      debug('Prompt length:', prompt.length, 'chars');
      const startTime = Date.now();

      const proc = spawn(this.cliPath, args, {
        // stdin must be 'ignore' - otherwise claude CLI waits for input
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        debug('stdout chunk:', data.toString().slice(0, 100));
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        debug('stderr chunk:', data.toString().slice(0, 200));
      });

      proc.on('error', (err: Error) => {
        debug('spawn error:', err.message);
        reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
      });

      proc.on('close', (code: number | null) => {
        const elapsed = Date.now() - startTime;
        debug('CLI exited with code', code, 'after', elapsed, 'ms');
        debug('stdout length:', stdout.length, 'stderr length:', stderr.length);

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`claude CLI exited with code ${code}: ${stderr}`));
        }
      });

      // Handle timeout
      const timer = setTimeout(() => {
        debug('TIMEOUT after', this.timeout, 'ms - killing process');
        proc.kill('SIGTERM');
        reject(new Error(`claude CLI timed out after ${this.timeout}ms`));
      }, this.timeout);

      proc.on('close', () => clearTimeout(timer));
    });
  }

  /**
   * Parse JSON from claude CLI response
   * Handles responses wrapped in markdown code blocks
   */
  private parseJsonResponse(response: string): Record<string, unknown> {
    // Try to extract JSON from markdown code block
    const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : response.trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error(`Failed to parse JSON response: ${response}`);
    }
  }

  /**
   * Find element from natural language query using Claude CLI
   *
   * @param query - Natural language description of the element
   * @param snapshot - Browser snapshot with element tree and refs
   * @returns Promise resolving to element ref with reasoning
   */
  async findElement(query: string, snapshot: EnhancedSnapshot): Promise<FindElementResult> {
    const availableRefs = Object.keys(snapshot.refs);

    debug('findElement called with query:', query);
    debug('Snapshot tree length:', snapshot.tree.length);
    debug('Available refs:', availableRefs.length, availableRefs.slice(0, 5).join(', '), '...');

    // If snapshot is empty, return early
    if (!availableRefs.length || snapshot.tree === '(no interactive elements)') {
      debug('Empty snapshot - returning NOT_FOUND immediately');
      return {
        ref: 'NOT_FOUND',
        confidence: 0,
        reasoning: 'Snapshot contains no interactive elements',
      };
    }

    const prompt = `${ELEMENT_FINDER_PROMPT}

Find the element matching this description: "${query}"

Accessibility tree:
${snapshot.tree}

Available refs: ${availableRefs.join(', ')}

Return ONLY a JSON object with these fields:
- ref: the element reference (e.g., "e3") or "NOT_FOUND" if no match
- confidence: a number 0-1
- reasoning: why you selected this element

JSON response:`;

    try {
      debug('Calling runClaude...');
      const response = await this.runClaude(prompt);
      debug('Got response:', response.slice(0, 200));
      const parsed = this.parseJsonResponse(response);
      debug('Parsed result:', parsed);

      return {
        ref: String(parsed.ref ?? 'NOT_FOUND'),
        confidence: Number(parsed.confidence ?? 0),
        reasoning: String(parsed.reasoning ?? 'No reasoning provided'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Error in findElement:', errorMessage);
      return {
        ref: 'NOT_FOUND',
        confidence: 0,
        reasoning: `CLI error: ${errorMessage}`,
      };
    }
  }

  /**
   * Run exploration on a spec using Claude CLI
   *
   * Note: The primary AI method is findElement(). This explore() method is a stub
   * that returns a minimal valid structure. Full exploration is orchestrated by
   * the Explorer class which uses findElement() for AI-powered element discovery.
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
   */
  async retryWithFeedback(params: RetryParams): Promise<ExplorationOutput> {
    return this.explore(params);
  }
}
