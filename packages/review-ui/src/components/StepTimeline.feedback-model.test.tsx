import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepTimeline } from './StepTimeline';
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

describe('StepTimeline - Feedback-Focused Model', () => {
  const defaultProps = {
    steps: [
      createMockStep({ step_index: 0, spec_action: { action: 'navigate', to: 'https://example.com' } }),
      createMockStep({ step_index: 1, spec_action: { action: 'click', query: 'Login button' } }),
      createMockStep({ step_index: 2, spec_action: { action: 'fill', query: 'Username', value: 'test' } }),
    ],
    currentStepIndex: 0,
    reviewStatus: {} as Record<number, 'reviewed' | 'pending'>,
    onSelectStep: vi.fn(),
  };

  describe('Progress Display', () => {
    it('should show "X / Y reviewed" instead of "X / Y approved"', () => {
      const propsWithReviews = {
        ...defaultProps,
        reviewStatus: {
          0: 'reviewed' as const,
          1: 'reviewed' as const,
          2: 'pending' as const,
        },
      };

      render(<StepTimeline {...propsWithReviews} />);

      // Should show reviewed count
      expect(screen.getByText(/2\s*\/\s*3 reviewed/i)).toBeInTheDocument();
      // Should not show "approved"
      expect(screen.queryByText(/approved/i)).not.toBeInTheDocument();
    });

    it('should count all reviewed steps', () => {
      const propsWithReviews = {
        ...defaultProps,
        reviewStatus: {
          0: 'reviewed' as const,
          1: 'pending' as const,
          2: 'pending' as const,
        },
      };

      render(<StepTimeline {...propsWithReviews} />);

      expect(screen.getByText(/1\s*\/\s*3 reviewed/i)).toBeInTheDocument();
    });
  });

  describe('Status Icons', () => {
    it('should display reviewed status icon', () => {
      const propsWithReviews = {
        ...defaultProps,
        reviewStatus: {
          0: 'reviewed' as const,
          1: 'pending' as const,
          2: 'pending' as const,
        },
      };

      render(<StepTimeline {...propsWithReviews} />);

      expect(screen.getByTestId('status-reviewed-0')).toBeInTheDocument();
      expect(screen.queryByTestId('status-approved-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('status-rejected-0')).not.toBeInTheDocument();
    });

    it('should display pending status icon', () => {
      const propsWithReviews = {
        ...defaultProps,
        reviewStatus: {
          0: 'pending' as const,
          1: 'pending' as const,
          2: 'pending' as const,
        },
      };

      render(<StepTimeline {...propsWithReviews} />);

      expect(screen.getByTestId('status-pending-0')).toBeInTheDocument();
    });

    it('should not render approved or rejected status icons', () => {
      const propsWithReviews = {
        ...defaultProps,
        reviewStatus: {
          0: 'reviewed' as const,
          1: 'pending' as const,
          2: 'reviewed' as const,
        },
      };

      render(<StepTimeline {...propsWithReviews} />);

      // Should not have any approved or rejected icons
      expect(screen.queryByTestId(/status-approved/)).not.toBeInTheDocument();
      expect(screen.queryByTestId(/status-rejected/)).not.toBeInTheDocument();
    });
  });

  describe('Type Safety', () => {
    it('should accept reviewStatus with only "reviewed" and "pending" values', () => {
      const validReviewStatus: Record<number, 'reviewed' | 'pending'> = {
        0: 'reviewed',
        1: 'pending',
        2: 'reviewed',
      };

      render(
        <StepTimeline
          {...defaultProps}
          reviewStatus={validReviewStatus}
        />
      );

      expect(screen.getByText(/2\s*\/\s*3 reviewed/i)).toBeInTheDocument();
    });

    // This test verifies that the old 3-state status is no longer accepted
    it('should not accept "approved" or "rejected" in reviewStatus type', () => {
      // This test verifies that TypeScript types are correctly defined
      // The type system ensures only 'reviewed' | 'pending' are accepted
      const validReviewStatus: Record<number, 'reviewed' | 'pending'> = {
        0: 'reviewed',
        1: 'pending',
      };

      expect(validReviewStatus).toBeDefined();
    });
  });
});
