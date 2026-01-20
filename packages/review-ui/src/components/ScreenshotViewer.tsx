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

type PreviewImage = { src: string; label: string } | null;

export function ScreenshotViewer({
  beforeSrc,
  afterSrc,
  diffSrc,
  mode,
  onModeChange,
}: ScreenshotViewerProps) {
  // Note: View mode keyboard shortcuts (1-4) are handled by parent via useReviewKeyboardShortcuts
  // Parent calls onModeChange when shortcuts are triggered

  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);

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
          <SideBySideView
            before={beforeSrc}
            after={afterSrc}
            onImageClick={(src, label) => setPreviewImage({ src, label })}
          />
        )}
        {mode === 'slider' && (
          <SliderView before={beforeSrc} after={afterSrc} />
        )}
        {mode === 'blink' && (
          <BlinkView
            before={beforeSrc}
            after={afterSrc}
            onImageClick={(src, label) => setPreviewImage({ src, label })}
          />
        )}
        {mode === 'diff' && diffSrc && (
          <DiffView
            baseline={beforeSrc}
            actual={afterSrc}
            diff={diffSrc}
            onImageClick={(src, label) => setPreviewImage({ src, label })}
          />
        )}
      </div>

      {/* Image preview modal */}
      {previewImage && (
        <ImagePreviewModal
          src={previewImage.src}
          label={previewImage.label}
          onClose={() => setPreviewImage(null)}
        />
      )}
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
  onImageClick?: (src: string, label: string) => void;
}

function SideBySideView({ before, after, onImageClick }: SideBySideViewProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          Before Action
          <span className="text-muted-foreground font-normal">(screenshot taken before this step ran)</span>
        </div>
        <ClickableImage
          src={before}
          alt="Screenshot before action"
          onClick={() => onImageClick?.(before, 'Before Action')}
        />
      </div>
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          After Action
          <span className="text-muted-foreground font-normal">(screenshot taken after this step ran)</span>
        </div>
        <ClickableImage
          src={after}
          alt="Screenshot after action"
          onClick={() => onImageClick?.(after, 'After Action')}
        />
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
  onImageClick?: (src: string, label: string) => void;
}

function BlinkView({ before, after, onImageClick }: BlinkViewProps) {
  const [showBefore, setShowBefore] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setShowBefore((v) => !v), 500);
    return () => clearInterval(interval);
  }, []);

  const currentSrc = showBefore ? before : after;
  const currentLabel = showBefore ? 'Before Action' : 'After Action';

  return (
    <div className="relative">
      <ClickableImage
        src={currentSrc}
        alt={showBefore ? "Before action" : "After action"}
        onClick={() => onImageClick?.(currentSrc, currentLabel)}
        className="w-full"
      />
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-sm rounded pointer-events-none">
        {showBefore ? 'Before' : 'After'}
      </div>
    </div>
  );
}

interface DiffViewProps {
  baseline: string;
  actual: string;
  diff: string;
  onImageClick?: (src: string, label: string) => void;
}

function DiffView({ baseline, actual, diff, onImageClick }: DiffViewProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <div className="text-sm font-medium mb-2">Baseline</div>
        <ClickableImage
          src={baseline}
          alt="Baseline screenshot"
          onClick={() => onImageClick?.(baseline, 'Baseline')}
        />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Actual</div>
        <ClickableImage
          src={actual}
          alt="Actual screenshot"
          onClick={() => onImageClick?.(actual, 'Actual')}
        />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Diff</div>
        <ClickableImage
          src={diff}
          alt="Diff image showing changes"
          onClick={() => onImageClick?.(diff, 'Diff')}
        />
      </div>
    </div>
  );
}

// Clickable image component with hover indicator
interface ClickableImageProps {
  src: string;
  alt: string;
  onClick?: () => void;
  className?: string;
}

function ClickableImage({ src, alt, onClick, className }: ClickableImageProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative block border rounded overflow-hidden group cursor-zoom-in transition-all hover:ring-2 hover:ring-primary/50',
        className
      )}
    >
      <img src={src} alt={alt} className="w-full" />
      {/* Zoom indicator on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
          Click to enlarge
        </div>
      </div>
    </button>
  );
}

// Image preview modal component
interface ImagePreviewModalProps {
  src: string;
  label: string;
  onClose: () => void;
}

function ImagePreviewModal({ src, label, onClose }: ImagePreviewModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />

      {/* Modal content */}
      <div className="relative max-w-[90vw] max-h-[90vh] overflow-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          aria-label="Close preview"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Label */}
        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-black/60 text-white text-sm font-medium rounded">
          {label}
        </div>

        {/* Image */}
        <img
          src={src}
          alt={label}
          className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
}
