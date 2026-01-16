import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type ViewMode = 'side-by-side' | 'slider' | 'blink' | 'diff';

export interface ScreenshotViewerProps {
  beforeSrc: string;
  afterSrc: string;
  diffSrc?: string;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function ScreenshotViewer({
  beforeSrc,
  afterSrc,
  diffSrc,
  mode,
  onModeChange,
}: ScreenshotViewerProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
          onModeChange('side-by-side');
          break;
        case '2':
          onModeChange('slider');
          break;
        case '3':
          onModeChange('blink');
          break;
        case '4':
          if (diffSrc) {
            onModeChange('diff');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange, diffSrc]);

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector */}
      <div className="flex gap-2 p-2 border-b">
        <ModeButton
          active={mode === 'side-by-side'}
          onClick={() => onModeChange('side-by-side')}
        >
          Side-by-Side
        </ModeButton>
        <ModeButton
          active={mode === 'slider'}
          onClick={() => onModeChange('slider')}
        >
          Slider
        </ModeButton>
        <ModeButton
          active={mode === 'blink'}
          onClick={() => onModeChange('blink')}
        >
          Blink
        </ModeButton>
        {diffSrc && (
          <ModeButton
            active={mode === 'diff'}
            onClick={() => onModeChange('diff')}
          >
            Diff
          </ModeButton>
        )}
      </div>

      {/* Viewer content */}
      <div className="flex-1 overflow-auto p-4">
        {mode === 'side-by-side' && (
          <SideBySideView before={beforeSrc} after={afterSrc} />
        )}
        {mode === 'slider' && (
          <SliderView before={beforeSrc} after={afterSrc} />
        )}
        {mode === 'blink' && (
          <BlinkView before={beforeSrc} after={afterSrc} />
        )}
        {mode === 'diff' && diffSrc && (
          <DiffView baseline={beforeSrc} actual={afterSrc} diff={diffSrc} />
        )}
      </div>
    </div>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ModeButton({ active, onClick, children }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      )}
    >
      {children}
    </button>
  );
}

interface SideBySideViewProps {
  before: string;
  after: string;
}

function SideBySideView({ before, after }: SideBySideViewProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          Before Action
          <span className="text-muted-foreground font-normal">(screenshot taken before this step ran)</span>
        </div>
        <img src={before} alt="Screenshot before action" className="border rounded w-full" />
      </div>
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          After Action
          <span className="text-muted-foreground font-normal">(screenshot taken after this step ran)</span>
        </div>
        <img src={after} alt="Screenshot after action" className="border rounded w-full" />
      </div>
    </div>
  );
}

interface SliderViewProps {
  before: string;
  after: string;
}

function SliderView({ before, after }: SliderViewProps) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse move and mouse up with proper cleanup
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setPosition((x / rect.width) * 100);
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="space-y-4">
      {/* Labels */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="font-medium">Before Action</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">After Action</span>
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>
      </div>

      {/* Slider */}
      <div ref={containerRef} className="relative select-none cursor-ew-resize">
        {/* After image (full width) */}
        <img src={after} alt="After action" className="w-full" draggable={false} />

        {/* Before image (clipped) */}
        <div
          className="absolute top-0 left-0 h-full overflow-hidden pointer-events-none"
          style={{ width: `${position}%` }}
        >
          <img
            src={before}
            alt="Before action"
            className="h-full object-cover object-left"
            style={{ width: position > 0 ? `${10000 / position}%` : '100%' }}
            draggable={false}
          />
        </div>

        {/* Divider line with handle */}
        <div
          className="absolute top-0 h-full flex items-center justify-center"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          {/* Vertical line */}
          <div className="absolute h-full w-0.5 bg-white shadow-lg left-1/2 -translate-x-1/2" />

          {/* Drag handle */}
          <button
            onMouseDown={() => setIsDragging(true)}
            className="relative z-10 w-8 h-12 bg-white rounded-md shadow-lg border-2 border-gray-300 hover:border-primary flex items-center justify-center cursor-ew-resize"
            aria-label="Drag to compare before and after"
          >
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l-5-7 5-7zm8 0v14l5-7-5-7z" />
            </svg>
          </button>
        </div>

        {/* Labels on image */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500/80 text-white text-xs rounded">
          Before
        </div>
        <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/80 text-white text-xs rounded">
          After
        </div>
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground text-center">
        Drag the handle or click anywhere on the image to compare before/after states
      </p>
    </div>
  );
}

interface BlinkViewProps {
  before: string;
  after: string;
}

function BlinkView({ before, after }: BlinkViewProps) {
  const [showBefore, setShowBefore] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setShowBefore((v) => !v), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <img src={showBefore ? before : after} alt={showBefore ? "Before action" : "After action"} className="w-full" />
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-sm rounded">
        {showBefore ? 'Before' : 'After'}
      </div>
    </div>
  );
}

interface DiffViewProps {
  baseline: string;
  actual: string;
  diff: string;
}

function DiffView({ baseline, actual, diff }: DiffViewProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <div className="text-sm font-medium mb-2">Baseline</div>
        <img src={baseline} alt="Baseline screenshot" className="border rounded w-full" />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Actual</div>
        <img src={actual} alt="Actual screenshot" className="border rounded w-full" />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Diff</div>
        <img src={diff} alt="Diff image showing changes" className="border rounded w-full" />
      </div>
    </div>
  );
}
