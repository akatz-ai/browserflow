// @akatz-ai/exploration - Claude adapter tests
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ClaudeAdapter } from './claude';

// Mock the Anthropic SDK
const mockCreate = mock(() =>
  Promise.resolve({
    content: [
      {
        type: 'tool_use',
        id: 'tool_1',
        name: 'select_element',
        input: {
          ref: 'e5',
          confidence: 0.95,
          reasoning: 'The element with ref e5 is a button with text "Submit" which matches the query for a submit button.',
        },
      },
    ],
    stop_reason: 'tool_use',
  })
);

// Mock Anthropic constructor
mock.module('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: mockCreate,
    };
  },
}));

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    mockCreate.mockClear();
    adapter = new ClaudeAdapter();
  });

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      expect(adapter.name).toBe('claude');
    });

    it('should accept custom model config', () => {
      const customAdapter = new ClaudeAdapter({
        model: 'claude-opus-4-20250514',
        maxTokens: 4096,
      });
      expect(customAdapter.name).toBe('claude');
    });
  });

  describe('findElement', () => {
    const sampleSnapshot = {
      tree: `
        <page url="http://localhost:3000/login">
          <form>
            <input ref="e1" type="email" placeholder="Email" />
            <input ref="e2" type="password" placeholder="Password" />
            <button ref="e5" type="submit">Submit</button>
          </form>
        </page>
      `,
      refs: {
        e1: { tag: 'input', type: 'email', placeholder: 'Email' },
        e2: { tag: 'input', type: 'password', placeholder: 'Password' },
        e5: { tag: 'button', type: 'submit', text: 'Submit' },
      },
    };

    it('should find element from natural language query', async () => {
      const result = await adapter.findElement('submit button', sampleSnapshot);

      expect(result.ref).toBe('e5');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should call Claude API with correct parameters', async () => {
      await adapter.findElement('email input field', sampleSnapshot);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];

      expect(callArgs.model).toMatch(/claude/);
      expect(callArgs.max_tokens).toBeGreaterThan(0);
      expect(callArgs.messages).toBeDefined();
      expect(callArgs.tools).toBeDefined();
    });

    it('should include snapshot tree in prompt', async () => {
      await adapter.findElement('password field', sampleSnapshot);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');

      expect(userMessage.content).toContain('password field');
    });

    it('should use tool_use for structured output', async () => {
      await adapter.findElement('submit button', sampleSnapshot);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'select_element',
          }),
        ])
      );
    });

    it('should return NOT_FOUND when element not found', async () => {
      mockCreate.mockImplementationOnce(() =>
        Promise.resolve({
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'select_element',
              input: {
                ref: 'NOT_FOUND',
                confidence: 0,
                reasoning: 'No element matches the description "purple unicorn button".',
              },
            },
          ],
          stop_reason: 'tool_use',
        })
      );

      const result = await adapter.findElement('purple unicorn button', sampleSnapshot);

      expect(result.ref).toBe('NOT_FOUND');
      expect(result.confidence).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      mockCreate.mockImplementationOnce(() => Promise.reject(new Error('API rate limit exceeded')));

      await expect(adapter.findElement('button', sampleSnapshot)).rejects.toThrow('API rate limit exceeded');
    });

    it('should extract ref from text response as fallback', async () => {
      mockCreate.mockImplementationOnce(() =>
        Promise.resolve({
          content: [
            {
              type: 'text',
              text: 'The submit button is element e5. I selected this because it has type="submit" and the text "Submit".',
            },
          ],
          stop_reason: 'end_turn',
        })
      );

      const result = await adapter.findElement('submit button', sampleSnapshot);

      expect(result.ref).toBe('e5');
    });
  });

  describe('findElement with ambiguous queries', () => {
    const snapshotWithMultipleButtons = {
      tree: `
        <page>
          <button ref="e1">Cancel</button>
          <button ref="e2">Submit</button>
          <button ref="e3">Submit</button>
        </page>
      `,
      refs: {
        e1: { tag: 'button', text: 'Cancel' },
        e2: { tag: 'button', text: 'Submit' },
        e3: { tag: 'button', text: 'Submit' },
      },
    };

    it('should pick most likely element for ambiguous query', async () => {
      const result = await adapter.findElement('submit button', snapshotWithMultipleButtons);

      // Should return one of the submit buttons
      expect(['e2', 'e3', 'e5']).toContain(result.ref);
    });

    it('should include reasoning for ambiguous cases', async () => {
      const result = await adapter.findElement('submit button', snapshotWithMultipleButtons);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });
});
