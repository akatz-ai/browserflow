import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScreenshotViewer, type ViewMode } from './ScreenshotViewer';

describe('ScreenshotViewer', () => {
  const defaultProps = {
    beforeSrc: '/screenshots/before.png',
    afterSrc: '/screenshots/after.png',
    diffSrc: '/screenshots/diff.png',
    mode: 'side-by-side' as ViewMode,
    onModeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mode Selector', () => {
    it('renders all mode buttons', () => {
      render(<ScreenshotViewer {...defaultProps} />);

      expect(screen.getByRole('button', { name: /side-by-side/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slider/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /blink/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /diff/i })).toBeInTheDocument();
    });

    it('does not render diff button when diffSrc is not provided', () => {
      render(<ScreenshotViewer {...defaultProps} diffSrc={undefined} />);

      expect(screen.queryByRole('button', { name: /diff/i })).not.toBeInTheDocument();
    });

    it('calls onModeChange when clicking a mode button', async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();

      render(<ScreenshotViewer {...defaultProps} onModeChange={onModeChange} />);

      await user.click(screen.getByRole('button', { name: /slider/i }));
      expect(onModeChange).toHaveBeenCalledWith('slider');

      await user.click(screen.getByRole('button', { name: /blink/i }));
      expect(onModeChange).toHaveBeenCalledWith('blink');

      await user.click(screen.getByRole('button', { name: /diff/i }));
      expect(onModeChange).toHaveBeenCalledWith('diff');
    });

    it('highlights the active mode button', () => {
      const { rerender } = render(<ScreenshotViewer {...defaultProps} mode="slider" />);

      // Slider should be highlighted (have variant default)
      expect(screen.getByRole('button', { name: /slider/i })).toHaveAttribute(
        'data-active',
        'true'
      );
      expect(screen.getByRole('button', { name: /side-by-side/i })).toHaveAttribute(
        'data-active',
        'false'
      );

      // Rerender with different mode
      rerender(<ScreenshotViewer {...defaultProps} mode="blink" />);
      expect(screen.getByRole('button', { name: /blink/i })).toHaveAttribute(
        'data-active',
        'true'
      );
    });
  });

  describe('Side-by-Side View', () => {
    it('shows both before and after images', () => {
      render(<ScreenshotViewer {...defaultProps} mode="side-by-side" />);

      expect(screen.getByText(/before action/i)).toBeInTheDocument();
      expect(screen.getByText(/after action/i)).toBeInTheDocument();

      const images = screen.getAllByRole('img');
      expect(images.length).toBe(2);
    });
  });

  describe('Slider View', () => {
    it('renders drag handle for comparison', () => {
      render(<ScreenshotViewer {...defaultProps} mode="slider" />);

      expect(screen.getByRole('button', { name: /drag to compare/i })).toBeInTheDocument();
    });

    it('shows both images overlaid', () => {
      render(<ScreenshotViewer {...defaultProps} mode="slider" />);

      const images = screen.getAllByRole('img');
      expect(images.length).toBe(2);
    });

    it('shows before/after labels', () => {
      render(<ScreenshotViewer {...defaultProps} mode="slider" />);

      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
    });
  });

  describe('Blink View', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('alternates between before and after images', () => {
      render(<ScreenshotViewer {...defaultProps} mode="blink" />);

      // Initially shows one image
      let images = screen.getAllByRole('img');
      expect(images.length).toBe(1);
      expect(images[0]).toHaveAttribute('src', '/screenshots/before.png');

      // After 500ms, should show the other image
      act(() => {
        vi.advanceTimersByTime(500);
      });

      images = screen.getAllByRole('img');
      expect(images[0]).toHaveAttribute('src', '/screenshots/after.png');

      // After another 500ms, back to before
      act(() => {
        vi.advanceTimersByTime(500);
      });

      images = screen.getAllByRole('img');
      expect(images[0]).toHaveAttribute('src', '/screenshots/before.png');
    });
  });

  describe('Diff View', () => {
    it('shows the diff image', () => {
      render(<ScreenshotViewer {...defaultProps} mode="diff" />);

      const images = screen.getAllByRole('img');
      // Should show at least the diff image
      expect(images.some(img => img.getAttribute('src') === '/screenshots/diff.png')).toBe(true);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('switches to side-by-side on pressing 1', async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();

      render(
        <ScreenshotViewer {...defaultProps} mode="slider" onModeChange={onModeChange} />
      );

      await user.keyboard('1');
      expect(onModeChange).toHaveBeenCalledWith('side-by-side');
    });

    it('switches to slider on pressing 2', async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();

      render(
        <ScreenshotViewer {...defaultProps} mode="side-by-side" onModeChange={onModeChange} />
      );

      await user.keyboard('2');
      expect(onModeChange).toHaveBeenCalledWith('slider');
    });

    it('switches to blink on pressing 3', async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();

      render(
        <ScreenshotViewer {...defaultProps} mode="side-by-side" onModeChange={onModeChange} />
      );

      await user.keyboard('3');
      expect(onModeChange).toHaveBeenCalledWith('blink');
    });

    it('switches to diff on pressing 4', async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();

      render(
        <ScreenshotViewer {...defaultProps} mode="side-by-side" onModeChange={onModeChange} />
      );

      await user.keyboard('4');
      expect(onModeChange).toHaveBeenCalledWith('diff');
    });
  });

  describe('Mode switching', () => {
    it('mode switching is instant', async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();

      const { rerender } = render(
        <ScreenshotViewer {...defaultProps} mode="side-by-side" onModeChange={onModeChange} />
      );

      // Click slider button
      await user.click(screen.getByRole('button', { name: /slider/i }));

      // Rerender with new mode to simulate parent state update
      rerender(<ScreenshotViewer {...defaultProps} mode="slider" onModeChange={onModeChange} />);

      // Slider view should now be visible (drag handle button)
      expect(screen.getByRole('button', { name: /drag to compare/i })).toBeInTheDocument();
    });
  });
});
