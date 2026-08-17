/**
 * src/shared/middleware/spa-fallback.middleware.ts
 *
 * Express middleware factory that lets the NestJS backend serve a single-page
 * app (the Vite-built React dashboard) by falling back to `index.html` for any
 * non-API, non-static-asset GET request.
 *
 * Use case:
 *   - `<backend-host>/`            → serves `web/dist/index.html`
 *   - `<backend-host>/questions`   → serves `web/dist/index.html` (React Router route)
 *   - `<backend-host>/assets/x.js` → handled by `useStaticAssets`, NOT this middleware
 *   - `<backend-host>/api/v1/...`  → skipped; controller handles
 *   - `<backend-host>/uploads/...` → skipped; handled by the uploads static asset middleware
 *
 * The middleware is intentionally a pure function (not @Injectable) because it
 * is registered via `app.use(...)` rather than NestJS's module-based middleware
 * chain. That keeps it easy to test in isolation — see the matching `.spec.ts`.
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { join } from 'path';
import { Logger } from '@nestjs/common';

export interface SpaFallbackOptions {
  /** Absolute path to the Vite build output directory (contains `index.html`). */
  webDistPath: string;

  /**
   * URL path prefixes that MUST NOT be intercepted by the SPA fallback.
   * Any GET request whose path equals one of these, or starts with
   * `<prefix>/`, is passed straight to the next handler.
   *
   * The backend's global API prefix (`api/v1`) and the uploads static asset
   * prefix (`uploads`) are the only critical ones in this codebase.
   */
  excludePrefixes: string[];

  /**
   * When `true` (default), add `Cache-Control: no-cache` headers so the
   * browser always revalidates `index.html`. This is required so freshly
   * shipped SPA builds actually get picked up — `index.html` is referenced
   * by hash-free name and embeds the new content-hashed asset URLs.
   */
  noCacheIndexHtml?: boolean;
}

/**
 * Returns a no-op middleware (always calls `next()`) if `index.html` is missing
 * from `webDistPath`. Useful when the backend is started without a built frontend
 * (e.g. mobile-only development, or the React app hasn't been built yet).
 */
export function spaFallback(options: SpaFallbackOptions): RequestHandler {
  const logger = new Logger('SpaFallback');
  const indexHtmlPath = join(options.webDistPath, 'index.html');
  const excludePrefixes = options.excludePrefixes;
  const noCacheIndexHtml = options.noCacheIndexHtml ?? true;

  const isExcluded = (urlPath: string): boolean =>
    excludePrefixes.some(
      (prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`),
    );

  // Treat any path with a file extension as a static asset request. Such
  // requests are normally served by `useStaticAssets`; if the file is missing
  // we want a 404 (default Express behaviour) rather than the SPA's
  // `index.html`, which would be confusing and could swallow real 404s.
  const hasFileExtension = (urlPath: string): boolean =>
    /\.[a-z0-9]{1,8}$/i.test(urlPath);

  logger.log(
    `SPA fallback active — index.html: ${indexHtmlPath} ` +
      `(excluded prefixes: ${excludePrefixes.join(', ')})`,
  );

  return function spaFallbackHandler(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    if (isExcluded(req.path)) {
      return next();
    }
    if (hasFileExtension(req.path)) {
      // Real static asset (already handled by useStaticAssets). Don't hijack.
      return next();
    }

    if (noCacheIndexHtml) {
      // `index.html` is referenced by hash-free name and embeds the new
      // content-hashed asset URLs after every build. We must always
      // revalidate so deployments actually roll out.
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    res.sendFile(indexHtmlPath, (err) => {
      if (err) {
        // Defer to the default error handler so the response is uniform
        // (404, 500, etc.) instead of an unhandled error.
        next(err);
      }
    });
  };
}
