import { applyDecorators, UseGuards } from '@nestjs/common';
import { SkipJwtAuth } from '../../../modules/auth/decorators/skip-jwt-auth.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';

/**
 * Composite decorator for service-to-service endpoints.
 * Skips the class-level JwtAuthGuard and applies ApiKeyGuard instead.
 *
 * Usage:
 *   @ApiKeyAuth()
 *   @Get('some-endpoint')
 *   async handler() { ... }
 */
export const ApiKeyAuth = () =>
  applyDecorators(SkipJwtAuth(), UseGuards(ApiKeyGuard));
