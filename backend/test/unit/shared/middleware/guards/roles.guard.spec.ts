import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../../../src/shared/middleware/guards/roles.guard';
import { UserRole } from '../../../../../src/shared/classes/enums';
import { createHttpContext } from '../../../../helpers/execution-context';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const contextFor = (requiredRoles: UserRole[] | undefined, role?: UserRole) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
    return createHttpContext({ request: { user: role ? { id: 'u1', role } : undefined } });
  };

  it('allows routes without @Roles metadata', () => {
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('allows routes with an empty role list', () => {
    expect(guard.canActivate(contextFor([]))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    expect(guard.canActivate(contextFor([UserRole.ADMIN, UserRole.FINANCE], UserRole.FINANCE))).toBe(true);
  });

  it('rejects a user whose role is not listed and names the required roles', () => {
    const context = contextFor([UserRole.ADMIN, UserRole.SUPER_ADMIN], UserRole.CURATOR);

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Access denied. Required role: admin or super_admin'),
    );
  });

  it('rejects requests without an authenticated user', () => {
    expect(() => guard.canActivate(contextFor([UserRole.ADMIN]))).toThrow(ForbiddenException);
  });

  it('does not treat super_admin as an implicit match for other roles', () => {
    expect(() => guard.canActivate(contextFor([UserRole.FINANCE], UserRole.SUPER_ADMIN))).toThrow(ForbiddenException);
  });
});
