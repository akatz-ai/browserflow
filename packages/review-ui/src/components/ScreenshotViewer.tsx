import { useState, useEffect, useCallback } from 'react';
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
        <div className="text-sm font-medium mb-2">Before</div>
        <img src={before} alt="" className="border rounded w-full" />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">After</div>
        <img src={after} alt="" className="border rounded w-full" />
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

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPosition(Number(e.target.value));
  }, []);

  return (
    <div className="relative">
      {/* After image (full width) */}
      <img src={after} alt="" className="w-full" />

      {/* Before image (clipped) */}
      <div
        className="absolute top-0 left-0 h-full overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={before}
          alt=""
          className="h-full object-cover object-left"
          style={{ width: `${10000 / position}%` }}
        />
      </div>

      {/* Slider control */}
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={handleChange}
        className="absolute bottom-4 left-4 right-4"
        aria-label="Comparison slider"
      />

      {/* Divider line */}
      <div
        className="absolute top-0 h-full w-0.5 bg-white shadow-lg"
        style={{ left: `${position}%` }}
      />
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
      <img src={showBefore ? before : after} alt="" className="w-full" />
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
        <img src={baseline} alt="" className="border rounded w-full" />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Actual</div>
        <img src={actual} alt="" className="border rounded w-full" />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Diff</div>
        <img src={diff} alt="" className="border rounded w-full" />
      </div>
    </div>
  );
}
