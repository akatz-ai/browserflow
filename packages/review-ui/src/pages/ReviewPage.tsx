import { useCallback, useRef, useState } from 'react';
import type { ExplorationStep, LegacyLocatorObject } from '@browserflow/core';
import { StepTimeline } from '../components/StepTimeline';
import { ScreenshotViewer, type ViewMode } from '../components/ScreenshotViewer';
import { MaskEditor, type Mask } from '../components/MaskEditor';
import { LocatorPicker } from '../components/LocatorPicker';
import { KeyboardShortcutsHelp } from '../components/KeyboardShortcutsHelp';
import {
  useReviewKeyboardShortcuts,
  type ReviewHandlers,
} from '../hooks/useReviewKeyboardShortcuts';
import { useReviewState, type StepReviewData } from '../hooks/useReviewState';
import { cn } from '@/lib/utils';

// Color palette for masks - cycles through these colors
const MASK_COLORS = [
  { name: 'purple', bg: 'bg-purple-500/30', border: 'border-purple-500', text: 'text-purple-400', bgSolid: 'bg-purple-500' },
  { name: 'cyan', bg: 'bg-cyan-500/30', border: 'border-cyan-500', text: 'text-cyan-400', bgSolid: 'bg-cyan-500' },
  { name: 'orange', bg: 'bg-orange-500/30', border: 'border-orange-500', text: 'text-orange-400', bgSolid: 'bg-orange-500' },
  { name: 'pink', bg: 'bg-pink-500/30', border: 'border-pink-500', text: 'text-pink-400', bgSolid: 'bg-pink-500' },
  { name: 'green', bg: 'bg-green-500/30', border: 'border-green-500', text: 'text-green-400', bgSolid: 'bg-green-500' },
  { name: 'yellow', bg: 'bg-yellow-500/30', border: 'border-yellow-500', text: 'text-yellow-400', bgSolid: 'bg-yellow-500' },
  { name: 'blue', bg: 'bg-blue-500/30', border: 'border-blue-500', text: 'text-blue-400', bgSolid: 'bg-blue-500' },
  { name: 'red', bg: 'bg-red-500/30', border: 'border-red-500', text: 'text-red-400', bgSolid: 'bg-red-500' },
];

export function getMaskColor(index: number) {
  return MASK_COLORS[index % MASK_COLORS.length];
}

export interface ReviewPageProps {
  explorationId: string;
  specName: string;
  steps: ExplorationStep[];
  baseScreenshotPath?: string;
  initialReviewData?: Record<number, StepReviewData>;
  onSubmit?: (reviewData: Record<number, StepReviewData>) => void;
}

export function ReviewPage({
  explorationId,
  specName,
  steps,
  baseScreenshotPath = '',
  initialReviewData,
  onSubmit,
}: ReviewPageProps) {
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const locatorPickerRef = useRef<HTMLDivElement>(null);

  // Mask modal states
  const [editingMask, setEditingMask] = useState<Mask | null>(null);
  const [previewMask, setPreviewMask] = useState<Mask | null>(null);
  const [editMaskComment, setEditMaskComment] = useState('');

  const {
    state,
    currentStep,
    currentReviewData,
    reviewStatus,
    locatorCandidates,
    actions,
  } = useReviewState({
    steps,
    initialReviewData,
    onSubmit,
  });

  // Build screenshot paths
  const getScreenshotUrl = useCallback(
    (path?: string) => {
      if (!path) return '';
      if (path.startsWith('http') || path.startsWith('/')) return path;
      return baseScreenshotPath ? `${baseScreenshotPath}/${path}` : path;
    },
    [baseScreenshotPath]
  );

  const beforeSrc = getScreenshotUrl(currentStep?.screenshots?.before);
  const afterSrc = getScreenshotUrl(currentStep?.screenshots?.after);
  const diffSrc = getScreenshotUrl((currentStep?.screenshots as { diff?: string })?.diff);

  // Create keyboard handlers
  const keyboardHandlers: ReviewHandlers = {
    nextStep: actions.nextStep,
    prevStep: actions.prevStep,
    approveStep: actions.approveStep,
    rejectStep: actions.rejectStep,
    addMask: actions.toggleMaskMode,
    focusLocatorPicker: useCallback(() => {
      locatorPickerRef.current?.focus();
    }, []),
    addAssertion: useCallback(() => {
      // TODO: Implement assertion modal
      console.log('Add assertion');
    }, []),
    focusComment: useCallback(() => {
      commentRef.current?.focus();
    }, []),
    setViewMode: useCallback(
      (mode: ViewMode) => {
        // Guard against switching to diff mode when no diff image exists
        if (mode === 'diff' && !diffSrc) {
          return;
        }
        actions.setViewMode(mode);
      },
      [diffSrc, actions.setViewMode]
    ),
    openSearch: actions.openSearch,
    submitReview: actions.submitReview,
    showHelp: actions.openShortcutsHelp,
    closeModal: actions.closeModal,
  };

  useReviewKeyboardShortcuts(keyboardHandlers, {
    enabled: !state.showShortcutsHelp && !state.showSearch,
  });

  // Progress stats
  const approvedCount = Object.values(state.reviewData).filter(
    (r) => r.status === 'approved'
  ).length;
  const rejectedCount = Object.values(state.reviewData).filter(
    (r) => r.status === 'rejected'
  ).length;
  const pendingCount = steps.length - approvedCount - rejectedCount;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{specName}</h1>
          <p className="text-sm text-muted-foreground">
            Exploration: {explorationId}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">{approvedCount} approved</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-red-600">{rejectedCount} rejected</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-yellow-600">{pendingCount} pending</span>
          </div>

          {/* Actions */}
          <button
            onClick={actions.openShortcutsHelp}
            className="px-3 py-1.5 text-sm hover:bg-muted rounded-md"
            title="Keyboard shortcuts (Ctrl+?)"
          >
            <KeyboardIcon className="w-4 h-4" />
          </button>

          <button
            onClick={actions.submitReview}
            disabled={!state.isDirty}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              state.isDirty
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Submit Review
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Step timeline */}
        <StepTimeline
          steps={steps}
          currentStepIndex={state.currentStepIndex}
          reviewStatus={reviewStatus}
          onSelectStep={actions.selectStep}
        />

        {/* Center: Screenshot viewer / Mask editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {state.maskModeEnabled && afterSrc ? (
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Mask Editor</span>
                <button
                  onClick={actions.toggleMaskMode}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Exit mask mode (m)
                </button>
              </div>
              <MaskEditor
                imageSrc={afterSrc}
                masks={currentReviewData.masks}
                onMasksChange={actions.updateMasks}
                enabled={true}
              />
            </div>
          ) : (
            <ScreenshotViewer
              beforeSrc={beforeSrc || afterSrc}
              afterSrc={afterSrc || beforeSrc}
              diffSrc={diffSrc}
              mode={state.viewMode}
              onModeChange={actions.setViewMode}
            />
          )}

          {/* Bottom toolbar area */}
          <div className="border-t">
            {/* Comment input row */}
            <div className="p-3 border-b flex items-start gap-3">
              <label className="text-sm font-medium whitespace-nowrap pt-2" htmlFor="step-comment">
                Comment:
              </label>
              <textarea
                id="step-comment"
                ref={commentRef}
                value={currentReviewData.comment}
                onChange={(e) => actions.updateComment(e.target.value)}
                placeholder="Add a comment for this step..."
                className="flex-1 p-2 text-sm border rounded-md resize-none bg-background h-24"
                rows={3}
              />
            </div>

            {/* Action buttons row */}
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={actions.toggleMaskMode}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    state.maskModeEnabled
                      ? 'bg-blue-500 text-white'
                      : 'bg-secondary hover:bg-secondary/80'
                  )}
                >
                  {state.maskModeEnabled ? 'Exit Mask Mode' : 'Add Mask (m)'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={actions.rejectStep}
                  className="px-4 py-2 text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors"
                >
                  Reject (r)
                </button>
                <button
                  onClick={actions.approveStep}
                  className="px-4 py-2 text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors"
                >
                  Approve (a)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Details panel */}
        <div className="w-96 border-l flex flex-col overflow-y-auto">
          {/* Step header */}
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {(currentStep?.step_index ?? 0) + 1}
              </span>
              <h3 className="font-semibold text-lg">
                {formatStepTitle(currentStep)}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <StatusBadge status={currentReviewData.status} />
              {currentStep?.execution?.duration_ms && (
                <span className="text-muted-foreground">
                  {currentStep.execution.duration_ms}ms
                </span>
              )}
            </div>
          </div>

          {/* What's Being Tested */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">What's Being Tested</h4>
            <p className="text-sm text-muted-foreground">
              {getStepDescription(currentStep)}
            </p>
          </div>

          {/* Test Actions */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">Test Actions</h4>
            <ul className="text-sm space-y-1">
              {getTestActions(currentStep).map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-cyan-400">→</span>
                  <span className="text-muted-foreground">{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Verification Points */}
          {getVerificationPoints(currentStep).length > 0 && (
            <div className="p-4 border-b">
              <h4 className="text-sm font-semibold text-orange-400 mb-2">Verification Points</h4>
              <ul className="text-sm space-y-1">
                {getVerificationPoints(currentStep).map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-orange-400">→</span>
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Element Discovery */}
          {currentStep?.execution?.locator && (
            <div className="p-4 border-b">
              <h4 className="text-sm font-semibold text-amber-400 mb-2">Element Discovery</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Locator strategy used to find the target element:
              </p>
              <code className="block text-xs bg-muted p-2 rounded font-mono">
                {formatLocator(currentStep.execution.locator)}
              </code>
            </div>
          )}

          {/* Locator picker */}
          {locatorCandidates.length > 0 && (
            <div className="p-4 border-b" ref={locatorPickerRef} tabIndex={-1}>
              <LocatorPicker
                candidates={locatorCandidates}
                currentLocator={currentReviewData.lockedLocator}
                onLockLocator={actions.lockLocator}
              />
            </div>
          )}

          {/* Masks summary - takes remaining space and scrolls */}
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">
                Masks
                {currentReviewData.masks.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                    {currentReviewData.masks.length}
                  </span>
                )}
              </h4>
              <button
                onClick={actions.toggleMaskMode}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {state.maskModeEnabled ? 'Done' : '+ Add'}
              </button>
            </div>
            {currentReviewData.masks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No masks defined. Use mask mode to hide dynamic content that shouldn't be compared.
              </p>
            ) : (
              <div className="space-y-3">
                {currentReviewData.masks.map((mask, index) => (
                  <MaskThumbnailCard
                    key={mask.id}
                    mask={mask}
                    index={index}
                    screenshotSrc={afterSrc}
                    onPreview={() => setPreviewMask(mask)}
                    onEdit={() => {
                      setEditingMask(mask);
                      setEditMaskComment(mask.reason);
                    }}
                    onDelete={() => {
                      actions.updateMasks(
                        currentReviewData.masks.filter((m) => m.id !== mask.id)
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsHelp
        open={state.showShortcutsHelp}
        onOpenChange={(open) =>
          open ? actions.openShortcutsHelp() : actions.closeShortcutsHelp()
        }
      />

      {/* Edit mask modal */}
      {editingMask && (
        <MaskEditModal
          mask={editingMask}
          comment={editMaskComment}
          onCommentChange={setEditMaskComment}
          onSave={() => {
            const updatedMasks = currentReviewData.masks.map((m) =>
              m.id === editingMask.id ? { ...m, reason: editMaskComment } : m
            );
            actions.updateMasks(updatedMasks);
            setEditingMask(null);
          }}
          onCancel={() => setEditingMask(null)}
        />
      )}

      {/* Preview mask modal */}
      {previewMask && (
        <MaskPreviewModal
          mask={previewMask}
          index={currentReviewData.masks.findIndex(m => m.id === previewMask.id)}
          screenshotSrc={afterSrc}
          onClose={() => setPreviewMask(null)}
        />
      )}
    </div>
  );
}

// Helper functions for step details
function formatStepTitle(step?: ExplorationStep): string {
  if (!step) return 'Unknown Step';

  const description = step.spec_action?.description || '';
  const action = step.spec_action?.action || '';

  // If there's a description, use it as title (convert to Title Case)
  if (description) {
    const formatted = description
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    return formatted;
  }

  // Fallback to action type
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function getStepDescription(step?: ExplorationStep): string {
  if (!step) return 'No step selected';

  const action = (step.spec_action?.action || '') as string;
  const spec = step.spec_action as unknown as Record<string, unknown>;

  switch (action) {
    case 'navigate':
      return `Navigate to ${spec.url || 'the target URL'}. This loads a new page or route in the browser.`;
    case 'click':
      return `Click on a target element. This simulates a user clicking the specified UI component.`;
    case 'fill':
    case 'type':
      return `Enter text into an input field. The value "${spec.value || ''}" will be typed into the target element.`;
    case 'screenshot':
      return `Capture a screenshot of the current page state. This creates a visual record for comparison.`;
    case 'expect':
    case 'assert':
      return `Verify that an element or condition meets expectations. This validates the application state.`;
    case 'hover':
      return `Hover over a target element. This triggers hover states and tooltips.`;
    case 'select':
      return `Select an option from a dropdown or select element.`;
    case 'wait':
      return `Wait for a condition or timeout before proceeding.`;
    default:
      return `Perform ${action} action on the target element.`;
  }
}

function getTestActions(step?: ExplorationStep): string[] {
  if (!step) return [];

  const action = (step.spec_action?.action || '') as string;
  const spec = step.spec_action as unknown as Record<string, unknown>;
  const execution = step.execution;
  const actions: string[] = [];

  // Add action-specific steps
  switch (action) {
    case 'navigate':
      actions.push(`Navigate browser to ${spec.url || 'target URL'}`);
      actions.push('Wait for page load to complete');
      break;
    case 'click':
      actions.push('Locate target element using locator strategy');
      actions.push('Verify element is visible and clickable');
      actions.push('Perform click action');
      break;
    case 'fill':
    case 'type':
      actions.push('Locate target input element');
      actions.push(`Type value: "${spec.value || ''}"`);
      break;
    case 'screenshot':
      actions.push('Wait for any animations to complete');
      actions.push('Capture full page or element screenshot');
      break;
    case 'expect':
    case 'assert':
      actions.push('Locate target element');
      actions.push('Evaluate assertion condition');
      break;
    default:
      actions.push(`Execute ${action} action`);
  }

  // Add execution details if available
  if (execution?.selector_used) {
    actions.push(`Used selector: ${execution.selector_used}`);
  }

  return actions;
}

function getVerificationPoints(step?: ExplorationStep): string[] {
  if (!step) return [];

  const action = (step.spec_action?.action || '') as string;
  const execution = step.execution;
  const points: string[] = [];

  // Add verification points based on action type
  if (action === 'expect' || action === 'assert') {
    points.push('Element exists in the DOM');
    points.push('Element is visible on screen');
    points.push('Assertion condition evaluates to true');
  } else if (action === 'click') {
    points.push('Element is clickable (not disabled)');
    points.push('Click event was dispatched');
  } else if (action === 'navigate') {
    points.push('Page loaded without errors');
    points.push('Expected URL was reached');
  }

  // Add status-based verification
  if (execution?.status === 'completed') {
    points.push('Step completed successfully');
  } else if (execution?.status === 'failed') {
    points.push(`Step failed: ${execution.error || 'Unknown error'}`);
  }

  return points;
}

function formatLocator(locator: ExplorationStep['execution']['locator']): string {
  if (!locator) return 'No locator';

  const { method, args } = locator;
  if (!method) return JSON.stringify(locator);

  const argStr = args
    ? Object.entries(args)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ')
    : '';

  return `${method}(${argStr})`;
}

function StatusBadge({ status }: { status: 'approved' | 'rejected' | 'pending' }) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 text-xs font-medium rounded',
        status === 'approved' && 'bg-green-100 text-green-700',
        status === 'rejected' && 'bg-red-100 text-red-700',
        status === 'pending' && 'bg-yellow-100 text-yellow-700'
      )}
    >
      {status}
    </span>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </svg>
  );
}

// Mask thumbnail card component
interface MaskThumbnailCardProps {
  mask: Mask;
  index: number;
  screenshotSrc: string;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function MaskThumbnailCard({
  mask,
  index,
  screenshotSrc,
  onPreview,
  onEdit,
  onDelete,
}: MaskThumbnailCardProps) {
  const color = getMaskColor(index);

  return (
    <div className={cn('rounded overflow-hidden', color.bg, `border ${color.border}/20`)}>
      {/* Thumbnail */}
      <button
        onClick={onPreview}
        className="relative w-full aspect-video overflow-hidden hover:opacity-90 transition-opacity"
        title="Click to preview"
      >
        <img
          src={screenshotSrc}
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Mask overlay on thumbnail */}
        <div
          className={cn('absolute border-2', color.bg, color.border)}
          style={{
            left: `${mask.x}%`,
            top: `${mask.y}%`,
            width: `${mask.width}%`,
            height: `${mask.height}%`,
          }}
        />
        {/* Zoom icon */}
        <div className="absolute bottom-1 right-1 p-1 bg-black/50 rounded">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </div>
      </button>

      {/* Info and actions */}
      <div className="p-2">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('font-medium text-sm', color.text)}>Mask {index + 1}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className={cn('p-1 text-muted-foreground transition-colors', `hover:${color.text}`)}
              title="Edit comment"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
              title="Delete mask"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate" title={mask.reason}>
          {mask.reason}
        </p>
      </div>
    </div>
  );
}

// Mask edit modal component
interface MaskEditModalProps {
  mask: Mask;
  comment: string;
  onCommentChange: (comment: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function MaskEditModal({ mask, comment, onCommentChange, onSave, onCancel }: MaskEditModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold mb-4">Edit Mask Comment</h3>

        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Enter reason for masking this region..."
          className="w-full h-24 p-3 border rounded-md bg-background text-sm resize-none"
          autoFocus
        />

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md',
              comment.trim()
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            onClick={onSave}
            disabled={!comment.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Mask preview modal component
interface MaskPreviewModalProps {
  mask: Mask;
  index: number;
  screenshotSrc: string;
  onClose: () => void;
}

function MaskPreviewModal({ mask, index, screenshotSrc, onClose }: MaskPreviewModalProps) {
  const color = getMaskColor(index);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />
      <div className="relative max-w-4xl max-h-full overflow-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Image with mask overlay */}
        <div className="relative">
          <img
            src={screenshotSrc}
            alt="Screenshot with mask"
            className="max-w-full max-h-[80vh] rounded-lg"
          />
          <div
            className={cn('absolute border-4 rounded', color.bg, color.border)}
            style={{
              left: `${mask.x}%`,
              top: `${mask.y}%`,
              width: `${mask.width}%`,
              height: `${mask.height}%`,
            }}
          />
        </div>

        {/* Mask info */}
        <div className="mt-4 p-4 bg-background rounded-lg">
          <h4 className={cn('font-semibold mb-2', color.text)}>Mask {index + 1}</h4>
          <p className="text-sm text-muted-foreground">{mask.reason}</p>
          <p className="text-xs text-muted-foreground/60 mt-2 font-mono">
            Position: {mask.x.toFixed(1)}%, {mask.y.toFixed(1)}% | Size: {mask.width.toFixed(1)}% x {mask.height.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}
