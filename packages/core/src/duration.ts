/**
 * Duration string parser
 *
 * Parses human-readable duration strings like "30s", "5m", "1h30m"
 * into milliseconds.
 *
 * @see bf-x1q for implementation task
 */

const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
};

/**
 * Validates a duration string without parsing it.
 *
 * @param input - Duration string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDuration(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return false;
  }

  // Plain number (milliseconds)
  if (/^\d+$/.test(trimmed)) {
    return true;
  }

  // Duration with units
  const regex = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let hasMatch = false;

  // Check if entire string matches expected pattern
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    if (match.index !== lastIndex) {
      return false; // Gap in matching
    }
    hasMatch = true;
    lastIndex = regex.lastIndex;
  }

  return hasMatch && lastIndex === trimmed.length;
}

/**
 * Parses a duration string into milliseconds.
 *
 * Supported formats:
 * - "30s" -> 30000
 * - "5m" -> 300000
 * - "1h" -> 3600000
 * - "1h30m" -> 5400000
 * - "500ms" -> 500
 * - "500" -> 500 (plain numbers treated as ms)
 *
 * @param input - Duration string to parse
 * @returns Duration in milliseconds
 * @throws Error if format is invalid
 */
export function parseDuration(input: string | number): number {
  if (typeof input === 'number') {
    return input;
  }

  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('Duration must be a non-empty string');
  }

  const trimmed = input.trim().toLowerCase();

  // Plain number (milliseconds)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  let total = 0;
  const regex = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let match;
  let hasMatch = false;

  while ((match = regex.exec(trimmed)) !== null) {
    hasMatch = true;
    const [, value, unit] = match;
    total += parseFloat(value) * UNITS[unit];
  }

  if (!hasMatch) {
    throw new Error(
      `Invalid duration "${input}". Use format like "3s", "2m", "500ms", or "1m30s"`
    );
  }

  return Math.round(total);
}

/**
 * Formats milliseconds into a human-readable duration string.
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join('') || '0s';
}
