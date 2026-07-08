import { Module } from '@nestjs/common';
import { EndpointLoggerService } from './endpoint-logger.service';

@Module({
  providers: [EndpointLoggerService],
  exports: [EndpointLoggerService],
})
export class EndpointLoggerModule {}