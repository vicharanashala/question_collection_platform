import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const incoming = req.headers["x-request-id"];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    req.id =
      candidate && /^[\w-]{8,64}$/.test(candidate) ? candidate : randomUUID();
    res.setHeader("x-request-id", req.id);
    next();
  }
}
