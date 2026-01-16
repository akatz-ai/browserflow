import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logStep,
  logHeader,
  logNewline,
  printNextSteps,
} from './prompts.js';

describe('prompts', () => {
  let logs: string[];
  let errors: string[];
  let warns: string[];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    logs = [];
    errors = [];
    warns = [];
    originalLog = console.log;
    originalError = console.error;
    originalWarn = console.warn;

    console.log = mock((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    console.error = mock((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    console.warn = mock((...args: unknown[]) => {
      warns.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  describe('logSuccess', () => {
    it('should log success message with checkmark', () => {
      logSuccess('Test passed');
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('✓');
      expect(logs[0]).toContain('Test passed');
    });
  });

  describe('logError', () => {
    it('should log error message with X', () => {
      logError('Something failed');
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('✗');
      expect(errors[0]).toContain('Something failed');
    });
  });

  describe('logWarning', () => {
    it('should log warning message', () => {
      logWarning('Be careful');
      expect(warns.length).toBe(1);
      expect(warns[0]).toContain('⚠');
      expect(warns[0]).toContain('Be careful');
    });
  });

  describe('logInfo', () => {
    it('should log info message', () => {
      logInfo('FYI');
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('ℹ');
      expect(logs[0]).toContain('FYI');
    });
  });

  describe('logStep', () => {
    it('should log step with progress indicator', () => {
      logStep(1, 3, 'Processing');
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('[1/3]');
      expect(logs[0]).toContain('Processing');
    });
  });

  describe('logHeader', () => {
    it('should log header with underline', () => {
      logHeader('Section Title');
      expect(logs.length).toBe(3); // Empty line + title + underline
      expect(logs.some(l => l.includes('Section Title'))).toBe(true);
      expect(logs.some(l => l.includes('─'))).toBe(true);
    });
  });

  describe('logNewline', () => {
    it('should log empty line', () => {
      logNewline();
      expect(logs.length).toBe(1);
      expect(logs[0]).toBe('');
    });
  });

  describe('printNextSteps', () => {
    it('should print next steps header', () => {
      printNextSteps(['Run bf doctor']);
      expect(logs.some(l => l.includes('Next steps'))).toBe(true);
    });

    it('should print each step with arrow', () => {
      printNextSteps(['Step 1', 'Step 2', 'Step 3']);
      expect(logs.some(l => l.includes('→') && l.includes('Step 1'))).toBe(true);
      expect(logs.some(l => l.includes('→') && l.includes('Step 2'))).toBe(true);
      expect(logs.some(l => l.includes('→') && l.includes('Step 3'))).toBe(true);
    });

    it('should handle empty steps array', () => {
      printNextSteps([]);
      // Should not print header if no steps
      expect(logs.some(l => l.includes('Next steps'))).toBe(false);
    });
  });
});
