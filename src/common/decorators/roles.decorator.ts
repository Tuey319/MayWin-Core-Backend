// src/common/guards/roles.guard.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Key used by RolesGuard to read required roles
 */
export const ROLES_KEY = 'roles';

/**
 * Attach required roles to a route or controller
 *
 * Usage:
 *   @Roles('ADMIN')
 *   @Roles('ADMIN', 'MANAGER')
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
