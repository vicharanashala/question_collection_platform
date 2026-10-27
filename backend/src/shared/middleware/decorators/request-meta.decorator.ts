import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UAParser } from "ua-parser-js";
export interface RequestMeta {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;

}

export const ReqMeta = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestMeta => {
    const req = ctx.switchToHttp().getRequest();
    const userAgent: string | undefined = req.headers?.["user-agent"]?.slice(0, 512);
    const ua = userAgent ? new UAParser(userAgent).getResult() : undefined;

    const join = (name?: string, version?: string) =>
      name ? [name, version].filter(Boolean).join(" ") : undefined;

    return {
      requestId: req.id,
      ipAddress: req.ip,
      userAgent,
      browser: join(ua?.browser.name, ua?.browser.major),
      os: join(ua?.os.name, ua?.os.version),
      // the parser leaves device.type empty for desktops
      device: userAgent ? ua?.device.type ?? "desktop" : undefined,
    };
  },
);