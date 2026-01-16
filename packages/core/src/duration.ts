/**
 * Duration string parser
 *
 * Parses human-readable duration strings like "30s", "5m", "1h30m"
 * into milliseconds.
 *
 * @see bf-x1q for implementation task
 */

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
 * @param duration - Duration string to parse
 * @returns Duration in milliseconds
 * @throws Error if format is invalid
 */
export function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const trimmed = duration.trim().toLowerCase();

  // Plain number (milliseconds)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  let total = 0;
  const regex = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let match;
  let matched = false;

  while ((match = regex.exec(trimmed)) !== null) {
    matched = true;
    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'ms':
        total += value;
        break;
      case 's':
        total += value * 1000;
        break;
      case 'm':
        total += value * 60 * 1000;
        break;
      case 'h':
        total += value * 60 * 60 * 1000;
        break;
    }
  }

  if (!matched) {
    throw new Error(`Invalid duration format: "${duration}"`);
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
