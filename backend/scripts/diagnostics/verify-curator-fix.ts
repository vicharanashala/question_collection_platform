// Diagnostic script — calls CuratorService directly to verify the dashboard fix.
// Uses the same NestJS DI graph the running API uses, but bypasses HTTP/auth.
import 'dotenv/config';
import * as dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { CuratorService } from '../../src/modules/admin/curator.service';

async function main() {
  // Build a minimal Nest app context (skip HTTP server, just DI)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  await app.init();
  console.log('[verify] app context ready');

  const svc = app.get(CuratorService);
  const result = await svc.getCuratorStats();
  console.log('[verify] getCuratorStats result:');
  console.log(JSON.stringify(result, null, 2));

  await app.close();
}

main().catch((e) => {
  console.error('[verify] failed:', e);
  process.exit(1);
});