import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ReviewPage } from './pages/ReviewPage';
import { useExplorationData } from './hooks/useExplorationData';
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
  const baseScreenshotPath = searchParams.get('screenshots') || '';

  const { data, loading, error } = useExplorationData(explorationPath);

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

  const handleSubmit = (reviewData: Record<number, StepReviewData>) => {
    console.log('Submitting review:', reviewData);

    // In production, this would POST to the server
    // For now, log and show success
    const reviewJson = {
      exploration_id: data.id,
      spec_name: data.specName,
      reviewed_at: new Date().toISOString(),
      steps: Object.entries(reviewData).map(([stepIndex, stepData]) => ({
        step_index: parseInt(stepIndex, 10),
        status: stepData.status,
        comment: stepData.comment || undefined,
        masks: stepData.masks.length > 0 ? stepData.masks : undefined,
        locked_locator: stepData.lockedLocator || undefined,
      })),
    };

    // Download as JSON for now
    const blob = new Blob([JSON.stringify(reviewJson, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-${data.id}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Review submitted! Downloaded as JSON file.');
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
