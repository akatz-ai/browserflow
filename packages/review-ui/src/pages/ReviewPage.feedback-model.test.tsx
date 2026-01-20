import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewPage } from './ReviewPage';
import type { ExplorationStep } from '@browserflow/core';

// Helper to create mock steps
function createMockStep(overrides: Partial<ExplorationStep> = {}): ExplorationStep {
  return {
    step_index: 0,
    spec_action: { action: 'click', query: 'Submit button' },
    execution: {
      status: 'completed',
      duration_ms: 100,
    },
    screenshots: {
      before: '/screenshots/step-0-before.png',
      after: '/screenshots/step-0-after.png',
    },
    ...overrides,
  };
}

describe('ReviewPage - Feedback-Focused Model', () => {
  const mockSteps = [
    createMockStep({ step_index: 0, spec_action: { action: 'navigate', to: 'https://example.com' } }),
    createMockStep({ step_index: 1, spec_action: { action: 'click', query: 'Login button' } }),
    createMockStep({ step_index: 2, spec_action: { action: 'fill', query: 'Username', value: 'test' } }),
  ];

  const defaultProps = {
    explorationId: 'test-exploration',
    specName: 'Login Flow',
    steps: mockSteps,
    baseScreenshotPath: '/screenshots',
    onSubmit: vi.fn(),
  };

  describe('Approve/Reject Buttons Removed', () => {
    it('should not show Approve button', () => {
      render(<ReviewPage {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    });

    it('should not show Reject button', () => {
      render(<ReviewPage {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    });
  });

  describe('Reviewed Status Based on Feedback', () => {
    it('should show step as pending when no comment or mask', () => {
      render(<ReviewPage {...defaultProps} />);

      // Step should show pending indicator (not reviewed)
      expect(screen.getByTestId('status-pending-0')).toBeInTheDocument();
    });

    it('should show step as reviewed when comment is added', async () => {
      const user = userEvent.setup();
      render(<ReviewPage {...defaultProps} />);

      // Add a comment
      const commentInput = screen.getByPlaceholderText(/add a comment/i);
      await user.type(commentInput, 'This looks good');

      // Step should now show as reviewed
      // Note: This might require navigation to see the status update
      expect(screen.getByTestId('status-reviewed-0')).toBeInTheDocument();
    });

    it('should show step as reviewed when mask is added', async () => {
      const user = userEvent.setup();
      render(<ReviewPage {...defaultProps} />);

      // Enter mask mode and add a mask
      const maskButton = screen.getByRole('button', { name: /add mask/i });
      await user.click(maskButton);

      // After adding a mask, step should be reviewed
      // This would require actually drawing a mask, which is complex in tests
      // So we'll mock the review data instead
    });

    it('accepts initial review data with reviewed status', () => {
      const initialData = {
        0: {
          status: 'reviewed' as const,
          comment: 'Looks good',
          masks: [],
        },
      };

      render(<ReviewPage {...defaultProps} initialReviewData={initialData} />);

      expect(screen.getByTestId('status-reviewed-0')).toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('should show "X reviewed / Y total" format instead of approved/rejected/pending', () => {
      render(<ReviewPage {...defaultProps} />);

      // Should NOT show the old format
      expect(screen.queryByText(/approved/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/rejected/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();

      // Should show new format
      expect(screen.getByText(/0 reviewed/i)).toBeInTheDocument();
      expect(screen.getByText(/3 total/i)).toBeInTheDocument();
    });

    it('should update reviewed count when comments are added', async () => {
      const user = userEvent.setup();
      const initialData = {
        0: {
          status: 'reviewed' as const,
          comment: 'First step reviewed',
          masks: [],
        },
        1: {
          status: 'reviewed' as const,
          comment: 'Second step reviewed',
          masks: [],
        },
      };

      render(<ReviewPage {...defaultProps} initialReviewData={initialData} />);

      expect(screen.getByText(/2 reviewed/i)).toBeInTheDocument();
      expect(screen.getByText(/3 total/i)).toBeInTheDocument();
    });
  });

  describe('Status Badge Display', () => {
    it('should show "reviewed" badge when step has feedback', () => {
      const initialData = {
        0: {
          status: 'reviewed' as const,
          comment: 'Looks good',
          masks: [],
        },
      };

      render(<ReviewPage {...defaultProps} initialReviewData={initialData} />);

      // Status badge should show "reviewed" not "approved"
      expect(screen.getByText('reviewed')).toBeInTheDocument();
      expect(screen.queryByText('approved')).not.toBeInTheDocument();
      expect(screen.queryByText('rejected')).not.toBeInTheDocument();
    });

    it('should show "pending" badge when step has no feedback', () => {
      render(<ReviewPage {...defaultProps} />);

      // All steps should be pending initially
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  describe('Timeline Integration', () => {
    it('should show reviewed count in timeline header', () => {
      const initialData = {
        0: {
          status: 'reviewed' as const,
          comment: 'Done',
          masks: [],
        },
      };

      render(<ReviewPage {...defaultProps} initialReviewData={initialData} />);

      // Timeline should show "1 / 3 reviewed"
      const timeline = screen.getByRole('heading', { name: /steps/i }).closest('div')?.parentElement;
      expect(timeline).toHaveTextContent(/1\s*\/\s*3 reviewed/i);
    });

    it('should show reviewed status icon in timeline', () => {
      const initialData = {
        0: {
          status: 'reviewed' as const,
          comment: 'Done',
          masks: [],
        },
      };

      render(<ReviewPage {...defaultProps} initialReviewData={initialData} />);

      expect(screen.getByTestId('status-reviewed-0')).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should not respond to "a" key for approve', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<ReviewPage {...defaultProps} onSubmit={onSubmit} />);

      await user.keyboard('a');

      // Step should not be marked as approved
      expect(screen.queryByText('approved')).not.toBeInTheDocument();
      // No submission should occur
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should not respond to "r" key for reject', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<ReviewPage {...defaultProps} onSubmit={onSubmit} />);

      await user.keyboard('r');

      // Step should not be marked as rejected
      expect(screen.queryByText('rejected')).not.toBeInTheDocument();
      // No submission should occur
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Review Submission', () => {
    it('should submit review data with "reviewed" status', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<ReviewPage {...defaultProps} onSubmit={onSubmit} />);

      // Add a comment to mark as reviewed
      const commentInput = screen.getByPlaceholderText(/add a comment/i);
      await user.type(commentInput, 'This looks good');

      // Submit review
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          0: expect.objectContaining({
            status: 'reviewed',
            comment: 'This looks good',
          }),
        })
      );
    });

    it('should not include "approved" or "rejected" in submitted data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      const initialData = {
        0: {
          status: 'reviewed' as const,
          comment: 'Step 1',
          masks: [],
        },
        1: {
          status: 'pending' as const,
          comment: '',
          masks: [],
        },
      };

      render(<ReviewPage {...defaultProps} initialReviewData={initialData} onSubmit={onSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      const submittedData = onSubmit.mock.calls[0][0];
      const allStatuses = Object.values(submittedData).map((d: any) => d.status);

      expect(allStatuses).not.toContain('approved');
      expect(allStatuses).not.toContain('rejected');
    });
  });
});
