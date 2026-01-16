/**
 * Environment detection utilities for CLI output
 * Handles CI detection, TTY checks, and color support
 */

// Cache values since they don't change during execution
let cachedIsCI: boolean | undefined;
let cachedIsTTY: boolean | undefined;
let cachedSupportsColor: boolean | undefined;

/**
 * Detect if running in a CI environment
 */
export function isCI(): boolean {
  if (cachedIsCI !== undefined) return cachedIsCI;

  cachedIsCI = Boolean(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.BUILDKITE ||
    process.env.TF_BUILD // Azure Pipelines
  );

  return cachedIsCI;
}

/**
 * Check if stdout is a TTY (interactive terminal)
 */
export function isTTY(): boolean {
  if (cachedIsTTY !== undefined) return cachedIsTTY;
  cachedIsTTY = Boolean(process.stdout.isTTY);
  return cachedIsTTY;
}

/**
 * Check if the terminal supports colors
 * Respects NO_COLOR and FORCE_COLOR environment variables
 */
export function supportsColor(): boolean {
  if (cachedSupportsColor !== undefined) return cachedSupportsColor;

  // NO_COLOR takes precedence (https://no-color.org/)
  if (process.env.NO_COLOR) {
    cachedSupportsColor = false;
    return false;
  }

  // FORCE_COLOR overrides TTY check
  if (process.env.FORCE_COLOR) {
    cachedSupportsColor = true;
    return true;
  }

  // Default to TTY status
  cachedSupportsColor = isTTY();
  return cachedSupportsColor;
}

/**
 * Reset cached values (for testing)
 */
export function resetEnvCache(): void {
  cachedIsCI = undefined;
  cachedIsTTY = undefined;
  cachedSupportsColor = undefined;
}

/**
 * Check if spinners should be used
 * Spinners don't work well in CI or non-TTY environments
 */
export function shouldUseSpinners(): boolean {
  return isTTY() && !isCI();
}

/**
 * Check if interactive prompts can be used
 */
export function isInteractive(): boolean {
  return isTTY() && !isCI() && Boolean(process.stdin.isTTY);
}
