import { useState, useEffect, useRef } from 'react';
import type { LegacyLocatorObject, LocatorMethod } from '@browserflow/core';
import { cn } from '@/lib/utils';

// Strategy types for locator candidates
export interface LocatorStrategy {
  type: 'testid' | 'role' | 'label' | 'css' | 'text' | 'placeholder';
  value?: string;
  selector?: string;
  role?: string;
  name?: string;
  text?: string;
}

export interface LocatorCandidate {
  strategy: LocatorStrategy;
  confidence: number;
  matchCount: number;
}

export interface LocatorPickerProps {
  candidates: LocatorCandidate[];
  currentLocator?: LegacyLocatorObject;
  onLockLocator: (locator: LegacyLocatorObject) => void;
}

export function LocatorPicker({
  candidates,
  currentLocator,
  onLockLocator,
}: LocatorPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut to focus picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'l') {
        containerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLockSelected = () => {
    const candidate = candidates[selectedIndex];
    if (candidate) {
      onLockLocator(candidateToLocator(candidate));
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      data-testid="locator-picker"
      className="space-y-4 outline-none"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Locator</h3>
        <Badge variant={currentLocator ? 'default' : 'outline'}>
          {currentLocator ? 'Locked' : 'Not locked'}
        </Badge>
      </div>

      {/* Current locked locator */}
      {currentLocator && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <div className="text-sm font-medium text-green-800">Preferred</div>
          <code className="text-xs">
            {formatLegacyLocatorObject(currentLocator)}
          </code>
        </div>
      )}

      {/* Candidate list */}
      <div className="space-y-2">
        {candidates.map((candidate, index) => (
          <CandidateRow
            key={index}
            candidate={candidate}
            isSelected={index === selectedIndex}
            onClick={() => setSelectedIndex(index)}
          />
        ))}
      </div>

      {/* Lock button */}
      <button
        onClick={handleLockSelected}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Lock Selected as Preferred
      </button>
    </div>
  );
}

interface CandidateRowProps {
  candidate: LocatorCandidate;
  isSelected: boolean;
  onClick: () => void;
}

function CandidateRow({ candidate, isSelected, onClick }: CandidateRowProps) {
  return (
    <div
      data-testid="candidate-row"
      className={cn(
        'p-3 border rounded cursor-pointer transition-colors',
        isSelected ? 'border-blue-500 bg-blue-50' : 'hover:bg-muted'
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <Badge variant="secondary">{candidate.strategy.type}</Badge>
          <code className="ml-2 text-sm truncate block mt-1">
            {formatStrategy(candidate.strategy)}
          </code>
        </div>
        <div className="text-right ml-2">
          <div className="text-sm font-medium">
            {Math.round(candidate.confidence * 100)}% confidence
          </div>
          <div className="text-xs text-muted-foreground">
            {candidate.matchCount} match{candidate.matchCount !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BadgeProps {
  variant: 'default' | 'secondary' | 'outline';
  children: React.ReactNode;
}

function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
        variant === 'default' && 'bg-primary text-primary-foreground',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        variant === 'outline' && 'border border-input bg-background'
      )}
    >
      {children}
    </span>
  );
}

function formatStrategy(strategy: LocatorStrategy): string {
  switch (strategy.type) {
    case 'testid':
      return `[data-testid="${strategy.value}"]`;
    case 'role':
      if (strategy.name) {
        return `getByRole('${strategy.role}', { name: '${strategy.name}' })`;
      }
      return `getByRole('${strategy.role}')`;
    case 'label':
      return `getByLabel('${strategy.text}')`;
    case 'css':
      return strategy.selector || '';
    case 'text':
      return `getByText('${strategy.text}')`;
    case 'placeholder':
      return `getByPlaceholder('${strategy.text}')`;
    default:
      return JSON.stringify(strategy);
  }
}

function candidateToLocator(candidate: LocatorCandidate): LegacyLocatorObject {
  const { strategy } = candidate;

  switch (strategy.type) {
    case 'testid':
      return {
        method: 'getByTestId' as LocatorMethod,
        args: { testId: strategy.value },
      };
    case 'role':
      return {
        method: 'getByRole' as LocatorMethod,
        args: { role: strategy.role, name: strategy.name },
      };
    case 'label':
      return {
        method: 'getByLabel' as LocatorMethod,
        args: { text: strategy.text },
      };
    case 'css':
      return {
        method: 'locator' as LocatorMethod,
        args: { selector: strategy.selector },
      };
    case 'text':
      return {
        method: 'getByText' as LocatorMethod,
        args: { text: strategy.text },
      };
    case 'placeholder':
      return {
        method: 'getByPlaceholder' as LocatorMethod,
        args: { text: strategy.text },
      };
    default:
      return {
        selector: JSON.stringify(strategy),
      };
  }
}

function formatLegacyLocatorObject(locator: LegacyLocatorObject): string {
  if (locator.method && locator.args) {
    const args = Object.entries(locator.args)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}: '${v}'`)
      .join(', ');
    return `${locator.method}({ ${args} })`;
  }
  if (locator.selector) {
    return locator.selector;
  }
  return JSON.stringify(locator);
}
