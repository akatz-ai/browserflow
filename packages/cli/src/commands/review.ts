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
 * Get MIME type based on file extension
 */
function getMimeType(pathname: string): string {
  const ext = pathname.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Serve static files from review-ui dist
 * @internal Exported for testing
 */
export async function serveStaticUI(pathname: string, cwd: string = process.cwd()): Promise<Response> {
  const distDir = join(cwd, 'packages', 'review-ui', 'dist');

  try {
    // Serve index.html for root path
    if (pathname === '/' || pathname === '/index.html') {
      const indexPath = join(distDir, 'index.html');
      const content = await readFile(indexPath, 'utf-8');
      return new Response(content, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Try to serve static file from dist
    // Remove leading slash from pathname
    const filePath = join(distDir, pathname.slice(1));

    // Check if file exists and is within distDir (prevent directory traversal)
    if (!filePath.startsWith(distDir)) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const content = await readFile(filePath);
      const mimeType = getMimeType(pathname);

      return new Response(content, {
        headers: { 'Content-Type': mimeType },
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      // If file not found and it's not an /assets/ request, fallback to index.html for SPA routing
      if (err.code === 'ENOENT' && !pathname.startsWith('/assets/')) {
        const indexPath = join(distDir, 'index.html');
        const content = await readFile(indexPath, 'utf-8');
        return new Response(content, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Return 404 for non-existent files in /assets/
      return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    // If dist directory doesn't exist, return error
    return new Response('Review UI not built. Run: cd packages/review-ui && bun run build', {
      status: 500
    });
  }
}

/**
 * Open browser to the review UI
 */
async function openBrowser(url: string): Promise<void> {
  const { spawn } = await import('node:child_process');

  // Use platform-appropriate command to open browser
  const cmd = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
    ? 'cmd'
    : 'xdg-open';

  const args = process.platform === 'win32'
    ? ['/c', 'start', url]
    : [url];

  try {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore'
    });

    child.on('error', () => {
      console.log(colors.dim(`Could not auto-open browser. Visit: ${url}`));
    });

    child.unref();
  } catch {
    console.log(colors.dim(`Could not auto-open browser. Visit: ${url}`));
  }
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
              const id = url.pathname.split('/').pop() || '';

              if (!id) {
                return Response.json(
                  { error: 'Exploration ID is required' },
                  { status: 400 }
                );
              }

              try {
                const contentType = req.headers.get('content-type') || '';
                let reviewData: unknown;
                const screenshotBlobs: Map<string, Blob> = new Map();

                if (contentType.includes('multipart/form-data')) {
                  // Parse multipart form data
                  const formData = await req.formData();

                  // Extract review JSON - can be string or File/Blob
                  const reviewDataField = formData.get('review_data');
                  let reviewDataStr: string;

                  if (typeof reviewDataField === 'string') {
                    reviewDataStr = reviewDataField;
                  } else if (reviewDataField instanceof Blob) {
                    // Handle case where it's sent as a file
                    reviewDataStr = await reviewDataField.text();
                  } else {
                    throw new Error('Missing review_data in form submission');
                  }

                  try {
                    reviewData = JSON.parse(reviewDataStr);
                  } catch (parseErr) {
                    throw new Error(`Failed to parse review_data JSON: ${(parseErr as Error).message}`);
                  }

                  // Extract screenshot blobs (step-N-review files)
                  for (const [key, value] of formData.entries()) {
                    if (key.startsWith('step-') && key.endsWith('-review') && value instanceof Blob) {
                      screenshotBlobs.set(key, value);
                    }
                  }
                } else {
                  // Backwards compatibility: plain JSON
                  reviewData = await req.json();
                }

                // Save review.json
                const reviewPath = await saveReview(id, reviewData, cwd);

                // Save annotated screenshots if any
                if (screenshotBlobs.size > 0) {
                  const screenshotsDir = join(cwd, '.browserflow', 'explorations', id, 'screenshots');

                  for (const [key, blob] of screenshotBlobs) {
                    // Extract step index from key (e.g., "step-2-review" -> "02")
                    const match = key.match(/^step-(\d+)-review$/);
                    if (match) {
                      const stepIndex = match[1];
                      const paddedIndex = stepIndex.padStart(2, '0');
                      const filename = `step-${paddedIndex}-review.png`;
                      const buffer = Buffer.from(await blob.arrayBuffer());
                      await writeFile(join(screenshotsDir, filename), buffer);
                    }
                  }
                }

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

            // Serve screenshots from explorations
            if (url.pathname.startsWith('/api/screenshots/')) {
              // Path format: /api/screenshots/{exp-id}/{filename}
              const pathParts = url.pathname.split('/').filter(Boolean);

              if (pathParts.length >= 4) {
                const expId = pathParts[2];
                const filename = pathParts.slice(3).join('/');

                // Prevent directory traversal
                if (filename.includes('..') || expId.includes('..')) {
                  return new Response('Forbidden', { status: 403 });
                }

                const screenshotPath = join(
                  cwd,
                  '.browserflow',
                  'explorations',
                  expId,
                  'screenshots',
                  filename
                );

                // Ensure path is within the expected directory
                const expectedBase = join(cwd, '.browserflow', 'explorations', expId, 'screenshots');
                if (!screenshotPath.startsWith(expectedBase)) {
                  return new Response('Forbidden', { status: 403 });
                }

                try {
                  const content = await readFile(screenshotPath);
                  const mimeType = getMimeType(filename);

                  return new Response(content, {
                    headers: { 'Content-Type': mimeType },
                  });
                } catch (error) {
                  const err = error as NodeJS.ErrnoException;
                  if (err.code === 'ENOENT') {
                    return new Response('Screenshot not found', { status: 404 });
                  }
                  throw error;
                }
              }

              return new Response('Invalid screenshot path', { status: 400 });
            }

            // Serve static review UI
            return serveStaticUI(url.pathname, cwd);
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
