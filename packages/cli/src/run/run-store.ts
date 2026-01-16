import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const BROWSERFLOW_DIR = '.browserflow';
const RUNS_DIR = 'runs';

export class RunStore {
  private baseDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.baseDir = path.join(projectRoot, BROWSERFLOW_DIR, RUNS_DIR);
  }

  async createRun(category: string = '_execution'): Promise<string> {
    const timestamp = Date.now();
    const runId = `run-${timestamp}`;
    const runDir = path.join(this.baseDir, category, runId);

    await fs.mkdir(runDir, { recursive: true });
    await fs.mkdir(path.join(runDir, 'artifacts'), { recursive: true });

    return runDir;
  }

  async listRuns(category: string = '_execution'): Promise<string[]> {
    const categoryDir = path.join(this.baseDir, category);
    try {
      const entries = await fs.readdir(categoryDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && e.name.startsWith('run-'))
        .map(e => e.name)
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  async getLatestRun(category: string = '_execution'): Promise<string | null> {
    const runs = await this.listRuns(category);
    if (runs.length === 0) return null;
    return path.join(this.baseDir, category, runs[0]);
  }

  getRunsDir(): string {
    return this.baseDir;
  }
}
