import type { ExplorationStep } from '@browserflow-ai/core';
import { cn } from '@/lib/utils';

export interface StepTimelineProps {
  steps: ExplorationStep[];
  currentStepIndex: number;
  reviewStatus: Record<number, 'reviewed' | 'pending'>;
  onSelectStep: (stepIndex: number) => void;
  getScreenshotUrl?: (path?: string) => string;
}

export function StepTimeline({
  steps,
  currentStepIndex,
  reviewStatus,
  onSelectStep,
  getScreenshotUrl,
}: StepTimelineProps) {
  const reviewedCount = Object.values(reviewStatus).filter(
    (status) => status === 'reviewed'
  ).length;

  return (
    <div className="w-48 border-r flex flex-col h-full">
      <div className="p-2 border-b">
        <h2 className="font-semibold">Steps</h2>
        <div className="text-sm text-muted-foreground">
          {reviewedCount} / {steps.length} reviewed
        </div>
      </div>

      <div
        className="space-y-1 p-2 overflow-y-auto flex-1"
        data-testid="step-timeline-container"
      >
        {steps.map((step, index) => (
          <StepThumbnail
            key={step.step_index}
            step={step}
            index={index}
            status={reviewStatus[step.step_index] || 'pending'}
            isSelected={step.step_index === currentStepIndex}
            onClick={() => onSelectStep(step.step_index)}
            getScreenshotUrl={getScreenshotUrl}
          />
        ))}
      </div>
    </div>
  );
}

interface StepThumbnailProps {
  step: ExplorationStep;
  index: number;
  status: 'reviewed' | 'pending';
  isSelected: boolean;
  onClick: () => void;
  getScreenshotUrl?: (path?: string) => string;
}

/**
 * Get display name for a step
 * Priority: name > prettified id > fallback to "Step N"
 */
function getStepDisplayName(step: ExplorationStep): string {
  const specAction = step.spec_action as { name?: string; id?: string };

  // Use name if provided
  if (specAction.name) {
    return specAction.name;
  }

  // Prettify id (e.g., "open-comfygit-panel" -> "Open Comfygit Panel")
  if (specAction.id) {
    return specAction.id
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // Fallback
  return `Step ${step.step_index}`;
}

function StepThumbnail({
  step,
  index,
  status,
  isSelected,
  onClick,
  getScreenshotUrl,
}: StepThumbnailProps) {
  const thumbnailSrc = getScreenshotUrl
    ? getScreenshotUrl(step.screenshots?.after)
    : step.screenshots?.after;

  const displayName = getStepDisplayName(step);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-2 rounded text-left transition-colors',
        isSelected && 'bg-accent',
        !isSelected && 'hover:bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={status} stepIndex={step.step_index} />

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {index + 1}. {displayName}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {step.spec_action.action}
          </div>
        </div>
      </div>

      {thumbnailSrc && (
        <img
          src={thumbnailSrc}
          alt=""
          className="mt-2 w-full h-16 object-cover rounded"
        />
      )}
    </button>
  );
}

interface StatusIconProps {
  status: 'reviewed' | 'pending';
  stepIndex: number;
}

function StatusIcon({ status, stepIndex }: StatusIconProps) {
  switch (status) {
    case 'reviewed':
      return (
        <CheckCircleIcon
          className="h-4 w-4 text-cyan-500"
          data-testid={`status-reviewed-${stepIndex}`}
        />
      );
    case 'pending':
      return (
        <CircleIcon
          className="h-4 w-4 text-yellow-500"
          data-testid={`status-pending-${stepIndex}`}
        />
      );
  }
}

// Simple SVG icons to avoid external dependency
function CheckCircleIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  );
}

function CircleIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
