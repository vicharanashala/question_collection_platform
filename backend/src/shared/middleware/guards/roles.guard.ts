import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../classes/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: { role: UserRole; id: string; mobileNumber: string } }>();
    const userRole = request.user?.role;

    // Temporary debug — surfaces the JWT-decoded role vs the @Roles decorator
    // requirement so we can diagnose the "Access denied" 403s distributor users
    // are seeing. Leave this on until confirmed fixed; safe in prod (just logs).
    // eslint-disable-next-line no-console

    if (!userRole) {
      throw new ForbiddenException('Access denied');
    }

    const hasRole = requiredRoles.includes(userRole as UserRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}