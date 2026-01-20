import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

describe('KeyboardShortcutsHelp', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  it('renders dialog when open is true', () => {
    render(<KeyboardShortcutsHelp {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render dialog when open is false', () => {
    render(<KeyboardShortcutsHelp {...defaultProps} open={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays the title "Keyboard Shortcuts"', () => {
    render(<KeyboardShortcutsHelp {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /keyboard shortcuts/i })).toBeInTheDocument();
  });

  describe('navigation shortcuts', () => {
    it('shows j/down arrow shortcut for next step', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/next step/i)).toBeInTheDocument();
      // Check for the "j / ↓" key display
      expect(screen.getByText('j / ↓')).toBeInTheDocument();
    });

    it('shows k/up arrow shortcut for previous step', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/previous step/i)).toBeInTheDocument();
      // Check for the "k / ↑" key display
      expect(screen.getByText('k / ↑')).toBeInTheDocument();
    });
  });

  describe('UI action shortcuts', () => {
    it('shows m shortcut for add mask', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/add mask/i)).toBeInTheDocument();
      expect(screen.getByText(/^m$/)).toBeInTheDocument();
    });

    it('shows l shortcut for lock locator', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/lock locator/i)).toBeInTheDocument();
      expect(screen.getByText(/^l$/)).toBeInTheDocument();
    });

    it('shows e shortcut for add assertion', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/add assertion/i)).toBeInTheDocument();
      expect(screen.getByText(/^e$/)).toBeInTheDocument();
    });

    it('shows c shortcut for focus comment', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/focus comment/i)).toBeInTheDocument();
      expect(screen.getByText(/^c$/)).toBeInTheDocument();
    });
  });

  describe('view mode shortcuts', () => {
    it('shows 1-4 shortcuts for view modes', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/side-by-side/i)).toBeInTheDocument();
      expect(screen.getByText(/slider/i)).toBeInTheDocument();
      expect(screen.getByText(/blink/i)).toBeInTheDocument();
      expect(screen.getByText(/diff/i)).toBeInTheDocument();
    });
  });

  describe('other shortcuts', () => {
    it('shows / shortcut for search', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/search/i)).toBeInTheDocument();
      expect(screen.getByText(/^\/$/).closest('[data-shortcut]')).toBeInTheDocument();
    });

    it('shows Ctrl+S shortcut for submit review', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      expect(screen.getByText(/submit review/i)).toBeInTheDocument();
    });

    it('shows Escape shortcut for close modal', () => {
      render(<KeyboardShortcutsHelp {...defaultProps} />);

      // The description contains "Close modal/cancel"
      expect(screen.getByText(/close modal\/cancel/i)).toBeInTheDocument();
      // The key binding shows "Esc" (appears in both shortcut list and footer)
      const escElements = screen.getAllByText('Esc');
      expect(escElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<KeyboardShortcutsHelp open={true} onOpenChange={onOpenChange} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('groups shortcuts by category', () => {
    render(<KeyboardShortcutsHelp {...defaultProps} />);

    expect(screen.getByText(/navigation/i)).toBeInTheDocument();
    expect(screen.getByText(/ui actions/i)).toBeInTheDocument();
    expect(screen.getByText(/view modes/i)).toBeInTheDocument();
  });

  it('renders keyboard shortcuts with kbd styling', () => {
    render(<KeyboardShortcutsHelp {...defaultProps} />);

    const kbdElements = screen.getAllByTestId('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
    expect(kbdElements[0]).toHaveClass('bg-muted');
  });
});
