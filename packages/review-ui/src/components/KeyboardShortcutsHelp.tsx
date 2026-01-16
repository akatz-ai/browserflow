import { cn } from '@/lib/utils';
import {
  KEYBOARD_SHORTCUTS,
  type ShortcutCategory,
} from '../hooks/useReviewKeyboardShortcuts';

export interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_ORDER: ShortcutCategory[] = [
  'Navigation',
  'Review Actions',
  'UI Actions',
  'View Modes',
  'Other',
];

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  if (!open) return null;

  // Group shortcuts by category
  type Shortcut = (typeof KEYBOARD_SHORTCUTS)[number];
  const shortcutsByCategory = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = KEYBOARD_SHORTCUTS.filter((s) => s.category === category);
      return acc;
    },
    {} as Record<ShortcutCategory, Shortcut[]>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog content */}
      <div className="relative bg-background border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="shortcuts-title" className="text-lg font-semibold">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6">
          <div className="space-y-6">
            {CATEGORY_ORDER.map((category) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcutsByCategory[category].map(({ key, description }) => (
                    <ShortcutRow key={key} shortcut={key} description={description} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            Press <Kbd>Esc</Kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

interface ShortcutRowProps {
  shortcut: string;
  description: string;
}

function ShortcutRow({ shortcut, description }: ShortcutRowProps) {
  // Split shortcut by + to handle combinations like Ctrl+S
  const keys = shortcut.split('+').map((k) => k.trim());

  return (
    <div className="flex items-center justify-between py-1" data-shortcut>
      <span className="text-sm">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <Kbd>{key}</Kbd>
            {index < keys.length - 1 && (
              <span className="text-muted-foreground">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      data-testid="kbd"
      className={cn(
        'px-2 py-1 text-xs font-mono bg-muted border rounded',
        className
      )}
    >
      {children}
    </kbd>
  );
}
