import { useState, useEffect } from 'react';
import type { ExplorationStep } from '@browserflow/core';

export interface ExplorationData {
  id: string;
  specName: string;
  specPath: string;
  exploredAt: string;
  duration: number;
  status: 'passed' | 'failed';
  steps: ExplorationStep[];
  browser?: {
    name: string;
    version: string;
  };
  viewport?: {
    width: number;
    height: number;
  };
}

export interface UseExplorationDataResult {
  data: ExplorationData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to load exploration data from the API or static files.
 * In dev mode, it can load from a local JSON file.
 * In production, it fetches from the bf review server API.
 */
export function useExplorationData(explorationPath?: string): UseExplorationDataResult {
  const [data, setData] = useState<ExplorationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // If a path is provided, load from that file
        if (explorationPath) {
          const response = await fetch(explorationPath);
          if (!response.ok) {
            throw new Error(`Failed to load exploration: ${response.statusText}`);
          }
          const json = await response.json();
          setData(normalizeExplorationData(json, explorationPath));
        } else {
          // Try to load from API endpoint
          const response = await fetch('/api/exploration');
          if (!response.ok) {
            throw new Error(`Failed to load exploration: ${response.statusText}`);
          }
          const json = await response.json();
          setData(normalizeExplorationData(json, '/api/exploration'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [explorationPath]);

  return { data, loading, error };
}

/**
 * Normalize exploration data from various formats to our internal format.
 * This handles both the legacy exploration.json format and the new lockfile format.
 */
function normalizeExplorationData(json: unknown, sourcePath: string): ExplorationData {
  const obj = json as Record<string, unknown>;

  // Handle legacy format (from our test runner)
  if ('spec' in obj && 'steps' in obj && Array.isArray(obj.steps)) {
    const legacySteps = obj.steps as Array<Record<string, unknown>>;

    return {
      id: obj.spec as string || 'unknown',
      specName: obj.spec as string || 'Unknown Spec',
      specPath: sourcePath,
      exploredAt: obj.exploredAt as string || new Date().toISOString(),
      duration: obj.duration as number || 0,
      status: obj.status as 'passed' | 'failed' || 'passed',
      steps: legacySteps.map((step, idx) => normalizeStep(step, idx)),
      browser: obj.browser as { name: string; version: string } | undefined,
      viewport: obj.viewport as { width: number; height: number } | undefined,
    };
  }

  // Handle lockfile format
  if ('explorations' in obj && Array.isArray(obj.explorations)) {
    const explorations = obj.explorations as Array<Record<string, unknown>>;
    const first = explorations[0];
    if (first && 'steps' in first) {
      return {
        id: first.exploration_id as string || 'unknown',
        specName: obj.spec_name as string || 'Unknown Spec',
        specPath: sourcePath,
        exploredAt: first.timestamp as string || new Date().toISOString(),
        duration: 0,
        status: first.status as 'passed' | 'failed' || 'passed',
        steps: (first.steps as Array<Record<string, unknown>>).map((step, idx) =>
          normalizeStep(step, idx)
        ),
      };
    }
  }

  throw new Error('Unknown exploration data format');
}

/**
 * Normalize a step from legacy format to ExplorationStep
 */
function normalizeStep(step: Record<string, unknown>, index: number): ExplorationStep {
  // Handle legacy format from our test script
  if ('action' in step && !('spec_action' in step)) {
    return {
      step_index: step.index as number ?? index,
      spec_action: {
        id: step.id as string || `step-${index}`,
        action: step.action as string || 'unknown',
      } as ExplorationStep['spec_action'],
      execution: {
        status: step.status === 'passed' ? 'completed' : 'failed',
        duration_ms: step.duration as number || 0,
        locator: step.locator as ExplorationStep['execution']['locator'],
      },
      screenshots: {
        after: step.screenshot as string || undefined,
      },
    };
  }

  // Already in correct format
  return step as unknown as ExplorationStep;
}

/**
 * Load exploration data directly from a JSON object (for testing/demo)
 */
export function useExplorationDataFromJson(json: unknown): UseExplorationDataResult {
  const [data, setData] = useState<ExplorationData | null>(null);

  useEffect(() => {
    try {
      setData(normalizeExplorationData(json, 'inline'));
    } catch (err) {
      console.error('Failed to parse exploration data:', err);
    }
  }, [json]);

  return { data, loading: false, error: null };
}
