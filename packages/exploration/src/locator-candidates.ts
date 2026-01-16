// @browserflow/exploration - Locator candidate generation

/**
 * A locator candidate with confidence score
 */
export interface LocatorCandidate {
  locator: string;
  type: 'ref' | 'css' | 'xpath' | 'text' | 'role' | 'testid';
  confidence: number;
  description?: string;
}

/**
 * Element information from browser snapshot
 */
export interface ElementInfo {
  ref: string;
  tag: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  testId?: string;
  className?: string;
  id?: string;
  attributes?: Record<string, string>;
}

/**
 * Configuration for the locator generator
 */
export interface LocatorCandidateGeneratorConfig {
  preferredStrategies?: ('ref' | 'testid' | 'role' | 'text' | 'css' | 'xpath')[];
  maxCandidates?: number;
}

/**
 * LocatorCandidateGenerator - Generates ranked locator options for elements
 *
 * Uses multiple strategies to find elements:
 * - Element refs from agent-browser snapshots
 * - Test IDs (data-testid, data-test, etc.)
 * - ARIA roles and labels
 * - Text content matching
 * - CSS selectors
 * - XPath expressions
 */
export class LocatorCandidateGenerator {
  private preferredStrategies: string[];
  private maxCandidates: number;

  constructor(config: LocatorCandidateGeneratorConfig = {}) {
    this.preferredStrategies = config.preferredStrategies ?? [
      'ref',
      'testid',
      'role',
      'text',
      'css',
    ];
    this.maxCandidates = config.maxCandidates ?? 5;
  }

  /**
   * Generate locator candidates for an element based on natural language query
   *
   * @param query - Natural language description (e.g., "Submit button in the form")
   * @param snapshot - Browser snapshot containing element refs
   * @returns Promise resolving to ranked list of locator strings
   */
  async generateCandidates(
    query: string,
    snapshot: Record<string, unknown>
  ): Promise<string[]> {
    // TODO: Implement in bf-661 (C.4: Implement locator candidate generator)
    // This stub returns empty candidates for compilation
    const candidates = await this.findCandidates(query, snapshot);
    return candidates.slice(0, this.maxCandidates).map((c) => c.locator);
  }

  /**
   * Generate detailed locator candidates with metadata
   *
   * @param query - Natural language description
   * @param snapshot - Browser snapshot
   * @returns Promise resolving to ranked list of candidates with scores
   */
  async generateDetailedCandidates(
    query: string,
    snapshot: Record<string, unknown>
  ): Promise<LocatorCandidate[]> {
    // TODO: Implement in bf-661
    return this.findCandidates(query, snapshot);
  }

  /**
   * Find candidate locators matching a query
   */
  private async findCandidates(
    query: string,
    snapshot: Record<string, unknown>
  ): Promise<LocatorCandidate[]> {
    // TODO: Implement actual matching logic in bf-661
    // This stub returns empty for compilation
    return [];
  }

  /**
   * Generate a locator from element ref
   */
  generateRefLocator(ref: string): LocatorCandidate {
    return {
      locator: `@${ref}`,
      type: 'ref',
      confidence: 1.0,
      description: 'Element reference from snapshot',
    };
  }

  /**
   * Generate a locator from test ID
   */
  generateTestIdLocator(testId: string): LocatorCandidate {
    return {
      locator: `[data-testid="${testId}"]`,
      type: 'testid',
      confidence: 0.95,
      description: 'Test ID selector',
    };
  }

  /**
   * Generate a locator from ARIA role
   */
  generateRoleLocator(role: string, name?: string): LocatorCandidate {
    const locator = name
      ? `role=${role}[name="${name}"]`
      : `role=${role}`;
    return {
      locator,
      type: 'role',
      confidence: 0.9,
      description: `ARIA role: ${role}${name ? ` with name "${name}"` : ''}`,
    };
  }

  /**
   * Generate a locator from text content
   */
  generateTextLocator(text: string, exact: boolean = false): LocatorCandidate {
    const locator = exact
      ? `text="${text}"`
      : `text~="${text}"`;
    return {
      locator,
      type: 'text',
      confidence: exact ? 0.85 : 0.7,
      description: `Text content${exact ? ' (exact)' : ' (partial)'}`,
    };
  }

  /**
   * Generate a CSS selector locator
   */
  generateCssLocator(selector: string): LocatorCandidate {
    return {
      locator: selector,
      type: 'css',
      confidence: 0.8,
      description: 'CSS selector',
    };
  }

  /**
   * Get the maximum number of candidates to return
   */
  getMaxCandidates(): number {
    return this.maxCandidates;
  }

  /**
   * Set the maximum number of candidates to return
   */
  setMaxCandidates(max: number): void {
    this.maxCandidates = max;
  }

  /**
   * Get the preferred strategies in order
   */
  getPreferredStrategies(): string[] {
    return [...this.preferredStrategies];
  }
}
