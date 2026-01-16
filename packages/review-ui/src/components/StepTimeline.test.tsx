import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('StepTimeline', () => {
  const defaultProps = {
    steps: [
      createMockStep({ step_index: 0, spec_action: { action: 'navigate', to: 'https://example.com' } }),
      createMockStep({ step_index: 1, spec_action: { action: 'click', query: 'Login button' } }),
      createMockStep({ step_index: 2, spec_action: { action: 'fill', query: 'Username', value: 'test' } }),
    ],
    currentStepIndex: 0,
    reviewStatus: {} as Record<number, 'approved' | 'rejected' | 'pending'>,
    onSelectStep: vi.fn(),
  };

  it('renders all steps with their indices', () => {
    render(<StepTimeline {...defaultProps} />);

    expect(screen.getByText(/1\./)).toBeInTheDocument();
    expect(screen.getByText(/2\./)).toBeInTheDocument();
    expect(screen.getByText(/3\./)).toBeInTheDocument();
  });

  it('displays step action descriptions', () => {
    render(<StepTimeline {...defaultProps} />);

    expect(screen.getByText(/navigate/i)).toBeInTheDocument();
    expect(screen.getByText(/click/i)).toBeInTheDocument();
    expect(screen.getByText(/fill/i)).toBeInTheDocument();
  });

  it('shows approval progress count', () => {
    const propsWithReviews = {
      ...defaultProps,
      reviewStatus: {
        0: 'approved' as const,
        1: 'approved' as const,
        2: 'pending' as const,
      },
    };

    render(<StepTimeline {...propsWithReviews} />);

    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();
  });

  it('highlights the current step', () => {
    render(<StepTimeline {...defaultProps} currentStepIndex={1} />);

    const buttons = screen.getAllByRole('button');
    // Second button (index 1) should have the selected styling
    expect(buttons[1]).toHaveClass('bg-accent');
  });

  it('calls onSelectStep when clicking a step', async () => {
    const user = userEvent.setup();
    const onSelectStep = vi.fn();

    render(<StepTimeline {...defaultProps} onSelectStep={onSelectStep} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[1]);

    expect(onSelectStep).toHaveBeenCalledWith(1);
  });

  it('displays status icons for each step', () => {
    const propsWithReviews = {
      ...defaultProps,
      reviewStatus: {
        0: 'approved' as const,
        1: 'rejected' as const,
        2: 'pending' as const,
      },
    };

    render(<StepTimeline {...propsWithReviews} />);

    // Check for status indicator elements
    expect(screen.getByTestId('status-approved-0')).toBeInTheDocument();
    expect(screen.getByTestId('status-rejected-1')).toBeInTheDocument();
    expect(screen.getByTestId('status-pending-2')).toBeInTheDocument();
  });

  it('shows thumbnail images when available', () => {
    render(<StepTimeline {...defaultProps} />);

    // Images with alt="" have role="presentation" for accessibility
    const images = screen.getAllByRole('presentation');
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toHaveAttribute('src', '/screenshots/step-0-after.png');
  });

  it('handles steps without screenshots gracefully', () => {
    const stepsWithoutScreenshots = [
      createMockStep({ step_index: 0, screenshots: {} }),
    ];

    render(
      <StepTimeline
        {...defaultProps}
        steps={stepsWithoutScreenshots}
      />
    );

    // Should render without crashing, no images present
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('is scrollable when there are many steps', () => {
    const manySteps = Array.from({ length: 20 }, (_, i) =>
      createMockStep({ step_index: i, spec_action: { action: 'click', query: `Step ${i}` } })
    );

    render(<StepTimeline {...defaultProps} steps={manySteps} />);

    const container = screen.getByTestId('step-timeline-container');
    expect(container).toHaveClass('overflow-y-auto');
  });

  it('shows header with "Steps" title', () => {
    render(<StepTimeline {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /steps/i })).toBeInTheDocument();
  });
});
