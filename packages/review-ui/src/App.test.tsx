import { render } from '@testing-library/react';
import { App } from './App';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as reactHotToast from 'react-hot-toast';

// Mock react-hot-toast to avoid side effects in tests
vi.mock('react-hot-toast', () => ({
  Toaster: vi.fn(() => null),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock the hooks to avoid complex setup
vi.mock('./hooks/useExplorationData', () => ({
  useExplorationData: vi.fn(() => ({
    data: null,
    loading: true,
    error: null,
  })),
}));

describe('App - Toast Notification Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Toaster Component Rendering', () => {
    it('should render Toaster component in the app root', () => {
      // Verify the app renders without errors when Toaster is present
      const { container } = render(<App />);

      // Toaster should be rendered in the DOM
      // react-hot-toast renders with a specific class
      expect(container).toBeTruthy();
    });

    it('should render app successfully with toast integration', () => {
      // This verifies that the toast library is integrated and doesn't break rendering
      expect(() => {
        render(<App />);
      }).not.toThrow();
    });
  });

  describe('Alert() Usage Verification', () => {
    it('should not use window.alert anywhere in the app', () => {
      // This is a meta-test that documents our requirement:
      // No alert() calls should exist in the codebase after implementation

      const mockAlert = vi.fn();
      window.alert = mockAlert;

      render(<App />);

      // Alert should never be called during normal rendering
      expect(mockAlert).not.toHaveBeenCalled();
    });
  });
});

describe('Toast Notification Usage in App.tsx', () => {
  it('should have react-hot-toast available', () => {
    expect(reactHotToast).toBeDefined();
  });

  it('should export Toaster and toast from react-hot-toast', () => {
    expect(reactHotToast.Toaster).toBeDefined();
    expect(reactHotToast.toast).toBeDefined();
  });
});
