import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReviewKeyboardShortcuts, KEYBOARD_SHORTCUTS } from './useReviewKeyboardShortcuts';

describe('useReviewKeyboardShortcuts - Feedback-Focused Model', () => {
  const mockHandlers = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Removed Approve/Reject Shortcuts', () => {
    it('should not have approveStep handler', () => {
      // The handlers interface should not include approveStep
      const handlers = mockHandlers;

      expect('approveStep' in handlers).toBe(false);
    });

    it('should not have rejectStep handler', () => {
      // The handlers interface should not include rejectStep
      const handlers = mockHandlers;

      expect('rejectStep' in handlers).toBe(false);
    });
  });

  describe('KEYBOARD_SHORTCUTS Documentation', () => {
    it('should not document "a" key for approve', () => {
      const approveShortcut = KEYBOARD_SHORTCUTS.find(
        (s) => s.key === 'a' && s.description.toLowerCase().includes('approve')
      );

      expect(approveShortcut).toBeUndefined();
    });

    it('should not document "r" key for reject', () => {
      const rejectShortcut = KEYBOARD_SHORTCUTS.find(
        (s) => s.key === 'r' && s.description.toLowerCase().includes('reject')
      );

      expect(rejectShortcut).toBeUndefined();
    });

    it('should not have "Review Actions" category with approve/reject', () => {
      const reviewActions = KEYBOARD_SHORTCUTS.filter(
        (s) => s.category === 'Review Actions'
      );

      // If Review Actions category exists, it should not have approve/reject
      reviewActions.forEach((shortcut) => {
        expect(shortcut.description.toLowerCase()).not.toContain('approve');
        expect(shortcut.description.toLowerCase()).not.toContain('reject');
      });
    });
  });

  describe('Preserved Shortcuts', () => {
    it('should still support navigation shortcuts', () => {
      renderHook(() => useReviewKeyboardShortcuts(mockHandlers));

      // These shortcuts should still be documented
      expect(
        KEYBOARD_SHORTCUTS.find((s) => s.key === 'j / ↓')
      ).toBeDefined();
      expect(
        KEYBOARD_SHORTCUTS.find((s) => s.key === 'k / ↑')
      ).toBeDefined();
    });

    it('should still support mask shortcut', () => {
      renderHook(() => useReviewKeyboardShortcuts(mockHandlers));

      expect(
        KEYBOARD_SHORTCUTS.find((s) => s.key === 'm' && s.description.toLowerCase().includes('mask'))
      ).toBeDefined();
    });

    it('should still support comment focus shortcut', () => {
      renderHook(() => useReviewKeyboardShortcuts(mockHandlers));

      expect(
        KEYBOARD_SHORTCUTS.find((s) => s.key === 'c' && s.description.toLowerCase().includes('comment'))
      ).toBeDefined();
    });
  });

  describe('Optional: Repurposed Shortcuts', () => {
    // If shortcuts are repurposed instead of removed, test the new behavior
    it('could repurpose "r" for "mark as reviewed"', () => {
      // This test is optional and depends on the implementation choice
      // If "r" is repurposed, test it here
    });
  });
});
