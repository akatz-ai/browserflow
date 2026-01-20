import { renderHook, act } from '@testing-library/react';
import { useReviewKeyboardShortcuts, type ReviewHandlers } from './useReviewKeyboardShortcuts';

// Map key names to their DOM event properties
const KEY_MAP: Record<string, { key: string; code: string }> = {
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown' },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp' },
  Escape: { key: 'Escape', code: 'Escape' },
  '/': { key: '/', code: 'Slash' },
  '?': { key: '?', code: 'Slash' },
};

// Helper to simulate key press
function fireKeyDown(key: string, options: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  const keyInfo = KEY_MAP[key] || { key, code: `Key${key.toUpperCase()}` };
  const event = new KeyboardEvent('keydown', {
    key: keyInfo.key,
    code: keyInfo.code,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
}

describe('useReviewKeyboardShortcuts', () => {
  const createMockHandlers = (): ReviewHandlers => ({
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    addMask: vi.fn(),
    focusLocatorPicker: vi.fn(),
    addAssertion: vi.fn(),
    focusComment: vi.fn(),
    setViewMode: vi.fn(),
    openSearch: vi.fn(),
    submitReview: vi.fn(),
    showHelp: vi.fn(),
    closeModal: vi.fn(),
  });

  describe('navigation shortcuts', () => {
    it('calls nextStep when j is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('j'));

      expect(handlers.nextStep).toHaveBeenCalledTimes(1);
    });

    it('calls nextStep when down arrow is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('ArrowDown'));

      expect(handlers.nextStep).toHaveBeenCalledTimes(1);
    });

    it('calls prevStep when k is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('k'));

      expect(handlers.prevStep).toHaveBeenCalledTimes(1);
    });

    it('calls prevStep when up arrow is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('ArrowUp'));

      expect(handlers.prevStep).toHaveBeenCalledTimes(1);
    });
  });

  describe('UI action shortcuts', () => {
    it('calls addMask when m is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('m'));

      expect(handlers.addMask).toHaveBeenCalledTimes(1);
    });

    it('calls focusLocatorPicker when l is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('l'));

      expect(handlers.focusLocatorPicker).toHaveBeenCalledTimes(1);
    });

    it('calls addAssertion when e is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('e'));

      expect(handlers.addAssertion).toHaveBeenCalledTimes(1);
    });

    it('calls focusComment when c is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('c'));

      expect(handlers.focusComment).toHaveBeenCalledTimes(1);
    });
  });

  describe('view mode shortcuts', () => {
    it('calls setViewMode with side-by-side when 1 is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('1'));

      expect(handlers.setViewMode).toHaveBeenCalledWith('side-by-side');
    });

    it('calls setViewMode with slider when 2 is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('2'));

      expect(handlers.setViewMode).toHaveBeenCalledWith('slider');
    });

    it('calls setViewMode with blink when 3 is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('3'));

      expect(handlers.setViewMode).toHaveBeenCalledWith('blink');
    });

    it('calls setViewMode with diff when 4 is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('4'));

      expect(handlers.setViewMode).toHaveBeenCalledWith('diff');
    });
  });

  describe('search shortcut', () => {
    it('calls openSearch when / is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('/'));

      expect(handlers.openSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('submit shortcut', () => {
    it('calls submitReview when Ctrl+S is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('s', { ctrlKey: true }));

      expect(handlers.submitReview).toHaveBeenCalledTimes(1);
    });

    it('calls submitReview when Cmd+S is pressed (Mac)', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('s', { metaKey: true }));

      expect(handlers.submitReview).toHaveBeenCalledTimes(1);
    });
  });

  describe('help shortcut', () => {
    it('calls showHelp when Ctrl+? is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('?', { ctrlKey: true }));

      expect(handlers.showHelp).toHaveBeenCalledTimes(1);
    });

    it('calls showHelp when Cmd+? is pressed (Mac)', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('?', { metaKey: true }));

      expect(handlers.showHelp).toHaveBeenCalledTimes(1);
    });
  });

  describe('modal shortcuts', () => {
    it('calls closeModal when Escape is pressed', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers));

      act(() => fireKeyDown('Escape'));

      expect(handlers.closeModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('enabled option', () => {
    it('does not fire shortcuts when enabled is false', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers, { enabled: false }));

      act(() => {
        fireKeyDown('j');
        fireKeyDown('m');
        fireKeyDown('1');
      });

      expect(handlers.nextStep).not.toHaveBeenCalled();
      expect(handlers.addMask).not.toHaveBeenCalled();
      expect(handlers.setViewMode).not.toHaveBeenCalled();
    });

    it('fires shortcuts when enabled is true', () => {
      const handlers = createMockHandlers();
      renderHook(() => useReviewKeyboardShortcuts(handlers, { enabled: true }));

      act(() => fireKeyDown('j'));

      expect(handlers.nextStep).toHaveBeenCalledTimes(1);
    });
  });
});
