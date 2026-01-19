import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocatorPicker, type LocatorCandidate } from './LocatorPicker';
import type { LegacyLocatorObject } from '@browserflow/core';

// Helper to create mock candidates
function createMockCandidate(overrides: Partial<LocatorCandidate> = {}): LocatorCandidate {
  return {
    strategy: { type: 'testid', value: 'submit-button' },
    confidence: 0.95,
    matchCount: 1,
    ...overrides,
  };
}

describe('LocatorPicker', () => {
  const defaultProps = {
    candidates: [
      createMockCandidate({
        strategy: { type: 'testid', value: 'submit-button' },
        confidence: 0.95,
        matchCount: 1,
      }),
      createMockCandidate({
        strategy: { type: 'role', role: 'button', name: 'Submit' },
        confidence: 0.85,
        matchCount: 1,
      }),
      createMockCandidate({
        strategy: { type: 'css', selector: '.btn-primary' },
        confidence: 0.70,
        matchCount: 3,
      }),
    ],
    currentLocator: undefined as LegacyLocatorObject | undefined,
    onLockLocator: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Candidate Display', () => {
    it('renders all candidates with their confidence scores', () => {
      render(<LocatorPicker {...defaultProps} />);

      expect(screen.getByText(/95%/)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
    });

    it('displays match count for each candidate', () => {
      render(<LocatorPicker {...defaultProps} />);

      // Two candidates have 1 match
      expect(screen.getAllByText(/1 match$/).length).toBe(2);
      expect(screen.getByText(/3 matches/)).toBeInTheDocument();
    });

    it('displays strategy type badges', () => {
      render(<LocatorPicker {...defaultProps} />);

      expect(screen.getByText('testid')).toBeInTheDocument();
      expect(screen.getByText('role')).toBeInTheDocument();
      expect(screen.getByText('css')).toBeInTheDocument();
    });

    it('formats testid strategy correctly', () => {
      render(<LocatorPicker {...defaultProps} />);

      expect(screen.getByText(/data-testid="submit-button"/)).toBeInTheDocument();
    });

    it('formats role strategy correctly', () => {
      render(<LocatorPicker {...defaultProps} />);

      expect(screen.getByText(/getByRole\('button'/)).toBeInTheDocument();
    });

    it('formats css strategy correctly', () => {
      render(<LocatorPicker {...defaultProps} />);

      expect(screen.getByText(/\.btn-primary/)).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('allows selecting a candidate by clicking', async () => {
      const user = userEvent.setup();
      render(<LocatorPicker {...defaultProps} />);

      // Find and click the second candidate row
      const candidateRows = screen.getAllByTestId('candidate-row');
      await user.click(candidateRows[1]);

      // Second row should now be selected (has border highlighting)
      expect(candidateRows[1]).toHaveClass('border-blue-500');
    });

    it('first candidate is selected by default', () => {
      render(<LocatorPicker {...defaultProps} />);

      const candidateRows = screen.getAllByTestId('candidate-row');
      expect(candidateRows[0]).toHaveClass('border-blue-500');
    });
  });

  describe('Locking', () => {
    it('calls onLockLocator when clicking lock button', async () => {
      const user = userEvent.setup();
      const onLockLocator = vi.fn();

      render(<LocatorPicker {...defaultProps} onLockLocator={onLockLocator} />);

      await user.click(screen.getByRole('button', { name: /lock selected/i }));

      expect(onLockLocator).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getByTestId',
          args: expect.objectContaining({ testId: 'submit-button' }),
        })
      );
    });

    it('calls onLockLocator with selected candidate when clicking inline lock', async () => {
      const user = userEvent.setup();
      const onLockLocator = vi.fn();

      render(<LocatorPicker {...defaultProps} onLockLocator={onLockLocator} />);

      // Select second candidate and lock it
      const candidateRows = screen.getAllByTestId('candidate-row');
      await user.click(candidateRows[1]);

      await user.click(screen.getByRole('button', { name: /lock selected/i }));

      expect(onLockLocator).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getByRole',
          args: expect.objectContaining({ role: 'button', name: 'Submit' }),
        })
      );
    });
  });

  describe('Current Locked Locator Display', () => {
    it('shows "Not locked" badge when no locator is locked', () => {
      render(<LocatorPicker {...defaultProps} />);

      expect(screen.getByText('Not locked')).toBeInTheDocument();
    });

    it('shows "Locked" badge when a locator is locked', () => {
      const lockedLocator: LegacyLocatorObject = {
        method: 'getByTestId',
        args: { testId: 'submit-button' },
        description: 'Submit button',
      };

      render(<LocatorPicker {...defaultProps} currentLocator={lockedLocator} />);

      expect(screen.getByText('Locked')).toBeInTheDocument();
    });

    it('displays the currently locked locator details', () => {
      const lockedLocator: LegacyLocatorObject = {
        method: 'getByTestId',
        args: { testId: 'submit-button' },
        description: 'Submit button',
      };

      render(<LocatorPicker {...defaultProps} currentLocator={lockedLocator} />);

      // Use exact match to avoid matching "Lock Selected as Preferred"
      expect(screen.getByText('Preferred')).toBeInTheDocument();
      // Also check that the locator details are shown
      expect(screen.getByText(/getByTestId/)).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('displays "Locator" heading', () => {
      render(<LocatorPicker {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /locator/i })).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    // Note: 'l' key for focusing locator picker is now handled by parent via useReviewKeyboardShortcuts
    // Parent controls focus behavior when the shortcut is triggered

    it('picker is focusable via tabIndex', () => {
      render(<LocatorPicker {...defaultProps} />);
      const picker = screen.getByTestId('locator-picker');

      // Verify it has tabIndex set so it can be focused programmatically
      expect(picker).toHaveAttribute('tabIndex');
    });
  });

  describe('Label Strategy', () => {
    it('formats label strategy correctly', () => {
      const propsWithLabel = {
        ...defaultProps,
        candidates: [
          createMockCandidate({
            strategy: { type: 'label', text: 'Email address' },
            confidence: 0.90,
            matchCount: 1,
          }),
        ],
      };

      render(<LocatorPicker {...propsWithLabel} />);

      expect(screen.getByText(/getByLabel\('Email address'\)/)).toBeInTheDocument();
    });
  });
});
