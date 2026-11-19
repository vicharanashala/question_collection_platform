import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Restricts a route to local development. Runs before validation, so deployed
 * environments reject the request without touching the handler.
 *
 * NODE_ENV must be set to "development" explicitly. An unset value is rejected,
 * so a misconfigured server never exposes developer-only routes.
 */
@Injectable()
export class DevelopmentOnlyGuard implements CanActivate {
  // Allows the request only when NODE_ENV is exactly "development".
  canActivate(): boolean {
    if (process.env.NODE_ENV?.toLowerCase() !== 'development') {
      throw new ForbiddenException('This endpoint is only available when NODE_ENV is development');
    }
    return true;
  }
}
