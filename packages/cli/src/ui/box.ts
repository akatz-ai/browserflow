import { colors } from './colors.js';

export interface BoxOptions {
  /** Width of the box content area (default: 58) */
  width?: number;
}

/**
 * Format content into a box with title and return as string
 */
export function formatBox(title: string, content: string[], options: BoxOptions = {}): string {
  const width = options.width ?? 58;
  const lines: string[] = [];

  // Top border with title
  // Account for ANSI escape codes in padEnd calculation
  const styledTitle = colors.bold(title);
  const ansiOverhead = styledTitle.length - title.length;
  lines.push('┌' + '─'.repeat(width) + '┐');
  lines.push('│ ' + styledTitle.padEnd(width - 1 + ansiOverhead) + '│');

  if (content.length > 0) {
    lines.push('├' + '─'.repeat(width) + '┤');
    for (const line of content) {
      // Handle lines that might be longer than width
      const truncated = line.length > width - 2 ? line.slice(0, width - 5) + '...' : line;
      lines.push('│ ' + truncated.padEnd(width - 1) + '│');
    }
  }

  // Bottom border
  lines.push('└' + '─'.repeat(width) + '┘');

  return lines.join('\n');
}

/**
 * Print a formatted box to the console
 */
export function printBox(title: string, content: string[], options: BoxOptions = {}): void {
  console.log(formatBox(title, content, options));
}
