import { useHotkeys } from 'react-hotkeys-hook';
import type { ViewMode } from '../components/ScreenshotViewer';

export interface ReviewHandlers {
  nextStep: () => void;
  prevStep: () => void;
  addMask: () => void;
  focusLocatorPicker: () => void;
  addAssertion: () => void;
  focusComment: () => void;
  setViewMode: (mode: ViewMode) => void;
  openSearch: () => void;
  submitReview: () => void;
  showHelp: () => void;
  closeModal: () => void;
}

export interface UseReviewKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useReviewKeyboardShortcuts(
  handlers: ReviewHandlers,
  options: UseReviewKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  // Navigation shortcuts
  useHotkeys('j', handlers.nextStep, {
    enabled,
    description: 'Next step',
    enableOnFormTags: false,
  });
  useHotkeys('down', handlers.nextStep, {
    enabled,
    enableOnFormTags: false,
  });
  useHotkeys('k', handlers.prevStep, {
    enabled,
    description: 'Previous step',
    enableOnFormTags: false,
  });
  useHotkeys('up', handlers.prevStep, {
    enabled,
    enableOnFormTags: false,
  });

  // UI actions
  useHotkeys('m', handlers.addMask, {
    enabled,
    description: 'Add mask',
    enableOnFormTags: false,
  });
  useHotkeys('l', handlers.focusLocatorPicker, {
    enabled,
    description: 'Lock locator',
    enableOnFormTags: false,
  });
  useHotkeys('e', handlers.addAssertion, {
    enabled,
    description: 'Add assertion',
    enableOnFormTags: false,
  });
  useHotkeys('c', handlers.focusComment, {
    enabled,
    description: 'Focus comment field',
    enableOnFormTags: false,
  });

  // View modes
  useHotkeys('1', () => handlers.setViewMode('side-by-side'), {
    enabled,
    description: 'Side-by-side view',
    enableOnFormTags: false,
  });
  useHotkeys('2', () => handlers.setViewMode('slider'), {
    enabled,
    description: 'Slider view',
    enableOnFormTags: false,
  });
  useHotkeys('3', () => handlers.setViewMode('blink'), {
    enabled,
    description: 'Blink view',
    enableOnFormTags: false,
  });
  useHotkeys('4', () => handlers.setViewMode('diff'), {
    enabled,
    description: 'Diff view',
    enableOnFormTags: false,
  });

  // Search
  useHotkeys('/', handlers.openSearch, {
    enabled,
    description: 'Search steps',
    enableOnFormTags: false,
    preventDefault: true,
  });

  // Submit - mod works for both Ctrl (Windows/Linux) and Cmd (Mac)
  useHotkeys('mod+s', handlers.submitReview, {
    enabled,
    description: 'Submit review',
    preventDefault: true,
  });

  // Help - mod+? for cross-platform support
  useHotkeys('mod+?', handlers.showHelp, {
    enabled,
    description: 'Show keyboard shortcuts',
    preventDefault: true,
  });

  // Close modal
  useHotkeys('Escape', handlers.closeModal, {
    enabled,
    description: 'Close modal/cancel',
  });
}

// Export the list of shortcuts for use in the help modal
export const KEYBOARD_SHORTCUTS = [
  // Navigation
  { category: 'Navigation', key: 'j / ↓', description: 'Next step' },
  { category: 'Navigation', key: 'k / ↑', description: 'Previous step' },

  // UI actions
  { category: 'UI Actions', key: 'm', description: 'Add mask' },
  { category: 'UI Actions', key: 'l', description: 'Lock locator' },
  { category: 'UI Actions', key: 'e', description: 'Add assertion' },
  { category: 'UI Actions', key: 'c', description: 'Focus comment field' },

  // View modes
  { category: 'View Modes', key: '1', description: 'Side-by-side' },
  { category: 'View Modes', key: '2', description: 'Slider' },
  { category: 'View Modes', key: '3', description: 'Blink' },
  { category: 'View Modes', key: '4', description: 'Diff' },

  // Other
  { category: 'Other', key: '/', description: 'Search steps' },
  { category: 'Other', key: 'Ctrl+S', description: 'Submit review' },
  { category: 'Other', key: 'Ctrl+?', description: 'Show keyboard shortcuts' },
  { category: 'Other', key: 'Esc', description: 'Close modal/cancel' },
] as const;

export type ShortcutCategory = (typeof KEYBOARD_SHORTCUTS)[number]['category'];
