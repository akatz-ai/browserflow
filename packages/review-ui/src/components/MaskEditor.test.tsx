import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaskEditor, type Mask, type MaskEditorProps } from './MaskEditor';

describe('MaskEditor', () => {
  const defaultProps: MaskEditorProps = {
    imageSrc: '/screenshots/test.png',
    masks: [],
    onMasksChange: vi.fn(),
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the image', () => {
      render(<MaskEditor {...defaultProps} />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/screenshots/test.png');
    });

    it('renders existing masks as overlays', () => {
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Timestamp' },
        { id: 'mask-2', x: 200, y: 100, width: 80, height: 60, reason: 'Ad' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlays = screen.getAllByTestId('mask-overlay');
      expect(maskOverlays).toHaveLength(2);
    });

    it('shows mask reason on hover', async () => {
      const user = userEvent.setup();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Dynamic timestamp' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.hover(maskOverlay);

      expect(screen.getByText('Dynamic timestamp')).toBeInTheDocument();
    });
  });

  describe('Drawing New Masks', () => {
    it('shows drawing indicator while dragging', () => {
      render(<MaskEditor {...defaultProps} />);

      const canvas = screen.getByTestId('mask-canvas');

      // Start drawing
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      // Move while drawing
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 150 });

      // Should show the drawing rectangle
      const drawingRect = screen.getByTestId('drawing-rect');
      expect(drawingRect).toBeInTheDocument();
    });

    it('creates a new mask after valid drag and reason input', () => {
      const onMasksChange = vi.fn();

      // Mock window.prompt
      const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue('Timestamp region');

      render(<MaskEditor {...defaultProps} onMasksChange={onMasksChange} />);

      const canvas = screen.getByTestId('mask-canvas');

      // Simulate drag to create mask
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 180 });
      fireEvent.mouseUp(canvas);

      // Should have prompted for reason
      expect(mockPrompt).toHaveBeenCalledWith('Why is this region masked?');

      // Should have called onMasksChange with new mask
      expect(onMasksChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            reason: 'Timestamp region',
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        ])
      );

      mockPrompt.mockRestore();
    });

    it('does not create mask if drag is too small (less than 10px)', () => {
      const onMasksChange = vi.fn();

      render(<MaskEditor {...defaultProps} onMasksChange={onMasksChange} />);

      const canvas = screen.getByTestId('mask-canvas');

      // Small drag (less than 10px in both dimensions)
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 105, clientY: 105 });
      fireEvent.mouseUp(canvas);

      expect(onMasksChange).not.toHaveBeenCalled();
    });

    it('does not create mask if reason prompt is cancelled', () => {
      const onMasksChange = vi.fn();
      const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue(null);

      render(<MaskEditor {...defaultProps} onMasksChange={onMasksChange} />);

      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 180 });
      fireEvent.mouseUp(canvas);

      expect(onMasksChange).not.toHaveBeenCalled();

      mockPrompt.mockRestore();
    });

    it('normalizes negative width/height rectangles', () => {
      const onMasksChange = vi.fn();
      const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue('Test');

      render(<MaskEditor {...defaultProps} onMasksChange={onMasksChange} />);

      const canvas = screen.getByTestId('mask-canvas');

      // Drag from bottom-right to top-left (negative dimensions)
      fireEvent.mouseDown(canvas, { clientX: 200, clientY: 180 });
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(canvas);

      // Should normalize to positive width/height
      expect(onMasksChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        ])
      );

      // Get the actual call and verify width/height are positive
      const call = onMasksChange.mock.calls[0][0];
      expect(call[0].width).toBeGreaterThan(0);
      expect(call[0].height).toBeGreaterThan(0);

      mockPrompt.mockRestore();
    });

    it('does not allow drawing when disabled', () => {
      const onMasksChange = vi.fn();

      render(<MaskEditor {...defaultProps} onMasksChange={onMasksChange} enabled={false} />);

      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 180 });
      fireEvent.mouseUp(canvas);

      expect(onMasksChange).not.toHaveBeenCalled();
    });
  });

  describe('Selecting Masks', () => {
    it('selects a mask when clicked', async () => {
      const user = userEvent.setup();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);

      expect(maskOverlay).toHaveAttribute('data-selected', 'true');
    });

    it('deselects when clicking outside masks', async () => {
      const user = userEvent.setup();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);
      expect(maskOverlay).toHaveAttribute('data-selected', 'true');

      // Click outside
      const canvas = screen.getByTestId('mask-canvas');
      await user.click(canvas);

      expect(maskOverlay).toHaveAttribute('data-selected', 'false');
    });
  });

  describe('Resizing Masks', () => {
    it('shows resize handles on selected mask', async () => {
      const user = userEvent.setup();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);

      // Should show 4 corner handles
      const handles = screen.getAllByTestId('resize-handle');
      expect(handles).toHaveLength(4);
    });

    it('resizes mask when dragging corner handle', async () => {
      const onMasksChange = vi.fn();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      const { rerender } = render(
        <MaskEditor {...defaultProps} masks={masks} onMasksChange={onMasksChange} />
      );

      // Select the mask
      const maskOverlay = screen.getByTestId('mask-overlay');
      fireEvent.click(maskOverlay);

      // Rerender to show handles
      rerender(<MaskEditor {...defaultProps} masks={masks} onMasksChange={onMasksChange} />);

      // Drag the bottom-right handle
      const handles = screen.getAllByTestId('resize-handle');
      const bottomRightHandle = handles.find(h => h.getAttribute('data-position') === 'se');

      if (bottomRightHandle) {
        fireEvent.mouseDown(bottomRightHandle, { clientX: 110, clientY: 70 });
        fireEvent.mouseMove(document, { clientX: 150, clientY: 100 });
        fireEvent.mouseUp(document);
      }

      expect(onMasksChange).toHaveBeenCalled();
    });
  });

  describe('Deleting Masks', () => {
    it('deletes selected mask when pressing Delete key', async () => {
      const user = userEvent.setup();
      const onMasksChange = vi.fn();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} onMasksChange={onMasksChange} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);

      await user.keyboard('{Delete}');

      expect(onMasksChange).toHaveBeenCalledWith([]);
    });

    it('deletes selected mask when pressing Backspace key', async () => {
      const user = userEvent.setup();
      const onMasksChange = vi.fn();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} onMasksChange={onMasksChange} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);

      await user.keyboard('{Backspace}');

      expect(onMasksChange).toHaveBeenCalledWith([]);
    });

    it('shows delete button on selected mask', async () => {
      const user = userEvent.setup();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('deletes mask when clicking delete button', async () => {
      const user = userEvent.setup();
      const onMasksChange = vi.fn();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} onMasksChange={onMasksChange} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(onMasksChange).toHaveBeenCalledWith([]);
    });

    it('does not delete if no mask is selected', async () => {
      const user = userEvent.setup();
      const onMasksChange = vi.fn();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} onMasksChange={onMasksChange} />);

      // Press delete without selecting
      await user.keyboard('{Delete}');

      expect(onMasksChange).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcut', () => {
    it('calls onToggleEnabled when pressing m key', async () => {
      const user = userEvent.setup();
      const onToggleEnabled = vi.fn();

      render(<MaskEditor {...defaultProps} onToggleEnabled={onToggleEnabled} />);

      await user.keyboard('m');

      expect(onToggleEnabled).toHaveBeenCalled();
    });

    it('does not trigger shortcut when typing in input', async () => {
      const user = userEvent.setup();
      const onToggleEnabled = vi.fn();

      render(
        <div>
          <MaskEditor {...defaultProps} onToggleEnabled={onToggleEnabled} />
          <input type="text" data-testid="test-input" />
        </div>
      );

      const input = screen.getByTestId('test-input');
      await user.click(input);
      await user.type(input, 'm');

      expect(onToggleEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Visual Feedback', () => {
    it('shows translucent overlay for masks', () => {
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      expect(maskOverlay).toHaveClass('bg-red-500/30');
    });

    it('shows different style for selected mask', async () => {
      const user = userEvent.setup();
      const masks: Mask[] = [
        { id: 'mask-1', x: 10, y: 20, width: 100, height: 50, reason: 'Test' },
      ];

      render(<MaskEditor {...defaultProps} masks={masks} />);

      const maskOverlay = screen.getByTestId('mask-overlay');
      await user.click(maskOverlay);

      expect(maskOverlay).toHaveClass('border-blue-500');
    });

    it('shows cursor crosshair when enabled', () => {
      render(<MaskEditor {...defaultProps} enabled={true} />);

      const canvas = screen.getByTestId('mask-canvas');
      expect(canvas).toHaveClass('cursor-crosshair');
    });

    it('shows default cursor when disabled', () => {
      render(<MaskEditor {...defaultProps} enabled={false} />);

      const canvas = screen.getByTestId('mask-canvas');
      expect(canvas).not.toHaveClass('cursor-crosshair');
    });
  });
});
