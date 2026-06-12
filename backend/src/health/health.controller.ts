import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipJwtAuth } from '../auth/decorators/skip-jwt-auth.decorator';

@Controller()
export class HealthController {
  @SkipJwtAuth()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @SkipJwtAuth()
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}