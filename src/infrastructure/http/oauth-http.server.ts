/**
 * Minimal HTTP server for OAuth callback + health check.
 *
 * No Express — Node http only. Telegram bot process owns this server.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { EnvConfig } from '../../config/env.config.js';
import type { CompleteOAuthUseCase } from '../../application/use-cases/accounts/complete-oauth.use-case.js';
import { isAppError } from '../../shared/errors.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('OAuthHttpServer');

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now >= record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  record.count += 1;
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

export class OAuthHttpServer {
  private server: Server | null = null;

  constructor(
    private readonly config: EnvConfig,
    private readonly completeOAuth: CompleteOAuthUseCase,
  ) {}

  /** Start listening on HTTP_HOST:HTTP_PORT */
  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(this.config.HTTP_PORT, this.config.HTTP_HOST, () => {
        log.info(
          { host: this.config.HTTP_HOST, port: this.config.HTTP_PORT },
          'OAuth HTTP server listening',
        );
        resolve();
      });
      this.server?.once('error', reject);
    });
  }

  /** Stop the HTTP server */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    log.info('OAuth HTTP server stopped');
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const ip = req.socket.remoteAddress ?? 'unknown';

      if (isRateLimited(ip)) {
        this.sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
        return;
      }

      const host = req.headers.host ?? `localhost:${this.config.HTTP_PORT}`;
      const url = new URL(req.url ?? '/', `http://${host}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        this.sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/auth/twitter/callback') {
        await this.handleOAuthCallback(url, res);
        return;
      }

      this.sendHtml(res, 404, '<h1>Not Found</h1>');
    } catch (error) {
      log.error({ err: error }, 'Unhandled HTTP error');
      this.sendHtml(res, 500, '<h1>Internal Server Error</h1>');
    }
  }

  private async handleOAuthCallback(url: URL, res: ServerResponse): Promise<void> {
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      const description = url.searchParams.get('error_description') ?? error;
      this.sendHtml(
        res,
        400,
        `<h1>Authorization denied</h1><p>${escapeHtml(description)}</p><p>You can close this window and return to Telegram.</p>`,
      );
      return;
    }

    if (!state || !code) {
      this.sendHtml(
        res,
        400,
        '<h1>Invalid callback</h1><p>Missing state or code. Please restart linking from Telegram.</p>',
      );
      return;
    }

    try {
      const result = await this.completeOAuth.execute({ state, code });

      const verb = result.isReconnect ? 'reconnected' : 'connected';
      this.sendHtml(
        res,
        200,
        `<h1>Success</h1><p>X account <strong>@${escapeHtml(result.account.twitterUsername)}</strong> ${verb}.</p><p>You can close this window and return to Telegram.</p>`,
      );
    } catch (err) {
      log.error({ err }, 'OAuth callback failed');

      if (isAppError(err)) {
        this.sendHtml(
          res,
          err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 400,
          `<h1>Connection failed</h1><p>${escapeHtml(err.message)}</p><p>Return to Telegram and try again.</p>`,
        );
        return;
      }

      this.sendHtml(
        res,
        500,
        '<h1>Connection failed</h1><p>Unexpected error. Return to Telegram and try again.</p>',
      );
    }
  }

  private sendJson(res: ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  private sendHtml(res: ServerResponse, status: number, body: string): void {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>X Moderator</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;line-height:1.5;color:#111}</style></head><body>${body}</body></html>`;
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
    });
    res.end(html);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
