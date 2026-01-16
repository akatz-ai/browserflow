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
 * Implicit ARIA roles for common HTML elements
 */
const IMPLICIT_ROLES: Record<string, string> = {
  a: 'link',
  button: 'button',
  input: 'textbox',
  select: 'combobox',
  textarea: 'textbox',
  img: 'img',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  article: 'article',
  section: 'region',
  form: 'form',
  table: 'table',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  dialog: 'dialog',
  menu: 'menu',
  option: 'option',
  progress: 'progressbar',
  meter: 'meter',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
};

/**
 * Maximum text length for text-based locators
 */
const MAX_TEXT_LENGTH = 50;

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
    const candidates = await this.findCandidates(query, snapshot);
    return candidates.slice(0, this.maxCandidates);
  }

  /**
   * Generate all applicable locator candidates for a known element
   *
   * @param element - Element information
   * @returns Promise resolving to ranked list of candidates
   */
  async generateCandidatesForElement(element: ElementInfo): Promise<LocatorCandidate[]> {
    const candidates: LocatorCandidate[] = [];

    // 1. Ref locator (highest confidence - direct reference)
    candidates.push(this.generateRefLocator(element.ref));

    // 2. Test ID locator (if present)
    const testId = element.testId || element.attributes?.['data-testid'] || element.attributes?.['data-test'];
    if (testId) {
      candidates.push(this.generateTestIdLocator(testId));
    }

    // 3. Role locator (explicit or implicit)
    const role = element.role || IMPLICIT_ROLES[element.tag];
    if (role) {
      const name = element.ariaLabel || (element.text && element.text.length <= MAX_TEXT_LENGTH ? element.text : undefined);
      candidates.push(this.generateRoleLocator(role, name));
    }

    // 4. Text locator (if text is short enough)
    if (element.text && element.text.length > 0 && element.text.length <= MAX_TEXT_LENGTH) {
      // Use exact match for shorter text
      const exact = element.text.length <= 30;
      candidates.push(this.generateTextLocator(element.text, exact));
    }

    // 5. CSS selector (always as fallback)
    const cssSelector = this.generateCssSelectorForElement(element);
    candidates.push({
      locator: cssSelector,
      type: 'css',
      confidence: this.calculateCssConfidence(element),
      description: 'CSS selector',
    });

    // Sort by confidence (highest first)
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Find candidate locators matching a query
   */
  private async findCandidates(
    query: string,
    snapshot: Record<string, unknown>
  ): Promise<LocatorCandidate[]> {
    // Handle empty query
    if (!query || query.trim() === '') {
      return [];
    }

    const normalizedQuery = query.toLowerCase().trim();
    const refs = (snapshot.refs || {}) as Record<string, Record<string, unknown>>;

    // Handle empty snapshot
    if (Object.keys(refs).length === 0) {
      return [];
    }

    // Find matching elements
    const matchedElements: Array<{ element: ElementInfo; score: number }> = [];

    for (const [ref, refData] of Object.entries(refs)) {
      const element = this.parseElementFromRef(ref, refData);
      const matchScore = this.calculateMatchScore(element, normalizedQuery);

      if (matchScore > 0) {
        matchedElements.push({ element, score: matchScore });
      }
    }

    // Sort by match score (best match first)
    matchedElements.sort((a, b) => b.score - a.score);

    // Take the best matching element and generate candidates for it
    if (matchedElements.length === 0) {
      return [];
    }

    const bestMatch = matchedElements[0];
    return this.generateCandidatesForElement(bestMatch.element);
  }

  /**
   * Parse element info from snapshot ref data
   */
  private parseElementFromRef(ref: string, refData: Record<string, unknown>): ElementInfo {
    return {
      ref,
      tag: (refData.tag as string) || 'div',
      role: refData.role as string | undefined,
      text: refData.text as string | undefined,
      ariaLabel: refData.ariaLabel as string | undefined,
      testId: refData.testId as string | undefined,
      className: refData.className as string | undefined,
      id: refData.id as string | undefined,
      attributes: refData.attributes as Record<string, string> | undefined,
    };
  }

  /**
   * Calculate how well an element matches the query
   * Returns a score from 0 (no match) to 1 (perfect match)
   */
  private calculateMatchScore(element: ElementInfo, normalizedQuery: string): number {
    let score = 0;
    const queryTerms = normalizedQuery.split(/\s+/);

    // Match by text content
    if (element.text) {
      const normalizedText = element.text.toLowerCase();
      if (normalizedText === normalizedQuery) {
        score += 1.0; // Exact match
      } else if (normalizedText.includes(normalizedQuery)) {
        score += 0.8; // Contains query
      } else {
        // Check if all query terms are in the text
        const matchedTerms = queryTerms.filter((term) => normalizedText.includes(term));
        score += (matchedTerms.length / queryTerms.length) * 0.6;
      }
    }

    // Match by aria-label
    if (element.ariaLabel) {
      const normalizedLabel = element.ariaLabel.toLowerCase();
      if (normalizedLabel === normalizedQuery) {
        score += 0.9;
      } else if (normalizedLabel.includes(normalizedQuery)) {
        score += 0.7;
      } else {
        const matchedTerms = queryTerms.filter((term) => normalizedLabel.includes(term));
        score += (matchedTerms.length / queryTerms.length) * 0.5;
      }
    }

    // Match by tag name
    const normalizedTag = element.tag.toLowerCase();
    if (queryTerms.includes(normalizedTag)) {
      score += 0.4;
    }

    // Match by role
    if (element.role) {
      const normalizedRole = element.role.toLowerCase();
      if (queryTerms.includes(normalizedRole)) {
        score += 0.5;
      }
    } else {
      // Check implicit role
      const implicitRole = IMPLICIT_ROLES[element.tag];
      if (implicitRole && queryTerms.includes(implicitRole)) {
        score += 0.4;
      }
    }

    // Match by test ID
    if (element.testId) {
      const normalizedTestId = element.testId.toLowerCase().replace(/[-_]/g, ' ');
      const matchedTerms = queryTerms.filter((term) => normalizedTestId.includes(term));
      score += (matchedTerms.length / queryTerms.length) * 0.3;
    }

    // Match by class name
    if (element.className) {
      const normalizedClasses = element.className.toLowerCase().replace(/[-_]/g, ' ');
      const matchedTerms = queryTerms.filter((term) => normalizedClasses.includes(term));
      score += (matchedTerms.length / queryTerms.length) * 0.2;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Generate a CSS selector for an element
   */
  private generateCssSelectorForElement(element: ElementInfo): string {
    // Prefer ID if available (most specific)
    if (element.id) {
      return `#${this.escapeCssSelector(element.id)}`;
    }

    // Build selector from tag and classes
    let selector = element.tag;

    if (element.className) {
      const classes = element.className.split(/\s+/).filter((c) => c.length > 0);
      if (classes.length > 0) {
        // Use first 2 classes for specificity without being too brittle
        const selectedClasses = classes.slice(0, 2);
        selector += selectedClasses.map((c) => `.${this.escapeCssSelector(c)}`).join('');
      }
    }

    return selector;
  }

  /**
   * Escape special characters in CSS selectors
   */
  private escapeCssSelector(value: string): string {
    return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  /**
   * Calculate CSS selector confidence based on element attributes
   */
  private calculateCssConfidence(element: ElementInfo): number {
    // ID-based selectors are more stable
    if (element.id) {
      return 0.75;
    }

    // Class-based selectors are moderately stable
    if (element.className) {
      return 0.6;
    }

    // Tag-only selectors are least stable
    return 0.4;
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
    const locator = name ? `role=${role}[name="${name}"]` : `role=${role}`;
    return {
      locator,
      type: 'role',
      confidence: name ? 0.9 : 0.85,
      description: `ARIA role: ${role}${name ? ` with name "${name}"` : ''}`,
    };
  }

  /**
   * Generate a locator from text content
   */
  generateTextLocator(text: string, exact: boolean = false): LocatorCandidate {
    const locator = exact ? `text="${text}"` : `text~="${text}"`;
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
