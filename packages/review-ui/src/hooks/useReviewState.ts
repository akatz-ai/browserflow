import { useState, useCallback, useMemo } from 'react';
import type { ExplorationStep, LegacyLocatorObject } from '@browserflow/core';
import type { Mask } from '../components/MaskEditor';
import type { ViewMode } from '../components/ScreenshotViewer';
import type { LocatorCandidate } from '../components/LocatorPicker';

export type StepReviewStatus = 'reviewed' | 'pending';

export interface StepReviewData {
  status: StepReviewStatus;
  comment: string;
  masks: Mask[];
  lockedLocator?: LegacyLocatorObject;
}

export interface ReviewState {
  currentStepIndex: number;
  reviewData: Record<number, StepReviewData>;
  viewMode: ViewMode;
  maskModeEnabled: boolean;
  showShortcutsHelp: boolean;
  showSearch: boolean;
  isDirty: boolean;
}

export interface UseReviewStateOptions {
  steps: ExplorationStep[];
  initialReviewData?: Record<number, StepReviewData>;
  onSubmit?: (reviewData: Record<number, StepReviewData>) => void;
}

export function useReviewState({ steps, initialReviewData = {}, onSubmit }: UseReviewStateOptions) {
  const [currentStepIndex, setCurrentStepIndex] = useState(steps[0]?.step_index ?? 0);
  const [reviewData, setReviewData] = useState<Record<number, StepReviewData>>(initialReviewData);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [maskModeEnabled, setMaskModeEnabled] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Get current step
  const currentStep = useMemo(
    () => steps.find((s) => s.step_index === currentStepIndex),
    [steps, currentStepIndex]
  );

  // Get review data for current step
  const currentReviewData = useMemo(
    () =>
      reviewData[currentStepIndex] ?? {
        status: 'pending' as const,
        comment: '',
        masks: [],
      },
    [reviewData, currentStepIndex]
  );

  // Review status map for timeline
  const reviewStatus = useMemo(
    () =>
      Object.fromEntries(
        steps.map((s) => [s.step_index, reviewData[s.step_index]?.status ?? 'pending'])
      ) as Record<number, StepReviewStatus>,
    [steps, reviewData]
  );

  // Update review data for a step
  const updateStepReview = useCallback(
    (stepIndex: number, updates: Partial<StepReviewData>) => {
      setReviewData((prev) => ({
        ...prev,
        [stepIndex]: {
          ...prev[stepIndex],
          status: prev[stepIndex]?.status ?? 'pending',
          comment: prev[stepIndex]?.comment ?? '',
          masks: prev[stepIndex]?.masks ?? [],
          ...updates,
        },
      }));
      setIsDirty(true);
    },
    []
  );

  // Navigation
  const nextStep = useCallback(() => {
    const currentIdx = steps.findIndex((s) => s.step_index === currentStepIndex);
    if (currentIdx < steps.length - 1) {
      setCurrentStepIndex(steps[currentIdx + 1].step_index);
    }
  }, [steps, currentStepIndex]);

  const prevStep = useCallback(() => {
    const currentIdx = steps.findIndex((s) => s.step_index === currentStepIndex);
    if (currentIdx > 0) {
      setCurrentStepIndex(steps[currentIdx - 1].step_index);
    }
  }, [steps, currentStepIndex]);

  const selectStep = useCallback((stepIndex: number) => {
    setCurrentStepIndex(stepIndex);
  }, []);

  // Review actions - removed approveStep and rejectStep
  // Steps are now marked as reviewed automatically when comment or mask is added

  // Masks
  const updateMasks = useCallback(
    (masks: Mask[]) => {
      // Mark step as reviewed if masks or comment exist
      const currentData = reviewData[currentStepIndex];
      const hasComment = currentData?.comment?.trim().length > 0;
      const status = masks.length > 0 || hasComment ? 'reviewed' : 'pending';
      updateStepReview(currentStepIndex, { masks, status });
    },
    [currentStepIndex, updateStepReview, reviewData]
  );

  const toggleMaskMode = useCallback(() => {
    setMaskModeEnabled((prev) => !prev);
  }, []);

  // Locator
  const lockLocator = useCallback(
    (locator: LegacyLocatorObject) => {
      updateStepReview(currentStepIndex, { lockedLocator: locator });
    },
    [currentStepIndex, updateStepReview]
  );

  // Comment
  const updateComment = useCallback(
    (comment: string) => {
      // Mark step as reviewed if comment or masks exist
      const currentData = reviewData[currentStepIndex];
      const hasMasks = (currentData?.masks?.length ?? 0) > 0;
      const status = comment.trim().length > 0 || hasMasks ? 'reviewed' : 'pending';
      updateStepReview(currentStepIndex, { comment, status });
    },
    [currentStepIndex, updateStepReview, reviewData]
  );

  // UI state
  const openShortcutsHelp = useCallback(() => {
    setShowShortcutsHelp(true);
  }, []);

  const closeShortcutsHelp = useCallback(() => {
    setShowShortcutsHelp(false);
  }, []);

  const openSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
  }, []);

  const closeModal = useCallback(() => {
    setShowShortcutsHelp(false);
    setShowSearch(false);
  }, []);

  // Submit
  const submitReview = useCallback(() => {
    if (onSubmit) {
      onSubmit(reviewData);
      setIsDirty(false);
    }
  }, [reviewData, onSubmit]);

  // Generate mock locator candidates from current step
  const locatorCandidates = useMemo((): LocatorCandidate[] => {
    if (!currentStep?.execution?.locator) return [];

    const locator = currentStep.execution.locator;
    const candidates: LocatorCandidate[] = [];

    // Add the actual locator used
    if (locator.method) {
      const args = locator.args || {};
      if (locator.method === 'getByTestId' && args.testId) {
        candidates.push({
          strategy: { type: 'testid', value: args.testId as string },
          confidence: 0.95,
          matchCount: 1,
        });
      } else if (locator.method === 'getByRole' && args.role) {
        candidates.push({
          strategy: { type: 'role', role: args.role as string, name: args.name as string },
          confidence: 0.85,
          matchCount: 1,
        });
      } else if (locator.method === 'getByText' && args.text) {
        candidates.push({
          strategy: { type: 'text', text: args.text as string },
          confidence: 0.7,
          matchCount: 1,
        });
      }
    }

    // If CSS selector was used, add it
    if (currentStep.execution.selector_used) {
      candidates.push({
        strategy: { type: 'css', selector: currentStep.execution.selector_used },
        confidence: 0.6,
        matchCount: 1,
      });
    }

    return candidates;
  }, [currentStep]);

  return {
    // State
    state: {
      currentStepIndex,
      reviewData,
      viewMode,
      maskModeEnabled,
      showShortcutsHelp,
      showSearch,
      isDirty,
    },
    // Derived
    currentStep,
    currentReviewData,
    reviewStatus,
    locatorCandidates,
    // Actions
    actions: {
      nextStep,
      prevStep,
      selectStep,
      updateMasks,
      toggleMaskMode,
      lockLocator,
      updateComment,
      setViewMode,
      openShortcutsHelp,
      closeShortcutsHelp,
      openSearch,
      closeSearch,
      closeModal,
      submitReview,
    },
  };
}
