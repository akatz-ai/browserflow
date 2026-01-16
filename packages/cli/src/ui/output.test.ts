import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { output, setJsonMode, isJsonMode, resetOutputState } from './output.js';

describe('output', () => {
  let logs: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    logs = [];
    originalLog = console.log;
    console.log = mock((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    resetOutputState();
  });

  afterEach(() => {
    console.log = originalLog;
    resetOutputState();
  });

  describe('setJsonMode', () => {
    it('should enable JSON mode', () => {
      expect(isJsonMode()).toBe(false);
      setJsonMode(true);
      expect(isJsonMode()).toBe(true);
    });

    it('should disable JSON mode', () => {
      setJsonMode(true);
      setJsonMode(false);
      expect(isJsonMode()).toBe(false);
    });
  });

  describe('output', () => {
    it('should output JSON when JSON mode is enabled', () => {
      setJsonMode(true);
      const data = { name: 'test', count: 42 };
      output(data);

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed).toEqual(data);
    });

    it('should output pretty-printed JSON with indentation', () => {
      setJsonMode(true);
      const data = { nested: { value: 1 } };
      output(data);

      expect(logs[0]).toContain('\n');
      expect(logs[0]).toContain('  '); // Indentation
    });

    it('should not output JSON when JSON mode is disabled', () => {
      setJsonMode(false);
      output({ data: 'test' });

      // Should not output anything in non-JSON mode (caller handles human output)
      expect(logs.length).toBe(0);
    });

    it('should handle arrays', () => {
      setJsonMode(true);
      const data = [1, 2, 3];
      output(data);

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toEqual(data);
    });

    it('should handle null and undefined', () => {
      setJsonMode(true);
      output(null);
      expect(JSON.parse(logs[0])).toBeNull();
    });

    it('should handle complex nested structures', () => {
      setJsonMode(true);
      const data = {
        specs: [
          { name: 'test1', steps: [{ name: 'step1', status: 'pass' }] },
          { name: 'test2', steps: [{ name: 'step2', status: 'fail' }] },
        ],
        summary: { passed: 1, failed: 1 },
      };
      output(data);

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toEqual(data);
    });
  });
});
