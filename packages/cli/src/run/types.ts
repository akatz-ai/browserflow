export interface RunOptions {
  spec?: string;
  tag?: string;
  parallel?: number;
  headed?: boolean;
  trace?: 'on' | 'off' | 'on-first-retry';
}

export interface StepResult {
  name: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
}

export interface SpecResult {
  name: string;
  steps: StepResult[];
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
}

export interface RunResult {
  runDir: string;
  specs: SpecResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: FailureInfo[];
}

export interface FailureInfo {
  spec: string;
  step: string;
  error: string;
  screenshot?: string;
  trace?: string;
  context?: {
    url: string;
    viewport: { width: number; height: number };
    browser: string;
  };
}
