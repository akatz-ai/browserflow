/**
 * bf review command - start review server for exploration approval
 * @see bf-kqu
 */

import { Command } from 'commander';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { colors } from '../ui/colors.js';

/**
 * Load exploration data from disk
 */
export async function loadExploration(id: string, cwd: string = process.cwd()): Promise<unknown> {
  const explorationPath = join(cwd, '.browserflow', 'explorations', id, 'exploration.json');

  try {
    const content = await readFile(explorationPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`Exploration not found: ${id}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in exploration file: ${err.message}`);
    }
    throw error;
  }
}

/**
 * Save review data to disk
 */
export async function saveReview(id: string, reviewData: unknown, cwd: string = process.cwd()): Promise<string> {
  const reviewPath = join(cwd, '.browserflow', 'explorations', id, 'review.json');
  await writeFile(reviewPath, JSON.stringify(reviewData, null, 2));
  return reviewPath;
}

/**
 * List all available explorations
 */
export async function listExplorations(cwd: string = process.cwd()): Promise<string[]> {
  const explorationsDir = join(cwd, '.browserflow', 'explorations');

  try {
    const entries = await readdir(explorationsDir);
    return entries.filter(e => e.startsWith('exp-'));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Serve static files from review-ui dist
 */
async function serveStaticUI(pathname: string): Promise<Response> {
  // For now, return a simple HTML page
  // In production, this would serve from packages/review-ui/dist
  if (pathname === '/' || pathname === '/index.html') {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>BrowserFlow Review</title>
  <meta charset="utf-8">
</head>
<body>
  <h1>BrowserFlow Review Server</h1>
  <p>Review UI will be served here.</p>
  <p>For now, use the API endpoints:</p>
  <ul>
    <li>GET /api/exploration?id=exp-123 - Load exploration data</li>
    <li>GET /api/exploration - List all explorations</li>
    <li>POST /api/reviews/:id - Submit review</li>
  </ul>
</body>
</html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Open browser to the review UI
 */
async function openBrowser(url: string): Promise<void> {
  const { spawn } = await import('node:child_process');

  // Try common browser commands
  const commands = process.platform === 'darwin'
    ? ['open']
    : process.platform === 'win32'
    ? ['start']
    : ['xdg-open', 'sensible-browser', 'firefox', 'chromium', 'google-chrome'];

  for (const cmd of commands) {
    try {
      spawn(cmd, [url], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      return;
    } catch {
      // Try next command
    }
  }

  console.log(colors.dim(`Could not auto-open browser. Visit: ${url}`));
}

export function reviewCommand(): Command {
  return new Command('review')
    .description('Start review server for exploration approval')
    .option('--exploration <id>', 'Specific exploration ID to review')
    .option('--port <port>', 'Server port', '8190')
    .option('--no-open', "Don't auto-open browser")
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const cwd = process.cwd();

      try {
        const server = Bun.serve({
          port,
          async fetch(req) {
            const url = new URL(req.url);

            // Serve exploration data
            if (url.pathname === '/api/exploration') {
              const id = url.searchParams.get('id') || options.exploration;

              if (!id) {
                // List available explorations
                const explorations = await listExplorations(cwd);
                return Response.json({ explorations });
              }

              try {
                const data = await loadExploration(id, cwd);
                return Response.json(data);
              } catch (error) {
                const err = error as Error;
                return Response.json(
                  { error: err.message },
                  { status: 404 }
                );
              }
            }

            // Handle review submission (POST /api/reviews/:id)
            if (url.pathname.startsWith('/api/reviews/') && req.method === 'POST') {
              const id = url.pathname.split('/').pop()!;

              try {
                const reviewData = await req.json();
                const reviewPath = await saveReview(id, reviewData, cwd);

                return Response.json(
                  { success: true },
                  {
                    headers: {
                      'X-Review-Path': reviewPath
                    }
                  }
                );
              } catch (error) {
                const err = error as Error;
                return Response.json(
                  { error: err.message },
                  { status: 500 }
                );
              }
            }

            // Serve static review UI
            return serveStaticUI(url.pathname);
          },
        });

        console.log(colors.info(`Review server: http://localhost:${port}`));

        if (options.open !== false) {
          const explorationParam = options.exploration ? `?id=${options.exploration}` : '';
          await openBrowser(`http://localhost:${port}${explorationParam}`);
        }

        console.log(colors.dim('Press Ctrl+C to stop'));

        // Keep process alive
        await new Promise(() => {});
      } catch (error) {
        const err = error as Error;
        console.error(colors.fail(err.message));
        process.exitCode = 1;
      }
    });
}
