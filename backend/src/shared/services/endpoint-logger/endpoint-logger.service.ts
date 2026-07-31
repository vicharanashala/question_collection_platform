import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost, ModulesContainer, Reflector } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { NestApplication } from '@nestjs/core';

/** Route entry ready for table rendering. */
export interface EndpointEntry {
  index: number;
  method: string;
  path: string;
  controller: string;
  auth: string;
  description: string;
}

// ── ANSI theme (green) ────────────────────────────────────────────────────────
const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const GREEN   = '\x1b[38;5;34m';
const LGREEN  = '\x1b[38;5;82m';
const CYAN    = '\x1b[36m';
const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const MAGENTA = '\x1b[35m';

const METHOD_COLOR: Record<string, string> = {
  GET:     GREEN,
  POST:    CYAN,
  PATCH:   YELLOW,
  PUT:     MAGENTA,
  DELETE:  RED,
  OPTIONS: DIM,
  HEAD:    DIM,
};

@Injectable()
export class EndpointLoggerService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Endpoints');
  private readonly scanner = new MetadataScanner();

  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap() {
    // Small delay ensures the router is fully wired
    // setTimeout(() => { this.logEndpoints(); }, 100); // temporarily disabled for diagnostics
  }

  /** Call from main.ts after `await app.listen()` for complete results. */
  async logEndpoints(): Promise<void> {
    const entries = this.collectEntries();
    this.printTable(entries);
  }

  // ── Route collection via ModulesContainer + Express router ─────────────────

  /**
   * Walk every loaded module's controllers, resolve their paths from
   * decorators, then cross-reference with the Express route stack to get
   * method-level auth/throttle/cache metadata.
   */
  private collectEntries(): EndpointEntry[] {
    // Build { expressPath -> { ctrlName, methods: [{ method, handler, path }] } }
    const ctrlMap = this.walkControllers();

    // Fallback: use Express stack directly when no decorators found
    const expressEntries = ctrlMap.size === 0
      ? this.collectFromExpressStack()
      : this.enrichFromExpress(ctrlMap);

    expressEntries.sort((a, b) => a.path.localeCompare(b.path));
    expressEntries.forEach((e, i) => (e.index = i + 1));
    return expressEntries;
  }

  /** Walk ModulesContainer → controllers → decorator metadata. */
  private walkControllers(): Map<string, { ctrlName: string; methods: ExpressMethod[] }> {
    const ctrlMap = new Map<string, { ctrlName: string; methods: ExpressMethod[] }>();

    // ModulesContainer extends Map<string, NestJSModule> — iterate with .values()
    // to get the actual NestJS Module objects, not the keys
    for (const mod of this.modulesContainer.values()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controllers: Map<string, any> = (mod as any)._controllers ?? (mod as any).controllers;
      if (!controllers || controllers.size === 0) continue;

      for (const [, instanceWrapper] of controllers) {
        const metatype = instanceWrapper.metatype;
        if (!metatype) continue;

        const ctrlName  = metatype.name;
        // Controller-level @Controller('path') stores a string; method-level stores string[]
        const rawCtrlPaths = this.reflector.getAllAndOverride<string | string[]>('path', [metatype]);
        const ctrlPaths: string[] = rawCtrlPaths
          ? Array.isArray(rawCtrlPaths) ? rawCtrlPaths : [rawCtrlPaths]
          : [];

        // Scan every public method on the prototype chain
        const methodNames = this.scanner.getAllMethodNames(metatype.prototype);
        for (const methodName of methodNames) {
          const handler = metatype.prototype[methodName];
          // Method-level @Get('/path') stores a string or string[] — normalise to array
          const rawMpaths = this.reflector.getAllAndOverride<string | string[]>('path', [handler]);
          if (!rawMpaths) continue; // not a route handler
          const mpaths: string[] = Array.isArray(rawMpaths) ? rawMpaths : [rawMpaths];

          const mex       = this.reflector.getAllAndOverride<RequestMethod>('requestMethod', [handler]);
          const httpMethod = this.requestMethodToString(mex);

          for (const mp of mpaths) {
            for (const cp of ctrlPaths) {
              const fullPath = this.joinPath(cp, mp);
              if (!ctrlMap.has(fullPath)) {
                ctrlMap.set(fullPath, { ctrlName, methods: [] });
              }
              ctrlMap.get(fullPath)!.methods.push({ method: httpMethod, handler, path: fullPath });
            }
          }
        }
      }
    }
    return ctrlMap;
  }

  /** Fallback: read routes directly from Express's _router.stack. */
  private collectFromExpressStack(): EndpointEntry[] {
    const entries: EndpointEntry[] = [];
    const stack = this.getExpressStack();
    if (!stack) return [];

    for (const layer of stack) {
      if (!layer.route) continue;
      const path    = layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .map((m) => m.toUpperCase())
        .filter((m) => m !== '_ALL');
      const ctrlName = this.resolveControllerName(layer.handle, path);
      const desc     = this.describeHandler(layer.handle, path, methods[0] ?? 'GET');

      for (const method of methods) {
        entries.push({
          index:       0,
          method,
          path:        this.stripPrefix(path),
          controller:  ctrlName,
          auth:        `${GREEN}Protected${RESET}`,
          description: desc,
        });
      }
    }
    return entries;
  }

  /**
   * Primary path: use ModulesContainer controller names + paths, then enrich
   * with auth/throttle/cache from the Express layer (which has the Guard/
   * Interceptor metadata resolved).
   */
  private enrichFromExpress(
    ctrlMap: Map<string, { ctrlName: string; methods: ExpressMethod[] }>,
  ): EndpointEntry[] {
    const expressStack = this.getExpressStack() ?? [];
    // Build a fast lookup: "METHOD /path" -> expressLayer
    const expressLayers = new Map<string, any>();
    for (const layer of expressStack) {
      if (!layer.route) continue;
      const path    = layer.route.path;
      const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all');
      for (const m of methods) {
        expressLayers.set(`${m.toUpperCase()}:${path}`, layer);
      }
    }

    const entries: EndpointEntry[] = [];

    for (const [expressPath, { ctrlName, methods }] of ctrlMap) {
      for (const { method, handler } of methods) {
        const layer = expressLayers.get(`${method}:${expressPath}`);
        const isPublic = layer ? this.isPublic(layer.handle) : this.isPublic(handler);
        const desc     = this.describeHandler(handler, expressPath, method);

        entries.push({
          index:       0,
          method,
          path:        this.stripPrefix(expressPath),
          controller:  ctrlName,
          auth:        isPublic ? `${LGREEN}Public${RESET}` : `${GREEN}Protected${RESET}`,
          description: desc,
        });
      }
    }
    return entries;
  }

  // ── Express stack helper ───────────────────────────────────────────────────

  private getExpressStack(): any[] | undefined {
    const adapter = this.httpAdapterHost.httpAdapter;
    if (!adapter) return undefined;
    const app = adapter.getInstance?.();
    return app?._router?.stack ?? app?.router?.stack;
  }

  // ── Metadata helpers ───────────────────────────────────────────────────────

  private isPublic(handler: Function): boolean {
    if (!handler) return false;
    return !!this.reflector.getAllAndOverride<boolean>('isPublic', [handler]);
  }



  // ── Description builder ───────────────────────────────────────────────────

  private describeHandler(handler: Function, path: string, method: string): string {
    // Try to read @Description() or summary from handler
    const desc = this.reflector.getAllAndOverride<string>('description', [handler]);
    if (desc) return desc;

    // Derive from method name: "getUserProfile" -> "User Profile"
    const hName = handler?.name ?? '';
    const cleaned = hName
      .replace(/^get|post|patch|put|delete|create|update|remove|submit|request/i, '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();

    if (cleaned && cleaned !== hName) return cleaned;

    // Fall back to last URL segment
    const segs    = path.split('/').filter(Boolean);
    const last    = segs[segs.length - 1] ?? '';
    const segName = last.replace(/:[^/]+/g, '_').replace(/[_-]/g, ' ');
    return segName ? segName.replace(/^./, (s) => s.toUpperCase()) : method;
  }

  private resolveControllerName(handle: Function, path: string): string {
    if (!handle) return 'Function';
    if (handle.prototype?.constructor?.name && handle.prototype.constructor.name !== 'Object') {
      return handle.prototype.constructor.name;
    }
    if (handle.name && handle.name !== 'bound fn' && !handle.name.includes('.')) {
      return handle.name;
    }
    // Derive from path: /admin/users -> AdminController
    const segs = path.split('/').filter(Boolean);
    if (segs.length >= 2) {
      return segs
        .slice(0, -1)
        .map((s) => s.replace(/^./, (c) => c.toUpperCase()))
        .join('');
    }
    return 'Function';
  }

  // ── Path helpers ───────────────────────────────────────────────────────────

  private joinPath(controllerPath: string, methodPath: string): string {
    const base = controllerPath.replace(/\/$/, '');
    const full = methodPath.startsWith('/') ? methodPath : `/${methodPath}`;
    return `${base}${full}`.replace(/\/+/g, '/') || '/';
  }

  private stripPrefix(path: string): string {
    return path.replace(/^\/api\/v1/, '').replace(/^\/+/, '') || '/';
  }

  private requestMethodToString(m?: RequestMethod): string {
    const map: Partial<Record<RequestMethod, string>> = {
      [RequestMethod.GET]:     'GET',
      [RequestMethod.POST]:    'POST',
      [RequestMethod.PUT]:     'PUT',
      [RequestMethod.PATCH]:   'PATCH',
      [RequestMethod.DELETE]:  'DELETE',
      [RequestMethod.OPTIONS]: 'OPTIONS',
      [RequestMethod.HEAD]:    'HEAD',
      [RequestMethod.ALL]:     'ALL',
    };
    return m !== undefined && m !== null ? (map[m] ?? `METHOD(${m})`) : 'GET';
  }

  // ── Table printing ─────────────────────────────────────────────────────────

  private printTable(entries: EndpointEntry[]): void {
    if (entries.length === 0) {
      this.logger.warn('No endpoints discovered — is the app fully bootstrapped?');
      return;
    }

    const W = 156;

    const COL = {
      n: 4,    // #
      m: 8,    // Method
      p: 64,   // Path
      c: 26,   // Controller
      a: 11,   // Auth
      d: 39,   // Description
    };

    const sep = '│' + '─'.repeat(W) + '│';

    const pad = (s: string, n: number) => {
      const bare = s.replace(/\x1b\[[0-9;]*m/g, '');
      return s + ' '.repeat(Math.max(0, n - bare.length));
    };

    const cell = (s: string, n: number) => ' ' + pad(s, n - 1);

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    this.log('');
    this.log(sep);
    this.log(
      `│${BOLD}${LGREEN}${' Agriculture QC API — Registered Endpoints '.padEnd(W)}${RESET}│`,
    );
    this.log(`│${DIM}${now}${' '.repeat(W - now.length - 1)}${RESET}│`);
    this.log(
      `│${LGREEN}${entries.length} endpoint${entries.length !== 1 ? 's' : ''} registered`
      + `${' '.repeat(W - String(entries.length).length - 24)}${RESET}│`,
    );
    this.log(sep);
    this.log(
      '│'
      + cell(`${BOLD}#${RESET}`,             COL.n)
      + cell(`${BOLD}Method${RESET}`,         COL.m)
      + cell(`${BOLD}Path${RESET}`,           COL.p)
      + cell(`${BOLD}Controller${RESET}`,     COL.c)
      + cell(`${BOLD}Auth${RESET}`,           COL.a)
      + cell(`${BOLD}Description${RESET}`,    COL.d)
      + '│',
    );
    this.log(
      '├' + '─'.repeat(COL.n) + '┼' + '─'.repeat(COL.m) + '┼'
      + '─'.repeat(COL.p) + '┼' + '─'.repeat(COL.c) + '┼'
      + '─'.repeat(COL.a) + '┤' + '─'.repeat(COL.d) + '┤',
    );

    for (const e of entries) {
      const mc   = METHOD_COLOR[e.method] ?? '';
      const mStr = `${mc}${BOLD}${e.method}${RESET}`;
      const desc = e.description.length > COL.d - 2
        ? e.description.slice(0, COL.d - 5) + '…'
        : e.description;

      this.log('│'
        + cell(`${DIM}${e.index}${RESET}`,       COL.n)
        + cell(mStr,                              COL.m)
        + cell(`  ${e.path}`,                    COL.p)
        + cell(`${DIM}${e.controller}${RESET}`,  COL.c)
        + cell(`  ${e.auth}`,                    COL.a)
        + cell(`  ${desc}`,                      COL.d)
        + '│');
    }

    this.log(sep);
    this.log('');
  }

  private log(msg: string): void {
    console.log(msg);
  }
}

interface ExpressMethod {
  method:  string;
  handler: Function;
  path:    string;
}