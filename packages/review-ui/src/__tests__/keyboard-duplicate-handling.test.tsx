import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaskEditor } from '../components/MaskEditor';
import { LocatorPicker } from '../components/LocatorPicker';
import { ScreenshotViewer } from '../components/ScreenshotViewer';
import { useReviewKeyboardShortcuts, type ReviewHandlers } from '../hooks/useReviewKeyboardShortcuts';
import { useRef } from 'react';

/**
 * Integration tests to verify keyboard shortcuts trigger exactly once
 * and there are no race conditions from duplicate event handlers.
 *
 * CURRENT STATE: These tests SHOULD FAIL because:
 * - MaskEditor has window.addEventListener for 'm'
 * - LocatorPicker has window.addEventListener for 'l'
 * - ScreenshotViewer has window.addEventListener for '1-4'
 * - useReviewKeyboardShortcuts ALSO handles m, l, 1-4
 *
 * This causes shortcuts to fire twice, creating conflicts.
 */

describe('Keyboard Shortcut Duplicate Handling', () => {
  describe('MaskEditor - "m" key should trigger exactly once', () => {
    it('should call addMask handler only once when m is pressed', async () => {
      const user = userEvent.setup();
      const addMask = vi.fn();

      // Component that uses both the hook and MaskEditor
      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask, // This is what should be called from the hook
          focusLocatorPicker: vi.fn(),
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode: vi.fn(),
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <MaskEditor
            imageSrc="/test.png"
            masks={[]}
            onMasksChange={vi.fn()}
            enabled={true}
          />
        );
      }

      render(<TestComponent />);

      // Press 'm' key
      await user.keyboard('m');

      // EXPECTED: addMask should be called exactly once from the hook
      expect(addMask).toHaveBeenCalledTimes(1);
    });

    it('should not have race conditions with rapid m key presses', async () => {
      const user = userEvent.setup();
      const addMask = vi.fn();

      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask,
          focusLocatorPicker: vi.fn(),
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode: vi.fn(),
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <MaskEditor
            imageSrc="/test.png"
            masks={[]}
            onMasksChange={vi.fn()}
            enabled={true}
          />
        );
      }

      render(<TestComponent />);

      // Rapidly press 'm' 5 times
      await user.keyboard('mmmmm');

      // EXPECTED: addMask called exactly 5 times (once per press)
      expect(addMask).toHaveBeenCalledTimes(5);
    });
  });

  describe('LocatorPicker - "l" key should trigger exactly once', () => {
    it('should call focusLocatorPicker handler only once when l is pressed', async () => {
      const user = userEvent.setup();
      const focusLocatorPicker = vi.fn();

      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask: vi.fn(),
          focusLocatorPicker, // This is what should be called
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode: vi.fn(),
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <LocatorPicker
            candidates={[]}
            onLockLocator={vi.fn()}
          />
        );
      }

      render(<TestComponent />);

      // Press 'l' key
      await user.keyboard('l');

      // EXPECTED: focusLocatorPicker should be called exactly once
      // ACTUAL: Called from both hook and LocatorPicker's addEventListener
      expect(focusLocatorPicker).toHaveBeenCalledTimes(1);
    });

    it('should not have race conditions with rapid l key presses', async () => {
      const user = userEvent.setup();
      const focusLocatorPicker = vi.fn();

      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask: vi.fn(),
          focusLocatorPicker,
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode: vi.fn(),
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <LocatorPicker
            candidates={[]}
            onLockLocator={vi.fn()}
          />
        );
      }

      render(<TestComponent />);

      // Rapidly press 'l' 5 times
      await user.keyboard('lllll');

      // EXPECTED: focusLocatorPicker called exactly 5 times
      expect(focusLocatorPicker).toHaveBeenCalledTimes(5);
    });
  });

  describe('ScreenshotViewer - view mode keys (1-4) should trigger exactly once', () => {
    it('should call setViewMode handler only once when 1 is pressed', async () => {
      const user = userEvent.setup();
      const setViewMode = vi.fn();
      const onModeChange = vi.fn();

      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask: vi.fn(),
          focusLocatorPicker: vi.fn(),
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode, // This is what should be called from hook
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <ScreenshotViewer
            beforeSrc="/before.png"
            afterSrc="/after.png"
            mode="side-by-side"
            onModeChange={onModeChange} // This is called from ScreenshotViewer's addEventListener
          />
        );
      }

      render(<TestComponent />);

      // Press '1' key
      await user.keyboard('1');

      // EXPECTED: setViewMode called exactly once with 'side-by-side'
      // ACTUAL: Both setViewMode (from hook) and onModeChange (from component) are called
      expect(setViewMode).toHaveBeenCalledTimes(1);
      expect(setViewMode).toHaveBeenCalledWith('side-by-side');
    });

    it('should handle all view mode keys (1-4) exactly once each', async () => {
      const user = userEvent.setup();
      const setViewMode = vi.fn();

      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask: vi.fn(),
          focusLocatorPicker: vi.fn(),
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode,
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <ScreenshotViewer
            beforeSrc="/before.png"
            afterSrc="/after.png"
            diffSrc="/diff.png"
            mode="side-by-side"
            onModeChange={vi.fn()}
          />
        );
      }

      render(<TestComponent />);

      // Press each view mode key
      await user.keyboard('1');
      await user.keyboard('2');
      await user.keyboard('3');
      await user.keyboard('4');

      // EXPECTED: setViewMode called exactly 4 times, once for each key
      expect(setViewMode).toHaveBeenCalledTimes(4);
      expect(setViewMode).toHaveBeenNthCalledWith(1, 'side-by-side');
      expect(setViewMode).toHaveBeenNthCalledWith(2, 'slider');
      expect(setViewMode).toHaveBeenNthCalledWith(3, 'blink');
      expect(setViewMode).toHaveBeenNthCalledWith(4, 'diff');
    });

    it('should not have race conditions with rapid view mode key presses', async () => {
      const user = userEvent.setup();
      const setViewMode = vi.fn();

      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask: vi.fn(),
          focusLocatorPicker: vi.fn(),
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode,
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <ScreenshotViewer
            beforeSrc="/before.png"
            afterSrc="/after.png"
            diffSrc="/diff.png"
            mode="side-by-side"
            onModeChange={vi.fn()}
          />
        );
      }

      render(<TestComponent />);

      // Rapidly cycle through view modes multiple times
      await user.keyboard('1234123412341234');

      // EXPECTED: setViewMode called exactly 16 times (4 keys × 4 repetitions)
      expect(setViewMode).toHaveBeenCalledTimes(16);
    });
  });

  describe('All components together - no cross-interference', () => {
    it('should handle all shortcuts independently without interference', async () => {
      const user = userEvent.setup();
      const addMask = vi.fn();
      const focusLocatorPicker = vi.fn();
      const setViewMode = vi.fn();

      function TestComponent() {
        const handlers: ReviewHandlers = {
          nextStep: vi.fn(),
          prevStep: vi.fn(),
                    addMask,
          focusLocatorPicker,
          addAssertion: vi.fn(),
          focusComment: vi.fn(),
          setViewMode,
          openSearch: vi.fn(),
          submitReview: vi.fn(),
          showHelp: vi.fn(),
          closeModal: vi.fn(),
        };

        useReviewKeyboardShortcuts(handlers);

        return (
          <div>
            <MaskEditor
              imageSrc="/test.png"
              masks={[]}
              onMasksChange={vi.fn()}
              enabled={true}
            />
            <LocatorPicker
              candidates={[]}
              onLockLocator={vi.fn()}
            />
            <ScreenshotViewer
              beforeSrc="/before.png"
              afterSrc="/after.png"
              mode="side-by-side"
              onModeChange={vi.fn()}
            />
          </div>
        );
      }

      render(<TestComponent />);

      // Press m, l, and view mode keys
      await user.keyboard('m');
      await user.keyboard('l');
      await user.keyboard('1');
      await user.keyboard('2');

      // EXPECTED: Each handler called exactly once
      expect(addMask).toHaveBeenCalledTimes(1);
      expect(focusLocatorPicker).toHaveBeenCalledTimes(1);
      expect(setViewMode).toHaveBeenCalledTimes(2); // Once for '1', once for '2'
      expect(setViewMode).toHaveBeenCalledWith('side-by-side');
      expect(setViewMode).toHaveBeenCalledWith('slider');
    });
  });
});
