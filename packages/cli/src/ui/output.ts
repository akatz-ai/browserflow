/**
 * Global JSON mode state
 */
let jsonMode = false;

/**
 * Enable or disable JSON output mode
 */
export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

/**
 * Check if JSON mode is currently enabled
 */
export function isJsonMode(): boolean {
  return jsonMode;
}

/**
 * Output data - in JSON mode outputs as formatted JSON,
 * in normal mode does nothing (caller should handle human output)
 */
export function output(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  }
  // In non-JSON mode, caller handles human-friendly output
}

/**
 * Reset output state (for testing)
 */
export function resetOutputState(): void {
  jsonMode = false;
}
