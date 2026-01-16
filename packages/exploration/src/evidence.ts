// @browserflow/exploration - Evidence collection (screenshots and traces)

/**
 * Evidence metadata
 */
export interface EvidenceMetadata {
  timestamp: string;
  sessionId: string;
  stepIndex?: number;
  type: 'screenshot' | 'trace' | 'snapshot';
  path: string;
}

/**
 * Screenshot capture options
 */
export interface ScreenshotOptions {
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
  mask?: string[];
  quality?: number;
}

/**
 * Configuration for the evidence collector
 */
export interface EvidenceCollectorConfig {
  outputDir?: string;
  screenshotFormat?: 'png' | 'jpeg';
  screenshotQuality?: number;
}

/**
 * EvidenceCollector - Captures screenshots and traces during exploration
 *
 * Provides:
 * - Screenshot capture (full page, clipped, masked)
 * - Browser snapshot capture
 * - Trace/HAR file generation
 * - Evidence metadata tracking
 */
export class EvidenceCollector {
  private outputDir: string;
  private screenshotFormat: 'png' | 'jpeg';
  private screenshotQuality: number;
  private evidence: EvidenceMetadata[] = [];

  constructor(config: EvidenceCollectorConfig = {}) {
    this.outputDir = config.outputDir ?? './evidence';
    this.screenshotFormat = config.screenshotFormat ?? 'png';
    this.screenshotQuality = config.screenshotQuality ?? 90;
  }

  /**
   * Capture a screenshot from the browser session
   *
   * @param sessionId - Browser session ID
   * @param name - Screenshot name/identifier
   * @param options - Screenshot options
   * @returns Promise resolving to screenshot file path
   */
  async captureScreenshot(
    sessionId: string,
    name: string,
    options: ScreenshotOptions = {}
  ): Promise<string> {
    // TODO: Implement actual screenshot capture via agent-browser
    // This stub returns a valid path for compilation
    const filename = `${name}.${this.screenshotFormat}`;
    const path = `${this.outputDir}/screenshots/${filename}`;

    const metadata: EvidenceMetadata = {
      timestamp: new Date().toISOString(),
      sessionId,
      type: 'screenshot',
      path,
    };

    this.evidence.push(metadata);
    return path;
  }

  /**
   * Capture a browser snapshot (DOM state with element refs)
   *
   * @param sessionId - Browser session ID
   * @param name - Snapshot name/identifier
   * @returns Promise resolving to snapshot data
   */
  async captureSnapshot(
    sessionId: string,
    name: string
  ): Promise<Record<string, unknown>> {
    // TODO: Implement actual snapshot capture via agent-browser
    const path = `${this.outputDir}/snapshots/${name}.json`;

    const metadata: EvidenceMetadata = {
      timestamp: new Date().toISOString(),
      sessionId,
      type: 'snapshot',
      path,
    };

    this.evidence.push(metadata);
    return { elements: [], path };
  }

  /**
   * Start trace recording
   *
   * @param sessionId - Browser session ID
   * @param name - Trace name/identifier
   */
  async startTrace(sessionId: string, name: string): Promise<void> {
    // TODO: Implement trace recording via agent-browser
  }

  /**
   * Stop trace recording and save
   *
   * @param sessionId - Browser session ID
   * @returns Promise resolving to trace file path
   */
  async stopTrace(sessionId: string): Promise<string> {
    // TODO: Implement trace recording via agent-browser
    const path = `${this.outputDir}/traces/trace.zip`;

    const metadata: EvidenceMetadata = {
      timestamp: new Date().toISOString(),
      sessionId,
      type: 'trace',
      path,
    };

    this.evidence.push(metadata);
    return path;
  }

  /**
   * Get all collected evidence metadata
   */
  getEvidence(): EvidenceMetadata[] {
    return [...this.evidence];
  }

  /**
   * Clear collected evidence metadata
   */
  clearEvidence(): void {
    this.evidence = [];
  }

  /**
   * Get the output directory
   */
  getOutputDir(): string {
    return this.outputDir;
  }

  /**
   * Set the output directory
   */
  setOutputDir(dir: string): void {
    this.outputDir = dir;
  }
}
