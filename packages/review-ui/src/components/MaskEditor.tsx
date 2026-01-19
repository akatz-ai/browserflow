import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface Mask {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MaskEditorProps {
  imageSrc: string;
  masks: Mask[];
  onMasksChange: (masks: Mask[]) => void;
  enabled?: boolean;
  onToggleEnabled?: () => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface ResizeState {
  handle: ResizeHandle;
  startX: number;
  startY: number;
  originalRect: Rect;
}

/**
 * Generate a unique ID (fallback for browsers without crypto.randomUUID)
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'mask-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Normalizes a rectangle to ensure positive width and height.
 */
function normalizeRect(rect: Rect): Rect {
  let { x, y, width, height } = rect;

  if (width < 0) {
    x = x + width;
    width = Math.abs(width);
  }

  if (height < 0) {
    y = y + height;
    height = Math.abs(height);
  }

  return { x, y, width, height };
}

export function MaskEditor({
  imageSrc,
  masks,
  onMasksChange,
  enabled = true,
  onToggleEnabled,
}: MaskEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [drawing, setDrawing] = useState(false);
  const [pendingRect, setPendingRect] = useState<Rect | null>(null);

  // Resize state for pending rect
  const [resizingPending, setResizingPending] = useState<ResizeState | null>(null);

  // Drag state for moving pending rect
  const [draggingPending, setDraggingPending] = useState<{ startX: number; startY: number; originalRect: Rect } | null>(null);

  // Modal state
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Existing mask selection/resize
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [resizingMask, setResizingMask] = useState<ResizeState & { maskId: string } | null>(null);
  const [hoveredMaskId, setHoveredMaskId] = useState<string | null>(null);

  const getContainerBounds = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 };
  }, []);

  // Convert pixel coordinates to percentages
  const toPercentages = useCallback((rect: Rect): Rect => {
    const bounds = getContainerBounds();
    if (!bounds.width || !bounds.height) return rect;
    return {
      x: (rect.x / bounds.width) * 100,
      y: (rect.y / bounds.height) * 100,
      width: (rect.width / bounds.width) * 100,
      height: (rect.height / bounds.height) * 100,
    };
  }, [getContainerBounds]);

  // Start drawing a new mask
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || showCommentModal) return;

      // If there's a pending rect, clicking outside should cancel it
      if (pendingRect) {
        setPendingRect(null);
        return;
      }

      setSelectedMaskId(null);
      const bounds = getContainerBounds();
      setDrawing(true);
      setPendingRect({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
        width: 0,
        height: 0,
      });
    },
    [enabled, showCommentModal, pendingRect, getContainerBounds]
  );

  // Handle mouse move for drawing, resizing, or dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const bounds = getContainerBounds();
      const currentX = e.clientX - bounds.left;
      const currentY = e.clientY - bounds.top;

      if (drawing && pendingRect) {
        setPendingRect({
          ...pendingRect,
          width: currentX - pendingRect.x,
          height: currentY - pendingRect.y,
        });
      } else if (draggingPending && pendingRect) {
        // Move the pending rect
        const { startX, startY, originalRect } = draggingPending;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        setPendingRect({
          ...originalRect,
          x: originalRect.x + deltaX,
          y: originalRect.y + deltaY,
        });
      } else if (resizingPending && pendingRect) {
        const { handle, startX, startY, originalRect } = resizingPending;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        setPendingRect(calculateResizedRect(originalRect, handle, deltaX, deltaY));
      } else if (resizingMask) {
        const { maskId, handle, startX, startY, originalRect } = resizingMask;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        const newRect = calculateResizedRect(originalRect, handle, deltaX, deltaY);
        const normalized = normalizeRect(newRect);
        const asPercent = toPercentages(normalized);

        const updatedMasks = masks.map((m) =>
          m.id === maskId ? { ...m, ...asPercent } : m
        );
        onMasksChange(updatedMasks);
      }
    },
    [drawing, pendingRect, draggingPending, resizingPending, resizingMask, masks, onMasksChange, getContainerBounds, toPercentages]
  );

  // Handle mouse up - finish drawing/dragging/resizing
  const handleMouseUp = useCallback(() => {
    if (drawing && pendingRect) {
      const normalized = normalizeRect(pendingRect);

      // Only keep rect if it's large enough
      if (normalized.width > 10 && normalized.height > 10) {
        setPendingRect(normalized);
      } else {
        setPendingRect(null);
      }
      setDrawing(false);
    }

    if (draggingPending) {
      setDraggingPending(null);
    }

    if (resizingPending) {
      setResizingPending(null);
    }

    if (resizingMask) {
      setResizingMask(null);
    }
  }, [drawing, pendingRect, draggingPending, resizingPending, resizingMask]);

  // Global mouse event listeners
  useEffect(() => {
    if (drawing || draggingPending || resizingPending || resizingMask) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [drawing, resizingPending, resizingMask, handleMouseMove, handleMouseUp]);

  // Handle confirm mask button click
  const handleConfirmMask = useCallback(() => {
    setShowCommentModal(true);
    setCommentText('');
  }, []);

  // Handle cancel pending mask
  const handleCancelPending = useCallback(() => {
    setPendingRect(null);
  }, []);

  // Handle modal confirm
  const handleModalConfirm = useCallback(() => {
    if (!pendingRect || !commentText.trim()) return;

    const normalized = normalizeRect(pendingRect);
    const asPercent = toPercentages(normalized);

    const newMask: Mask = {
      id: generateId(),
      ...asPercent,
      reason: commentText.trim(),
    };

    onMasksChange([...masks, newMask]);
    setPendingRect(null);
    setShowCommentModal(false);
    setCommentText('');
  }, [pendingRect, commentText, masks, onMasksChange, toPercentages]);

  // Handle modal cancel
  const handleModalCancel = useCallback(() => {
    setPendingRect(null);
    setShowCommentModal(false);
    setCommentText('');
  }, []);

  // Start resizing pending rect
  const handlePendingResizeStart = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.stopPropagation();
      if (!pendingRect) return;

      const bounds = getContainerBounds();
      setResizingPending({
        handle,
        startX: e.clientX - bounds.left,
        startY: e.clientY - bounds.top,
        originalRect: { ...pendingRect },
      });
    },
    [pendingRect, getContainerBounds]
  );

  // Start dragging pending rect (move it)
  const handlePendingDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!pendingRect) return;

      const bounds = getContainerBounds();
      setDraggingPending({
        startX: e.clientX - bounds.left,
        startY: e.clientY - bounds.top,
        originalRect: { ...pendingRect },
      });
    },
    [pendingRect, getContainerBounds]
  );

  // Handle mask click - select it
  const handleMaskClick = useCallback(
    (e: React.MouseEvent, maskId: string) => {
      e.stopPropagation();
      setSelectedMaskId(maskId);
      setPendingRect(null);
    },
    []
  );

  // Handle resize handle mouse down for existing masks
  const handleMaskResizeStart = useCallback(
    (e: React.MouseEvent, maskId: string, handle: ResizeHandle) => {
      e.stopPropagation();

      const mask = masks.find((m) => m.id === maskId);
      if (!mask) return;

      const bounds = getContainerBounds();
      // Convert percentage to pixels for resizing
      const pixelRect: Rect = {
        x: (mask.x / 100) * bounds.width,
        y: (mask.y / 100) * bounds.height,
        width: (mask.width / 100) * bounds.width,
        height: (mask.height / 100) * bounds.height,
      };

      setResizingMask({
        maskId,
        handle,
        startX: e.clientX - bounds.left,
        startY: e.clientY - bounds.top,
        originalRect: pixelRect,
      });
    },
    [masks, getContainerBounds]
  );

  // Delete mask handler
  const handleDeleteMask = useCallback(
    (maskId: string) => {
      const updatedMasks = masks.filter((m) => m.id !== maskId);
      onMasksChange(updatedMasks);
      setSelectedMaskId(null);
    },
    [masks, onMasksChange]
  );

  // Keyboard shortcuts (component-specific only)
  // Note: 'm' key for toggling mask mode is handled by parent via useReviewKeyboardShortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (showCommentModal) {
          handleModalCancel();
        } else if (pendingRect) {
          handleCancelPending();
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMaskId) {
        handleDeleteMask(selectedMaskId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMaskId, showCommentModal, pendingRect, handleModalCancel, handleCancelPending, handleDeleteMask]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Base image */}
      <img
        src={imageSrc}
        alt="Screenshot for masking"
        className="pointer-events-none max-w-full"
        role="img"
      />

      {/* Drawing canvas overlay */}
      <div
        data-testid="mask-canvas"
        className={cn(
          'absolute top-0 left-0 w-full h-full',
          enabled && !showCommentModal ? 'cursor-crosshair' : 'cursor-default'
        )}
        onMouseDown={handleCanvasMouseDown}
      />

      {/* Existing masks */}
      {masks.map((mask) => (
        <ExistingMaskOverlay
          key={mask.id}
          mask={mask}
          isSelected={selectedMaskId === mask.id}
          isHovered={hoveredMaskId === mask.id}
          onSelect={(e) => handleMaskClick(e, mask.id)}
          onMouseEnter={() => setHoveredMaskId(mask.id)}
          onMouseLeave={() => setHoveredMaskId(null)}
          onResizeStart={(e, handle) => handleMaskResizeStart(e, mask.id, handle)}
          onDelete={() => handleDeleteMask(mask.id)}
        />
      ))}

      {/* Pending mask (being drawn/confirmed) */}
      {pendingRect && !drawing && (
        <PendingMaskOverlay
          rect={pendingRect}
          onConfirm={handleConfirmMask}
          onCancel={handleCancelPending}
          onResizeStart={handlePendingResizeStart}
          onDragStart={handlePendingDragStart}
        />
      )}

      {/* Drawing rectangle */}
      {drawing && pendingRect && (
        <div
          data-testid="drawing-rect"
          className="absolute border-2 border-dashed border-purple-500 bg-purple-500/20 pointer-events-none"
          style={{
            left: Math.min(pendingRect.x, pendingRect.x + pendingRect.width),
            top: Math.min(pendingRect.y, pendingRect.y + pendingRect.height),
            width: Math.abs(pendingRect.width),
            height: Math.abs(pendingRect.height),
          }}
        />
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <MaskCommentModal
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          comment={commentText}
          onCommentChange={setCommentText}
        />
      )}
    </div>
  );
}

function calculateResizedRect(original: Rect, handle: ResizeHandle, deltaX: number, deltaY: number): Rect {
  let newRect = { ...original };

  switch (handle) {
    case 'nw':
      newRect = {
        x: original.x + deltaX,
        y: original.y + deltaY,
        width: original.width - deltaX,
        height: original.height - deltaY,
      };
      break;
    case 'n':
      newRect = {
        ...original,
        y: original.y + deltaY,
        height: original.height - deltaY,
      };
      break;
    case 'ne':
      newRect = {
        x: original.x,
        y: original.y + deltaY,
        width: original.width + deltaX,
        height: original.height - deltaY,
      };
      break;
    case 'e':
      newRect = {
        ...original,
        width: original.width + deltaX,
      };
      break;
    case 'se':
      newRect = {
        x: original.x,
        y: original.y,
        width: original.width + deltaX,
        height: original.height + deltaY,
      };
      break;
    case 's':
      newRect = {
        ...original,
        height: original.height + deltaY,
      };
      break;
    case 'sw':
      newRect = {
        x: original.x + deltaX,
        y: original.y,
        width: original.width - deltaX,
        height: original.height + deltaY,
      };
      break;
    case 'w':
      newRect = {
        ...original,
        x: original.x + deltaX,
        width: original.width - deltaX,
      };
      break;
  }

  return normalizeRect(newRect);
}

interface PendingMaskOverlayProps {
  rect: Rect;
  onConfirm: () => void;
  onCancel: () => void;
  onResizeStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
  onDragStart: (e: React.MouseEvent) => void;
}

function PendingMaskOverlay({ rect, onConfirm, onCancel, onResizeStart, onDragStart }: PendingMaskOverlayProps) {
  const handles: { position: ResizeHandle; className: string }[] = [
    { position: 'nw', className: 'top-0 left-0 cursor-nw-resize -translate-x-1/2 -translate-y-1/2' },
    { position: 'n', className: 'top-0 left-1/2 cursor-n-resize -translate-x-1/2 -translate-y-1/2' },
    { position: 'ne', className: 'top-0 right-0 cursor-ne-resize translate-x-1/2 -translate-y-1/2' },
    { position: 'e', className: 'top-1/2 right-0 cursor-e-resize translate-x-1/2 -translate-y-1/2' },
    { position: 'se', className: 'bottom-0 right-0 cursor-se-resize translate-x-1/2 translate-y-1/2' },
    { position: 's', className: 'bottom-0 left-1/2 cursor-s-resize -translate-x-1/2 translate-y-1/2' },
    { position: 'sw', className: 'bottom-0 left-0 cursor-sw-resize -translate-x-1/2 translate-y-1/2' },
    { position: 'w', className: 'top-1/2 left-0 cursor-w-resize -translate-x-1/2 -translate-y-1/2' },
  ];

  return (
    <div
      data-testid="pending-mask"
      className="absolute border-2 border-purple-500 bg-purple-500/30 cursor-move"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={onDragStart}
    >
      {/* Resize handles */}
      {handles.map(({ position, className }) => (
        <div
          key={position}
          data-testid="resize-handle"
          data-position={position}
          className={cn(
            'absolute w-3 h-3 bg-purple-500 border-2 border-white rounded-sm',
            className
          )}
          onMouseDown={(e) => onResizeStart(e, position)}
        />
      ))}

      {/* Action buttons - positioned further below the mask */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 mt-2">
        <button
          type="button"
          className="px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 shadow-lg whitespace-nowrap"
          onClick={onConfirm}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Confirm Mask
        </button>
        <button
          type="button"
          className="px-2 py-1 bg-gray-600 text-white text-xs font-medium rounded hover:bg-gray-700 shadow-lg"
          onClick={onCancel}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ExistingMaskOverlayProps {
  mask: Mask;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onResizeStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
  onDelete: () => void;
}

function ExistingMaskOverlay({
  mask,
  isSelected,
  isHovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onResizeStart,
  onDelete,
}: ExistingMaskOverlayProps) {
  const handles: { position: ResizeHandle; className: string }[] = [
    { position: 'nw', className: 'top-0 left-0 cursor-nw-resize -translate-x-1/2 -translate-y-1/2' },
    { position: 'ne', className: 'top-0 right-0 cursor-ne-resize translate-x-1/2 -translate-y-1/2' },
    { position: 'sw', className: 'bottom-0 left-0 cursor-sw-resize -translate-x-1/2 translate-y-1/2' },
    { position: 'se', className: 'bottom-0 right-0 cursor-se-resize translate-x-1/2 translate-y-1/2' },
  ];

  return (
    <div
      data-testid="mask-overlay"
      data-selected={isSelected}
      className={cn(
        'absolute bg-purple-500/30 border-2 cursor-pointer',
        isSelected ? 'border-purple-500' : 'border-purple-500/50'
      )}
      style={{
        left: `${mask.x}%`,
        top: `${mask.y}%`,
        width: `${mask.width}%`,
        height: `${mask.height}%`,
      }}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Reason tooltip on hover */}
      {(isHovered || isSelected) && (
        <div className="absolute -top-8 left-0 px-2 py-1 bg-black/75 text-white text-xs rounded whitespace-nowrap max-w-xs truncate">
          {mask.reason}
        </div>
      )}

      {/* Resize handles (only when selected) */}
      {isSelected && (
        <>
          {handles.map(({ position, className }) => (
            <div
              key={position}
              data-testid="resize-handle"
              data-position={position}
              className={cn(
                'absolute w-3 h-3 bg-purple-500 border-2 border-white rounded-sm',
                className
              )}
              onMouseDown={(e) => onResizeStart(e, position)}
            />
          ))}

          {/* Delete button */}
          <button
            type="button"
            aria-label="Delete mask"
            className="absolute -top-8 right-0 px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}

interface MaskCommentModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  comment: string;
  onCommentChange: (comment: string) => void;
}

function MaskCommentModal({ onConfirm, onCancel, comment, onCommentChange }: MaskCommentModalProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (comment.trim()) {
        onConfirm();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold mb-4">Add Mask Comment</h3>

        <p className="text-sm text-muted-foreground mb-4">
          Why should this region be masked? (e.g., "Dynamic timestamp", "User avatar", "Random advertisement")
        </p>

        <textarea
          ref={inputRef}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter reason for masking this region..."
          className="w-full h-24 p-3 border rounded-md bg-background text-sm resize-none"
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
            onClick={onConfirm}
            disabled={!comment.trim()}
          >
            Save Mask
          </button>
        </div>
      </div>
    </div>
  );
}
