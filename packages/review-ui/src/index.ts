// @browserflow/review-ui - React review application
// This package is primarily used as a Vite SPA (via main.tsx)
// Library exports for embedding components can be added here

export { cn } from './lib/utils';

// Components
export { StepTimeline, type StepTimelineProps } from './components/StepTimeline';
export {
  ScreenshotViewer,
  type ScreenshotViewerProps,
  type ViewMode,
} from './components/ScreenshotViewer';
export {
  LocatorPicker,
  type LocatorPickerProps,
  type LocatorCandidate,
  type LocatorStrategy,
} from './components/LocatorPicker';
export {
  KeyboardShortcutsHelp,
  type KeyboardShortcutsHelpProps,
} from './components/KeyboardShortcutsHelp';
export {
  MaskEditor,
  type MaskEditorProps,
  type Mask,
} from './components/MaskEditor';

// Hooks
export {
  useReviewKeyboardShortcuts,
  KEYBOARD_SHORTCUTS,
  type ReviewHandlers,
  type UseReviewKeyboardShortcutsOptions,
  type ShortcutCategory,
} from './hooks/useReviewKeyboardShortcuts';
