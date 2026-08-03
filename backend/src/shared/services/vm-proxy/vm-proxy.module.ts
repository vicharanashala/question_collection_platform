import { Global, Module } from '@nestjs/common';
import { VmProxyService } from './vm-proxy.service';

@Global()
@Module({
  providers: [VmProxyService],
  exports: [VmProxyService],
})
export class VmProxyModule {}