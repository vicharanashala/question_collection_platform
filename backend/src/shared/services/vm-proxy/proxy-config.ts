/**
 * parseProxyUrl(raw: string): URL | null
 *
 * Parses a `process.env.PROXY` URL string using the native Node.js URL constructor.
 * Returns null when PROXY is unset or empty.
 *
 * Usage:
 *   const parsed = parseProxyUrl(process.env.PROXY ?? '');
 *   if (!parsed) return null;
 */
export function parseProxyUrl(raw: string): URL | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/**
 * buildAxiosProxyConfig(parsed: URL): AxiosProxyConfig
 *
 * Builds a standard axios `proxy` configuration object from a parsed proxy URL.
 * The `protocol` field has its trailing colon stripped.
 *
 * Usage:
 *   const parsed = parseProxyUrl(proxyEnv);
 *   if (parsed) {
 *     const proxyConfig = buildAxiosProxyConfig(parsed);
 *     const agent = new HttpsProxyAgent(parsed.href);
 *     // use both with axios or fetch
 *   }
 */
export interface AxiosProxyConfig {
  protocol: string;
  host: string;
  port: number;
  auth?: { username: string; password: string };
}

export function buildAxiosProxyConfig(parsed: URL): AxiosProxyConfig {
  const protocol = parsed.protocol.replace(/:$/, '');
  const port = parsed.port
    ? Number(parsed.port)
    : protocol === 'https'
      ? 443
      : 80;

  const config: AxiosProxyConfig = { protocol, host: parsed.hostname, port };

  if (parsed.username || parsed.password) {
    config.auth = {
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  }

  return config;
}

/**
 * buildProxyAgent(parsed: URL): HttpsProxyAgent
 *
 * Returns an https-proxy-agent bound to the proxy URL.
 * Uses https-proxy-agent (already a transitive dep via axios/gaxios).
 * The agent type is deliberately returned as `unknown` to avoid a direct
 * type-dep on https-proxy-agent's internal exports; callers pass it to
 * fetch()'s `agent` option or axios's `httpAgent`/`httpsAgent` options.
 */
export function buildProxyAgent(parsed: URL): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { HttpsProxyAgent } = require('https-proxy-agent') as {
    HttpsProxyAgent: new (url: string) => unknown;
  };
  return new HttpsProxyAgent(parsed.href);
}