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

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface ResizeState {
  maskId: string;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  originalRect: Rect;
}

/**
 * Normalizes a rectangle to ensure positive width and height.
 * Handles cases where the user drags from bottom-right to top-left.
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
  const [drawing, setDrawing] = useState(false);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [hoveredMaskId, setHoveredMaskId] = useState<string | null>(null);

  // Get container bounds for coordinate calculation
  const getContainerBounds = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
  }, []);

  // Handle mouse down on canvas - start drawing
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      // Deselect if clicking on canvas (not on a mask)
      setSelectedMaskId(null);

      const bounds = getContainerBounds();
      setDrawing(true);
      setCurrentRect({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
        width: 0,
        height: 0,
      });
    },
    [enabled, getContainerBounds]
  );

  // Handle mouse move - update drawing rect or resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const bounds = getContainerBounds();
      const currentX = e.clientX - bounds.left;
      const currentY = e.clientY - bounds.top;

      if (drawing && currentRect) {
        setCurrentRect({
          ...currentRect,
          width: currentX - currentRect.x,
          height: currentY - currentRect.y,
        });
      } else if (resizing) {
        const { maskId, handle, startX, startY, originalRect } = resizing;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        let newRect: Rect = { ...originalRect };

        switch (handle) {
          case 'nw':
            newRect = {
              x: originalRect.x + deltaX,
              y: originalRect.y + deltaY,
              width: originalRect.width - deltaX,
              height: originalRect.height - deltaY,
            };
            break;
          case 'ne':
            newRect = {
              x: originalRect.x,
              y: originalRect.y + deltaY,
              width: originalRect.width + deltaX,
              height: originalRect.height - deltaY,
            };
            break;
          case 'sw':
            newRect = {
              x: originalRect.x + deltaX,
              y: originalRect.y,
              width: originalRect.width - deltaX,
              height: originalRect.height + deltaY,
            };
            break;
          case 'se':
            newRect = {
              x: originalRect.x,
              y: originalRect.y,
              width: originalRect.width + deltaX,
              height: originalRect.height + deltaY,
            };
            break;
        }

        // Normalize and update the mask
        const normalized = normalizeRect(newRect);
        const updatedMasks = masks.map((m) =>
          m.id === maskId ? { ...m, ...normalized } : m
        );
        onMasksChange(updatedMasks);
      }
    },
    [drawing, currentRect, resizing, masks, onMasksChange, getContainerBounds]
  );

  // Handle mouse up - finish drawing or resizing
  const handleMouseUp = useCallback(() => {
    if (drawing && currentRect) {
      const normalized = normalizeRect(currentRect);

      // Only create mask if it's large enough
      if (normalized.width > 10 && normalized.height > 10) {
        const reason = window.prompt('Why is this region masked?');
        if (reason) {
          const newMask: Mask = {
            id: crypto.randomUUID(),
            ...normalized,
            reason,
          };
          onMasksChange([...masks, newMask]);
        }
      }

      setDrawing(false);
      setCurrentRect(null);
    }

    if (resizing) {
      setResizing(null);
    }
  }, [drawing, currentRect, resizing, masks, onMasksChange]);

  // Global mouse event listeners for drawing/resizing
  useEffect(() => {
    if (drawing || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [drawing, resizing, handleMouseMove, handleMouseUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 'm' toggles mask mode
      if (e.key === 'm' && onToggleEnabled) {
        onToggleEnabled();
        return;
      }

      // Delete or Backspace deletes selected mask
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMaskId) {
        const updatedMasks = masks.filter((m) => m.id !== selectedMaskId);
        onMasksChange(updatedMasks);
        setSelectedMaskId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMaskId, masks, onMasksChange, onToggleEnabled]);

  // Handle mask click - select it
  const handleMaskClick = useCallback(
    (e: React.MouseEvent, maskId: string) => {
      e.stopPropagation();
      setSelectedMaskId(maskId);
    },
    []
  );

  // Handle resize handle mouse down
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, maskId: string, handle: ResizeHandle) => {
      e.stopPropagation();

      const mask = masks.find((m) => m.id === maskId);
      if (!mask) return;

      const bounds = getContainerBounds();
      setResizing({
        maskId,
        handle,
        startX: e.clientX - bounds.left,
        startY: e.clientY - bounds.top,
        originalRect: {
          x: mask.x,
          y: mask.y,
          width: mask.width,
          height: mask.height,
        },
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

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Base image */}
      <img
        src={imageSrc}
        alt=""
        className="pointer-events-none max-w-full"
        role="img"
      />

      {/* Drawing canvas overlay */}
      <div
        data-testid="mask-canvas"
        className={cn(
          'absolute top-0 left-0 w-full h-full',
          enabled ? 'cursor-crosshair' : 'cursor-default'
        )}
        onMouseDown={handleCanvasMouseDown}
      />

      {/* Existing masks */}
      {masks.map((mask) => {
        const isSelected = selectedMaskId === mask.id;
        const isHovered = hoveredMaskId === mask.id;

        return (
          <MaskOverlay
            key={mask.id}
            mask={mask}
            isSelected={isSelected}
            isHovered={isHovered}
            onSelect={(e) => handleMaskClick(e, mask.id)}
            onMouseEnter={() => setHoveredMaskId(mask.id)}
            onMouseLeave={() => setHoveredMaskId(null)}
            onResizeStart={(e, handle) => handleResizeStart(e, mask.id, handle)}
            onDelete={() => handleDeleteMask(mask.id)}
          />
        );
      })}

      {/* Current drawing rectangle */}
      {drawing && currentRect && (
        <div
          data-testid="drawing-rect"
          className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 pointer-events-none"
          style={{
            left: Math.min(currentRect.x, currentRect.x + currentRect.width),
            top: Math.min(currentRect.y, currentRect.y + currentRect.height),
            width: Math.abs(currentRect.width),
            height: Math.abs(currentRect.height),
          }}
        />
      )}
    </div>
  );
}

interface MaskOverlayProps {
  mask: Mask;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onResizeStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
  onDelete: () => void;
}

function MaskOverlay({
  mask,
  isSelected,
  isHovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onResizeStart,
  onDelete,
}: MaskOverlayProps) {
  const handles: { position: ResizeHandle; className: string }[] = [
    { position: 'nw', className: 'top-0 left-0 cursor-nw-resize' },
    { position: 'ne', className: 'top-0 right-0 cursor-ne-resize' },
    { position: 'sw', className: 'bottom-0 left-0 cursor-sw-resize' },
    { position: 'se', className: 'bottom-0 right-0 cursor-se-resize' },
  ];

  return (
    <div
      data-testid="mask-overlay"
      data-selected={isSelected}
      className={cn(
        'absolute bg-red-500/30 border-2 cursor-pointer',
        isSelected ? 'border-blue-500' : 'border-red-500/50'
      )}
      style={{
        left: mask.x,
        top: mask.y,
        width: mask.width,
        height: mask.height,
      }}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Reason tooltip on hover */}
      {(isHovered || isSelected) && (
        <div className="absolute -top-8 left-0 px-2 py-1 bg-black/75 text-white text-xs rounded whitespace-nowrap">
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
                'absolute w-3 h-3 bg-blue-500 border border-white rounded-sm -translate-x-1/2 -translate-y-1/2',
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
