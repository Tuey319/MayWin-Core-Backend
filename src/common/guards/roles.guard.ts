// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role hierarchy — ordered from least to most privileged.
 * The array index is the "level" used for comparison.
 */
const ROLE_HIERARCHY = [
  'nurse',
  'head_nurse',
  'department_head',
  'hospital_admin',
  'super_admin',
] as const;

function normalizeRole(role: string): string {
  return String(role).toLowerCase().replace(/[-\s]/g, '_');
}

function roleLevel(role: string): number {
  return ROLE_HIERARCHY.indexOf(normalizeRole(role) as any);
}

function userMaxLevel(roles: string[]): number {
  return roles.reduce((max, r) => Math.max(max, roleLevel(r)), -1);
}

/**
 * Guards routes decorated with @Roles('ROLE_NAME').
 *
 * Semantics: @Roles('HEAD_NURSE') means the caller must be HEAD_NURSE **or higher**
 * in the role hierarchy.  Endpoints without @Roles() are not restricted by this guard.
 *
 * Registration: registered globally via APP_GUARD in AppModule so it applies to every
 * controller automatically.  No need to add @UseGuards(RolesGuard) per controller.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() annotation — no role restriction on this endpoint
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Insufficient role');
    }

    const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [];
    const userLevel = userMaxLevel(userRoles);

    // @Roles('A', 'B') means "A or B or higher" — take the lowest of the two.
    const minRequired = requiredRoles
      .map(r => roleLevel(r))
      .filter(l => l >= 0)
      .reduce((min, l) => Math.min(min, l), Infinity);

    if (minRequired === Infinity) {
      // @Roles() called with an unrecognised role name — deny by default (fail-closed).
      throw new ForbiddenException('Insufficient role');
    }

    if (userLevel < minRequired) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
