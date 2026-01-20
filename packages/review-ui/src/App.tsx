import { useState } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ReviewPage } from './pages/ReviewPage';
import { useExplorationData } from './hooks/useExplorationData';
import { captureAnnotatedScreenshot } from './lib/captureAnnotatedScreenshot';
import type { StepReviewData } from './hooks/useReviewState';

export function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/review" element={<ReviewRoute />} />
        <Route path="/review/:explorationId" element={<ReviewRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          BrowserFlow Review
        </h1>
        <p className="text-muted-foreground mb-8">
          Human review interface for browser explorations.
        </p>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold mb-2">Getting Started</h2>
            <p className="text-sm text-muted-foreground mb-4">
              To review an exploration, either:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>
                Run <code className="px-1 bg-muted rounded">bf review</code> in your project
              </li>
              <li>
                Navigate to <code className="px-1 bg-muted rounded">/review?path=...</code> with exploration data
              </li>
            </ul>
          </div>

          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold mb-2">Keyboard Shortcuts</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><kbd className="px-1 bg-muted rounded">j/k</kbd> Navigate steps</div>
              <div><kbd className="px-1 bg-muted rounded">a</kbd> Approve</div>
              <div><kbd className="px-1 bg-muted rounded">r</kbd> Reject</div>
              <div><kbd className="px-1 bg-muted rounded">m</kbd> Add mask</div>
              <div><kbd className="px-1 bg-muted rounded">l</kbd> Lock locator</div>
              <div><kbd className="px-1 bg-muted rounded">c</kbd> Comment</div>
              <div><kbd className="px-1 bg-muted rounded">1-4</kbd> View modes</div>
              <div><kbd className="px-1 bg-muted rounded">Ctrl+S</kbd> Submit</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRoute() {
  const [searchParams] = useSearchParams();
  const explorationPath = searchParams.get('path') || '/api/exploration';
  const screenshotsParam = searchParams.get('screenshots');
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error } = useExplorationData(explorationPath);

  // Build screenshot base path from exploration ID (or use explicit param)
  const baseScreenshotPath = screenshotsParam || (data?.id ? `/api/screenshots/${data.id}` : '');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading exploration...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-2">Failed to load exploration</h1>
          <p className="text-muted-foreground mb-4">{error || 'No data available'}</p>
          <a
            href="/"
            className="text-primary hover:underline"
          >
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (reviewData: Record<number, StepReviewData>, overallComment: string) => {
    setSubmitting(true);
    try {
      // Helper to build screenshot URL (matching ReviewPage logic)
      const getScreenshotUrl = (path?: string): string => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('/')) return path;
        const cleanPath = path.startsWith('screenshots/') ? path.slice('screenshots/'.length) : path;
        return baseScreenshotPath ? `${baseScreenshotPath}/${cleanPath}` : path;
      };

      // Build the review JSON and track which steps have masks
      const stepsWithMasks: Array<{ stepIndex: number; screenshotUrl: string; masks: StepReviewData['masks'] }> = [];

      const reviewJson = {
        exploration_id: data.id,
        spec_name: data.specName,
        reviewed_at: new Date().toISOString(),
        overall_comment: overallComment || undefined,
        steps: Object.entries(reviewData).map(([stepIndex, stepData]) => {
          const idx = parseInt(stepIndex, 10);
          const step = data.steps.find(s => s.step_index === idx);

          // Track steps with masks for annotated screenshot capture
          if (stepData.masks.length > 0 && step?.screenshots?.after) {
            stepsWithMasks.push({
              stepIndex: idx,
              screenshotUrl: getScreenshotUrl(step.screenshots.after),
              masks: stepData.masks,
            });
          }

          return {
            step_index: idx,
            status: stepData.status,
            comment: stepData.comment || undefined,
            masks: stepData.masks.length > 0 ? stepData.masks : undefined,
            locked_locator: stepData.lockedLocator || undefined,
            // Will add annotated_screenshot below if masks exist
            annotated_screenshot: stepData.masks.length > 0
              ? `screenshots/step-${String(idx).padStart(2, '0')}-review.png`
              : undefined,
          };
        }),
      };

      // If there are steps with masks, use multipart/form-data
      if (stepsWithMasks.length > 0) {
        const formData = new FormData();
        formData.append('review_data', JSON.stringify(reviewJson));

        // Capture annotated screenshots for each step with masks
        for (const { stepIndex, screenshotUrl, masks } of stepsWithMasks) {
          try {
            const blob = await captureAnnotatedScreenshot({
              imageSrc: screenshotUrl,
              masks,
            });
            formData.append(`step-${stepIndex}-review`, blob, `step-${String(stepIndex).padStart(2, '0')}-review.png`);
          } catch (captureError) {
            console.warn(`Failed to capture annotated screenshot for step ${stepIndex}:`, captureError);
            // Continue without the annotated screenshot
          }
        }

        const response = await fetch(`/api/reviews/${data.id}`, {
          method: 'POST',
          body: formData, // Browser sets Content-Type with boundary automatically
        });

        if (!response.ok) {
          throw new Error(`Save failed: ${response.statusText}`);
        }

        const reviewPath = response.headers.get('X-Review-Path') || 'server';
        toast.success(`Saved to ${reviewPath}`);
      } else {
        // No masks - use simple JSON
        const response = await fetch(`/api/reviews/${data.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviewJson),
        });

        if (!response.ok) {
          throw new Error(`Save failed: ${response.statusText}`);
        }

        const reviewPath = response.headers.get('X-Review-Path') || 'server';
        toast.success(`Saved to ${reviewPath}`);
      }
    } catch (error) {
      const err = error as Error;
      toast.error(`Save failed: ${err.message}`, {
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ReviewPage
      explorationId={data.id}
      specName={data.specName}
      steps={data.steps}
      baseScreenshotPath={baseScreenshotPath}
      onSubmit={handleSubmit}
    />
  );
}
