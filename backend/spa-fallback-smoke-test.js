/**
 * spa-fallback-smoke-test.js
 *
 * End-to-end integration smoke test that exercises the real SPA fallback
 * middleware + useStaticAssets stack against a live HTTP server. NOT part of
 * the production build — this is a developer-facing diagnostic that lives at
 * the backend root and is run with `node spa-fallback-smoke-test.js`.
 *
 * Why a separate script rather than a Jest test?
 *  - Jest already covers the middleware's pure logic.
 *  - This script proves the full Express pipeline (useStaticAssets + spaFallback
 *    + middleware ordering) works against the *actual* web/dist bundle.
 *  - Useful for debugging new deployments without bringing up the whole
 *    NestJS app (MongoDB, Redis, AI VM, etc.).
 *
 * Exit code 0 = all assertions passed; non-zero = at least one failed.
 */
const http = require('http');
const path = require('path');
const express = require('express');
const serveStatic = require('serve-static');
const { spaFallback } = require('./dist/shared/middleware/spa-fallback.middleware');

const WEB_DIST = path.resolve(__dirname, '../web/dist');
const PORT = 4321;

const distExists = require('fs').existsSync(path.join(WEB_DIST, 'index.html'));
if (!distExists) {
  console.error(`✗ web/dist not found at ${WEB_DIST}. Run: pnpm --filter web build`);
  process.exit(1);
}

const app = express();

// 1) Static assets from web/dist (Vite output). The `maxAge`/`setHeaders`
//    combo here MUST mirror `backend/src/main.ts` exactly so this test
//    proves the real production pipeline, not a synthetic one.
app.use(serveStatic(WEB_DIST, {
  index: false,
  maxAge: 365 * 24 * 60 * 60 * 1000,
  setHeaders: (res, filePath) => {
    const rel = path.relative(WEB_DIST, filePath).split(path.sep).join('/');
    const isHashedAsset = rel.startsWith('assets/');
    if (!isHashedAsset) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

// 2) SPA fallback for client-side routes
app.use(spaFallback({
  webDistPath: WEB_DIST,
  excludePrefixes: ['/api/v1', '/uploads', '/reference'],
}));

// 3) Mock API endpoint (in real life, this would be the NestJS controller)
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

const server = app.listen(PORT, async () => {
  console.log(`Smoke test server listening on http://localhost:${PORT}`);
  console.log(`Serving web/dist from ${WEB_DIST}\n`);

  const results = [];
  const record = (label, ok, details) => {
    const sym = ok ? '✓' : '✗';
    console.log(`  ${sym} ${label} ${details || ''}`);
    results.push({ label, ok });
  };

  // --- Roots --------------------------------------------------------------
  console.log('--- Root & SPA routes ---');
  results.push(await httpGet('/', 200, 'text/html', (ok, headers, body) => {
    record('GET /            → 200 text/html', ok && /\<html/i.test(body), `(Cache-Control: ${headers['cache-control']})`);
  }));

  results.push(await httpGet('/questions/42', 200, 'text/html', (ok, headers, body) => {
    record('GET /questions/42 → 200 text/html (SPA deep-link)', ok && /\<html/i.test(body));
  }));

  results.push(await httpGet('/admin/users', 200, 'text/html', (ok, headers, body) => {
    record('GET /admin/users → 200 text/html (SPA deep-link)', ok && /\<html/i.test(body));
  }));

  // --- Static assets ------------------------------------------------------
  console.log('\n--- Static assets (Vite-bundled) ---');

  // `/index.html` is the root-level static served by `useStaticAssets` (not
  // the SPA fallback). It must return 200 with `no-cache` so the browser
  // always picks up new bundles that Vite's `<script>` tags reference.
  results.push(await httpGet('/index.html', 200, 'text/html', (ok, headers, body) => {
    record('GET /index.html   → 200 text/html served by useStaticAssets', ok && /\<html/i.test(body), `(Cache-Control: ${headers['cache-control']})`);
    const cc = String(headers['cache-control'] || '');
    if (!cc.includes('no-cache')) results.push({ label: 'no-cache header on index.html', ok: false });
  }));

  // Hashed JS asset — auto-discover first `index-*.js` so the test stays
  // in sync with whatever Vite produces today. Vite serves `.js` with
  // `text/javascript` (the modern, RFC-9239-aligned MIME type) rather than
  // the legacy `application/javascript`, so we accept either.
  const fs = require('fs');
  const assetDir = path.join(WEB_DIST, 'assets');
  const hashedAsset = fs.readdirSync(assetDir).find((f) => f.endsWith('.js') && f.includes('index'));
  if (hashedAsset) {
    results.push(await httpGet('/assets/' + hashedAsset, 200, /^text\/javascript/, (ok, headers) => {
      record(`GET /assets/${hashedAsset} → 200 js w/ immutable cache`, ok, `(Cache-Control: ${headers['cache-control']})`);
      const cc = String(headers['cache-control'] || '');
      const immutable = cc.includes('max-age=31536000');
      if (!immutable) results.push({ label: '1y max-age on hashed asset', ok: false });
    }));
  } else {
    results.push({ label: 'no hashed asset found in web/dist/assets', ok: false });
  }

  // A hashed CSS asset — proves the `assets/*` rule is prefix-based, not
  // just for `.js` files.
  const hashedCss = fs.readdirSync(assetDir).find((f) => f.endsWith('.css'));
  if (hashedCss) {
    results.push(await httpGet('/assets/' + hashedCss, 200, 'text/css', (ok, headers) => {
      record(`GET /assets/${hashedCss} → 200 css`, ok, `(Cache-Control: ${headers['cache-control']})`);
    }));
  }

  // --- Excluded paths -----------------------------------------------------
  // `id="root"` is the React mount point in our `web/index.html`. If it
  // appears in the response body, the SPA fallback hijacked a request that
  // should have been served by a controller or returned as a plain 404.
  const SPA_MARKER = 'id="root"';

  console.log('\n--- Excluded paths (must hit API / 404, not index.html) ---');
  results.push(await httpGet('/api/v1/health', 200, 'application/json', (ok, headers, body) => {
    record('GET /api/v1/health → 200 JSON (controller response)', ok && body.includes('"status"'));
  }));

  results.push(await httpGet('/uploads/foo.mp3', 404, null, (ok, headers, body) => {
    record('GET /uploads/foo.mp3 → 404 (not hijacked by SPA fallback)', ok && !body.includes(SPA_MARKER));
  }));

  // --- Missing assets with extension (should be 404, NOT index.html) ----
  console.log('\n--- Missing assets with file extension (must be 404, not SPA fallback) ---');
  results.push(await httpGet('/missing.png', 404, null, (ok, headers, body) => {
    record('GET /missing.png  → 404 (not hijacked by SPA fallback)', ok && !body.includes(SPA_MARKER));
  }));

  // --- Summary ------------------------------------------------------------
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} assertions passed`);
  server.close();
  process.exit(failed === 0 ? 0 : 1);
});

function httpGet(urlPath, expectedStatus, expectedContentType, bodyCallback, altCallback) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: PORT, path: urlPath }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const ctype = res.headers['content-type'] || '';
        // `expectedContentType` can be:
        //   - null/undefined (skip the check)
        //   - a plain string (must `startsWith` — e.g. "text/html")
        //   - a RegExp (must match)
        let ctypeOk = true;
        if (expectedContentType instanceof RegExp) {
          ctypeOk = expectedContentType.test(ctype);
        } else if (typeof expectedContentType === 'string') {
          ctypeOk = ctype.startsWith(expectedContentType);
        }
        const ok = res.statusCode === expectedStatus && ctypeOk;
        const cb = altCallback || bodyCallback;
        const result = { label: urlPath, ok };
        if (cb) cb(ok, res.headers, body);
        resolve(result);
      });
    }).on('error', (err) => {
      console.log(`  ✗ ${urlPath}        → error: ${err.message}`);
      resolve({ label: urlPath, ok: false });
    });
  });
}
