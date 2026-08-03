/**
 * Routes VM server (tailnet-bound) HTTP traffic through the local SOCKS/HTTP proxy.
 *
 * The AI, GDB, Gemma, and Embed servers all live at 100.100.108.44 on the tailnet.
 * Because this app may run outside the tailnet (e.g. on Cloud Run), direct routes to
 * 100.x addresses are not possible — all tailnet-bound traffic must go through the
 * proxy that Tailscale exposes locally.
 *
 * How it works:
 * - axios: a request interceptor attaches SocksProxyAgent to all tailnet-bound
 *   requests.  `proxy: false` prevents axios from also applying any HTTP_PROXY
 *   env var on top.
 * - globalThis.fetch: Node's native fetch ignores http agents entirely. We replace
 *   globalThis.fetch with undici's, which accepts a per-request dispatcher, so
 *   tailnet-bound calls go through the HTTP CONNECT proxy.
 *
 * Both proxies are configurable via env vars:
 *   VM_PROXY_SOCKS_URL   — SOCKS5 proxy URL (default: socks5h://localhost:1055)
 *                          socks5h:// means DNS resolution happens at the proxy
 *                          (required for MagicDNS names like *.ts.net to work).
 *   VM_PROXY_HTTP_URL    — HTTP CONNECT proxy URL (default: http://localhost:1055)
 *   USE_VM_PROXY         — set to 'false' to disable entirely (e.g. direct dev)
 *
 * Only tailnet hosts (100.64.0.0/10 or *.ts.net) are diverted.
 * Everything else (Mongo Atlas, Firebase, Plivo, external APIs) keeps its direct route.
 */
import axios from 'axios';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

// ─── Proxy configuration (read once at startup) ────────────────────────────────

const VM_PROXY_SOCKS_URL = process.env.VM_PROXY_SOCKS_URL || 'socks5h://localhost:1055';
const VM_PROXY_HTTP_URL = process.env.VM_PROXY_HTTP_URL || 'http://localhost:1056';
const USE_VM_PROXY = process.env.USE_VM_PROXY !== 'false';

// ─── Tailnet host detection ────────────────────────────────────────────────────

/**
 * Returns true for hostnames that live on the Tailscale CGNAT tailnet.
 * The tailnet uses 100.64.0.0/10 — second octet runs 64–127.
 * Also matches MagicDNS names (*.ts.net).
 */
export const isTailnetHost = (hostname: string): boolean => {
  if (hostname.endsWith('.ts.net')) return true;

  const m = /^100\.(\d+)\./.exec(hostname);
  if (!m) return false;

  const second = Number(m[1]);
  return second >= 64 && second <= 127;
};

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

/**
 * Returns a SOCKS agent for the given URL if it points to a tailnet host,
 * otherwise undefined. Used by http-proxy-middleware (faq/pop proxies) which
 * sits outside the axios/global-fetch patching layer.
 */
export function tailnetAgentFor(targetUrl: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SocksProxyAgent } = require('socks-proxy-agent') as {
    SocksProxyAgent: new (url: string) => unknown;
  };
  if (!USE_VM_PROXY) return undefined;
  if (!isTailnetHost(hostnameOf(targetUrl))) return undefined;
  return new SocksProxyAgent(VM_PROXY_SOCKS_URL);
}

/**
 * Installs the global proxy patches:
 *   1. axios request interceptor → attaches SocksProxyAgent for tailnet URLs
 *   2. globalThis.fetch replacement → routes tailnet calls through undici + HTTP proxy
 *
 * Call this once at app startup, before any AI/GDB/Embedding service makes a request.
 */

export function installVmProxy(): void {
  if (!USE_VM_PROXY) {
    console.log('[VmProxy] USE_VM_PROXY=false — proxy disabled, direct connections');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SocksProxyAgent } = require('socks-proxy-agent') as {
    SocksProxyAgent: new (url: string) => unknown;
  };

  // ── axios (GemmaService) ────────────────────────────────────────────────────
  // A per-request interceptor is cleaner than a global default: non-tailnet
  // calls are completely unaffected.
  const socksAgent = new SocksProxyAgent(VM_PROXY_SOCKS_URL);

  axios.interceptors.request.use((config) => {
    const url = config.baseURL
      ? new URL(config.url ?? '', config.baseURL).toString()
      : (config.url ?? '');

    if (isTailnetHost(hostnameOf(url))) {
      config.httpAgent = socksAgent;
      config.httpsAgent = socksAgent;
      config.proxy = false; // prevent axios from honouring HTTP_PROXY env var too
    }
    return config;
  });

  // ── globalThis.fetch (GdbService, EmbedService) ─────────────────────────────
  // Node's built-in fetch has no agent option and ignores http(s)_agent.
  // Global undici dispatcher does not affect native fetch either.
  // Replace native fetch with undici's, which accepts `dispatcher`.
  const proxyAgent = new ProxyAgent(VM_PROXY_HTTP_URL);
  const nativeFetch = globalThis.fetch;

  globalThis.fetch = ((input: any, init?: any) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input?.url ?? '');

    if (!isTailnetHost(hostnameOf(url))) return nativeFetch(input, init);

    return undiciFetch(url, { ...init, dispatcher: proxyAgent });
  }) as typeof globalThis.fetch;

  console.log(
    `[VmProxy] installed — socks: ${VM_PROXY_SOCKS_URL}, http: ${VM_PROXY_HTTP_URL}`,
  );
}