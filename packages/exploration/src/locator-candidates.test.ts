// @browserflow/exploration - Locator candidate generator tests
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  LocatorCandidateGenerator,
  type LocatorCandidate,
  type ElementInfo,
} from './locator-candidates';

describe('LocatorCandidateGenerator', () => {
  let generator: LocatorCandidateGenerator;

  beforeEach(() => {
    generator = new LocatorCandidateGenerator();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(generator.getMaxCandidates()).toBe(5);
      expect(generator.getPreferredStrategies()).toEqual([
        'ref',
        'testid',
        'role',
        'text',
        'css',
      ]);
    });

    it('should allow custom max candidates', () => {
      const gen = new LocatorCandidateGenerator({ maxCandidates: 10 });
      expect(gen.getMaxCandidates()).toBe(10);
    });

    it('should allow custom preferred strategies', () => {
      const gen = new LocatorCandidateGenerator({
        preferredStrategies: ['testid', 'css'],
      });
      expect(gen.getPreferredStrategies()).toEqual(['testid', 'css']);
    });
  });

  describe('generateRefLocator', () => {
    it('should generate ref locator with high confidence', () => {
      const result = generator.generateRefLocator('e1');
      expect(result).toEqual({
        locator: '@e1',
        type: 'ref',
        confidence: 1.0,
        description: 'Element reference from snapshot',
      });
    });
  });

  describe('generateTestIdLocator', () => {
    it('should generate testid locator', () => {
      const result = generator.generateTestIdLocator('submit-btn');
      expect(result.locator).toBe('[data-testid="submit-btn"]');
      expect(result.type).toBe('testid');
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('generateRoleLocator', () => {
    it('should generate role locator without name', () => {
      const result = generator.generateRoleLocator('button');
      expect(result.locator).toBe('role=button');
      expect(result.type).toBe('role');
      // Role without name has lower confidence (0.85) than role with name (0.9)
      expect(result.confidence).toBe(0.85);
    });

    it('should generate role locator with name', () => {
      const result = generator.generateRoleLocator('button', 'Submit');
      expect(result.locator).toBe('role=button[name="Submit"]');
      expect(result.description).toContain('Submit');
    });
  });

  describe('generateTextLocator', () => {
    it('should generate exact text locator', () => {
      const result = generator.generateTextLocator('Submit', true);
      expect(result.locator).toBe('text="Submit"');
      expect(result.confidence).toBe(0.85);
    });

    it('should generate partial text locator', () => {
      const result = generator.generateTextLocator('Submit', false);
      expect(result.locator).toBe('text~="Submit"');
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('generateCssLocator', () => {
    it('should generate CSS selector locator', () => {
      const result = generator.generateCssLocator('button.primary');
      expect(result.locator).toBe('button.primary');
      expect(result.type).toBe('css');
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('generateCandidates', () => {
    it('should find candidates matching query in snapshot', async () => {
      const snapshot = {
        tree: '<button ref="e1" data-testid="submit-btn">Submit</button>',
        refs: {
          e1: {
            tag: 'button',
            text: 'Submit',
            testId: 'submit-btn',
            role: 'button',
          },
        },
      };

      const candidates = await generator.generateCandidates('submit button', snapshot);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array when no matching elements', async () => {
      const snapshot = {
        tree: '<div>Hello</div>',
        refs: {},
      };

      const candidates = await generator.generateCandidates('submit button', snapshot);

      expect(candidates).toEqual([]);
    });

    it('should respect maxCandidates setting', async () => {
      const gen = new LocatorCandidateGenerator({ maxCandidates: 2 });
      const snapshot = {
        tree: '<button ref="e1" data-testid="btn">Click</button>',
        refs: {
          e1: {
            tag: 'button',
            text: 'Click',
            testId: 'btn',
            role: 'button',
            ariaLabel: 'Click me',
          },
        },
      };

      const candidates = await gen.generateCandidates('button', snapshot);

      expect(candidates.length).toBeLessThanOrEqual(2);
    });
  });

  describe('generateDetailedCandidates', () => {
    it('should return candidates with confidence scores', async () => {
      const snapshot = {
        tree: '<button ref="e1" data-testid="submit-btn">Submit</button>',
        refs: {
          e1: {
            tag: 'button',
            text: 'Submit',
            testId: 'submit-btn',
            role: 'button',
          },
        },
      };

      const candidates = await generator.generateDetailedCandidates('submit button', snapshot);

      expect(candidates.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(candidate).toHaveProperty('locator');
        expect(candidate).toHaveProperty('type');
        expect(candidate).toHaveProperty('confidence');
        expect(candidate.confidence).toBeGreaterThanOrEqual(0);
        expect(candidate.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should order candidates by confidence (highest first)', async () => {
      const snapshot = {
        tree: '<button ref="e1" data-testid="submit">Submit Form</button>',
        refs: {
          e1: {
            tag: 'button',
            text: 'Submit Form',
            testId: 'submit',
            role: 'button',
          },
        },
      };

      const candidates = await generator.generateDetailedCandidates('submit button', snapshot);

      if (candidates.length > 1) {
        for (let i = 0; i < candidates.length - 1; i++) {
          expect(candidates[i].confidence).toBeGreaterThanOrEqual(candidates[i + 1].confidence);
        }
      }
    });

    it('should always include CSS fallback as last resort', async () => {
      const snapshot = {
        tree: '<span ref="e1">Plain text</span>',
        refs: {
          e1: {
            tag: 'span',
            text: 'Plain text',
          },
        },
      };

      const candidates = await generator.generateDetailedCandidates('plain text element', snapshot);

      // Should have at least a CSS fallback
      expect(candidates.length).toBeGreaterThan(0);
      const hasCSS = candidates.some((c) => c.type === 'css');
      expect(hasCSS).toBe(true);
    });

    it('should generate testid candidate when data-testid present', async () => {
      const snapshot = {
        tree: '<button ref="e1" data-testid="my-button">Click</button>',
        refs: {
          e1: {
            tag: 'button',
            text: 'Click',
            testId: 'my-button',
            attributes: { 'data-testid': 'my-button' },
          },
        },
      };

      const candidates = await generator.generateDetailedCandidates('button', snapshot);

      const testidCandidate = candidates.find((c) => c.type === 'testid');
      expect(testidCandidate).toBeDefined();
      expect(testidCandidate!.locator).toContain('my-button');
      expect(testidCandidate!.confidence).toBe(0.95);
    });

    it('should generate role candidate when role is present', async () => {
      const snapshot = {
        tree: '<button ref="e1" role="button">Submit</button>',
        refs: {
          e1: {
            tag: 'button',
            text: 'Submit',
            role: 'button',
            ariaLabel: 'Submit',
          },
        },
      };

      const candidates = await generator.generateDetailedCandidates('submit', snapshot);

      const roleCandidate = candidates.find((c) => c.type === 'role');
      expect(roleCandidate).toBeDefined();
      expect(roleCandidate!.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should generate text candidate for visible text', async () => {
      const snapshot = {
        tree: '<a ref="e1">Learn more</a>',
        refs: {
          e1: {
            tag: 'a',
            text: 'Learn more',
          },
        },
      };

      const candidates = await generator.generateDetailedCandidates('learn more link', snapshot);

      const textCandidate = candidates.find((c) => c.type === 'text');
      expect(textCandidate).toBeDefined();
      expect(textCandidate!.locator).toContain('Learn more');
    });
  });

  describe('generateCandidatesForElement', () => {
    it('should generate all applicable candidates for element info', async () => {
      const element: ElementInfo = {
        ref: 'e1',
        tag: 'button',
        text: 'Submit',
        testId: 'submit-btn',
        role: 'button',
        ariaLabel: 'Submit form',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      // Should have: ref, testid, role, text, css (at minimum)
      expect(candidates.length).toBeGreaterThanOrEqual(4);

      // Check each strategy type is present
      const types = candidates.map((c) => c.type);
      expect(types).toContain('ref');
      expect(types).toContain('testid');
      expect(types).toContain('role');
      expect(types).toContain('css');
    });

    it('should handle element without testid', async () => {
      const element: ElementInfo = {
        ref: 'e2',
        tag: 'div',
        text: 'Hello World',
        className: 'greeting',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      // Should still work without testid
      expect(candidates.length).toBeGreaterThan(0);
      const types = candidates.map((c) => c.type);
      expect(types).not.toContain('testid');
      expect(types).toContain('ref');
      expect(types).toContain('css');
    });

    it('should generate CSS selector using id when available', async () => {
      const element: ElementInfo = {
        ref: 'e3',
        tag: 'input',
        id: 'email-input',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const cssCandidate = candidates.find((c) => c.type === 'css');
      expect(cssCandidate).toBeDefined();
      expect(cssCandidate!.locator).toContain('#email-input');
    });

    it('should generate CSS selector using class when no id', async () => {
      const element: ElementInfo = {
        ref: 'e4',
        tag: 'button',
        className: 'btn btn-primary',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const cssCandidate = candidates.find((c) => c.type === 'css');
      expect(cssCandidate).toBeDefined();
      // Should use first class or a combination
      expect(cssCandidate!.locator).toMatch(/button\.btn/);
    });

    it('should infer role from tag name when explicit role missing', async () => {
      // Standard HTML5 elements have implicit roles
      const element: ElementInfo = {
        ref: 'e5',
        tag: 'button',
        text: 'Click me',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const roleCandidate = candidates.find((c) => c.type === 'role');
      expect(roleCandidate).toBeDefined();
      expect(roleCandidate!.locator).toContain('button');
    });

    it('should not generate text candidate for very long text', async () => {
      const element: ElementInfo = {
        ref: 'e6',
        tag: 'p',
        text: 'A'.repeat(100), // Very long text
      };

      const candidates = await generator.generateCandidatesForElement(element);

      // Should not include text strategy for very long text
      const textCandidate = candidates.find((c) => c.type === 'text');
      expect(textCandidate).toBeUndefined();
    });

    it('should handle elements with special characters in text', async () => {
      const element: ElementInfo = {
        ref: 'e7',
        tag: 'span',
        text: 'Price: $100.00',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const textCandidate = candidates.find((c) => c.type === 'text');
      expect(textCandidate).toBeDefined();
      // Should properly escape or handle special chars
    });
  });

  describe('element matching', () => {
    it('should match elements by text content', async () => {
      const snapshot = {
        tree: '<button ref="e1">Login</button><button ref="e2">Register</button>',
        refs: {
          e1: { tag: 'button', text: 'Login' },
          e2: { tag: 'button', text: 'Register' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('login', snapshot);

      // Should match the Login button, not Register
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some((c) => c.locator.includes('Login') || c.locator.includes('e1'))).toBe(true);
    });

    it('should match elements by tag name', async () => {
      const snapshot = {
        tree: '<input ref="e1" type="text"><button ref="e2">Submit</button>',
        refs: {
          e1: { tag: 'input', type: 'text' },
          e2: { tag: 'button', text: 'Submit' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('input field', snapshot);

      expect(candidates.length).toBeGreaterThan(0);
      // Should match the input element
    });

    it('should match elements by role', async () => {
      const snapshot = {
        tree: '<nav ref="e1"><a ref="e2">Link</a></nav>',
        refs: {
          e1: { tag: 'nav', role: 'navigation' },
          e2: { tag: 'a', text: 'Link', role: 'link' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('navigation', snapshot);

      expect(candidates.length).toBeGreaterThan(0);
    });

    it('should handle case-insensitive matching', async () => {
      const snapshot = {
        tree: '<button ref="e1">SUBMIT</button>',
        refs: {
          e1: { tag: 'button', text: 'SUBMIT' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('submit', snapshot);

      expect(candidates.length).toBeGreaterThan(0);
    });

    it('should match by aria-label', async () => {
      const snapshot = {
        tree: '<button ref="e1" aria-label="Close dialog">X</button>',
        refs: {
          e1: { tag: 'button', text: 'X', ariaLabel: 'Close dialog' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('close dialog', snapshot);

      expect(candidates.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty snapshot', async () => {
      const snapshot = {
        tree: '',
        refs: {},
      };

      const candidates = await generator.generateDetailedCandidates('anything', snapshot);

      expect(candidates).toEqual([]);
    });

    it('should handle empty query', async () => {
      const snapshot = {
        tree: '<button ref="e1">Click</button>',
        refs: {
          e1: { tag: 'button', text: 'Click' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('', snapshot);

      expect(candidates).toEqual([]);
    });

    it('should handle elements with no attributes', async () => {
      const snapshot = {
        tree: '<div ref="e1"></div>',
        refs: {
          e1: { tag: 'div' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('div', snapshot);

      // Should still generate at least ref and css candidates
      if (candidates.length > 0) {
        const types = candidates.map((c) => c.type);
        expect(types).toContain('ref');
        expect(types).toContain('css');
      }
    });

    it('should handle numeric refs', async () => {
      const snapshot = {
        tree: '<span ref="123">Text</span>',
        refs: {
          '123': { tag: 'span', text: 'Text' },
        },
      };

      const candidates = await generator.generateDetailedCandidates('text', snapshot);

      const refCandidate = candidates.find((c) => c.type === 'ref');
      if (refCandidate) {
        expect(refCandidate.locator).toBe('@123');
      }
    });
  });

  describe('confidence scoring', () => {
    it('should score testid higher than role', async () => {
      const element: ElementInfo = {
        ref: 'e1',
        tag: 'button',
        text: 'Submit',
        testId: 'submit-btn',
        role: 'button',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const testidCandidate = candidates.find((c) => c.type === 'testid');
      const roleCandidate = candidates.find((c) => c.type === 'role');

      expect(testidCandidate).toBeDefined();
      expect(roleCandidate).toBeDefined();
      expect(testidCandidate!.confidence).toBeGreaterThan(roleCandidate!.confidence);
    });

    it('should score role higher than text', async () => {
      const element: ElementInfo = {
        ref: 'e1',
        tag: 'button',
        text: 'Submit',
        role: 'button',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const roleCandidate = candidates.find((c) => c.type === 'role');
      const textCandidate = candidates.find((c) => c.type === 'text');

      expect(roleCandidate).toBeDefined();
      expect(textCandidate).toBeDefined();
      expect(roleCandidate!.confidence).toBeGreaterThan(textCandidate!.confidence);
    });

    it('should score text higher than css', async () => {
      const element: ElementInfo = {
        ref: 'e1',
        tag: 'span',
        text: 'Click',
        className: 'action',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const textCandidate = candidates.find((c) => c.type === 'text');
      const cssCandidate = candidates.find((c) => c.type === 'css');

      expect(textCandidate).toBeDefined();
      expect(cssCandidate).toBeDefined();
      expect(textCandidate!.confidence).toBeGreaterThan(cssCandidate!.confidence);
    });

    it('should give ref highest confidence', async () => {
      const element: ElementInfo = {
        ref: 'e1',
        tag: 'button',
        text: 'Submit',
        testId: 'submit-btn',
      };

      const candidates = await generator.generateCandidatesForElement(element);

      const refCandidate = candidates.find((c) => c.type === 'ref');
      const testidCandidate = candidates.find((c) => c.type === 'testid');

      expect(refCandidate).toBeDefined();
      expect(refCandidate!.confidence).toBe(1.0);
      expect(refCandidate!.confidence).toBeGreaterThan(testidCandidate!.confidence);
    });
  });
});
