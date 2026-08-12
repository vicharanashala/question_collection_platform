// WebSocket bootstrap — call setupWebSocket(app) in bootstrap() after listen().
// TODO: install @nestjs/platform-socket.io and implement WebSocket gateways
// under src/modules/<name>/websocket.gateway.ts

import { INestApplication, Logger } from '@nestjs/common';

const logger = new Logger('WebSocket');

/**
 * Attaches a WebSocket adapter to the NestJS app.
 * Placeholder until the socket.io adapter is installed.
 */
export function setupWebSocket(app: INestApplication): void {
  logger.log('WebSocket setup placeholder — install @nestjs/platform-socket.io to enable');
  // TODO: app.useWebSocketAdapter(new MyWebSocketAdapter(app));
}

/**
 * WebSocket gateway stubs — add one file per module under:
 *   src/modules/<name>/websocket.gateway.ts
 *
 * Example:
 *   @WebSocketGateway({ cors: { origin: '*' } })
 *   export class AuthWebSocketGateway { ... }
 */