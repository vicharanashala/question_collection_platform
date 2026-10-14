import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestMeta {
  requestId?: string;
  ipAddress?: string;
}

export const ReqMeta = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestMeta => {
    const req = ctx.switchToHttp().getRequest();
    return { requestId: req.id, ipAddress: req.ip };
  },
);