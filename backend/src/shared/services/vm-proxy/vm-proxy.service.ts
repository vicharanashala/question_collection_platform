/**
 * VmProxyService
 *
 * Centralises all proxy-aware request logic for VM_SERVER_URL traffic.
 * Callers (GemmaService, GdbService, EmbedService) inject this service and
 * use the helpers below to inject the correct axios `proxy` config and/or
 * https-proxy-agent into their outbound requests.
 *
 * Environment variables consumed:
 *   PROXY  — proxy URL, e.g. "http://my-proxy:8080"
 *            When absent or empty, all helpers return null / false.
 *
 * Only VM_SERVER_URL requests are ever proxied; this service deliberately
 * refuses to proxy any other destination.
 *
 * The axios proxy config produced here is the standard shape:
 *   { protocol, host, port, auth? }
 *
 * The agent returned by getProxyAgent() is an https-proxy-agent instance
 * (a transitive dep — already in node_modules) and should be passed as
 *   fetch(url, { agent })
 * or
 *   axios.post(url, data, { httpsAgent: agent })
 */
import { Injectable, Logger } from '@nestjs/common';
import { parseProxyUrl, buildAxiosProxyConfig, buildProxyAgent, AxiosProxyConfig } from './proxy-config';

@Injectable()
export class VmProxyService {
  private readonly logger = new Logger(VmProxyService.name);

  /** True when a PROXY env var is present and valid */
  get isConfigured(): boolean {
    return parseProxyUrl(process.env.PROXY ?? '') !== null;
  }

  /**
   * Returns the standard axios `proxy` config object for VM_SERVER_URL requests,
   * or null when no proxy is configured.
   *
   * Usage with axios:
   *   const proxyConfig = vmProxy.getProxyConfigForVmServer();
   *   await axios.post(url, data, proxyConfig ? { proxy: proxyConfig } : undefined);
   */
  getProxyConfigForVmServer(): AxiosProxyConfig | null {
    const proxyUrl = parseProxyUrl(process.env.PROXY ?? '');
    if (!proxyUrl) {
      this.logger.debug('[VmProxy] PROXY env not set — direct connection');
      return null;
    }

    const config = buildAxiosProxyConfig(proxyUrl);
    this.logger.log(
      `[VmProxy] proxy configured: ${config.protocol}://${config.host}:${config.port}`,
    );
    return config;
  }

  /**
   * Returns an https-proxy-agent bound to the PROXY URL, or null when no proxy
   * is configured.
   *
   * Usage with native fetch:
   *   const agent = vmProxy.getProxyAgent();
   *   await fetch(url, { agent });
   *
   * Usage with axios (for https URLs):
   *   const agent = vmProxy.getProxyAgent();
   *   await axios.post(url, data, { httpsAgent: agent });
   */
  getProxyAgent(): unknown | null {
    const proxyUrl = parseProxyUrl(process.env.PROXY ?? '');
    if (!proxyUrl) return null;
    return buildProxyAgent(proxyUrl);
  }
}