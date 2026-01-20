/**
 * Capture annotated screenshot with masks rendered as overlays
 *
 * Used to save a visual record of what the human reviewer highlighted
 * so Claude can directly see the masks without interpreting coordinates.
 */

import type { Mask } from '../components/MaskEditor';

// Color palette for masks - matches MASK_COLORS in ReviewPage.tsx
// Using rgba for canvas rendering
const MASK_COLORS = [
  { fill: 'rgba(168, 85, 247, 0.3)', border: 'rgb(168, 85, 247)' },   // purple
  { fill: 'rgba(6, 182, 212, 0.3)', border: 'rgb(6, 182, 212)' },     // cyan
  { fill: 'rgba(249, 115, 22, 0.3)', border: 'rgb(249, 115, 22)' },   // orange
  { fill: 'rgba(236, 72, 153, 0.3)', border: 'rgb(236, 72, 153)' },   // pink
  { fill: 'rgba(34, 197, 94, 0.3)', border: 'rgb(34, 197, 94)' },     // green
  { fill: 'rgba(234, 179, 8, 0.3)', border: 'rgb(234, 179, 8)' },     // yellow
  { fill: 'rgba(59, 130, 246, 0.3)', border: 'rgb(59, 130, 246)' },   // blue
  { fill: 'rgba(239, 68, 68, 0.3)', border: 'rgb(239, 68, 68)' },     // red
];

function getMaskColor(index: number) {
  return MASK_COLORS[index % MASK_COLORS.length];
}

export interface CaptureOptions {
  /** URL of the screenshot image to annotate */
  imageSrc: string;
  /** Array of masks to render on the screenshot */
  masks: Mask[];
  /** Border width in pixels (default: 3) */
  borderWidth?: number;
  /** Whether to show mask number labels (default: true) */
  showLabels?: boolean;
}

/**
 * Load an image from URL and return HTMLImageElement
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Handle CORS for data URLs or same-origin
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Capture an annotated screenshot with masks rendered as visual overlays
 *
 * @param options - Configuration for the capture
 * @returns PNG Blob of the annotated screenshot
 */
export async function captureAnnotatedScreenshot(options: CaptureOptions): Promise<Blob> {
  const {
    imageSrc,
    masks,
    borderWidth = 3,
    showLabels = true,
  } = options;

  // Load the base image
  const img = await loadImage(imageSrc);

  // Create canvas at image dimensions
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Draw base image
  ctx.drawImage(img, 0, 0);

  // Draw each mask
  for (let i = 0; i < masks.length; i++) {
    const mask = masks[i];
    const color = getMaskColor(i);

    // Convert percentage coordinates to pixels
    const x = (mask.x / 100) * canvas.width;
    const y = (mask.y / 100) * canvas.height;
    const width = (mask.width / 100) * canvas.width;
    const height = (mask.height / 100) * canvas.height;

    // Draw semi-transparent fill
    ctx.fillStyle = color.fill;
    ctx.fillRect(x, y, width, height);

    // Draw solid border
    ctx.strokeStyle = color.border;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(x, y, width, height);

    // Draw mask number label
    if (showLabels) {
      const label = String(i + 1);
      const labelSize = Math.max(16, Math.min(24, height / 4)); // Responsive size
      const padding = 4;

      ctx.font = `bold ${labelSize}px sans-serif`;
      const textMetrics = ctx.measureText(label);
      const labelWidth = textMetrics.width + padding * 2;
      const labelHeight = labelSize + padding * 2;

      // Position label in top-left corner of mask
      const labelX = x + borderWidth;
      const labelY = y + borderWidth;

      // Draw label background
      ctx.fillStyle = color.border;
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

      // Draw label text
      ctx.fillStyle = 'white';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);
    }
  }

  // Convert canvas to PNG blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/png',
      1.0 // Maximum quality
    );
  });
}
