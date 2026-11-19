import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest(err: any, user: any, info: any) {
    // If a valid user exists, attach it to the request.
    // If no token is supplied, allow anonymous access.
    // If an invalid token is supplied, reject the request.
    if (err || (info && !user)) {
      if (err) throw err;

      // Allow missing credentials, reject invalid credentials.
      if (info?.name === "TokenExpiredError" ||
          info?.name === "JsonWebTokenError") {
        throw info;
      }
    }

    return user || null;
  }
}